// Control Tower - PTY Commands
// Tauri command handlers for PTY operations
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::pty::{SessionInfo, TerminalManagerState, TmuxSessionInfo};
use tauri::{AppHandle, State};

/// Input for creating a new PTY session
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct CreatePtyInput {
    /// Working directory for the shell
    pub working_directory: String,
    /// Optional command to run (default: user's shell)
    pub command: Option<String>,
    /// Terminal columns
    pub cols: u16,
    /// Terminal rows
    pub rows: u16,
    /// Optional session name hint
    pub session_name: Option<String>,
}

/// Result from creating a PTY session
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePtyResult {
    /// The session ID
    pub session_id: String,
    /// tmux session name (null for native sessions)
    pub tmux_name: Option<String>,
}

/// Create a new PTY session
#[tauri::command]
pub async fn pty_create(
    app: AppHandle,
    state: State<'_, TerminalManagerState>,
    input: CreatePtyInput,
) -> Result<CreatePtyResult, String> {
    // Generate a unique session ID
    let session_id = uuid::Uuid::new_v4().to_string();

    let mut manager = state.lock().await;
    let tmux_name = manager.create_session(
        &app,
        session_id.clone(),
        &input.working_directory,
        input.command.as_deref(),
        input.cols,
        input.rows,
    )?;

    Ok(CreatePtyResult {
        session_id,
        tmux_name,
    })
}

/// Attach to an existing tmux session (reconnect after app restart)
#[tauri::command]
pub async fn pty_attach(
    app: AppHandle,
    state: State<'_, TerminalManagerState>,
    session_id: String,
    tmux_name: String,
    working_dir: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    let mut manager = state.lock().await;
    manager.attach_session(&app, session_id, &tmux_name, &working_dir, cols, rows)
}

/// Check if tmux is available, returning version string or null
#[tauri::command]
pub async fn pty_check_tmux() -> Result<Option<String>, String> {
    Ok(crate::pty::TerminalManager::check_tmux())
}

/// List all Control Tower tmux sessions
#[tauri::command]
pub async fn pty_list_tmux() -> Result<Vec<TmuxSessionInfo>, String> {
    Ok(crate::pty::TerminalManager::list_ct_sessions())
}

/// Write data to a PTY session
#[tauri::command]
pub async fn pty_write(
    state: State<'_, TerminalManagerState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    let mut manager = state.lock().await;
    manager.write(&session_id, &data)
}

/// Resize a PTY session
#[tauri::command]
pub async fn pty_resize(
    state: State<'_, TerminalManagerState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let manager = state.lock().await;
    manager.resize(&session_id, cols, rows)
}

/// Detach a PTY session (close PTY without killing tmux session)
/// Used when reconnecting to the same tmux session from a fresh mount
#[tauri::command]
pub async fn pty_detach(
    state: State<'_, TerminalManagerState>,
    session_id: String,
) -> Result<(), String> {
    let mut manager = state.lock().await;
    manager.detach_session(&session_id)
}

/// Close a PTY session
#[tauri::command]
pub async fn pty_close(
    app: AppHandle,
    state: State<'_, TerminalManagerState>,
    session_id: String,
) -> Result<Option<i32>, String> {
    let mut manager = state.lock().await;
    manager.close(&app, &session_id)
}

/// List all active PTY session IDs
#[tauri::command]
pub async fn pty_list_sessions(
    state: State<'_, TerminalManagerState>,
) -> Result<Vec<String>, String> {
    let manager = state.lock().await;
    Ok(manager.list_sessions())
}

/// Check if a PTY session is active
#[tauri::command]
pub async fn pty_is_active(
    state: State<'_, TerminalManagerState>,
    session_id: String,
) -> Result<bool, String> {
    let mut manager = state.lock().await;
    Ok(manager.is_active(&session_id))
}

/// Get information about a PTY session
#[tauri::command]
pub async fn pty_get_session_info(
    state: State<'_, TerminalManagerState>,
    session_id: String,
) -> Result<Option<SessionInfo>, String> {
    let manager = state.lock().await;
    Ok(manager.get_session_info(&session_id))
}

/// Get count of active PTY sessions
#[tauri::command]
pub async fn pty_active_count(state: State<'_, TerminalManagerState>) -> Result<usize, String> {
    let mut manager = state.lock().await;
    Ok(manager.active_count())
}

/// Close all PTY sessions (used on app exit)
/// tmux sessions are detached (survive), native sessions are killed
#[tauri::command]
pub async fn pty_close_all(state: State<'_, TerminalManagerState>) -> Result<usize, String> {
    let mut manager = state.lock().await;
    let count = manager.active_count();
    manager.close_all();
    Ok(count)
}
