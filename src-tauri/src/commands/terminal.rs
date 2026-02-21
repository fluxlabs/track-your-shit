// Track Your Shit - Terminal Commands
// Command history and script favorites management
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{
    CommandHistoryEntry, SaveTerminalSessionInput, ScriptFavorite, TerminalSession,
};
use rusqlite::params;
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

const MAX_HISTORY: i32 = 50;
const MAX_FAVORITES: usize = 5;

/// Get command history for a project
#[tauri::command]
pub async fn get_command_history(
    db: tauri::State<'_, DbState>,
    project_id: String,
    limit: Option<i32>,
) -> Result<Vec<CommandHistoryEntry>, String> {
    let db = db.write().await;
    let conn = db.conn();
    let limit = limit.unwrap_or(MAX_HISTORY);

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, command, source, created_at
             FROM command_history
             WHERE project_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map(params![project_id, limit], |row| {
            Ok(CommandHistoryEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                command: row.get(2)?,
                source: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

/// Add a command to history, auto-pruning to MAX_HISTORY entries
#[tauri::command]
pub async fn add_command_history(
    db: tauri::State<'_, DbState>,
    project_id: String,
    command: String,
    source: Option<String>,
) -> Result<CommandHistoryEntry, String> {
    let db = db.write().await;
    let conn = db.conn();
    let source = source.unwrap_or_else(|| "manual".to_string());

    let entry_id = format!("{:032x}", rand::random::<u128>());

    conn.execute(
        "INSERT INTO command_history (id, project_id, command, source)
         VALUES (?1, ?2, ?3, ?4)",
        params![entry_id, project_id, command, source],
    )
    .map_err(|e| e.to_string())?;

    // Auto-prune: keep only the most recent MAX_HISTORY entries
    conn.execute(
        "DELETE FROM command_history
         WHERE project_id = ?1
         AND id NOT IN (
             SELECT id FROM command_history
             WHERE project_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2
         )",
        params![project_id, MAX_HISTORY],
    )
    .map_err(|e| e.to_string())?;

    let entry = conn
        .query_row(
            "SELECT id, project_id, command, source, created_at
             FROM command_history WHERE id = ?1",
            params![entry_id],
            |row| {
                Ok(CommandHistoryEntry {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    command: row.get(2)?,
                    source: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(entry)
}

/// Clear all command history for a project
#[tauri::command]
pub async fn clear_command_history(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<i32, String> {
    let db = db.write().await;
    let conn = db.conn();

    let count = conn
        .execute(
            "DELETE FROM command_history WHERE project_id = ?1",
            params![project_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(count as i32)
}

/// Get script favorites for a project, ordered by order_index
#[tauri::command]
pub async fn get_script_favorites(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<ScriptFavorite>, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, script_id, order_index, created_at
             FROM script_favorites
             WHERE project_id = ?1
             ORDER BY order_index ASC",
        )
        .map_err(|e| e.to_string())?;

    let favorites = stmt
        .query_map(params![project_id], |row| {
            Ok(ScriptFavorite {
                id: row.get(0)?,
                project_id: row.get(1)?,
                script_id: row.get(2)?,
                order_index: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(favorites)
}

/// Toggle a script as favorite. Returns true if added, false if removed.
/// Enforces max 5 favorites per project.
#[tauri::command]
pub async fn toggle_script_favorite(
    db: tauri::State<'_, DbState>,
    project_id: String,
    script_id: String,
) -> Result<bool, String> {
    let db = db.write().await;
    let conn = db.conn();

    // Check if already favorited
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM script_favorites
             WHERE project_id = ?1 AND script_id = ?2",
            params![project_id, script_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if exists {
        // Remove favorite
        conn.execute(
            "DELETE FROM script_favorites WHERE project_id = ?1 AND script_id = ?2",
            params![project_id, script_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        // Check max limit
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM script_favorites WHERE project_id = ?1",
                params![project_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;

        if count as usize >= MAX_FAVORITES {
            return Err(format!(
                "Maximum of {} favorites reached. Remove one first.",
                MAX_FAVORITES
            ));
        }

        let fav_id = format!("{:032x}", rand::random::<u128>());
        conn.execute(
            "INSERT INTO script_favorites (id, project_id, script_id, order_index)
             VALUES (?1, ?2, ?3, ?4)",
            params![fav_id, project_id, script_id, count],
        )
        .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

/// Reorder script favorites by providing ordered list of script_ids
#[tauri::command]
pub async fn reorder_script_favorites(
    db: tauri::State<'_, DbState>,
    project_id: String,
    script_ids: Vec<String>,
) -> Result<(), String> {
    let db = db.write().await;
    let conn = db.conn();

    for (index, script_id) in script_ids.iter().enumerate() {
        conn.execute(
            "UPDATE script_favorites SET order_index = ?1
             WHERE project_id = ?2 AND script_id = ?3",
            params![index as i32, project_id, script_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

const MAX_SESSIONS: i32 = 10;

/// Save terminal sessions (replaces all existing). Used for session persistence.
#[tauri::command]
pub async fn save_terminal_sessions(
    db: tauri::State<'_, DbState>,
    sessions: Vec<SaveTerminalSessionInput>,
) -> Result<i32, String> {
    let db = db.write().await;
    let conn = db.conn();

    // Delete all existing sessions
    conn.execute("DELETE FROM terminal_sessions", [])
        .map_err(|e| e.to_string())?;

    // Insert new sessions (limit to MAX_SESSIONS)
    let count = sessions.len().min(MAX_SESSIONS as usize);
    for session in sessions.iter().take(count) {
        let session_id = format!("{:032x}", rand::random::<u128>());
        conn.execute(
            "INSERT INTO terminal_sessions (id, project_id, tab_name, tab_type, working_directory, sort_order, tmux_session)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                session_id,
                session.project_id,
                session.tab_name,
                session.tab_type,
                session.working_directory,
                session.sort_order,
                session.tmux_session,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(count as i32)
}

/// Restore terminal sessions from DB
#[tauri::command]
pub async fn restore_terminal_sessions(
    db: tauri::State<'_, DbState>,
) -> Result<Vec<TerminalSession>, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, tab_name, tab_type, working_directory, sort_order, tmux_session, created_at
             FROM terminal_sessions
             ORDER BY sort_order ASC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let sessions = stmt
        .query_map(params![MAX_SESSIONS], |row| {
            Ok(TerminalSession {
                id: row.get(0)?,
                project_id: row.get(1)?,
                tab_name: row.get(2)?,
                tab_type: row.get(3)?,
                working_directory: row.get(4)?,
                sort_order: row.get(5)?,
                tmux_session: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(sessions)
}
