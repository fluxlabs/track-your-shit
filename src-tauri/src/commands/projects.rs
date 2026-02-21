// Control Tower - Project Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::db::Database;
use crate::models::{
    GitInfo, ImportResult, MarkdownScanResult, Project, ProjectDocs,
    ProjectUpdate, ProjectWithStats, RoadmapProgress, TechStack,
};
use crate::pty::PtyManagerState;
use crate::security::shell_escape_path;
use rusqlite::params;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

type DbState = Arc<crate::db::DbPool>;

/// Get the Claude CLI path
fn get_claude_path(_db: &Database) -> String {
    "claude".to_string()
}

#[tauri::command]
pub async fn list_projects(db: tauri::State<'_, DbState>) -> Result<Vec<Project>, String> {
    let conn = db.read().await;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, path, description, tech_stack, config, status, created_at, updated_at, COALESCE(is_favorite, 0)
             FROM projects
             WHERE status = 'active'
             ORDER BY COALESCE(is_favorite, 0) DESC, updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            let tech_stack_str: Option<String> = row.get(4)?;
            let tech_stack: Option<TechStack> =
                tech_stack_str.and_then(|s| serde_json::from_str(&s).ok());

            let config_str: Option<String> = row.get(5)?;
            let config: Option<serde_json::Value> =
                config_str.and_then(|s| serde_json::from_str(&s).ok());

            let is_fav: i32 = row.get(9)?;

            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                description: row.get(3)?,
                tech_stack,
                config,
                status: row.get(6)?,
                is_favorite: is_fav != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(projects)
}

#[tauri::command]
pub async fn get_project(db: tauri::State<'_, DbState>, id: String) -> Result<Project, String> {
    let conn = db.read().await;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, path, description, tech_stack, config, status, created_at, updated_at, COALESCE(is_favorite, 0)
             FROM projects
             WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let project = stmt
        .query_row(params![id], |row| {
            let tech_stack_str: Option<String> = row.get(4)?;
            let tech_stack: Option<TechStack> =
                tech_stack_str.and_then(|s| serde_json::from_str(&s).ok());

            let config_str: Option<String> = row.get(5)?;
            let config: Option<serde_json::Value> =
                config_str.and_then(|s| serde_json::from_str(&s).ok());

            let is_fav: i32 = row.get(9)?;

            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                description: row.get(3)?,
                tech_stack,
                config,
                status: row.get(6)?,
                is_favorite: is_fav != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(project)
}

#[tauri::command]
pub async fn import_project(
    db: tauri::State<'_, DbState>,
    path: String,
) -> Result<Project, String> {
    // Detect tech stack
    let tech_stack = crate::commands::filesystem::detect_tech_stack_internal(&path)?;

    // Extract project name from path
    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown Project")
        .to_string();

    let id = uuid::Uuid::new_v4().to_string().replace("-", "");
    let tech_stack_json = serde_json::to_string(&tech_stack).map_err(|e| e.to_string())?;

    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        conn.execute(
            "INSERT INTO projects (id, name, path, tech_stack, status) VALUES (?1, ?2, ?3, ?4, 'active')",
            params![id, name, path, tech_stack_json],
        )
        .map_err(|e| e.to_string())?;

        // Log activity
        let activity_id = uuid::Uuid::new_v4().to_string().replace("-", "");
        conn.execute(
            "INSERT INTO activity_log (id, project_id, event_type, message) VALUES (?1, ?2, 'project_imported', ?3)",
            params![activity_id, id, format!("Project '{}' imported from {}", name, path)],
        )
        .map_err(|e| e.to_string())?;
    }

    // Return the created project by calling get_project with the State
    get_project(db, id).await
}

#[tauri::command]
pub async fn update_project(
    db: tauri::State<'_, DbState>,
    id: String,
    updates: ProjectUpdate,
) -> Result<Project, String> {
    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        let mut sql = String::from("UPDATE projects SET updated_at = datetime('now')");
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        if let Some(name) = &updates.name {
            sql.push_str(", name = ?");
            params_vec.push(Box::new(name.clone()));
        }
        if let Some(description) = &updates.description {
            sql.push_str(", description = ?");
            params_vec.push(Box::new(description.clone()));
        }
        if let Some(status) = &updates.status {
            sql.push_str(", status = ?");
            params_vec.push(Box::new(status.clone()));
        }

        sql.push_str(" WHERE id = ?");
        params_vec.push(Box::new(id.clone()));

        let params_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_refs.as_slice())
            .map_err(|e| e.to_string())?;
    }

    get_project(db, id).await
}

