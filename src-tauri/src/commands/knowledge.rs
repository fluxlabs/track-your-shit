// Control Tower - Knowledge Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
//
// Implements knowledge/memory system for persistent context (PRD FR-9)

use crate::models::{Knowledge, KnowledgeBookmark, KnowledgeInput, KnowledgeSearchResult};
use rusqlite::params;
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

/// Store a knowledge entry
///
/// FR-9.1: System SHALL store knowledge entries with content
/// FR-9.2: System SHALL categorize knowledge (learning, decision, reference, fact)
#[tauri::command]
pub async fn knowledge_store(
    db: tauri::State<'_, DbState>,
    project_id: String,
    input: KnowledgeInput,
) -> Result<Knowledge, String> {
    let db = db.write().await;
    let conn = db.conn();

    // Validate category
    let category = input.category.unwrap_or_else(|| "learning".to_string());
    let valid_categories = ["learning", "decision", "reference", "fact"];
    if !valid_categories.contains(&category.as_str()) {
        return Err(format!(
            "Invalid category: {}. Valid: {:?}",
            category, valid_categories
        ));
    }

    // Serialize metadata
    let metadata_str = input
        .metadata
        .as_ref()
        .map(|m| serde_json::to_string(m).unwrap_or_default());

    let knowledge_id = format!("{:032x}", rand::random::<u128>());

    conn.execute(
        "INSERT INTO knowledge (id, project_id, title, content, category, source, metadata)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            knowledge_id,
            project_id,
            input.title,
            input.content,
            category,
            input.source,
            metadata_str
        ],
    )
    .map_err(|e| e.to_string())?;

    // Return created knowledge entry
    let knowledge = conn
        .query_row(
            "SELECT id, project_id, title, content, category, source, metadata, created_at, updated_at
             FROM knowledge WHERE id = ?1",
            params![knowledge_id],
            |row| {
                let metadata_str: Option<String> = row.get(6)?;
                let metadata: Option<serde_json::Value> =
                    metadata_str.and_then(|s| serde_json::from_str(&s).ok());
                Ok(Knowledge {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    category: row.get(4)?,
                    source: row.get(5)?,
                    metadata,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(knowledge)
}

/// Search knowledge by text query
///
/// FR-9.3: System SHALL support knowledge search by project
#[tauri::command]
pub async fn knowledge_search(
    db: tauri::State<'_, DbState>,
    project_id: String,
    query: String,
    category: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<KnowledgeSearchResult>, String> {
    let db = db.write().await;
    let conn = db.conn();
    let limit = limit.unwrap_or(20);
    let search_pattern = format!("%{}%", query);

    let (sql, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref cat) = category
    {
        (
            "SELECT id, project_id, title, content, category, created_at
             FROM knowledge
             WHERE project_id = ?1 AND category = ?2 AND (title LIKE ?3 OR content LIKE ?3)
             ORDER BY created_at DESC
             LIMIT ?4"
                .to_string(),
            vec![
                Box::new(project_id) as Box<dyn rusqlite::ToSql>,
                Box::new(cat.clone()),
                Box::new(search_pattern),
                Box::new(limit),
            ],
        )
    } else {
        (
            "SELECT id, project_id, title, content, category, created_at
             FROM knowledge
             WHERE project_id = ?1 AND (title LIKE ?2 OR content LIKE ?2)
             ORDER BY created_at DESC
             LIMIT ?3"
                .to_string(),
            vec![
                Box::new(project_id) as Box<dyn rusqlite::ToSql>,
                Box::new(search_pattern),
                Box::new(limit),
            ],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let results = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(KnowledgeSearchResult {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                category: row.get(4)?,
                relevance_score: None, // Would require embeddings for true relevance
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

/// Get all knowledge for a project
#[tauri::command]
pub async fn knowledge_list(
    db: tauri::State<'_, DbState>,
    project_id: String,
    category: Option<String>,
    limit: Option<i32>,
    offset: Option<i32>,
) -> Result<Vec<Knowledge>, String> {
    let db = db.write().await;
    let conn = db.conn();
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);

    let (sql, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) = if let Some(ref cat) = category
    {
        (
            "SELECT id, project_id, title, content, category, source, metadata, created_at, updated_at
             FROM knowledge
             WHERE project_id = ?1 AND category = ?2
             ORDER BY created_at DESC
             LIMIT ?3 OFFSET ?4".to_string(),
            vec![
                Box::new(project_id) as Box<dyn rusqlite::ToSql>,
                Box::new(cat.clone()),
                Box::new(limit),
                Box::new(offset),
            ],
        )
    } else {
        (
            "SELECT id, project_id, title, content, category, source, metadata, created_at, updated_at
             FROM knowledge
             WHERE project_id = ?1
             ORDER BY created_at DESC
             LIMIT ?2 OFFSET ?3".to_string(),
            vec![
                Box::new(project_id) as Box<dyn rusqlite::ToSql>,
                Box::new(limit),
                Box::new(offset),
            ],
        )
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let knowledge_entries = stmt
        .query_map(params_refs.as_slice(), |row| {
            let metadata_str: Option<String> = row.get(6)?;
            let metadata: Option<serde_json::Value> =
                metadata_str.and_then(|s| serde_json::from_str(&s).ok());
            Ok(Knowledge {
                id: row.get(0)?,
                project_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                category: row.get(4)?,
                source: row.get(5)?,
                metadata,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(knowledge_entries)
}

/// Get a specific knowledge entry
#[tauri::command]
pub async fn knowledge_get(
    db: tauri::State<'_, DbState>,
    knowledge_id: String,
) -> Result<Knowledge, String> {
    let db = db.write().await;
    let conn = db.conn();

    let knowledge = conn
        .query_row(
            "SELECT id, project_id, title, content, category, source, metadata, created_at, updated_at
             FROM knowledge WHERE id = ?1",
            params![knowledge_id],
            |row| {
                let metadata_str: Option<String> = row.get(6)?;
                let metadata: Option<serde_json::Value> =
                    metadata_str.and_then(|s| serde_json::from_str(&s).ok());
                Ok(Knowledge {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    category: row.get(4)?,
                    source: row.get(5)?,
                    metadata,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| format!("Knowledge entry not found: {}", e))?;

    Ok(knowledge)
}

/// Update a knowledge entry
#[tauri::command]
pub async fn knowledge_update(
    db: tauri::State<'_, DbState>,
    knowledge_id: String,
    title: Option<String>,
    content: Option<String>,
    category: Option<String>,
    source: Option<String>,
    metadata: Option<serde_json::Value>,
) -> Result<Knowledge, String> {
    let db = db.write().await;
    let conn = db.conn();

    // Build dynamic update
    let mut updates = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(t) = &title {
        updates.push("title = ?");
        params_vec.push(Box::new(t.clone()));
    }
    if let Some(c) = &content {
        updates.push("content = ?");
        params_vec.push(Box::new(c.clone()));
    }
    if let Some(cat) = &category {
        // Validate category
        let valid_categories = ["learning", "decision", "reference", "fact"];
        if !valid_categories.contains(&cat.as_str()) {
            return Err(format!("Invalid category: {}", cat));
        }
        updates.push("category = ?");
        params_vec.push(Box::new(cat.clone()));
    }
    if let Some(s) = &source {
        updates.push("source = ?");
        params_vec.push(Box::new(s.clone()));
    }
    if let Some(m) = &metadata {
        let metadata_str = serde_json::to_string(m).unwrap_or_default();
        updates.push("metadata = ?");
        params_vec.push(Box::new(metadata_str));
    }

    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }

    updates.push("updated_at = datetime('now')");
    params_vec.push(Box::new(knowledge_id.clone()));

    let query = format!("UPDATE knowledge SET {} WHERE id = ?", updates.join(", "));

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    conn.execute(&query, params_refs.as_slice())
        .map_err(|e| e.to_string())?;

    // Return updated entry
    let knowledge = conn
        .query_row(
            "SELECT id, project_id, title, content, category, source, metadata, created_at, updated_at
             FROM knowledge WHERE id = ?1",
            params![knowledge_id],
            |row| {
                let metadata_str: Option<String> = row.get(6)?;
                let metadata: Option<serde_json::Value> =
                    metadata_str.and_then(|s| serde_json::from_str(&s).ok());
                Ok(Knowledge {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    category: row.get(4)?,
                    source: row.get(5)?,
                    metadata,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(knowledge)
}

/// Delete a knowledge entry
#[tauri::command]
pub async fn knowledge_delete(
    db: tauri::State<'_, DbState>,
    knowledge_id: String,
) -> Result<bool, String> {
    let db = db.write().await;
    let conn = db.conn();

    let deleted = conn
        .execute("DELETE FROM knowledge WHERE id = ?1", params![knowledge_id])
        .map_err(|e| e.to_string())?;

    Ok(deleted > 0)
}

/// Get knowledge categories for a project
#[tauri::command]
pub async fn knowledge_categories(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<(String, i32)>, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT category, COUNT(*) as count
             FROM knowledge
             WHERE project_id = ?1
             GROUP BY category
             ORDER BY count DESC",
        )
        .map_err(|e| e.to_string())?;

    let categories = stmt
        .query_map(params![project_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(categories)
}

/// Bulk import knowledge entries
#[tauri::command]
pub async fn knowledge_import(
    db: tauri::State<'_, DbState>,
    project_id: String,
    entries: Vec<KnowledgeInput>,
) -> Result<i32, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut imported = 0;
    for input in entries {
        let category = input.category.unwrap_or_else(|| "learning".to_string());
        let metadata_str = input
            .metadata
            .as_ref()
            .map(|m| serde_json::to_string(m).unwrap_or_default());

        let knowledge_id = format!("{:032x}", rand::random::<u128>());

        let result = conn.execute(
            "INSERT INTO knowledge (id, project_id, title, content, category, source, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                knowledge_id,
                project_id,
                input.title,
                input.content,
                category,
                input.source,
                metadata_str
            ],
        );

        if result.is_ok() {
            imported += 1;
        }
    }

    Ok(imported)
}

// ============================================================
// Knowledge Bookmark Commands (KN-06)
// ============================================================

/// Create a knowledge bookmark for a heading in a file
#[tauri::command]
pub async fn create_knowledge_bookmark(
    db: tauri::State<'_, DbState>,
    project_id: String,
    file_path: String,
    heading: String,
    heading_level: Option<i32>,
    note: Option<String>,
) -> Result<KnowledgeBookmark, String> {
    let heading_level = heading_level.unwrap_or(1);

    let db = db.write().await;
    let conn = db.conn();

    let bookmark_id = format!("{:032x}", rand::random::<u128>());

    conn.execute(
        "INSERT INTO knowledge_bookmarks (id, project_id, file_path, heading, heading_level, note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(project_id, file_path, heading) DO UPDATE SET
            heading_level = ?5, note = ?6",
        params![
            bookmark_id,
            project_id,
            file_path,
            heading,
            heading_level,
            note
        ],
    )
    .map_err(|e| e.to_string())?;

    // Fetch the bookmark (may have been upserted)
    let bookmark = conn
        .query_row(
            "SELECT id, project_id, file_path, heading, heading_level, note, created_at
             FROM knowledge_bookmarks
             WHERE project_id = ?1 AND file_path = ?2 AND heading = ?3",
            params![project_id, file_path, heading],
            |row| {
                Ok(KnowledgeBookmark {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    file_path: row.get(2)?,
                    heading: row.get(3)?,
                    heading_level: row.get(4)?,
                    note: row.get(5)?,
                    created_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(bookmark)
}

/// List all knowledge bookmarks for a project
#[tauri::command]
pub async fn list_knowledge_bookmarks(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<KnowledgeBookmark>, String> {
    let db = db.write().await;
    let conn = db.conn();

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, file_path, heading, heading_level, note, created_at
             FROM knowledge_bookmarks
             WHERE project_id = ?1
             ORDER BY file_path, heading_level, heading",
        )
        .map_err(|e| e.to_string())?;

    let bookmarks = stmt
        .query_map(params![project_id], |row| {
            Ok(KnowledgeBookmark {
                id: row.get(0)?,
                project_id: row.get(1)?,
                file_path: row.get(2)?,
                heading: row.get(3)?,
                heading_level: row.get(4)?,
                note: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(bookmarks)
}

/// Delete a knowledge bookmark
#[tauri::command]
pub async fn delete_knowledge_bookmark(
    db: tauri::State<'_, DbState>,
    bookmark_id: String,
) -> Result<bool, String> {
    let db = db.write().await;
    let conn = db.conn();

    let deleted = conn
        .execute(
            "DELETE FROM knowledge_bookmarks WHERE id = ?1",
            params![bookmark_id],
        )
        .map_err(|e| e.to_string())?;

    Ok(deleted > 0)
}
