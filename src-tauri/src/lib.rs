// VCCA - Library Root (Tauri app setup, command registration, event listeners)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

mod commands;
pub mod db;
mod headless;
mod models;
mod pty;
mod security;

use db::tracing_layer::SqliteLayer;
use db::DbPool;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

pub fn run() {
    // Create the SQLite tracing layer (DB connection set during Tauri setup)
    let (sqlite_layer, sqlite_layer_handle) = SqliteLayer::new();

    // Initialize layered tracing subscriber: env-filter + fmt + sqlite
    let _ = tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with(tracing_subscriber::fmt::layer())
        .with(sqlite_layer)
        .try_init();

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init());

    // Add single-instance plugin on desktop platforms
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {
            tracing::info!("Another instance attempted to start");
        }));
    }

    builder
        .setup(move |app| {
            // Initialize database connection pool (1 writer + N readers)
            let pool = DbPool::new(app.handle())?;

            // Set up the tracing layer's DB connection (separate connection to avoid deadlocks)
            let app_data_dir = app.handle().path().app_data_dir().unwrap();
            let tracing_db_path = app_data_dir.join("gsd-vibe.db");
            sqlite_layer_handle.set_db_path(tracing_db_path);
            sqlite_layer_handle.set_app_handle(app.handle().clone());

            // Use the writer for startup queries (we're still single-threaded here)
            let tmux_status;
            {
                let writer = pool.writer_arc();
                let db = writer.blocking_lock();

                // Read use_tmux setting from DB
                let use_tmux: bool = db
                    .conn()
                    .query_row(
                        "SELECT value FROM settings WHERE key = 'use_tmux'",
                        [],
                        |row| row.get::<_, String>(0),
                    )
                    .map(|v| v == "true")
                    .unwrap_or(true);

                // Initialize Terminal Manager (auto-detects tmux availability)
                let terminal_manager = pty::TerminalManager::new(use_tmux);

                tmux_status = serde_json::json!({
                    "available": terminal_manager.tmux_available,
                    "version": terminal_manager.tmux_version,
                    "enabled": terminal_manager.use_tmux,
                });

                // Cleanup orphaned tmux sessions if tmux is available
                if terminal_manager.tmux_available {
                    let known_names: Vec<String> = db
                        .conn()
                        .prepare("SELECT tmux_session FROM terminal_sessions WHERE tmux_session IS NOT NULL")
                        .and_then(|mut stmt| {
                            stmt.query_map([], |row| row.get::<_, String>(0))
                                .map(|rows| rows.filter_map(|r| r.ok()).collect())
                        })
                        .unwrap_or_default();

                    pty::TerminalManager::cleanup_orphaned(&known_names);
                }

                app.manage(Arc::new(Mutex::new(terminal_manager)));
                app.manage(Arc::new(Mutex::new(
                    crate::headless::HeadlessSessionRegistry::new(),
                )));
            }

            // Register the pool as managed state
            let pool = Arc::new(pool);
            app.manage(pool.clone());

            // Emit tmux status event after app is set up
            let tmux_status_clone = tmux_status.clone();
            let app_handle_tmux = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                let _ = app_handle_tmux.emit("app:tmux-status", tmux_status_clone);
            });

            // Initialize file watcher manager
            let watcher_manager = commands::watcher::WatcherManager::new();
            app.manage(Arc::new(Mutex::new(watcher_manager)));

            // Spawn background task to refresh stale project descriptions
            // (fixes HTML comments, raw markdown markers stored from previous imports)
            let pool_for_refresh = pool.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = refresh_stale_descriptions(pool_for_refresh).await {
                    tracing::warn!("Description refresh failed (non-fatal): {}", e);
                }
            });

            tracing::info!("VCCA initialized");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Project commands
            commands::projects::list_projects,
            commands::projects::get_project,
            commands::projects::import_project,
            commands::projects::import_project_enhanced,
            commands::projects::check_project_path,
            commands::projects::create_new_project,
            commands::projects::finalize_project_creation,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::projects::archive_project,
            commands::projects::get_projects_with_stats,
            commands::projects::get_git_info,
            commands::projects::toggle_favorite,
            // File system commands
            commands::filesystem::detect_tech_stack,
            commands::filesystem::get_scanner_summary,
            commands::filesystem::read_project_file,
            commands::filesystem::read_project_docs,
            commands::filesystem::pick_folder,
            commands::filesystem::list_knowledge_files,
            commands::filesystem::list_code_files,
            commands::filesystem::search_knowledge_files,
            commands::filesystem::write_project_file,
            commands::filesystem::delete_project_file,
            commands::filesystem::index_project_markdown,
            commands::filesystem::build_knowledge_graph,
            // Activity commands
            commands::activity::get_activity_log,
            commands::activity::search_activity,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::reset_settings,
            commands::settings::import_settings,
            // Onboarding commands
            commands::onboarding::onboarding_get_status,
            commands::onboarding::onboarding_detect_dependencies,
            commands::onboarding::onboarding_validate_and_store_api_key,
            commands::onboarding::onboarding_mark_complete,
            // Data commands
            commands::data::export_data,
            commands::data::clear_all_data,
            commands::data::clear_selected_data,
            // PTY commands
            commands::pty::pty_create,
            commands::pty::pty_write,
            commands::pty::pty_resize,
            commands::pty::pty_close,
            commands::pty::pty_detach,
            commands::pty::pty_is_active,
            commands::pty::pty_get_session_info,
            commands::pty::pty_attach,
            commands::pty::pty_check_tmux,
            commands::pty::pty_list_tmux,
            // Knowledge commands
            commands::knowledge::knowledge_store,
            commands::knowledge::knowledge_search,
            commands::knowledge::knowledge_list,
            commands::knowledge::knowledge_get,
            commands::knowledge::knowledge_update,
            commands::knowledge::knowledge_delete,
            commands::knowledge::knowledge_categories,
            commands::knowledge::knowledge_import,
            commands::knowledge::create_knowledge_bookmark,
            commands::knowledge::list_knowledge_bookmarks,
            commands::knowledge::delete_knowledge_bookmark,
            // Global search
            commands::search::global_search,
            // App log commands
            commands::logs::get_app_logs,
            commands::logs::get_app_log_stats,
            commands::logs::get_log_levels,
            commands::logs::clear_app_logs,
            commands::logs::log_frontend_error,
            commands::logs::log_frontend_event,
            // Git commands
            commands::git::get_git_status,
            commands::git::get_environment_info,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_fetch,
            commands::git::git_stage_all,
            commands::git::git_commit,
            commands::git::git_stash_save,
            commands::git::git_stash_pop,
            commands::git::git_changed_files,
            commands::git::git_log,
            commands::git::git_stage_file,
            commands::git::git_unstage_file,
            commands::git::git_discard_file,
            commands::git::git_remote_url,
            commands::git::git_branches,
            commands::git::git_tags,
            // Notification commands
            commands::notifications::get_notifications,
            commands::notifications::get_unread_notification_count,
            commands::notifications::create_notification,
            commands::notifications::mark_notification_read,
            commands::notifications::mark_all_notifications_read,
            commands::notifications::clear_notifications,
            // Terminal commands
            commands::terminal::get_command_history,
            commands::terminal::add_command_history,
            commands::terminal::clear_command_history,
            commands::terminal::get_script_favorites,
            commands::terminal::toggle_script_favorite,
            commands::terminal::reorder_script_favorites,
            commands::terminal::save_terminal_sessions,
            commands::terminal::restore_terminal_sessions,
            // Snippet & auto-command commands
            commands::snippets::list_snippets,
            commands::snippets::create_snippet,
            commands::snippets::update_snippet,
            commands::snippets::delete_snippet,
            commands::snippets::list_auto_commands,
            commands::snippets::create_auto_command,
            commands::snippets::update_auto_command,
            commands::snippets::delete_auto_command,
            commands::snippets::toggle_auto_command,
            commands::snippets::get_auto_command_presets,
            // Dependency scanner commands
            commands::dependencies::get_dependency_status,
            commands::dependencies::invalidate_dependency_cache,
            // File watcher commands
            commands::watcher::watch_project_files,
            commands::watcher::unwatch_project_files,
            // GSD commands
            commands::gsd::gsd_get_project_info,
            commands::gsd::gsd_get_state,
            commands::gsd::gsd_get_config,
            commands::gsd::gsd_list_requirements,
            commands::gsd::gsd_list_milestones,
            commands::gsd::gsd_list_todos,
            commands::gsd::gsd_create_todo,
            commands::gsd::gsd_update_todo,
            commands::gsd::gsd_complete_todo,
            commands::gsd::gsd_delete_todo,
            commands::gsd::gsd_list_debug_sessions,
            commands::gsd::gsd_get_debug_session,
            commands::gsd::gsd_list_research,
            commands::gsd::gsd_get_verification,
            commands::gsd::gsd_get_phase_context,
            commands::gsd::gsd_list_plans,
            commands::gsd::gsd_get_phase_plans,
            commands::gsd::gsd_list_summaries,
            commands::gsd::gsd_get_phase_summaries,
            commands::gsd::gsd_list_phase_research,
            commands::gsd::gsd_get_phase_research,
            commands::gsd::gsd_list_milestone_audits,
            commands::gsd::gsd_sync_project,
            commands::gsd::gsd_get_roadmap_progress,
            commands::gsd::gsd_update_config,
            commands::gsd::gsd_list_all_todos,
            commands::gsd::gsd_list_validations,
            commands::gsd::gsd_get_validation_by_phase,
            commands::gsd::gsd_list_uat_results,
            commands::gsd::gsd_get_uat_by_phase,
            commands::gsd::gsd_get_phase_spec,
            commands::gsd::gsd_get_phase_security,
            commands::gsd::gsd_get_phase_validation_doc,
            commands::gsd::gsd_get_phase_review,
            commands::gsd::gsd_get_codebase_docs,
            commands::gsd::gsd_get_process_docs,
            // GSD-2 commands
            commands::gsd2::gsd2_list_milestones,
            commands::gsd2::gsd2_get_milestone,
            commands::gsd2::gsd2_get_slice,
            commands::gsd2::gsd2_derive_state,
            commands::gsd2::gsd2_get_health,
            commands::gsd2::gsd2_list_worktrees,
            commands::gsd2::gsd2_remove_worktree,
            commands::gsd2::gsd2_get_worktree_diff,
            commands::gsd2::gsd2_headless_query,
            commands::gsd2::gsd2_headless_get_session,
            commands::gsd2::gsd2_headless_unregister,
            commands::gsd2::gsd2_headless_start,
            commands::gsd2::gsd2_headless_stop,
            commands::gsd2::gsd2_get_inspect,
            commands::gsd2::gsd2_get_steer_content,
            commands::gsd2::gsd2_set_steer_content,
            commands::gsd2::gsd2_get_undo_info,
            commands::gsd2::gsd2_get_recovery_info,
            commands::gsd2::gsd2_get_history,
            commands::gsd2::gsd2_get_hooks,
            commands::gsd2::gsd2_get_git_summary,
            commands::gsd2::gsd2_export_progress,
            commands::gsd2::gsd2_get_visualizer_data,
            commands::gsd2::can_safely_close,
            commands::gsd2::force_close_all,
            commands::gsd2::gsd2_doctor,
            commands::gsd2::gsd2_list_sessions,
            commands::gsd2::gsd2_list_models,
            commands::gsd2::gsd2_generate_plan_preview,
            commands::gsd2::gsd2_merge_worktree,
            commands::gsd2::gsd2_clean_worktrees,
            commands::gsd2::gsd2_headless_start_with_model,
            commands::gsd2::gsd2_get_doctor_report,
            commands::gsd2::gsd2_apply_doctor_fixes,
            commands::gsd2::gsd2_get_forensics_report,
            commands::gsd2::gsd2_get_skill_health,
            commands::gsd2::gsd2_get_knowledge,
            commands::gsd2::gsd2_get_captures,
            commands::gsd2::gsd2_resolve_capture,
            commands::gsd2::gsd2_generate_html_report,
            commands::gsd2::gsd2_get_reports_index,
            commands::gsd2::gsd2_get_preferences,
            commands::gsd2::gsd2_save_preferences,
            // GitHub commands
            commands::github::github_get_token_status,
            commands::github::github_get_repo_info,
            commands::github::github_list_prs,
            commands::github::github_create_pr,
            commands::github::github_get_pr_reviews,
            commands::github::github_list_issues,
            commands::github::github_create_issue,
            commands::github::github_list_check_runs,
            commands::github::github_list_releases,
            commands::github::github_list_repo_notifications,
            commands::github::github_import_gh_token,
            commands::github::github_save_token,
            commands::github::github_remove_token,
            // Secrets / OS keychain commands
            commands::secrets::set_secret,
            commands::secrets::get_secret,
            commands::secrets::delete_secret,
            commands::secrets::list_secret_keys,
            commands::secrets::get_predefined_secret_keys,
            commands::secrets::has_secret,
            // Template commands
            commands::templates::list_project_templates,
            commands::templates::list_gsd_planning_templates,
            commands::templates::scaffold_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running VCCA");
}