#[tauri::command]
pub async fn delete_project(db: tauri::State<'_, DbState>, id: String) -> Result<(), String> {
    let db = db.write().await;
    let conn = db.conn();

    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn archive_project(db: tauri::State<'_, DbState>, id: String) -> Result<Project, String> {
    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        conn.execute(
            "UPDATE projects SET status = 'archived', updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
    }

    get_project(db, id).await
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn import_project_enhanced(
    app: AppHandle,
    db: tauri::State<'_, DbState>,
    pty_manager: tauri::State<'_, PtyManagerState>,
    path: String,
    autoSyncRoadmap: bool,
    ptySessionId: Option<String>,
    skipConversion: Option<bool>,
) -> Result<ImportResult, String> {
    let _auto_sync_roadmap = autoSyncRoadmap;
    let provided_session_id = ptySessionId;
    let skip_conversion = skipConversion.unwrap_or(false);

    tracing::info!("import_project_enhanced called for path: {}", path);

    // Detect tech stack
    tracing::info!("Detecting tech stack...");
    let tech_stack =
        crate::commands::filesystem::detect_tech_stack_internal(&path).map_err(|e| {
            tracing::error!("Failed to detect tech stack: {}", e);
            e
        })?;
    tracing::info!(
        "Tech stack detected: planning={}",
        tech_stack.has_planning
    );

    // Read project docs
    let docs: Option<ProjectDocs> =
        crate::commands::filesystem::read_project_docs(path.clone()).await?;

    // Quick metadata scan of all markdown files
    let markdown_scan: Option<MarkdownScanResult> =
        crate::commands::filesystem::scan_markdown_metadata(std::path::Path::new(&path)).ok();

    // Extract project name from path
    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown Project")
        .to_string();

    // Extract description from docs if available
    let description = docs.as_ref().and_then(|d| d.description.clone());

    let id = uuid::Uuid::new_v4().to_string().replace("-", "");
    let tech_stack_json = serde_json::to_string(&tech_stack).map_err(|e| e.to_string())?;

    // Determine import mode
    let import_mode = if tech_stack.has_planning && skip_conversion {
        // GSD project but user opted to skip conversion — import natively from .planning
        "gsd_native"
    } else if tech_stack.has_planning {
        // GSD project — run conversion
        "gsd"
    } else {
        "bare"
    };

    // Get Claude path for PTY commands
    let claude_path = {
        let db_guard = db.write().await;
        get_claude_path(&db_guard)
    };

    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        conn.execute(
            "INSERT INTO projects (id, name, path, description, tech_stack, status) VALUES (?1, ?2, ?3, ?4, ?5, 'active')",
            params![id, name, path, description, tech_stack_json],
        )
        .map_err(|e| e.to_string())?;

        // Log activity
        let activity_id = uuid::Uuid::new_v4().to_string().replace("-", "");
        let import_type = match import_mode {
            "gsd_native" => "GSD project (native, no conversion)",
            "existing" => "Existing project",
            "gsd" if tech_stack.gsd_conversion_incomplete => {
                "GSD project (re-converting - incomplete)"
            }
            "gsd" => "GSD project (converting)",
            _ => "bare project (generating)",
        };
        conn.execute(
            "INSERT INTO activity_log (id, project_id, event_type, message) VALUES (?1, ?2, 'project_imported', ?3)",
            params![activity_id, id, format!("Project '{}' imported as {} from {}", name, import_type, path)],
        )
        .map_err(|e| e.to_string())?;
    }

    // Get the created project
    let project = get_project(db.clone(), id.clone()).await?;

    // Handle based on import mode
    let (roadmap_synced, pty_session_id) = match import_mode {
        "existing" => {
            (false, None)
        }
        "gsd_native" => {
            // GSD native import - skip PTY conversion, sync directly from .planning/
            // Description was already extracted from docs earlier. If still None,
            // try reading .planning/PROJECT.md directly for a fallback description.
            if description.is_none() {
                let project_md_path = std::path::Path::new(&path).join(".planning/PROJECT.md");
                if project_md_path.exists() {
                    if let Ok(content) = std::fs::read_to_string(&project_md_path) {
                        // Use first non-empty, non-heading line as a fallback description
                        let fallback_desc: Option<String> = content
                            .lines()
                            .map(|l| l.trim())
                            .find(|l| !l.is_empty() && !l.starts_with('#'))
                            .map(|l| {
                                if l.len() > 200 {
                                    format!("{}...", &l[..197])
                                } else {
                                    l.to_string()
                                }
                            });
                        if let Some(ref desc_text) = fallback_desc {
                            let db_guard = db.write().await;
                            let _ = db_guard.conn().execute(
                                "UPDATE projects SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
                                params![desc_text, id],
                            );
                        }
                    }
                }
            }

            // Sync GSD data from .planning/ into the database
            {
                let db_guard = db.write().await;
                match crate::commands::gsd::gsd_sync_project_internal(&db_guard, &id) {
                    Ok(sync_result) => {
                        tracing::info!(
                            project_id = %id,
                            "GSD native sync completed: {} todos, {} milestones, {} requirements, {} verifications",
                            sync_result.todos_synced,
                            sync_result.milestones_synced,
                            sync_result.requirements_synced,
                            sync_result.verifications_synced
                        );
                    }
                    Err(e) => {
                        tracing::warn!("GSD native sync failed during import: {}", e);
                    }
                }
            }

            (false, None)
        }
        "gsd" => {
            // GSD project - spawn PTY to run the Node.js conversion script
            // Use provided session ID if available (allows frontend to set up listeners first)
            let session_id = provided_session_id
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

            // Find the conversion script - check multiple locations
            // 1. Development: relative to the Cargo manifest (../../scripts/ from src-tauri)
            // 2. Production: bundled in app resources
            // CARGO_MANIFEST_DIR = .../project-autopilot/control-tower-app/src-tauri
            let manifest_dir = env!("CARGO_MANIFEST_DIR");
            let script_path = std::path::Path::new(manifest_dir)
                .parent() // control-tower-app/
                .and_then(|p| p.parent()) // project-autopilot/
                .unwrap_or(std::path::Path::new("."))
                .join("scripts")
                .join("gsd-convert.mjs");

            let command = if script_path.exists() {
                format!(
                    "node '{}' '{}'",
                    script_path.display(),
                    shell_escape_path(&path)
                )
            } else {
                // Fallback: try to run from current directory
                format!(
                    "node scripts/gsd-convert.mjs '{}'",
                    shell_escape_path(&path)
                )
            };

            tracing::info!(
                project_id = %id,
                "Starting GSD conversion PTY session {} for project {} with command: {}",
                session_id,
                id,
                command
            );

            let mut manager = pty_manager.lock().await;
            manager.create_session(&app, session_id.clone(), &path, Some(&command), 120, 30)?;

            (false, Some(session_id))
        }
        _ => {
            // Bare project - launch Claude CLI with /gsd:init for GSD initialization
            // Use provided session ID if available (allows frontend to set up listeners first)
            let session_id = provided_session_id
                .clone()
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

            let command = format!(
                "{} -p --dangerously-skip-permissions /gsd:init",
                claude_path
            );

            tracing::info!(
                project_id = %id,
                "Starting bare project import PTY session {} for project {} with command: {}",
                session_id,
                id,
                command
            );

            let mut manager = pty_manager.lock().await;
            manager.create_session(&app, session_id.clone(), &path, Some(&command), 120, 30)?;

            (false, Some(session_id))
        }
    };

    // For "existing" and "gsd_native" imports, spawn async markdown indexing in the background
    if import_mode == "existing" || import_mode == "gsd_native" {
        let db_clone = db.inner().clone();
        let app_clone = app.clone();
        let pid = id.clone();
        let ppath = path.clone();
        tauri::async_runtime::spawn(async move {
            let db_guard = db_clone.write().await;
            let conn = db_guard.conn();

            // Discover and index markdown files
            let base = std::path::Path::new(&ppath);
            let discovered = match crate::commands::filesystem::discover_markdown_files(base) {
                Ok(files) => files,
                Err(_) => return,
            };

            let total = discovered.len();
            if total == 0 {
                return;
            }

            // Delete previous scan entries
            let _ = conn.execute(
                "DELETE FROM knowledge WHERE project_id = ?1 AND source LIKE 'scan://%'",
                params![pid],
            );

            let mut indexed: usize = 0;
            let max_file_size: u64 = 512 * 1024;

            for (i, file) in discovered.iter().enumerate() {
                if file.size_bytes > max_file_size {
                    continue;
                }
                let full_path = base.join(&file.relative_path);
                let content = match std::fs::read_to_string(&full_path) {
                    Ok(c) => c,
                    Err(_) => continue,
                };
                if content.trim().is_empty() {
                    continue;
                }

                let metadata = serde_json::json!({
                    "size_bytes": file.size_bytes,
                    "indexed_from": "import_scan",
                    "folder": file.folder,
                });
                let metadata_str = serde_json::to_string(&metadata).unwrap_or_default();
                let knowledge_id = format!("{:032x}", rand::random::<u128>());

                let _ = conn.execute(
                    "INSERT INTO knowledge (id, project_id, title, content, category, source, metadata)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        knowledge_id,
                        pid,
                        file.display_name,
                        content,
                        "reference",
                        format!("scan://{}", file.relative_path),
                        metadata_str,
                    ],
                );
                indexed += 1;

                // Emit progress every 10 files
                if (i + 1) % 10 == 0 || i + 1 == total {
                    let _ = app_clone.emit(
                        "knowledge:index-progress",
                        crate::models::MarkdownIndexProgress {
                            project_id: pid.clone(),
                            indexed,
                            total,
                            current_file: file.relative_path.clone(),
                        },
                    );
                }
            }
        });
    }

    Ok(ImportResult {
        project,
        docs,
        roadmap_synced,
        pty_session_id,
        import_mode: import_mode.to_string(),
        markdown_scan,
    })
}

