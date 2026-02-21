// Control Tower - Data Management Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri_plugin_dialog::DialogExt;

type DbState = Arc<crate::db::DbPool>;

/// Export options for data export
#[derive(Debug, Clone, Deserialize)]
pub struct ExportOptions {
    pub format: String, // "json" or "csv"
    #[serde(default = "default_true")]
    pub include_projects: bool,
    #[serde(default = "default_true")]
    pub include_decisions: bool,
    #[serde(default = "default_true")]
    pub include_costs: bool,
    #[serde(default = "default_true")]
    pub include_roadmaps: bool,
    #[serde(default = "default_true")]
    pub include_activity: bool,
}

fn default_true() -> bool {
    true
}

/// Export data structure
#[derive(Debug, Clone, Serialize)]
pub struct ExportData {
    pub version: String,
    pub exported_at: String,
    pub projects: Vec<serde_json::Value>,
    pub decisions: Vec<serde_json::Value>,
    pub costs: Vec<serde_json::Value>,
    pub roadmaps: Vec<serde_json::Value>,
    pub phases: Vec<serde_json::Value>,
    pub tasks: Vec<serde_json::Value>,
    pub activity_log: Vec<serde_json::Value>,
}

#[tauri::command]
pub async fn export_data(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
    options: ExportOptions,
) -> Result<String, String> {
    let db = db.write().await;
    let conn = db.conn();

    // Collect all data
    let mut export_data = ExportData {
        version: "1.0".to_string(),
        exported_at: chrono::Utc::now().to_rfc3339(),
        projects: Vec::new(),
        decisions: Vec::new(),
        costs: Vec::new(),
        roadmaps: Vec::new(),
        phases: Vec::new(),
        tasks: Vec::new(),
        activity_log: Vec::new(),
    };

    // Export projects
    if options.include_projects {
        let mut stmt = conn.prepare(
            "SELECT id, name, path, description, tech_stack, config, status, created_at, updated_at FROM projects"
        ).map_err(|e| e.to_string())?;
        export_data.projects = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "path": row.get::<_, String>(2)?,
                    "description": row.get::<_, Option<String>>(3)?,
                    "tech_stack": row.get::<_, Option<String>>(4)?,
                    "config": row.get::<_, Option<String>>(5)?,
                    "status": row.get::<_, String>(6)?,
                    "created_at": row.get::<_, String>(7)?,
                    "updated_at": row.get::<_, String>(8)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
    }

    // Export decisions
    if options.include_decisions {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, execution_id, phase, category, question, answer, reasoning, created_at FROM decisions"
        ).map_err(|e| e.to_string())?;
        export_data.decisions = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "project_id": row.get::<_, String>(1)?,
                    "execution_id": row.get::<_, Option<String>>(2)?,
                    "phase": row.get::<_, Option<String>>(3)?,
                    "category": row.get::<_, Option<String>>(4)?,
                    "question": row.get::<_, String>(5)?,
                    "answer": row.get::<_, String>(6)?,
                    "reasoning": row.get::<_, Option<String>>(7)?,
                    "created_at": row.get::<_, String>(8)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
    }

    // Export costs
    if options.include_costs {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, execution_id, phase, task, agent, model, input_tokens, output_tokens, total_cost, created_at FROM costs"
        ).map_err(|e| e.to_string())?;
        export_data.costs = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "project_id": row.get::<_, String>(1)?,
                    "execution_id": row.get::<_, Option<String>>(2)?,
                    "phase": row.get::<_, Option<String>>(3)?,
                    "task": row.get::<_, Option<String>>(4)?,
                    "agent": row.get::<_, Option<String>>(5)?,
                    "model": row.get::<_, String>(6)?,
                    "input_tokens": row.get::<_, i32>(7)?,
                    "output_tokens": row.get::<_, i32>(8)?,
                    "total_cost": row.get::<_, f64>(9)?,
                    "created_at": row.get::<_, String>(10)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
    }

    // Export roadmaps (includes phases and tasks)
    if options.include_roadmaps {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, name, description, total_phases, completed_phases, total_tasks, completed_tasks,
                    estimated_cost, actual_cost, status, created_at, updated_at FROM roadmaps"
        ).map_err(|e| e.to_string())?;
        export_data.roadmaps = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "project_id": row.get::<_, String>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "description": row.get::<_, Option<String>>(3)?,
                    "total_phases": row.get::<_, i32>(4)?,
                    "completed_phases": row.get::<_, i32>(5)?,
                    "total_tasks": row.get::<_, i32>(6)?,
                    "completed_tasks": row.get::<_, i32>(7)?,
                    "estimated_cost": row.get::<_, Option<f64>>(8)?,
                    "actual_cost": row.get::<_, Option<f64>>(9)?,
                    "status": row.get::<_, String>(10)?,
                    "created_at": row.get::<_, String>(11)?,
                    "updated_at": row.get::<_, String>(12)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        // Export phases
        let mut stmt = conn.prepare(
            "SELECT id, roadmap_id, phase_number, name, description, goal, status, group_number,
                    total_tasks, completed_tasks, estimated_cost, actual_cost, started_at, completed_at FROM phases"
        ).map_err(|e| e.to_string())?;
        export_data.phases = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "roadmap_id": row.get::<_, String>(1)?,
                    "phase_number": row.get::<_, i32>(2)?,
                    "name": row.get::<_, String>(3)?,
                    "description": row.get::<_, Option<String>>(4)?,
                    "goal": row.get::<_, Option<String>>(5)?,
                    "status": row.get::<_, String>(6)?,
                    "group_number": row.get::<_, Option<i32>>(7)?,
                    "total_tasks": row.get::<_, i32>(8)?,
                    "completed_tasks": row.get::<_, i32>(9)?,
                    "estimated_cost": row.get::<_, Option<f64>>(10)?,
                    "actual_cost": row.get::<_, Option<f64>>(11)?,
                    "started_at": row.get::<_, Option<String>>(12)?,
                    "completed_at": row.get::<_, Option<String>>(13)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        // Export tasks
        let mut stmt = conn.prepare(
            "SELECT id, phase_id, task_number, name, description, status, agent, model,
                    estimated_cost, actual_cost, files_created, files_modified, commit_hash, started_at, completed_at FROM tasks"
        ).map_err(|e| e.to_string())?;
        export_data.tasks = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "phase_id": row.get::<_, String>(1)?,
                    "task_number": row.get::<_, String>(2)?,
                    "name": row.get::<_, String>(3)?,
                    "description": row.get::<_, Option<String>>(4)?,
                    "status": row.get::<_, String>(5)?,
                    "agent": row.get::<_, Option<String>>(6)?,
                    "model": row.get::<_, Option<String>>(7)?,
                    "estimated_cost": row.get::<_, Option<f64>>(8)?,
                    "actual_cost": row.get::<_, Option<f64>>(9)?,
                    "files_created": row.get::<_, Option<String>>(10)?,
                    "files_modified": row.get::<_, Option<String>>(11)?,
                    "commit_hash": row.get::<_, Option<String>>(12)?,
                    "started_at": row.get::<_, Option<String>>(13)?,
                    "completed_at": row.get::<_, Option<String>>(14)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
    }

    // Export activity log
    if options.include_activity {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, execution_id, event_type, message, metadata, created_at FROM activity_log"
        ).map_err(|e| e.to_string())?;
        export_data.activity_log = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "project_id": row.get::<_, String>(1)?,
                    "execution_id": row.get::<_, Option<String>>(2)?,
                    "event_type": row.get::<_, String>(3)?,
                    "message": row.get::<_, Option<String>>(4)?,
                    "metadata": row.get::<_, Option<String>>(5)?,
                    "created_at": row.get::<_, String>(6)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
    }

    // Generate output content
    let content = match options.format.as_str() {
        "json" => serde_json::to_string_pretty(&export_data).map_err(|e| e.to_string())?,
        "csv" => {
            // For CSV, we'll just export a summary/projects for simplicity
            let mut csv = String::from("type,id,name,status,created_at\n");
            for project in &export_data.projects {
                csv.push_str(&format!(
                    "project,{},{},{},{}\n",
                    project["id"].as_str().unwrap_or(""),
                    project["name"].as_str().unwrap_or(""),
                    project["status"].as_str().unwrap_or(""),
                    project["created_at"].as_str().unwrap_or("")
                ));
            }
            csv
        }
        _ => return Err("Unsupported format. Use 'json' or 'csv'.".to_string()),
    };

    // Show save dialog
    let extension = if options.format == "json" {
        "json"
    } else {
        "csv"
    };
    let default_name = format!(
        "track-your-shit-export-{}.{}",
        chrono::Utc::now().format("%Y%m%d-%H%M%S"),
        extension
    );

    use std::sync::mpsc;
    use tauri_plugin_dialog::FilePath;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .set_file_name(&default_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });

    match rx.recv() {
        Ok(Some(file_path)) => {
            let path_str = match file_path {
                FilePath::Path(p) => p,
                FilePath::Url(u) => {
                    return Err(format!("URL paths not supported: {}", u));
                }
            };

            std::fs::write(&path_str, content).map_err(|e| e.to_string())?;
            Ok(path_str.to_string_lossy().to_string())
        }
        Ok(None) => Err("Export cancelled".to_string()),
        Err(_) => Err("Dialog was cancelled".to_string()),
    }
}

