// Control Tower - File Watcher Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Manages file watchers per project path
pub struct WatcherManager {
    watchers: HashMap<String, notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>,
}

impl WatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: HashMap::new(),
        }
    }
}

type WatcherState = Arc<Mutex<WatcherManager>>;

/// Start watching a project's knowledge files for changes
/// Emits "knowledge:file-changed" events when .md files change
/// Emits "gsd:file-changed" events when .planning/ files change (with change_type classification)
#[tauri::command]
pub async fn watch_project_files(
    watcher_manager: tauri::State<'_, WatcherState>,
    app: AppHandle,
    project_path: String,
) -> Result<bool, String> {
    let mut manager = watcher_manager.lock().await;

    // Already watching this path
    if manager.watchers.contains_key(&project_path) {
        return Ok(true);
    }

    let path = PathBuf::from(&project_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", project_path));
    }

    let app_handle = app.clone();
    let project_path_clone = project_path.clone();

    let mut debouncer = new_debouncer(
        Duration::from_secs(2),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            match res {
                Ok(events) => {
                    for event in events {
                        if event.kind == DebouncedEventKind::Any {
                            let changed_path = event.path.to_string_lossy().to_string();
                            // Emit for .md files (knowledge file changes)
                            if changed_path.ends_with(".md") {
                                let _ = app_handle.emit(
                                    "knowledge:file-changed",
                                    serde_json::json!({
                                        "project_path": project_path_clone,
                                        "file_path": changed_path,
                                    }),
                                );
                            }
                            // Emit GSD-specific events for .planning/ file changes
                            if changed_path.contains("/.planning/")
                                || changed_path.contains("\\.planning\\")
                            {
                                let change_type = if changed_path.contains("/phases/")
                                    || changed_path.contains("\\phases\\")
                                {
                                    "gsd_phase"
                                } else if changed_path.contains("/todos/")
                                    || changed_path.contains("\\todos\\")
                                {
                                    "gsd_todo"
                                } else if changed_path.contains("REQUIREMENTS.md") {
                                    "gsd_requirements"
                                } else if changed_path.contains("ROADMAP.md") {
                                    "gsd_roadmap"
                                } else if changed_path.contains("STATE.md") {
                                    "gsd_state"
                                } else if changed_path.contains("PROJECT.md") {
                                    "gsd_project"
                                } else if changed_path.contains("config.json") {
                                    "gsd_config"
                                } else {
                                    "gsd_other"
                                };
                                let _ = app_handle.emit(
                                    "gsd:file-changed",
                                    serde_json::json!({
                                        "project_path": project_path_clone,
                                        "file_path": changed_path,
                                        "change_type": change_type,
                                    }),
                                );
                            }
                            // Emit deps:file-changed for dependency file changes at project root
                            if let Some(file_name) = event.path.file_name().and_then(|f| f.to_str())
                            {
                                let is_dep_file = matches!(
                                    file_name,
                                    "package.json"
                                        | "package-lock.json"
                                        | "yarn.lock"
                                        | "pnpm-lock.yaml"
                                        | "Cargo.toml"
                                        | "Cargo.lock"
                                        | "pyproject.toml"
                                        | "requirements.txt"
                                );
                                if is_dep_file {
                                    let _ = app_handle.emit(
                                        "deps:file-changed",
                                        serde_json::json!({
                                            "project_path": project_path_clone,
                                            "file_path": changed_path,
                                        }),
                                    );
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("File watcher error: {}", e);
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    // Watch the .planning directory
    let planning_dir = path.join(".planning");

    let watcher = debouncer.watcher();

    if planning_dir.exists() {
        watcher
            .watch(&planning_dir, notify::RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch .planning: {}", e))?;
    }

    // Watch dependency files at project root (NonRecursive to avoid deep scanning)
    let dep_files = [
        "package.json",
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "Cargo.toml",
        "Cargo.lock",
        "pyproject.toml",
        "requirements.txt",
    ];
    for dep_file in &dep_files {
        let dep_path = path.join(dep_file);
        if dep_path.exists() {
            // watch individual files at project root
            let _ = watcher.watch(&dep_path, notify::RecursiveMode::NonRecursive);
        }
    }

    manager.watchers.insert(project_path.clone(), debouncer);
    tracing::info!("Started file watcher for: {}", project_path);

    Ok(true)
}

/// Stop watching a project's files
#[tauri::command]
pub async fn unwatch_project_files(
    watcher_manager: tauri::State<'_, WatcherState>,
    project_path: String,
) -> Result<bool, String> {
    let mut manager = watcher_manager.lock().await;

    if manager.watchers.remove(&project_path).is_some() {
        tracing::info!("Stopped file watcher for: {}", project_path);
        Ok(true)
    } else {
        Ok(false)
    }
}
