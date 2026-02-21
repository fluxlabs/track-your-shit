// Track Your Shit - Activity Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{ActivityEntry, Decision};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

/// Decision with project name for global views
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionWithProject {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub execution_id: Option<String>,
    pub phase: Option<String>,
    pub category: Option<String>,
    pub question: String,
    pub answer: String,
    pub reasoning: Option<String>,
    pub tags: Option<String>,
    pub impact_status: Option<String>,
    pub impact_reason: Option<String>,
    pub impact_updated_at: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

/// Filters for decision queries
#[derive(Debug, Clone, Deserialize)]
pub struct DecisionFilters {
    pub project_id: Option<String>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub tag: Option<String>,
    pub impact_status: Option<String>,
    pub limit: Option<i32>,
}

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

#[tauri::command]
pub async fn get_decisions(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<Decision>, String> {
    let conn = db.read().await;
    

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, execution_id, phase, category, question, answer, reasoning, tags, impact_status, impact_reason, impact_updated_at, created_at, updated_at
             FROM decisions
             WHERE project_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let decisions = stmt
        .query_map(params![project_id], |row| {
            Ok(Decision {
                id: row.get(0)?,
                project_id: row.get(1)?,
                execution_id: row.get(2)?,
                phase: row.get(3)?,
                category: row.get(4)?,
                question: row.get(5)?,
                answer: row.get(6)?,
                reasoning: row.get(7)?,
                tags: row.get(8)?,
                impact_status: row.get(9)?,
                impact_reason: row.get(10)?,
                impact_updated_at: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(decisions)
}

#[tauri::command]
pub async fn get_all_decisions(
    db: tauri::State<'_, DbState>,
    filters: DecisionFilters,
) -> Result<Vec<DecisionWithProject>, String> {
    let conn = db.read().await;
    
    let limit = filters.limit.unwrap_or(100);

    // Build query with optional filters
    let mut sql = String::from(
        "SELECT d.id, d.project_id, p.name as project_name, d.execution_id, d.phase, d.category,
                d.question, d.answer, d.reasoning, d.tags, d.impact_status, d.impact_reason,
                d.impact_updated_at, d.created_at, d.updated_at
         FROM decisions d
         JOIN projects p ON d.project_id = p.id
         WHERE 1=1",
    );
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    let mut param_index = 1;

    if let Some(ref pid) = filters.project_id {
        sql.push_str(&format!(" AND d.project_id = ?{}", param_index));
        params.push(Box::new(pid.clone()));
        param_index += 1;
    }

    if let Some(ref cat) = filters.category {
        sql.push_str(&format!(" AND d.category = ?{}", param_index));
        params.push(Box::new(cat.clone()));
        param_index += 1;
    }

    if let Some(ref search) = filters.search {
        let search_pattern = format!("%{}%", search);
        sql.push_str(&format!(
            " AND (d.question LIKE ?{} OR d.answer LIKE ?{})",
            param_index, param_index
        ));
        params.push(Box::new(search_pattern));
        param_index += 1;
    }

    if let Some(ref tag) = filters.tag {
        let tag_pattern = format!("%\"{}\"%", tag);
        sql.push_str(&format!(" AND d.tags LIKE ?{}", param_index));
        params.push(Box::new(tag_pattern));
        param_index += 1;
    }

    if let Some(ref impact) = filters.impact_status {
        sql.push_str(&format!(" AND d.impact_status = ?{}", param_index));
        params.push(Box::new(impact.clone()));
        param_index += 1;
    }

    sql.push_str(&format!(
        " ORDER BY d.created_at DESC LIMIT ?{}",
        param_index
    ));
    params.push(Box::new(limit));

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let decisions = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(DecisionWithProject {
                id: row.get(0)?,
                project_id: row.get(1)?,
                project_name: row.get(2)?,
                execution_id: row.get(3)?,
                phase: row.get(4)?,
                category: row.get(5)?,
                question: row.get(6)?,
                answer: row.get(7)?,
                reasoning: row.get(8)?,
                tags: row.get(9)?,
                impact_status: row.get(10)?,
                impact_reason: row.get(11)?,
                impact_updated_at: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(decisions)
}

#[tauri::command]
pub async fn get_decision_categories(db: tauri::State<'_, DbState>) -> Result<Vec<String>, String> {
    let conn = db.read().await;
    

    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT category FROM decisions WHERE category IS NOT NULL ORDER BY category",
        )
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
}
