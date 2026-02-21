// Control Tower - Settings Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{ClaudeStatus, Settings};
use crate::pty::TerminalManagerState;
use rusqlite::params;
use std::process::Command;
use std::sync::Arc;
use tauri_plugin_dialog::DialogExt;

type DbState = Arc<crate::db::DbPool>;

#[tauri::command]
pub async fn get_settings(db: tauri::State<'_, DbState>) -> Result<Settings, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut settings = Settings::default();

    // Load settings from database
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        })
        .map_err(|e| e.to_string())?;

    for row in rows {
        if let Ok((key, value)) = row {
            match key.as_str() {
                "theme" => settings.theme = value,
                "start_on_login" => settings.start_on_login = value == "true",
                "default_cost_limit" => settings.default_cost_limit = value.parse().unwrap_or(50.0),
                "notifications_enabled" => settings.notifications_enabled = value == "true",
                "notify_on_complete" => settings.notify_on_complete = value == "true",
                "notify_on_error" => settings.notify_on_error = value == "true",
                "notify_cost_threshold" => settings.notify_cost_threshold = value.parse().ok(),
                // Cost threshold system
                "cost_thresholds_enabled" => settings.cost_thresholds_enabled = value == "true",
                "warn_cost" => settings.warn_cost = value.parse().unwrap_or(10.0),
                "alert_cost" => settings.alert_cost = value.parse().unwrap_or(25.0),
                "stop_cost" => settings.stop_cost = value.parse().unwrap_or(50.0),
                // Theme/appearance
                "accent_color" => settings.accent_color = value,
                "ui_density" => settings.ui_density = value,
                "font_size_scale" => settings.font_size_scale = value.parse().unwrap_or(1.0),
                "font_family" => settings.font_family = value,
                // Startup behavior
                "auto_open_last_project" => settings.auto_open_last_project = value == "true",
                "window_state" => settings.window_state = value,
                // Notification granularity
                "notify_on_phase_complete" => settings.notify_on_phase_complete = value == "true",
                "notify_on_cost_warning" => settings.notify_on_cost_warning = value == "true",
                // Advanced
                "debug_logging" => settings.debug_logging = value == "true",
                // Terminal persistence
                "use_tmux" => settings.use_tmux = value == "true",
                _ => {}
            }
        }
    }

    Ok(settings)
}

#[tauri::command]
pub async fn update_settings(
    db: tauri::State<'_, DbState>,
    terminal_manager: tauri::State<'_, TerminalManagerState>,
    settings: Settings,
) -> Result<Settings, String> {
    // Update TerminalManager's use_tmux preference at runtime
    {
        let mut tm = terminal_manager.lock().await;
        tm.set_use_tmux(settings.use_tmux);
    }

    let db = db.write().await;
    let conn = db.conn();

    // Helper function to upsert a setting
    let upsert = |key: &str, value: &str| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
            params![key, value],
        )?;
        Ok(())
    };

    upsert("theme", &settings.theme).map_err(|e| e.to_string())?;
    upsert("start_on_login", &settings.start_on_login.to_string()).map_err(|e| e.to_string())?;
    upsert("default_cost_limit", &settings.default_cost_limit.to_string()).map_err(|e| e.to_string())?;
    upsert(
        "notifications_enabled",
        &settings.notifications_enabled.to_string(),
    )
    .map_err(|e| e.to_string())?;
    upsert(
        "notify_on_complete",
        &settings.notify_on_complete.to_string(),
    )
    .map_err(|e| e.to_string())?;
    upsert("notify_on_error", &settings.notify_on_error.to_string()).map_err(|e| e.to_string())?;

    if let Some(threshold) = settings.notify_cost_threshold {
        upsert("notify_cost_threshold", &threshold.to_string()).map_err(|e| e.to_string())?;
    }

    // Cost threshold system
    upsert(
        "cost_thresholds_enabled",
        &settings.cost_thresholds_enabled.to_string(),
    )
    .map_err(|e| e.to_string())?;
    upsert("warn_cost", &settings.warn_cost.to_string()).map_err(|e| e.to_string())?;
    upsert("alert_cost", &settings.alert_cost.to_string()).map_err(|e| e.to_string())?;
    upsert("stop_cost", &settings.stop_cost.to_string()).map_err(|e| e.to_string())?;

    // Theme/appearance
    upsert("accent_color", &settings.accent_color).map_err(|e| e.to_string())?;
    upsert("ui_density", &settings.ui_density).map_err(|e| e.to_string())?;
    upsert("font_size_scale", &settings.font_size_scale.to_string()).map_err(|e| e.to_string())?;
    upsert("font_family", &settings.font_family).map_err(|e| e.to_string())?;

    // Startup behavior
    upsert(
        "auto_open_last_project",
        &settings.auto_open_last_project.to_string(),
    )
    .map_err(|e| e.to_string())?;
    upsert("window_state", &settings.window_state).map_err(|e| e.to_string())?;

    // Notification granularity
    upsert(
        "notify_on_phase_complete",
        &settings.notify_on_phase_complete.to_string(),
    )
    .map_err(|e| e.to_string())?;
    upsert(
        "notify_on_cost_warning",
        &settings.notify_on_cost_warning.to_string(),
    )
    .map_err(|e| e.to_string())?;

    // Advanced
    upsert("debug_logging", &settings.debug_logging.to_string()).map_err(|e| e.to_string())?;

    // Terminal persistence
    upsert("use_tmux", &settings.use_tmux.to_string()).map_err(|e| e.to_string())?;

    Ok(settings)
}

