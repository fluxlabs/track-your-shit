// Track Your Shit - Global Search Command (FTS5-accelerated)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{
    DecisionSearchResult, GlobalSearchResults, KnowledgeSearchResultItem, PhaseSearchResult,
    ProjectSearchResult,
};
use rusqlite::params;
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

/// Escape special FTS5 characters in user input to prevent query syntax errors.
/// FTS5 special chars: " * ( ) : ^
fn fts5_escape(query: &str) -> String {
    // Wrap each token in double quotes to treat as literal match
    query
        .split_whitespace()
        .map(|token| {
            let escaped = token.replace('"', "\"\"");
            format!("\"{}\"", escaped)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub async fn global_search(
    db: tauri::State<'_, DbState>,
    query: String,
    limit: Option<i32>,
) -> Result<GlobalSearchResults, String> {
    let conn = db.read().await;
    
    let limit = limit.unwrap_or(10);
    let fts_query = fts5_escape(&query);
    let like_pattern = format!("%{}%", query);

    // Search projects using FTS5
    let projects = {
        let mut stmt = conn
            .prepare(
                "SELECT p.id, p.name, p.description, p.status
                 FROM projects_fts fts
                 JOIN projects p ON p.rowid = fts.rowid
                 WHERE projects_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<ProjectSearchResult> = stmt
            .query_map(params![fts_query, limit], |row| {
                Ok(ProjectSearchResult {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    status: row.get(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    // Search phases (no FTS table — uses LIKE with indexed join columns)
    let phases = {
        let mut stmt = conn
            .prepare(
                "SELECT ph.id, ph.name, ph.goal, ph.status, p.id, p.name
                 FROM phases ph
                 JOIN roadmaps fp ON ph.roadmap_id = fp.id
                 JOIN projects p ON fp.project_id = p.id
                 WHERE ph.name LIKE ?1 OR ph.goal LIKE ?1
                 ORDER BY ph.phase_number ASC
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<PhaseSearchResult> = stmt
            .query_map(params![like_pattern, limit], |row| {
                Ok(PhaseSearchResult {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    goal: row.get(2)?,
                    status: row.get(3)?,
                    project_id: row.get(4)?,
                    project_name: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    // Search decisions using FTS5
    let decisions = {
        let mut stmt = conn
            .prepare(
                "SELECT d.id, d.question, d.answer, d.category, p.id, p.name
                 FROM decisions_fts fts
                 JOIN decisions d ON d.rowid = fts.rowid
                 JOIN projects p ON d.project_id = p.id
                 WHERE decisions_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<DecisionSearchResult> = stmt
            .query_map(params![fts_query, limit], |row| {
                Ok(DecisionSearchResult {
                    id: row.get(0)?,
                    question: row.get(1)?,
                    answer: row.get(2)?,
                    category: row.get(3)?,
                    project_id: row.get(4)?,
                    project_name: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    // Search knowledge using FTS5
    let knowledge = {
        let mut stmt = conn
            .prepare(
                "SELECT k.id, k.title, k.category, p.id, p.name
                 FROM knowledge_fts fts
                 JOIN knowledge k ON k.rowid = fts.rowid
                 JOIN projects p ON k.project_id = p.id
                 WHERE knowledge_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;

        let result: Vec<KnowledgeSearchResultItem> = stmt
            .query_map(params![fts_query, limit], |row| {
                Ok(KnowledgeSearchResultItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    category: row.get(2)?,
                    project_id: row.get(3)?,
                    project_name: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        result
    };

    Ok(GlobalSearchResults {
        projects,
        phases,
        decisions,
        knowledge,
    })
}
