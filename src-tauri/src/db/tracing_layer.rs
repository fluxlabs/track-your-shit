// Track Your Shit - Custom Tracing Subscriber Layer
// Captures Rust tracing events and writes to app_logs SQLite table
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tracing::field::{Field, Visit};
use tracing::{Event, Subscriber};
use tracing_subscriber::layer::Context;
use tracing_subscriber::Layer;

use crate::models::AppLogEvent;

/// Shared state that can be configured after the subscriber is initialized.
/// Both the DB connection and app handle are set during Tauri's `.setup()`.
#[derive(Clone)]
pub struct SqliteLayerHandle {
    conn: Arc<Mutex<Option<Connection>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl SqliteLayerHandle {
    /// Open the database connection at the given path.
    pub fn set_db_path(&self, path: PathBuf) {
        if let Ok(c) = Connection::open(&path) {
            if let Ok(mut conn) = self.conn.lock() {
                *conn = Some(c);
            }
        }
    }

    /// Set the Tauri AppHandle for real-time event emission.
    pub fn set_app_handle(&self, handle: AppHandle) {
        if let Ok(mut h) = self.app_handle.lock() {
            *h = Some(handle);
        }
    }
}

/// A tracing Layer that writes log events (info and above) to the app_logs SQLite table.
/// Uses its own rusqlite::Connection (not the async Tokio Mutex one) to avoid deadlocks.
pub struct SqliteLayer {
    conn: Arc<Mutex<Option<Connection>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl SqliteLayer {
    /// Create a new SqliteLayer and its handle for deferred configuration.
    pub fn new() -> (Self, SqliteLayerHandle) {
        let conn = Arc::new(Mutex::new(None));
        let app_handle = Arc::new(Mutex::new(None));

        let handle = SqliteLayerHandle {
            conn: conn.clone(),
            app_handle: app_handle.clone(),
        };

        let layer = Self { conn, app_handle };

        (layer, handle)
    }
}

/// Visitor that extracts the `message` and `project_id` fields from a tracing event.
struct MessageVisitor {
    message: String,
    project_id: Option<String>,
}

impl MessageVisitor {
    fn new() -> Self {
        Self {
            message: String::new(),
            project_id: None,
        }
    }
}

impl Visit for MessageVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{:?}", value);
            // Remove surrounding quotes if present
            if self.message.starts_with('"')
                && self.message.ends_with('"')
                && self.message.len() > 1
            {
                self.message = self.message[1..self.message.len() - 1].to_string();
            }
        } else if field.name() == "project_id" {
            let mut val = format!("{:?}", value);
            if val.starts_with('"') && val.ends_with('"') && val.len() > 1 {
                val = val[1..val.len() - 1].to_string();
            }
            self.project_id = Some(val);
        } else if self.message.is_empty() {
            // Fallback: use the first field
            self.message = format!("{} = {:?}", field.name(), value);
        }
    }

    fn record_str(&mut self, field: &Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        } else if field.name() == "project_id" {
            self.project_id = Some(value.to_string());
        }
    }
}

impl<S: Subscriber> Layer<S> for SqliteLayer {
    fn on_event(&self, event: &Event<'_>, _ctx: Context<'_, S>) {
        let level = *event.metadata().level();

        // Only store info+ in SQLite (trace/debug go to stdout only)
        if level > tracing::Level::INFO {
            return;
        }

        let level_str = match level {
            tracing::Level::ERROR => "error",
            tracing::Level::WARN => "warn",
            tracing::Level::INFO => "info",
            tracing::Level::DEBUG => "debug",
            tracing::Level::TRACE => "trace",
        };

        let target = event.metadata().target().to_string();

        let mut visitor = MessageVisitor::new();
        event.record(&mut visitor);
        let message = visitor.message;
        let project_id = visitor.project_id;

        if message.is_empty() {
            return;
        }

        // Write to SQLite
        let id = {
            let conn_guard = self.conn.lock().unwrap();
            if let Some(ref conn) = *conn_guard {
                let result = conn.query_row(
                    "INSERT INTO app_logs (level, target, message, source, project_id) VALUES (?1, ?2, ?3, 'backend', ?4) RETURNING id",
                    rusqlite::params![level_str, target, message, project_id],
                    |row| row.get::<_, String>(0),
                );
                result.ok()
            } else {
                None
            }
        };

        // Emit event for real-time streaming (if app handle is available)
        if let Some(ref log_id) = id {
            let handle_guard = self.app_handle.lock().unwrap();
            if let Some(ref app) = *handle_guard {
                let log_event = AppLogEvent {
                    id: log_id.clone(),
                    level: level_str.to_string(),
                    target: Some(target),
                    message,
                    source: "backend".to_string(),
                    project_id: project_id.clone(),
                    created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                };
                let _ = app.emit("log:new", &log_event);
            }
        }
    }
}
