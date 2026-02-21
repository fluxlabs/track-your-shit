// Control Tower - Terminal Manager Module
// Manages pseudo-terminal sessions with optional tmux persistence
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex as StdMutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

/// Event payload for PTY output
#[derive(Clone, serde::Serialize)]
pub struct PtyOutputEvent {
    pub session_id: String,
    pub data: Vec<u8>,
}

/// Event payload for PTY exit
#[derive(Clone, serde::Serialize)]
pub struct PtyExitEvent {
    pub session_id: String,
    pub exit_code: Option<i32>,
}

/// Event payload for PTY errors
#[allow(dead_code)]
#[derive(Clone, serde::Serialize)]
pub struct PtyErrorEvent {
    pub session_id: String,
    pub error: String,
}

/// Info about a tmux session managed by Control Tower
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct TmuxSessionInfo {
    pub name: String,
    pub working_directory: String,
    pub created_at: String,
}

/// Backend type for a terminal session
pub enum SessionBackend {
    /// Raw PTY — current behavior, no persistence
    Native,
    /// tmux-backed — persistent across app restarts
    Tmux { tmux_name: String },
}

/// A single terminal session with master handle and child process
pub struct TerminalSession {
    /// Backend type (native or tmux)
    backend: SessionBackend,
    /// PTY master for read/write operations
    master: Box<dyn MasterPty + Send>,
    /// Writer handle for sending data to PTY
    writer: Box<dyn Write + Send>,
    /// Child process handle (shared with monitor thread for command sessions)
    child: Arc<StdMutex<Box<dyn Child + Send + Sync>>>,
    /// Working directory for this session
    pub working_directory: String,
    /// Session creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl TerminalSession {
    /// Write data to the PTY input
    pub fn write(&mut self, data: &[u8]) -> std::io::Result<()> {
        self.writer.write_all(data)?;
        self.writer.flush()
    }

    /// Resize the PTY
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        self.master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))
    }

    /// Check if the child process is still running
    pub fn is_running(&mut self) -> bool {
        match self.child.lock() {
            Ok(mut child) => match child.try_wait() {
                Ok(None) => true, // Still running
                _ => false,       // Exited or error
            },
            Err(_) => false, // Poisoned mutex = treat as exited
        }
    }

    /// Kill the child process
    pub fn kill(&mut self) -> std::io::Result<()> {
        match self.child.lock() {
            Ok(mut child) => child.kill(),
            Err(_) => Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Child mutex poisoned",
            )),
        }
    }

    /// Get exit status if process has exited
    pub fn exit_status(&mut self) -> Option<i32> {
        match self.child.lock() {
            Ok(mut child) => match child.try_wait() {
                Ok(Some(status)) => Some(status.exit_code() as i32),
                _ => None,
            },
            Err(_) => None,
        }
    }

    /// Get the tmux session name if this is a tmux-backed session
    #[allow(dead_code)]
    pub fn tmux_name(&self) -> Option<&str> {
        match &self.backend {
            SessionBackend::Tmux { tmux_name } => Some(tmux_name),
            SessionBackend::Native => None,
        }
    }
}

/// Manages multiple terminal sessions with optional tmux persistence
pub struct TerminalManager {
    /// Active sessions indexed by session ID
    sessions: HashMap<String, TerminalSession>,
    /// Default shell path
    default_shell: String,
    /// Whether tmux is available on the system
    pub tmux_available: bool,
    /// tmux version string (if available)
    pub tmux_version: Option<String>,
    /// Whether to use tmux for new sessions (user preference)
    pub use_tmux: bool,
}

impl TerminalManager {
    /// Create a new terminal manager, auto-detecting tmux availability
    pub fn new(use_tmux: bool) -> Self {
        let default_shell = std::env::var("SHELL").unwrap_or_else(|_| {
            #[cfg(windows)]
            {
                "cmd.exe".to_string()
            }
            #[cfg(not(windows))]
            {
                "/bin/bash".to_string()
            }
        });

        let (tmux_available, tmux_version) = match Self::check_tmux() {
            Some(version) => (true, Some(version)),
            None => (false, None),
        };

        if tmux_available {
            tracing::info!(
                "tmux detected: {} (use_tmux={})",
                tmux_version.as_deref().unwrap_or("unknown"),
                use_tmux
            );
        } else {
            tracing::info!("tmux not found, using native PTY only");
        }

        Self {
            sessions: HashMap::new(),
            default_shell,
            tmux_available,
            tmux_version,
            use_tmux,
        }
    }

