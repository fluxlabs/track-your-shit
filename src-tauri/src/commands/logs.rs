// Control Tower - Application Log Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{
    AppLogEntry, AppLogEvent, AppLogFilters, AppLogStats, LevelCount, SourceCount,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Emitter;

type DbState = Arc<crate::db::DbPool>;

/// Query app logs with filters
#[tauri::command]
pub async fn get_app_logs(
    db: tauri::State<'_, DbState>,
    filters: AppLogFilters,
) -> Result<Vec<AppLogEntry>, String> {
    let conn = db.read().await;

    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref level) = filters.level {
        conditions.push(format!("level = ?{}", param_values.len() + 1));
        param_values.push(Box::new(level.clone()));
    }
    if let Some(ref source) = filters.source {
        conditions.push(format!("source = ?{}", param_values.len() + 1));
        param_values.push(Box::new(source.clone()));
    }
    if let Some(ref target) = filters.target {
        conditions.push(format!("target LIKE ?{}", param_values.len() + 1));
        param_values.push(Box::new(format!("%{}%", target)));
    }
    if let Some(ref project_id) = filters.project_id {
        if project_id == "__system__" {
            conditions.push("project_id IS NULL".to_string());
        } else {
            conditions.push(format!("project_id = ?{}", param_values.len() + 1));
            param_values.push(Box::new(project_id.clone()));
        }
    }
    if let Some(ref search) = filters.search {
        conditions.push(format!("message LIKE ?{}", param_values.len() + 1));
        param_values.push(Box::new(format!("%{}%", search)));
    }
    if let Some(ref before) = filters.before {
        conditions.push(format!("created_at < ?{}", param_values.len() + 1));
        param_values.push(Box::new(before.clone()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let limit = filters.limit.unwrap_or(100).min(500);

    let sql = format!(
        "SELECT id, level, target, message, source, project_id, metadata, created_at
         FROM app_logs {} ORDER BY created_at DESC LIMIT {}",
        where_clause, limit
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let logs: Vec<AppLogEntry> = stmt
        .query_map(params_refs.as_slice(), |row| {
            let metadata_str: Option<String> = row.get(6)?;
            Ok(AppLogEntry {
                id: row.get(0)?,
                level: row.get(1)?,
                target: row.get(2)?,
                message: row.get(3)?,
                source: row.get(4)?,
                project_id: row.get(5)?,
                metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(logs)
}

/// Get aggregate log statistics
#[tauri::command]
pub async fn get_app_log_stats(db: tauri::State<'_, DbState>) -> Result<AppLogStats, String> {
    let conn = db.read().await;

    let total: i32 = conn
        .query_row("SELECT COUNT(*) FROM app_logs", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let mut level_stmt = conn
        .prepare("SELECT level, COUNT(*) as cnt FROM app_logs GROUP BY level ORDER BY cnt DESC")
        .map_err(|e| e.to_string())?;

    let by_level: Vec<LevelCount> = level_stmt
        .query_map([], |row| {
            Ok(LevelCount {
                level: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut source_stmt = conn
        .prepare("SELECT source, COUNT(*) as cnt FROM app_logs GROUP BY source ORDER BY cnt DESC")
        .map_err(|e| e.to_string())?;

    let by_source: Vec<SourceCount> = source_stmt
        .query_map([], |row| {
            Ok(SourceCount {
                source: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(AppLogStats {
        total,
        by_level,
        by_source,
    })
}

/// Get distinct log levels present in the database
#[tauri::command]
pub async fn get_log_levels(db: tauri::State<'_, DbState>) -> Result<Vec<String>, String> {
    let conn = db.read().await;

    let mut stmt = conn
        .prepare("SELECT DISTINCT level FROM app_logs ORDER BY level")
        .map_err(|e| e.to_string())?;

    let levels: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(levels)
}

/// Clear app logs with optional filters
#[tauri::command]
pub async fn clear_app_logs(
    db: tauri::State<'_, DbState>,
    before: Option<String>,
    level: Option<String>,
) -> Result<i32, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut conditions: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref before_val) = before {
        conditions.push(format!("created_at < ?{}", param_values.len() + 1));
        param_values.push(Box::new(before_val.clone()));
    }
    if let Some(ref level_val) = level {
        conditions.push(format!("level = ?{}", param_values.len() + 1));
        param_values.push(Box::new(level_val.clone()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!("DELETE FROM app_logs {}", where_clause);

    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let deleted = conn
        .execute(&sql, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    Ok(deleted as i32)
}

/// Rotate app logs - delete logs older than retention period
/// Default retention: 30 days for info, 7 days for debug/trace
#[tauri::command]
pub async fn rotate_app_logs(
    db: tauri::State<'_, DbState>,
    retention_days: Option<i32>,
) -> Result<LogRotationResult, String> {
    let db = db.write().await;
    let conn = db.conn();

    let retention = retention_days.unwrap_or(30);
    let debug_retention = (retention / 4).max(7);

    // Delete old info/warn/error logs
    let deleted_info = conn.execute(
        "DELETE FROM app_logs WHERE created_at < datetime('now', ?1 || ' days') AND level IN ('info', 'warn', 'error')",
        params![format!("-{}", retention)],
    ).map_err(|e| e.to_string())? as i32;

    // Delete older debug/trace logs
    let deleted_debug = conn.execute(
        "DELETE FROM app_logs WHERE created_at < datetime('now', ?1 || ' days') AND level IN ('debug', 'trace')",
        params![format!("-{}", debug_retention)],
    ).map_err(|e| e.to_string())? as i32;

    // Get current log count
    let remaining: i32 = conn
        .query_row("SELECT COUNT(*) FROM app_logs", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    Ok(LogRotationResult {
        deleted_info,
        deleted_debug,
        remaining,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogRotationResult {
    pub deleted_info: i32,
    pub deleted_debug: i32,
    pub remaining: i32,
}

/// Log a frontend error (used by ErrorBoundary)
#[tauri::command]
pub async fn log_frontend_error(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
    error: String,
    project_id: Option<String>,
) -> Result<AppLogEntry, String> {
    let db = db.write().await;
    let conn = db.conn();

    let id: String = conn
        .query_row(
            "INSERT INTO app_logs (level, target, message, source, project_id)
             VALUES ('error', 'frontend.error_boundary', ?1, 'frontend', ?2)
             RETURNING id",
            params![error, project_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let entry = conn
        .query_row(
            "SELECT id, level, target, message, source, project_id, metadata, created_at
             FROM app_logs WHERE id = ?1",
            params![id],
            |row| {
                let metadata_str: Option<String> = row.get(6)?;
                Ok(AppLogEntry {
                    id: row.get(0)?,
                    level: row.get(1)?,
                    target: row.get(2)?,
                    message: row.get(3)?,
                    source: row.get(4)?,
                    project_id: row.get(5)?,
                    metadata: metadata_str.and_then(|s| serde_json::from_str(&s).ok()),
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Emit real-time event
    let event = AppLogEvent {
        id: entry.id.clone(),
        level: entry.level.clone(),
        target: entry.target.clone(),
        message: entry.message.clone(),
        source: entry.source.clone(),
        project_id: entry.project_id.clone(),
        created_at: entry.created_at.clone(),
    };
    let _ = app.emit("log:new", &event);

    Ok(entry)
}

/// Log a general frontend event
#[tauri::command]
pub async fn log_frontend_event(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
    level: String,
    message: String,
    target: Option<String>,
    project_id: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<AppLogEntry, String> {
    // Validate level
    let valid_levels = ["trace", "debug", "info", "warn", "error"];
    if !valid_levels.contains(&level.as_str()) {
        return Err(format!(
            "Invalid log level '{}'. Must be one of: {:?}",
            level, valid_levels
        ));
    }

    let db = db.write().await;
    let conn = db.conn();

    let metadata_str = metadata
        .as_ref()
        .map(|m| serde_json::to_string(m).unwrap_or_default());

    let id: String = conn
        .query_row(
            "INSERT INTO app_logs (level, target, message, source, project_id, metadata)
             VALUES (?1, ?2, ?3, 'frontend', ?4, ?5)
             RETURNING id",
            params![level, target, message, project_id, metadata_str],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let entry = conn
        .query_row(
            "SELECT id, level, target, message, source, project_id, metadata, created_at
             FROM app_logs WHERE id = ?1",
            params![id],
            |row| {
                let md_str: Option<String> = row.get(6)?;
                Ok(AppLogEntry {
                    id: row.get(0)?,
                    level: row.get(1)?,
                    target: row.get(2)?,
                    message: row.get(3)?,
                    source: row.get(4)?,
                    project_id: row.get(5)?,
                    metadata: md_str.and_then(|s| serde_json::from_str(&s).ok()),
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Emit real-time event
    let event = AppLogEvent {
        id: entry.id.clone(),
        level: entry.level.clone(),
        target: entry.target.clone(),
        message: entry.message.clone(),
        source: entry.source.clone(),
        project_id: entry.project_id.clone(),
        created_at: entry.created_at.clone(),
    };
    let _ = app.emit("log:new", &event);

    Ok(entry)
}