/// Check if a project path is available for creation
#[tauri::command]
#[allow(non_snake_case)]
pub async fn check_project_path(parentPath: String, projectName: String) -> Result<bool, String> {
    let parent = std::path::Path::new(&parentPath);
    if !parent.exists() || !parent.is_dir() {
        return Err(format!("Parent directory does not exist: {}", parentPath));
    }

    let project_path = parent.join(&projectName);

    if project_path.exists() {
        // Check if it's an empty directory (can be reused)
        let is_empty = std::fs::read_dir(&project_path)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);

        if !is_empty {
            return Err(format!(
                "Directory already exists and is not empty: {}",
                project_path.display()
            ));
        }
    }

    Ok(true)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn create_new_project(
    app: AppHandle,
    db: tauri::State<'_, DbState>,
    pty_manager: tauri::State<'_, PtyManagerState>,
    parentPath: String,
    projectName: String,
    template: Option<String>,
    discoveryMode: Option<String>,
    ptySessionId: Option<String>,
) -> Result<crate::models::CreateProjectResult, String> {
    use crate::models::CreateProjectResult;

    let parent_path = parentPath;
    let project_name = projectName;
    let discovery_mode = discoveryMode.unwrap_or_else(|| "quick".to_string());
    let provided_session_id = ptySessionId;

    tracing::info!(
        "create_new_project called: parent={}, name={}, template={:?}, discovery={}",
        parent_path,
        project_name,
        template,
        discovery_mode,
    );

    // Validate project name (lowercase, numbers, hyphens only)
    let name_regex =
        regex::Regex::new(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$").map_err(|e| e.to_string())?;
    if !name_regex.is_match(&project_name) || project_name.len() < 2 {
        return Err(
            "Invalid project name. Use lowercase letters, numbers, and hyphens only (min 2 chars)."
                .to_string(),
        );
    }

    // Validate parent path exists
    let parent = std::path::Path::new(&parent_path);
    if !parent.exists() || !parent.is_dir() {
        return Err(format!("Parent directory does not exist: {}", parent_path));
    }

    // Create project path
    let project_path = parent.join(&project_name);
    let project_path_str = project_path.to_string_lossy().to_string();

    // Check if project directory already exists
    if project_path.exists() {
        // Check if it's an empty directory (likely from a previous failed attempt)
        let is_empty = std::fs::read_dir(&project_path)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);

        if !is_empty {
            return Err(format!(
                "Directory already exists and is not empty: {}",
                project_path_str
            ));
        }
        tracing::info!(
            "Reusing empty directory from previous attempt: {}",
            project_path_str
        );
    } else {
        // Create project directory
        std::fs::create_dir(&project_path)
            .map_err(|e| format!("Failed to create project directory: {}", e))?;
        tracing::info!("Created project directory: {}", project_path_str);
    }

    // Create project record with 'active' status
    // Note: DB constraint only allows 'active' or 'archived'
    let id = uuid::Uuid::new_v4().to_string().replace("-", "");

    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        conn.execute(
            "INSERT INTO projects (id, name, path, status) VALUES (?1, ?2, ?3, 'active')",
            params![id, project_name, project_path_str],
        )
        .map_err(|e| e.to_string())?;

        // Log activity
        let activity_id = uuid::Uuid::new_v4().to_string().replace("-", "");
        let template_info = template.as_ref().map_or("blank".to_string(), |t| t.clone());
        conn.execute(
            "INSERT INTO activity_log (id, project_id, event_type, message) VALUES (?1, ?2, 'project_created', ?3)",
            params![activity_id, id, format!("New project '{}' created (template: {}, discovery: {})", project_name, template_info, discovery_mode)],
        )
        .map_err(|e| e.to_string())?;
    }

    // Get the created project
    let project = get_project(db.clone(), id.clone()).await?;

    // Generate PTY session ID (use provided or create new)
    let session_id = provided_session_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    // Claude CLI path
    let claude_path = "claude".to_string();

    // Launch GSD initialization
    let command = format!(
        "{} -p --dangerously-skip-permissions /gsd:init",
        claude_path
    );

    tracing::info!(
        project_id = %id,
        "Starting new project PTY session {} for project {} with command: {}",
        session_id,
        id,
        command
    );

    // Create PTY session
    let mut manager = pty_manager.lock().await;
    manager.create_session(
        &app,
        session_id.clone(),
        &project_path_str,
        Some(&command),
        120,
        30,
    )?;

    Ok(CreateProjectResult {
        project,
        pty_session_id: session_id,
        template,
        discovery_mode,
        creation_mode: "new".to_string(),
    })
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn finalize_project_creation(
    db: tauri::State<'_, DbState>,
    projectId: String,
    success: bool,
) -> Result<crate::models::Project, String> {
    let project_id = projectId;

    tracing::info!(
        project_id = %project_id,
        "finalize_project_creation called: project={}, success={}",
        project_id, success
    );

    // Get the project to get its path
    let project = get_project(db.clone(), project_id.clone()).await?;

    // Re-detect tech stack now that .planning/ should exist
    let tech_stack = crate::commands::filesystem::detect_tech_stack_internal(&project.path)?;
    let tech_stack_json = serde_json::to_string(&tech_stack).map_err(|e| e.to_string())?;

    // Update project status
    // Note: DB constraint only allows 'active' or 'archived'
    let new_status = if success { "active" } else { "archived" };

    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        conn.execute(
            "UPDATE projects SET status = ?1, tech_stack = ?2, updated_at = datetime('now') WHERE id = ?3",
            params![new_status, tech_stack_json, project_id],
        )
        .map_err(|e| e.to_string())?;

        // Log activity
        let activity_id = uuid::Uuid::new_v4().to_string().replace("-", "");
        let message = if success {
            format!(
                "Project '{}' initialization completed successfully",
                project.name
            )
        } else {
            format!("Project '{}' initialization failed", project.name)
        };
        conn.execute(
            "INSERT INTO activity_log (id, project_id, event_type, message) VALUES (?1, ?2, ?3, ?4)",
            params![activity_id, project_id, if success { "project_initialized" } else { "project_init_failed" }, message],
        )
        .map_err(|e| e.to_string())?;
    }

    // Return updated project
    get_project(db, project_id).await
}

