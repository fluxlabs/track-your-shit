// Track Your Shit - Snippets & Auto-commands
// Saved command snippets and pre/post execution hooks
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{AutoCommand, AutoCommandInput, AutoCommandPreset, Snippet, SnippetInput};
use rusqlite::params;
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

// ============================================================
// Snippets
// ============================================================

/// List snippets for a project (includes global snippets where project_id IS NULL)
#[tauri::command]
pub async fn list_snippets(
    db: tauri::State<'_, DbState>,
    project_id: Option<String>,
) -> Result<Vec<Snippet>, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, label, command, description, category, created_at, updated_at
             FROM snippets
             WHERE project_id IS NULL OR project_id = ?1
             ORDER BY category ASC, label ASC",
        )
        .map_err(|e| e.to_string())?;

    let snippets = stmt
        .query_map(params![project_id], |row| {
            Ok(Snippet {
                id: row.get(0)?,
                project_id: row.get(1)?,
                label: row.get(2)?,
                command: row.get(3)?,
                description: row.get(4)?,
                category: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(snippets)
}

/// Create a new snippet
#[tauri::command]
pub async fn create_snippet(
    db: tauri::State<'_, DbState>,
    project_id: Option<String>,
    input: SnippetInput,
) -> Result<Snippet, String> {
    let db = db.write().await;
    let conn = db.conn();

    let snippet_id = format!("{:032x}", rand::random::<u128>());
    let category = input.category.unwrap_or_else(|| "general".to_string());

    conn.execute(
        "INSERT INTO snippets (id, project_id, label, command, description, category)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            snippet_id,
            project_id,
            input.label,
            input.command,
            input.description,
            category
        ],
    )
    .map_err(|e| e.to_string())?;

    let snippet = conn
        .query_row(
            "SELECT id, project_id, label, command, description, category, created_at, updated_at
             FROM snippets WHERE id = ?1",
            params![snippet_id],
            |row| {
                Ok(Snippet {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    label: row.get(2)?,
                    command: row.get(3)?,
                    description: row.get(4)?,
                    category: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(snippet)
}

/// Update an existing snippet
#[tauri::command]
pub async fn update_snippet(
    db: tauri::State<'_, DbState>,
    id: String,
    input: SnippetInput,
) -> Result<Snippet, String> {
    let db = db.write().await;
    let conn = db.conn();

    let category = input.category.unwrap_or_else(|| "general".to_string());

    conn.execute(
        "UPDATE snippets SET label = ?1, command = ?2, description = ?3, category = ?4, updated_at = datetime('now')
         WHERE id = ?5",
        params![input.label, input.command, input.description, category, id],
    )
    .map_err(|e| e.to_string())?;

    let snippet = conn
        .query_row(
            "SELECT id, project_id, label, command, description, category, created_at, updated_at
             FROM snippets WHERE id = ?1",
            params![id],
            |row| {
                Ok(Snippet {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    label: row.get(2)?,
                    command: row.get(3)?,
                    description: row.get(4)?,
                    category: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(snippet)
}

/// Delete a snippet
#[tauri::command]
pub async fn delete_snippet(db: tauri::State<'_, DbState>, id: String) -> Result<bool, String> {
    let db = db.write().await;
    let conn = db.conn();

    let count = conn
        .execute("DELETE FROM snippets WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

// ============================================================
// Auto-commands
// ============================================================

/// List auto-commands for a project, ordered by hook_type then order_index
#[tauri::command]
pub async fn list_auto_commands(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<AutoCommand>, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, label, command, hook_type, enabled, order_index, preset, created_at, updated_at
             FROM auto_commands
             WHERE project_id = ?1
             ORDER BY hook_type ASC, order_index ASC",
        )
        .map_err(|e| e.to_string())?;

    let commands = stmt
        .query_map(params![project_id], |row| {
            Ok(AutoCommand {
                id: row.get(0)?,
                project_id: row.get(1)?,
                label: row.get(2)?,
                command: row.get(3)?,
                hook_type: row.get(4)?,
                enabled: row.get(5)?,
                order_index: row.get(6)?,
                preset: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(commands)
}

/// Create a new auto-command
#[tauri::command]
pub async fn create_auto_command(
    db: tauri::State<'_, DbState>,
    project_id: String,
    input: AutoCommandInput,
) -> Result<AutoCommand, String> {
    let db = db.write().await;
    let conn = db.conn();

    let cmd_id = format!("{:032x}", rand::random::<u128>());
    let hook_type = input.hook_type.unwrap_or_else(|| "pre".to_string());

    // Get next order_index for this hook_type
    let next_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(order_index), -1) + 1 FROM auto_commands
             WHERE project_id = ?1 AND hook_type = ?2",
            params![project_id, hook_type],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO auto_commands (id, project_id, label, command, hook_type, order_index, preset)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            cmd_id,
            project_id,
            input.label,
            input.command,
            hook_type,
            next_order,
            input.preset
        ],
    )
    .map_err(|e| e.to_string())?;

    let auto_cmd = conn
        .query_row(
            "SELECT id, project_id, label, command, hook_type, enabled, order_index, preset, created_at, updated_at
             FROM auto_commands WHERE id = ?1",
            params![cmd_id],
            |row| {
                Ok(AutoCommand {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    label: row.get(2)?,
                    command: row.get(3)?,
                    hook_type: row.get(4)?,
                    enabled: row.get(5)?,
                    order_index: row.get(6)?,
                    preset: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(auto_cmd)
}

/// Update an auto-command
#[tauri::command]
pub async fn update_auto_command(
    db: tauri::State<'_, DbState>,
    id: String,
    input: AutoCommandInput,
) -> Result<AutoCommand, String> {
    let db = db.write().await;
    let conn = db.conn();

    let hook_type = input.hook_type.unwrap_or_else(|| "pre".to_string());

    conn.execute(
        "UPDATE auto_commands SET label = ?1, command = ?2, hook_type = ?3, updated_at = datetime('now')
         WHERE id = ?4",
        params![input.label, input.command, hook_type, id],
    )
    .map_err(|e| e.to_string())?;

    let auto_cmd = conn
        .query_row(
            "SELECT id, project_id, label, command, hook_type, enabled, order_index, preset, created_at, updated_at
             FROM auto_commands WHERE id = ?1",
            params![id],
            |row| {
                Ok(AutoCommand {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    label: row.get(2)?,
                    command: row.get(3)?,
                    hook_type: row.get(4)?,
                    enabled: row.get(5)?,
                    order_index: row.get(6)?,
                    preset: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(auto_cmd)
}

/// Delete an auto-command
#[tauri::command]
pub async fn delete_auto_command(
    db: tauri::State<'_, DbState>,
    id: String,
) -> Result<bool, String> {
    let db = db.write().await;
    let conn = db.conn();

    let count = conn
        .execute("DELETE FROM auto_commands WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(count > 0)
}

/// Toggle an auto-command's enabled state
#[tauri::command]
pub async fn toggle_auto_command(
    db: tauri::State<'_, DbState>,
    id: String,
) -> Result<AutoCommand, String> {
    let db = db.write().await;
    let conn = db.conn();

    conn.execute(
        "UPDATE auto_commands SET enabled = NOT enabled, updated_at = datetime('now')
         WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    let auto_cmd = conn
        .query_row(
            "SELECT id, project_id, label, command, hook_type, enabled, order_index, preset, created_at, updated_at
             FROM auto_commands WHERE id = ?1",
            params![id],
            |row| {
                Ok(AutoCommand {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    label: row.get(2)?,
                    command: row.get(3)?,
                    hook_type: row.get(4)?,
                    enabled: row.get(5)?,
                    order_index: row.get(6)?,
                    preset: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(auto_cmd)
}

/// Get built-in auto-command presets
#[tauri::command]
pub async fn get_auto_command_presets() -> Result<Vec<AutoCommandPreset>, String> {
    Ok(vec![
        AutoCommandPreset {
            id: "lint".to_string(),
            label: "Lint".to_string(),
            command: "pnpm lint".to_string(),
            hook_type: "post".to_string(),
        },
        AutoCommandPreset {
            id: "test".to_string(),
            label: "Test".to_string(),
            command: "pnpm test".to_string(),
            hook_type: "post".to_string(),
        },
        AutoCommandPreset {
            id: "build".to_string(),
            label: "Build".to_string(),
            command: "pnpm build".to_string(),
            hook_type: "post".to_string(),
        },
        AutoCommandPreset {
            id: "format".to_string(),
            label: "Format".to_string(),
            command: "pnpm format".to_string(),
            hook_type: "pre".to_string(),
        },
        AutoCommandPreset {
            id: "typecheck".to_string(),
            label: "Type Check".to_string(),
            command: "pnpm tsc --noEmit".to_string(),
            hook_type: "post".to_string(),
        },
    ])
}