/// Re-read descriptions for projects whose stored description contains HTML comments
/// or raw markdown formatting. Runs once at startup, non-blocking.
async fn refresh_stale_descriptions(pool: Arc<DbPool>) -> Result<(), String> {
    use rusqlite::params;

    // Read all projects with their current descriptions
    let projects: Vec<(String, Option<String>, String)> = {
        let conn = pool.read().await;
        let mut stmt = conn
            .prepare("SELECT id, description, path FROM projects")
            .map_err(|e: rusqlite::Error| e.to_string())?;
        let rows = stmt.query_map([], |row: &rusqlite::Row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e: rusqlite::Error| e.to_string())?;
        rows.filter_map(|r: Result<(String, Option<String>, String), rusqlite::Error>| r.ok())
            .collect()
    };

    let mut updated = 0u32;
    for (id, desc, path) in &projects {
        let needs_refresh = match desc.as_deref() {
            Some(d) => {
                d.contains("<!--")
                    || d.contains("-->")
                    || d.contains("**")
                    || d.contains("__")
                    || d.contains("~~")
            }
            None => false,
        };

        if !needs_refresh {
            continue;
        }

        // Re-read docs from disk using the same priority chain as import
        if let Ok(Some(docs)) =
            commands::filesystem::read_project_docs(path.to_string()).await
        {
            if let Some(ref new_desc) = docs.description {
                let db = pool.write().await;
                let _ = db.conn().execute(
                    "UPDATE projects SET description = ?1, updated_at = datetime('now') WHERE id = ?2",
                    params![new_desc, id],
                );
                updated += 1;
            }
        }
    }

    if updated > 0 {
        tracing::info!("Refreshed {} stale project descriptions", updated);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert!(true);
    }
}