#[tauri::command]
pub async fn get_projects_with_stats(
    db: tauri::State<'_, DbState>,
) -> Result<Vec<ProjectWithStats>, String> {
    let conn = db.read().await;

    let mut stmt = conn
        .prepare(
            "SELECT
                p.id, p.name, p.path, p.description, p.tech_stack, p.config, p.status,
                p.created_at, p.updated_at, COALESCE(p.is_favorite, 0),
                COALESCE(cost_agg.total_cost, 0),
                fp.total_phases, fp.completed_phases, fp.total_tasks, fp.completed_tasks, fp.status,
                (SELECT MAX(created_at) FROM activity_log WHERE project_id = p.id)
            FROM projects p
            LEFT JOIN (
                SELECT project_id, SUM(total_cost) as total_cost
                FROM costs GROUP BY project_id
            ) cost_agg ON cost_agg.project_id = p.id
            LEFT JOIN (
                SELECT fp1.*
                FROM roadmaps fp1
                INNER JOIN (
                    SELECT project_id, MAX(created_at) as max_created
                    FROM roadmaps GROUP BY project_id
                ) fp2 ON fp1.project_id = fp2.project_id AND fp1.created_at = fp2.max_created
            ) fp ON fp.project_id = p.id
            WHERE p.status = 'active'
            ORDER BY COALESCE(p.is_favorite, 0) DESC, p.updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let projects = stmt
        .query_map([], |row| {
            let tech_stack_str: Option<String> = row.get(4)?;
            let tech_stack: Option<TechStack> =
                tech_stack_str.and_then(|s| serde_json::from_str(&s).ok());

            let config_str: Option<String> = row.get(5)?;
            let config: Option<serde_json::Value> =
                config_str.and_then(|s| serde_json::from_str(&s).ok());

            let is_fav: i32 = row.get(9)?;
            let total_cost: f64 = row.get(10)?;

            // Roadmap progress (nullable)
            let fp_total_phases: Option<i32> = row.get(11)?;
            let fp_completed_phases: Option<i32> = row.get(12)?;
            let fp_total_tasks: Option<i32> = row.get(13)?;
            let fp_completed_tasks: Option<i32> = row.get(14)?;
            let fp_status: Option<String> = row.get(15)?;
            let last_activity_at: Option<String> = row.get(16)?;

            let roadmap_progress = fp_total_phases.map(|tp| RoadmapProgress {
                total_phases: tp,
                completed_phases: fp_completed_phases.unwrap_or(0),
                total_tasks: fp_total_tasks.unwrap_or(0),
                completed_tasks: fp_completed_tasks.unwrap_or(0),
                status: fp_status.unwrap_or_else(|| "pending".to_string()),
            });

            Ok(ProjectWithStats {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                description: row.get(3)?,
                tech_stack,
                config,
                status: row.get(6)?,
                is_favorite: is_fav != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                total_cost,
                roadmap_progress,
                last_activity_at,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(projects)
}

#[tauri::command]
pub async fn get_git_info(path: String) -> Result<GitInfo, String> {
    let git_dir = std::path::Path::new(&path).join(".git");
    if !git_dir.exists() {
        return Ok(GitInfo {
            branch: None,
            is_dirty: false,
            has_git: false,
        });
    }

    // Get current branch
    let branch = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            } else {
                None
            }
        });

    // Check dirty status
    let is_dirty = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&path)
        .output()
        .ok()
        .map(|out| !out.stdout.is_empty())
        .unwrap_or(false);

    Ok(GitInfo {
        branch,
        is_dirty,
        has_git: true,
    })
}

#[tauri::command]
pub async fn toggle_favorite(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<bool, String> {
    let db = db.write().await;
    let conn = db.conn();

    // Toggle is_favorite: 0 -> 1, 1 -> 0
    conn.execute(
        "UPDATE projects SET is_favorite = CASE WHEN COALESCE(is_favorite, 0) = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;

    // Return new state
    let new_state: bool = conn
        .query_row(
            "SELECT COALESCE(is_favorite, 0) FROM projects WHERE id = ?1",
            params![project_id],
            |row| {
                let val: i32 = row.get(0)?;
                Ok(val != 0)
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(new_state)
}