#[tauri::command]
pub async fn clear_all_data(db: tauri::State<'_, DbState>) -> Result<(), String> {
    let db = db.write().await;
    let conn = db.conn();

    // Delete in order respecting foreign key constraints
    conn.execute("DELETE FROM tasks", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM phases", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM roadmaps", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM activity_log", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM decisions", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM costs", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM projects", [])
        .map_err(|e| e.to_string())?;

    tracing::info!("All data cleared from database");
    Ok(())
}

#[tauri::command]
pub async fn clear_selected_data(
    db: tauri::State<'_, DbState>,
    categories: Vec<String>,
) -> Result<(), String> {
    let db = db.write().await;
    let conn = db.conn();

    for category in &categories {
        match category.as_str() {
            "roadmaps" => {
                // Must delete child tables first (FK order)
                conn.execute("DELETE FROM tasks", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM phases", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM roadmaps", [])
                    .map_err(|e| e.to_string())?;
            }
            "decisions" => {
                conn.execute("DELETE FROM decision_links", []).ok();
                conn.execute("DELETE FROM decisions", [])
                    .map_err(|e| e.to_string())?;
            }
            "costs" => {
                conn.execute("DELETE FROM costs", [])
                    .map_err(|e| e.to_string())?;
            }
            "activity" => {
                conn.execute("DELETE FROM activity_log", [])
                    .map_err(|e| e.to_string())?;
            }
            "projects" => {
                // Cascade: delete all related data first
                conn.execute("DELETE FROM tasks", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM phases", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM roadmaps", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM activity_log", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM decision_links", []).ok();
                conn.execute("DELETE FROM decisions", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM costs", [])
                    .map_err(|e| e.to_string())?;
                conn.execute("DELETE FROM projects", [])
                    .map_err(|e| e.to_string())?;
            }
            "gsd" => {
                conn.execute("DELETE FROM gsd_todos", []).ok();
                conn.execute("DELETE FROM gsd_debug_sessions", []).ok();
                conn.execute("DELETE FROM gsd_requirements", []).ok();
                conn.execute("DELETE FROM gsd_milestones", []).ok();
                conn.execute("DELETE FROM gsd_verifications", []).ok();
                conn.execute("DELETE FROM gsd_config", []).ok();
                conn.execute("DELETE FROM gsd_plans", []).ok();
                conn.execute("DELETE FROM gsd_summaries", []).ok();
                conn.execute("DELETE FROM gsd_phase_research", []).ok();
            }
            "tests" => {
                conn.execute("DELETE FROM test_results", []).ok();
                conn.execute("DELETE FROM test_runs", []).ok();
                conn.execute("DELETE FROM flaky_tests", []).ok();
            }
            "knowledge" => {
                conn.execute("DELETE FROM knowledge_bookmarks", []).ok();
                conn.execute("DELETE FROM knowledge", []).ok();
            }
            _ => {
                tracing::warn!("Unknown data category: {}", category);
            }
        }
    }

    tracing::info!("Selected data cleared: {:?}", categories);
    Ok(())
}