#[tauri::command]
pub async fn check_claude_status() -> Result<ClaudeStatus, String> {
    // Check if claude is in PATH
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

    let which_output = Command::new(which_cmd).arg("claude").output();

    let (installed, path) = match which_output {
        Ok(output) if output.status.success() => {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (true, Some(path))
        }
        _ => (false, None),
    };

    // Get Claude version if installed
    let version = if installed {
        Command::new("claude")
            .arg("--version")
            .output()
            .ok()
            .and_then(|output| {
                if output.status.success() {
                    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    version_str.split_whitespace().last().map(|v| v.to_string())
                } else {
                    None
                }
            })
    } else {
        None
    };

    Ok(ClaudeStatus {
        installed,
        version,
        path,
    })
}

// Reset all settings to defaults
#[tauri::command]
pub async fn reset_settings(db: tauri::State<'_, DbState>) -> Result<Settings, String> {
    let db = db.write().await;
    let conn = db.conn();

    conn.execute("DELETE FROM settings", [])
        .map_err(|e| e.to_string())?;

    tracing::info!("Settings reset to defaults");
    Ok(Settings::default())
}

// Import settings from a JSON file
#[tauri::command]
pub async fn import_settings(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
) -> Result<Settings, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::FilePath;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .add_filter("JSON", &["json"])
        .pick_file(move |path| {
            let _ = tx.send(path);
        });

    let file_path = match rx.recv() {
        Ok(Some(file_path)) => match file_path {
            FilePath::Path(p) => p,
            FilePath::Url(u) => {
                return Err(format!("URL paths not supported: {}", u));
            }
        },
        Ok(None) => return Err("Import cancelled".to_string()),
        Err(_) => return Err("Dialog was cancelled".to_string()),
    };

    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let settings: Settings =
        serde_json::from_str(&content).map_err(|e| format!("Invalid settings file: {}", e))?;

    // Apply imported settings to the database using the same upsert logic
    let db = db.write().await;
    let conn = db.conn();

    let upsert = |key: &str, value: &str| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
            params![key, value],
        )?;
        Ok(())
    };

    upsert("theme", &settings.theme).map_err(|e| e.to_string())?;
    upsert("start_on_login", &settings.start_on_login.to_string()).map_err(|e| e.to_string())?;
    upsert("default_cost_limit", &settings.default_cost_limit.to_string()).map_err(|e| e.to_string())?;
    upsert("notifications_enabled", &settings.notifications_enabled.to_string()).map_err(|e| e.to_string())?;
    upsert("notify_on_complete", &settings.notify_on_complete.to_string()).map_err(|e| e.to_string())?;
    upsert("notify_on_error", &settings.notify_on_error.to_string()).map_err(|e| e.to_string())?;
    if let Some(threshold) = settings.notify_cost_threshold {
        upsert("notify_cost_threshold", &threshold.to_string()).map_err(|e| e.to_string())?;
    }
    upsert("cost_thresholds_enabled", &settings.cost_thresholds_enabled.to_string()).map_err(|e| e.to_string())?;
    upsert("warn_cost", &settings.warn_cost.to_string()).map_err(|e| e.to_string())?;
    upsert("alert_cost", &settings.alert_cost.to_string()).map_err(|e| e.to_string())?;
    upsert("stop_cost", &settings.stop_cost.to_string()).map_err(|e| e.to_string())?;
    upsert("accent_color", &settings.accent_color).map_err(|e| e.to_string())?;
    upsert("ui_density", &settings.ui_density).map_err(|e| e.to_string())?;
    upsert("font_size_scale", &settings.font_size_scale.to_string()).map_err(|e| e.to_string())?;
    upsert("font_family", &settings.font_family).map_err(|e| e.to_string())?;
    upsert("auto_open_last_project", &settings.auto_open_last_project.to_string()).map_err(|e| e.to_string())?;
    upsert("window_state", &settings.window_state).map_err(|e| e.to_string())?;
    upsert("notify_on_phase_complete", &settings.notify_on_phase_complete.to_string()).map_err(|e| e.to_string())?;
    upsert("notify_on_cost_warning", &settings.notify_on_cost_warning.to_string()).map_err(|e| e.to_string())?;
    upsert("debug_logging", &settings.debug_logging.to_string()).map_err(|e| e.to_string())?;
    upsert("use_tmux", &settings.use_tmux.to_string()).map_err(|e| e.to_string())?;

    tracing::info!("Settings imported from {:?}", file_path);
    Ok(settings)
}
