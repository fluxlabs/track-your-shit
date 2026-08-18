// VCCA - Activity Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::ActivityEntry;
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

#[tauri::command]
pub async fn get_activity_log(
    db: tauri::State<'_, DbState>,
    project_id: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<ActivityEntry>, String> {
    let conn = db.read().await;

    let limit = limit.unwrap_or(50);

    let (sql, params): (&str, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref pid) = project_id {
        (
            "SELECT id, project_id, execution_id, event_type, message, metadata, created_at
             FROM activity_log
             WHERE project_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2",
            vec![
                Box::new(pid.clone()) as Box<dyn rusqlite::ToSql>,
                Box::new(limit),
            ],
        )
    } else {
        (
            "SELECT id, project_id, execution_id, event_type, message, metadata, created_at
             FROM activity_log
             ORDER BY created_at DESC
             LIMIT ?1",
            vec![Box::new(limit) as Box<dyn rusqlite::ToSql>],
        )
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let activities = stmt
        .query_map(params_refs.as_slice(), |row| {
            let metadata_str: Option<String> = row.get(5)?;
            let metadata: Option<serde_json::Value> =
                metadata_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(ActivityEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                execution_id: row.get(2)?,
                event_type: row.get(3)?,
                message: row.get(4)?,
                metadata,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(activities)
}

#[tauri::command]
pub async fn search_activity(
    db: tauri::State<'_, DbState>,
    query: String,
    project_id: Option<String>,
) -> Result<Vec<ActivityEntry>, String> {
    let conn = db.read().await;

    let search_pattern = format!("%{}%", query);

    let (sql, params): (&str, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref pid) = project_id {
        (
            "SELECT id, project_id, execution_id, event_type, message, metadata, created_at
             FROM activity_log
             WHERE project_id = ?1 AND (message LIKE ?2 OR event_type LIKE ?2)
             ORDER BY created_at DESC
             LIMIT 100",
            vec![
                Box::new(pid.clone()) as Box<dyn rusqlite::ToSql>,
                Box::new(search_pattern),
            ],
        )
    } else {
        (
            "SELECT id, project_id, execution_id, event_type, message, metadata, created_at
             FROM activity_log
             WHERE message LIKE ?1 OR event_type LIKE ?1
             ORDER BY created_at DESC
             LIMIT 100",
            vec![Box::new(search_pattern) as Box<dyn rusqlite::ToSql>],
        )
    };

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let activities = stmt
        .query_map(params_refs.as_slice(), |row| {
            let metadata_str: Option<String> = row.get(5)?;
            let metadata: Option<serde_json::Value> =
                metadata_str.and_then(|s| serde_json::from_str(&s).ok());

            Ok(ActivityEntry {
                id: row.get(0)?,
                project_id: row.get(1)?,
                execution_id: row.get(2)?,
                event_type: row.get(3)?,
                message: row.get(4)?,
                metadata,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(activities)
}