    /// Check if tmux is installed, returning version string
    pub fn check_tmux() -> Option<String> {
        std::process::Command::new("tmux")
            .arg("-V")
            .output()
            .ok()
            .filter(|output| output.status.success())
            .and_then(|output| {
                String::from_utf8(output.stdout)
                    .ok()
                    .map(|s| s.trim().to_string())
            })
    }

    /// Run a tmux command and return stdout
    fn run_tmux(args: &[&str]) -> Result<String, String> {
        let output = std::process::Command::new("tmux")
            .args(args)
            .output()
            .map_err(|e| format!("Failed to run tmux: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("tmux error: {}", stderr.trim()));
        }

        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    /// List all Control Tower tmux sessions (prefixed with `ct-`)
    pub fn list_ct_sessions() -> Vec<TmuxSessionInfo> {
        let output = std::process::Command::new("tmux")
            .args([
                "list-sessions",
                "-F",
                "#{session_name}\t#{session_path}\t#{session_created}",
            ])
            .output();

        let output = match output {
            Ok(o) if o.status.success() => o,
            _ => return vec![],
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(3, '\t').collect();
                if parts.len() >= 1 && parts[0].starts_with("ct-") {
                    Some(TmuxSessionInfo {
                        name: parts[0].to_string(),
                        working_directory: parts.get(1).unwrap_or(&"").to_string(),
                        created_at: parts.get(2).unwrap_or(&"").to_string(),
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    /// Kill orphaned ct-* tmux sessions not in the known list
    pub fn cleanup_orphaned(known_names: &[String]) {
        let live_sessions = Self::list_ct_sessions();
        for session in live_sessions {
            if !known_names.contains(&session.name) {
                tracing::info!("Cleaning up orphaned tmux session: {}", session.name);
                let _ = Self::run_tmux(&["kill-session", "-t", &session.name]);
            }
        }
    }

    /// Whether tmux should be used for new sessions
    fn should_use_tmux(&self) -> bool {
        self.tmux_available && self.use_tmux
    }

    /// Create a new terminal session
    pub fn create_session(
        &mut self,
        app: &AppHandle,
        session_id: String,
        working_dir: &str,
        command: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<Option<String>, String> {
        // Check if session already exists
        if self.sessions.contains_key(&session_id) {
            return Err(format!("Session {} already exists", session_id));
        }

        if self.should_use_tmux() {
            self.create_tmux_session(app, session_id, working_dir, command, cols, rows)
        } else {
            self.create_native_session(app, session_id, working_dir, command, cols, rows)?;
            Ok(None)
        }
    }

    /// Create a tmux-backed session
    fn create_tmux_session(
        &mut self,
        app: &AppHandle,
        session_id: String,
        working_dir: &str,
        command: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<Option<String>, String> {
        // Generate tmux session name: ct-<first-8-of-uuid>
        let tmux_name = format!("ct-{}", &session_id[..8.min(session_id.len())]);

        // Build tmux new-session command
        let cols_str = cols.to_string();
        let rows_str = rows.to_string();

        let mut tmux_args: Vec<&str> = vec![
            "new-session",
            "-d",
            "-s",
            &tmux_name,
            "-c",
            working_dir,
            "-x",
            &cols_str,
            "-y",
            &rows_str,
        ];

        // Always pass explicit shell command for clean terminals (no rc files)
        let is_zsh = self.default_shell.ends_with("zsh");
        let is_bash = self.default_shell.ends_with("bash");
        let shell_cmd;
        if let Some(cmd) = command {
            // Command sessions: run via clean shell without rc files
            let escaped = cmd.replace('\'', "'\\''");
            if is_zsh {
                shell_cmd = format!("{} --no-rcs -c '{}'", self.default_shell, escaped);
            } else if is_bash {
                shell_cmd = format!("{} --norc --noprofile -c '{}'", self.default_shell, escaped);
            } else {
                shell_cmd = format!("{} -c '{}'", self.default_shell, escaped);
            }
        } else {
            // Interactive sessions: start clean shell without rc files, with custom prompt
            let dir_name = std::path::Path::new(working_dir)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(working_dir)
                .replace('\'', "'\\''");
            if is_zsh {
                shell_cmd = format!(
                    "/usr/bin/env TERM=xterm-256color COLORTERM=truecolor CONTROL_TOWER=1 PS1='%F{{cyan}}{}%f %F{{blue}}$%f ' {} --no-rcs",
                    dir_name, self.default_shell
                );
            } else if is_bash {
                shell_cmd = format!(
                    "/usr/bin/env TERM=xterm-256color COLORTERM=truecolor CONTROL_TOWER=1 PS1='\\[\\033[36m\\]{}\\[\\033[0m\\] \\[\\033[34m\\]$\\[\\033[0m\\] ' {} --norc --noprofile",
                    dir_name, self.default_shell
                );
            } else {
                shell_cmd = format!(
                    "/usr/bin/env TERM=xterm-256color COLORTERM=truecolor CONTROL_TOWER=1 {}",
                    self.default_shell
                );
            }
        }
        tmux_args.push(&shell_cmd);

        Self::run_tmux(&tmux_args)?;

        // Configure the tmux session
        let _ = Self::run_tmux(&["set-option", "-t", &tmux_name, "status", "off"]);
        let _ = Self::run_tmux(&["set-option", "-t", &tmux_name, "-g", "mouse", "on"]);
        let _ = Self::run_tmux(&["set-option", "-t", &tmux_name, "history-limit", "50000"]);

        // Set clean shell as default-command for new panes/windows in this session
        if command.is_none() {
            let default_cmd = if is_zsh {
                format!("{} --no-rcs", self.default_shell)
            } else if is_bash {
                format!("{} --norc --noprofile", self.default_shell)
            } else {
                self.default_shell.clone()
            };
            let _ = Self::run_tmux(&[
                "set-option",
                "-t",
                &tmux_name,
                "default-command",
                &default_cmd,
            ]);
        }

        // Now open a PTY pair and attach to the tmux session
        let (master, writer, child, reader) =
            self.open_pty_for_tmux(&tmux_name, working_dir, cols, rows)?;

        let session = TerminalSession {
            backend: SessionBackend::Tmux {
                tmux_name: tmux_name.clone(),
            },
            master,
            writer,
            child: child.clone(),
            working_directory: working_dir.to_string(),
            created_at: chrono::Utc::now(),
        };

        self.sessions.insert(session_id.clone(), session);

        // For command-based sessions, spawn a monitor thread
        if command.is_some() {
            self.spawn_monitor_thread(app, &session_id, child.clone());
        }

        // Spawn reader thread
        self.spawn_reader_thread(app, &session_id, reader);

        tracing::info!(
            "Created tmux session {} (tmux: {}) in {}",
            session_id,
            tmux_name,
            working_dir
        );

        Ok(Some(tmux_name))
    }

    /// Attach to an existing tmux session (for reconnection after app restart)
    pub fn attach_session(
        &mut self,
        app: &AppHandle,
        session_id: String,
        tmux_name: &str,
        working_dir: &str,
        cols: u16,
        rows: u16,
    ) -> Result<bool, String> {
        // Verify the tmux session still exists
        Self::run_tmux(&["has-session", "-t", tmux_name])
            .map_err(|_| format!("tmux session '{}' no longer exists", tmux_name))?;

        // Resize to current terminal dimensions
        let cols_str = cols.to_string();
        let rows_str = rows.to_string();
        let _ = Self::run_tmux(&[
            "resize-window",
            "-t",
            tmux_name,
            "-x",
            &cols_str,
            "-y",
            &rows_str,
        ]);

        // Open PTY pair and attach
        let (master, writer, child, reader) =
            self.open_pty_for_tmux(tmux_name, working_dir, cols, rows)?;

        let session = TerminalSession {
            backend: SessionBackend::Tmux {
                tmux_name: tmux_name.to_string(),
            },
            master,
            writer,
            child,
            working_directory: working_dir.to_string(),
            created_at: chrono::Utc::now(),
        };

        self.sessions.insert(session_id.clone(), session);

        // Spawn reader thread
        self.spawn_reader_thread(app, &session_id, reader);

        tracing::info!(
            "Reattached to tmux session {} (tmux: {})",
            session_id,
            tmux_name
        );

        Ok(true)
    }

    /// Open a PTY pair that runs `tmux attach-session -t <name>`
    fn open_pty_for_tmux(
        &self,
        tmux_name: &str,
        working_dir: &str,
        cols: u16,
        rows: u16,
    ) -> Result<
        (
            Box<dyn MasterPty + Send>,
            Box<dyn Write + Send>,
            Arc<StdMutex<Box<dyn Child + Send + Sync>>>,
            Box<dyn Read + Send>,
        ),
        String,
    > {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new("tmux");
        cmd.arg("attach-session");
        cmd.arg("-t");
        cmd.arg(tmux_name);
        cmd.cwd(working_dir);
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("CONTROL_TOWER", "1");

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to attach to tmux: {}", e))?;

        let child = Arc::new(StdMutex::new(child));

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

        Ok((pair.master, writer, child, reader))
    }

    /// Create a native (non-tmux) PTY session — original behavior
    fn create_native_session(
        &mut self,
        app: &AppHandle,
        session_id: String,
        working_dir: &str,
        command: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        // Build the command
        let is_zsh = self.default_shell.ends_with("zsh");
        let is_bash = self.default_shell.ends_with("bash");

        let mut cmd = if let Some(command_str) = command {
            let mut c = CommandBuilder::new(&self.default_shell);
            if is_zsh {
                c.arg("--no-rcs");
            } else if is_bash {
                c.arg("--norc");
                c.arg("--noprofile");
            }
            c.arg("-c");
            c.arg(command_str);
            c
        } else {
            let mut c = CommandBuilder::new(&self.default_shell);
            if is_zsh {
                c.arg("--no-rcs");
            } else if is_bash {
                c.arg("--norc");
                c.arg("--noprofile");
            }
            c
        };
        cmd.cwd(working_dir);

        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("CONTROL_TOWER", "1");

        if command.is_none() {
            let dir_name = std::path::Path::new(working_dir)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(working_dir);

            if is_zsh {
                cmd.env("PS1", &format!("%F{{cyan}}{}%f %F{{blue}}$%f ", dir_name));
            } else {
                cmd.env(
                    "PS1",
                    &format!(
                        "\\[\\033[36m\\]{}\\[\\033[0m\\] \\[\\033[34m\\]$\\[\\033[0m\\] ",
                        dir_name
                    ),
                );
            }
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {}", e))?;

        let child = Arc::new(StdMutex::new(child));

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

        let session = TerminalSession {
            backend: SessionBackend::Native,
            master: pair.master,
            writer,
            child: child.clone(),
            working_directory: working_dir.to_string(),
            created_at: chrono::Utc::now(),
        };

        self.sessions.insert(session_id.clone(), session);

        // For command-based sessions, spawn monitor thread
        if command.is_some() {
            self.spawn_monitor_thread(app, &session_id, child.clone());
        }

        // Spawn reader thread
        self.spawn_reader_thread(app, &session_id, reader);

        tracing::info!(
            "Created native PTY session {} in {}",
            session_id,
            working_dir
        );
        Ok(())
    }

    /// Spawn monitor thread for command sessions (detects child exit)
    fn spawn_monitor_thread(
        &self,
        app: &AppHandle,
        session_id: &str,
        child: Arc<StdMutex<Box<dyn Child + Send + Sync>>>,
    ) {
        let monitor_app = app.clone();
        let monitor_sid = session_id.to_string();
        std::thread::spawn(move || {
            tracing::info!("PTY child monitor started for session {}", monitor_sid);
            loop {
                std::thread::sleep(std::time::Duration::from_millis(200));

                let exited = match child.lock() {
                    Ok(mut c) => match c.try_wait() {
                        Ok(Some(status)) => Some(status.exit_code() as i32),
                        Ok(None) => None,
                        Err(_) => Some(-1),
                    },
                    Err(_) => break,
                };

                if let Some(exit_code) = exited {
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    tracing::info!(
                        "PTY child monitor detected exit for session {} (code: {})",
                        monitor_sid,
                        exit_code
                    );
                    let _ = monitor_app.emit(
                        &format!("pty:exit:{}", monitor_sid),
                        PtyExitEvent {
                            session_id: monitor_sid.clone(),
                            exit_code: Some(exit_code),
                        },
                    );
                    break;
                }
            }
            tracing::info!("PTY child monitor exiting for session {}", monitor_sid);
        });
    }

    /// Spawn reader thread for PTY output
    fn spawn_reader_thread(
        &self,
        app: &AppHandle,
        session_id: &str,
        mut reader: Box<dyn Read + Send>,
    ) {
        let app_handle = app.clone();
        let sid = session_id.to_string();
        std::thread::spawn(move || {
            tracing::info!("PTY reader thread started for session {}", sid);
            let mut buf = [0u8; 4096];
            let mut total_bytes = 0usize;
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        tracing::info!("PTY {} EOF after {} total bytes", sid, total_bytes);
                        let _ = app_handle.emit(
                            &format!("pty:exit:{}", sid),
                            PtyExitEvent {
                                session_id: sid.clone(),
                                exit_code: None,
                            },
                        );
                        break;
                    }
                    Ok(n) => {
                        total_bytes += n;
                        tracing::trace!("PTY {} read {} bytes (total: {})", sid, n, total_bytes);
                        let event_name = format!("pty:output:{}", sid);
                        let result = app_handle.emit(
                            &event_name,
                            PtyOutputEvent {
                                session_id: sid.clone(),
                                data: buf[..n].to_vec(),
                            },
                        );
                        if let Err(e) = result {
                            tracing::error!("Failed to emit PTY output event: {}", e);
                        }
                    }
                    Err(e) => {
                        tracing::info!("PTY {} read error after {} bytes: {}", sid, total_bytes, e);
                        let _ = app_handle.emit(
                            &format!("pty:exit:{}", sid),
                            PtyExitEvent {
                                session_id: sid.clone(),
                                exit_code: None,
                            },
                        );
                        break;
                    }
                }
            }
            tracing::info!("PTY reader thread exiting for session {}", sid);
        });
    }

    /// Write data to a terminal session
    pub fn write(&mut self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let session = self
            .sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        session
            .write(data)
            .map_err(|e| format!("Failed to write to PTY: {}", e))
    }

    /// Resize a terminal session
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        // Guard against tiny dimensions — can happen when the frontend container is hidden
        // (display:none). Resizing tmux to 1x1 destroys all content formatting.
        if cols < 2 || rows < 2 {
            return Ok(());
        }

        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        // Resize the PTY
        session.resize(cols, rows)?;

        // Also resize the tmux window if tmux-backed
        if let SessionBackend::Tmux { ref tmux_name } = session.backend {
            let cols_str = cols.to_string();
            let rows_str = rows.to_string();
            let _ = Self::run_tmux(&[
                "resize-window",
                "-t",
                tmux_name,
                "-x",
                &cols_str,
                "-y",
                &rows_str,
            ]);
        }

        Ok(())
    }

    /// Detach a terminal session (close PTY without killing the tmux session).
    /// Used for cleanup when reconnecting to the same tmux session from a fresh component mount.
    pub fn detach_session(&mut self, session_id: &str) -> Result<(), String> {
        let mut session = self
            .sessions
            .remove(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        // Kill the PTY attach process but leave the tmux session alive
        if session.is_running() {
            let _ = session.kill();
        }

        tracing::info!("Detached terminal session {} (tmux preserved)", session_id);
        Ok(())
    }

    /// Close a terminal session
    pub fn close(&mut self, app: &AppHandle, session_id: &str) -> Result<Option<i32>, String> {
        let mut session = self
            .sessions
            .remove(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        // For tmux sessions, kill the tmux session (permanent close)
        if let SessionBackend::Tmux { ref tmux_name } = session.backend {
            tracing::info!("Killing tmux session {} for tab close", tmux_name);
            let _ = Self::run_tmux(&["kill-session", "-t", tmux_name]);
        }

        let exit_code = if session.is_running() {
            let _ = session.kill();
            None
        } else {
            session.exit_status()
        };

        let _ = app.emit(
            &format!("pty:exit:{}", session_id),
            PtyExitEvent {
                session_id: session_id.to_string(),
                exit_code,
            },
        );

        tracing::info!("Closed terminal session {}", session_id);
        Ok(exit_code)
    }

    /// List all active session IDs
    pub fn list_sessions(&self) -> Vec<String> {
        self.sessions.keys().cloned().collect()
    }

    /// Check if a session is active
    pub fn is_active(&mut self, session_id: &str) -> bool {
        // For tmux sessions, also check tmux itself
        if let Some(session) = self.sessions.get(session_id) {
            if let SessionBackend::Tmux { ref tmux_name } = session.backend {
                return Self::run_tmux(&["has-session", "-t", tmux_name]).is_ok();
            }
        }

        self.sessions
            .get_mut(session_id)
            .map(|s| s.is_running())
            .unwrap_or(false)
    }

    /// Get session info
    pub fn get_session_info(&self, session_id: &str) -> Option<SessionInfo> {
        self.sessions.get(session_id).map(|s| SessionInfo {
            session_id: session_id.to_string(),
            working_directory: s.working_directory.clone(),
            created_at: s.created_at.to_rfc3339(),
        })
    }

    /// Get the tmux session name for a session
    #[allow(dead_code)]
    pub fn get_tmux_name(&self, session_id: &str) -> Option<String> {
        self.sessions
            .get(session_id)
            .and_then(|s| s.tmux_name().map(|n| n.to_string()))
    }

    /// Close all terminal sessions
    /// Native sessions are killed. tmux sessions are detached (survive for reconnect).
    pub fn close_all(&mut self) {
        let session_ids: Vec<String> = self.sessions.keys().cloned().collect();
        for session_id in session_ids {
            if let Some(mut session) = self.sessions.remove(&session_id) {
                match session.backend {
                    SessionBackend::Tmux { .. } => {
                        // Just kill the PTY attach process, leave tmux session alive
                        if session.is_running() {
                            let _ = session.kill();
                        }
                        tracing::info!(
                            "Detached tmux session {} on shutdown (tmux survives)",
                            session_id
                        );
                    }
                    SessionBackend::Native => {
                        if session.is_running() {
                            let _ = session.kill();
                        }
                        tracing::info!("Closed native PTY session {} on shutdown", session_id);
                    }
                }
            }
        }
    }

    /// Get count of active sessions
    pub fn active_count(&mut self) -> usize {
        let mut count = 0;
        for session in self.sessions.values_mut() {
            if session.is_running() {
                count += 1;
            }
        }
        count
    }

    /// Get list of active session IDs
    #[allow(dead_code)]
    pub fn active_sessions(&mut self) -> Vec<String> {
        self.sessions
            .iter_mut()
            .filter_map(|(id, s)| {
                if s.is_running() {
                    Some(id.clone())
                } else {
                    None
                }
            })
            .collect()
    }

    /// Update the use_tmux preference (affects future sessions only)
    pub fn set_use_tmux(&mut self, enabled: bool) {
        self.use_tmux = enabled;
        tracing::info!("tmux preference updated: use_tmux={}", enabled);
    }
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self::new(true)
    }
}

/// Session information for listing
#[derive(Clone, serde::Serialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub working_directory: String,
    pub created_at: String,
}

/// Type alias for the managed terminal manager state
pub type TerminalManagerState = Arc<Mutex<TerminalManager>>;

// Keep backward compatibility alias
pub type PtyManagerState = TerminalManagerState;
