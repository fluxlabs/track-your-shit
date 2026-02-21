// Track Your Shit - Library Root (Tauri app setup, command registration, event listeners)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

mod commands;
pub mod db;
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
            let tracing_db_path = app_data_dir.join("track-your-shit.db");
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

            tracing::info!("Track Your Shit initialized");
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
            commands::filesystem::detect_docs_available,
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
            commands::activity::get_decisions,
            commands::activity::get_all_decisions,
            commands::activity::get_decision_categories,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::check_claude_status,
            commands::settings::reset_settings,
            commands::settings::import_settings,
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
            commands::pty::pty_list_sessions,
            commands::pty::pty_is_active,
            commands::pty::pty_get_session_info,
            commands::pty::pty_active_count,
            commands::pty::pty_close_all,
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
            commands::logs::rotate_app_logs,
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
            commands::dependencies::run_dependency_audit,
            commands::dependencies::get_outdated_packages,
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
            // Secrets / OS keychain commands
            commands::secrets::set_secret,
            commands::secrets::get_secret,
            commands::secrets::delete_secret,
            commands::secrets::list_secret_keys,
            commands::secrets::get_predefined_secret_keys,
            commands::secrets::has_secret,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Track Your Shit");
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert!(true);
    }
}
