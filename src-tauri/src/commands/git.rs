// Control Tower - Git Status Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{
    EnvironmentInfo, GitChangedFile, GitCommitInfo, GitLogEntry, GitOperationResult,
    GitStatusDetail,
};

#[tauri::command]
pub async fn get_git_status(project_path: String) -> Result<GitStatusDetail, String> {
    let git_dir = std::path::Path::new(&project_path).join(".git");
    if !git_dir.exists() {
        return Ok(GitStatusDetail {
            has_git: false,
            branch: None,
            is_dirty: false,
            staged_count: 0,
            unstaged_count: 0,
            untracked_count: 0,
            ahead: 0,
            behind: 0,
            last_commit: None,
            stash_count: 0,
        });
    }

    // Get current branch
    let branch = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&project_path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            } else {
                None
            }
        });

    // Parse porcelain status for staged/unstaged/untracked counts
    let (staged_count, unstaged_count, untracked_count) = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&project_path)
        .output()
        .ok()
        .map(|out| {
            let output = String::from_utf8_lossy(&out.stdout);
            let mut staged = 0u32;
            let mut unstaged = 0u32;
            let mut untracked = 0u32;

            for line in output.lines() {
                if line.len() < 2 {
                    continue;
                }
                let bytes = line.as_bytes();
                let index = bytes[0];
                let worktree = bytes[1];

                if index == b'?' {
                    untracked += 1;
                } else {
                    if index != b' ' && index != b'?' {
                        staged += 1;
                    }
                    if worktree != b' ' && worktree != b'?' {
                        unstaged += 1;
                    }
                }
            }
            (staged, unstaged, untracked)
        })
        .unwrap_or((0, 0, 0));

    let is_dirty = staged_count > 0 || unstaged_count > 0 || untracked_count > 0;

    // Ahead/behind remote (may fail if no upstream)
    let (ahead, behind) = std::process::Command::new("git")
        .args(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])
        .current_dir(&project_path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                let parts: Vec<&str> = text.trim().split('\t').collect();
                if parts.len() == 2 {
                    let a = parts[0].parse::<u32>().unwrap_or(0);
                    let b = parts[1].parse::<u32>().unwrap_or(0);
                    Some((a, b))
                } else {
                    None
                }
            } else {
                None
            }
        })
        .unwrap_or((0, 0));

    // Last commit info
    let last_commit = std::process::Command::new("git")
        .args(["log", "-1", "--format=%H%n%s%n%an%n%aI"])
        .current_dir(&project_path)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                let lines: Vec<&str> = text.trim().lines().collect();
                if lines.len() >= 4 {
                    Some(GitCommitInfo {
                        hash: lines[0][..8.min(lines[0].len())].to_string(),
                        message: lines[1].to_string(),
                        author: lines[2].to_string(),
                        date: lines[3].to_string(),
                    })
                } else {
                    None
                }
            } else {
                None
            }
        });

    // Stash count
    let stash_count = std::process::Command::new("git")
        .args(["stash", "list"])
        .current_dir(&project_path)
        .output()
        .ok()
        .map(|out| {
            let output = String::from_utf8_lossy(&out.stdout);
            output.lines().count() as u32
        })
        .unwrap_or(0);

    Ok(GitStatusDetail {
        has_git: true,
        branch,
        is_dirty,
        staged_count,
        unstaged_count,
        untracked_count,
        ahead,
        behind,
        last_commit,
        stash_count,
    })
}

/// Get environment info (git branch + runtime versions) for a working directory
#[tauri::command]
pub async fn get_environment_info(working_dir: String) -> Result<EnvironmentInfo, String> {
    // Git branch
    let git_branch = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&working_dir)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            } else {
                None
            }
        });

    // Node version
    let node_version = std::process::Command::new("node")
        .args(["--version"])
        .current_dir(&working_dir)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                Some(v.strip_prefix('v').unwrap_or(&v).to_string())
            } else {
                None
            }
        });

    // Python version
    let python_version = std::process::Command::new("python3")
        .args(["--version"])
        .current_dir(&working_dir)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                Some(v.strip_prefix("Python ").unwrap_or(&v).to_string())
            } else {
                None
            }
        });

    // Rust version
    let rust_version = std::process::Command::new("rustc")
        .args(["--version"])
        .current_dir(&working_dir)
        .output()
        .ok()
        .and_then(|out| {
            if out.status.success() {
                let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
                // "rustc 1.75.0 (82e1608df 2023-12-21)" -> "1.75.0"
                v.split_whitespace().nth(1).map(|s| s.to_string())
            } else {
                None
            }
        });

    Ok(EnvironmentInfo {
        git_branch,
        node_version,
        python_version,
        rust_version,
        working_directory: working_dir,
    })
}

/// Helper to run a git command and return a GitOperationResult
fn run_git_op(project_path: &str, args: &[&str]) -> Result<GitOperationResult, String> {
    let output = std::process::Command::new("git")
        .args(args)
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() {
        Ok(GitOperationResult {
            success: true,
            message: if stdout.is_empty() { stderr } else { stdout },
        })
    } else {
        Ok(GitOperationResult {
            success: false,
            message: if stderr.is_empty() { stdout } else { stderr },
        })
    }
}

#[tauri::command]
pub async fn git_push(project_path: String) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["push"])
}

#[tauri::command]
pub async fn git_pull(project_path: String) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["pull"])
}

#[tauri::command]
pub async fn git_fetch(project_path: String) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["fetch"])
}

#[tauri::command]
pub async fn git_stage_all(project_path: String) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["add", "-A"])
}

#[tauri::command]
pub async fn git_stage_file(
    project_path: String,
    file_path: String,
) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["add", "--", &file_path])
}

#[tauri::command]
pub async fn git_unstage_file(
    project_path: String,
    file_path: String,
) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["restore", "--staged", "--", &file_path])
}

#[tauri::command]
pub async fn git_discard_file(
    project_path: String,
    file_path: String,
) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["checkout", "--", &file_path])
}

#[tauri::command]
pub async fn git_remote_url(project_path: String) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to get remote url: {}", e))?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
pub async fn git_branches(project_path: String) -> Result<Vec<String>, String> {
    let output = std::process::Command::new("git")
        .args(["branch", "--format=%(refname:short)"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to list branches: {}", e))?;
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}

#[tauri::command]
pub async fn git_tags(project_path: String) -> Result<Vec<String>, String> {
    let output = std::process::Command::new("git")
        .args(["tag", "--sort=-creatordate", "-l"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to list tags: {}", e))?;
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(text
        .lines()
        .take(20)
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect())
}

#[tauri::command]
pub async fn git_commit(
    project_path: String,
    message: String,
) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["commit", "-m", &message])
}

#[tauri::command]
pub async fn git_stash_save(project_path: String) -> Result<GitOperationResult, String> {
    run_git_op(
        &project_path,
        &["stash", "push", "-m", "Control Tower stash"],
    )
}

#[tauri::command]
pub async fn git_stash_pop(project_path: String) -> Result<GitOperationResult, String> {
    run_git_op(&project_path, &["stash", "pop"])
}

#[tauri::command]
pub async fn git_changed_files(project_path: String) -> Result<Vec<GitChangedFile>, String> {
    let output = std::process::Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git status: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let files: Vec<GitChangedFile> = text
        .lines()
        .filter(|line| line.len() >= 3)
        .map(|line| {
            let bytes = line.as_bytes();
            let index = bytes[0];
            let worktree = bytes[1];
            let path = line[3..].to_string();

            let (status, staged) = if index == b'?' {
                ("??".to_string(), false)
            } else if index != b' ' {
                (String::from_utf8_lossy(&[index]).to_string(), true)
            } else {
                (String::from_utf8_lossy(&[worktree]).to_string(), false)
            };

            GitChangedFile {
                path,
                status,
                staged,
            }
        })
        .collect();

    Ok(files)
}

#[tauri::command]
pub async fn git_log(project_path: String, limit: Option<u32>) -> Result<Vec<GitLogEntry>, String> {
    let count = limit.unwrap_or(20).to_string();
    let output = std::process::Command::new("git")
        .args([
            "log",
            &format!("-{}", count),
            "--format=%H%n%h%n%s%n%an%n%aI",
            "--shortstat",
        ])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute git log: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<GitLogEntry> = Vec::new();
    let lines: Vec<&str> = text.lines().collect();
    let mut i = 0;

    while i + 4 < lines.len() {
        let hash = lines[i].to_string();
        let short_hash = lines[i + 1].to_string();
        let message = lines[i + 2].to_string();
        let author = lines[i + 3].to_string();
        let date = lines[i + 4].to_string();
        i += 5;

        // Skip blank lines between format output and optional --shortstat line
        while i < lines.len() && lines[i].is_empty() {
            i += 1;
        }

        // Parse optional --shortstat line (e.g., " 3 files changed, 10 insertions(+), 2 deletions(-)")
        let (files_changed, insertions, deletions) =
            if i < lines.len() && lines[i].contains("changed") {
                let stat = lines[i];
                i += 1;
                let parts: Vec<&str> = stat.split(',').collect();
                let fc = parts
                    .first()
                    .and_then(|p| p.split_whitespace().next())
                    .and_then(|n: &str| n.parse::<u32>().ok())
                    .unwrap_or(0);
                let ins = parts
                    .iter()
                    .find(|p| p.contains("insertion"))
                    .and_then(|p| p.split_whitespace().next())
                    .and_then(|n: &str| n.parse::<u32>().ok())
                    .unwrap_or(0);
                let del = parts
                    .iter()
                    .find(|p| p.contains("deletion"))
                    .and_then(|p| p.split_whitespace().next())
                    .and_then(|n: &str| n.parse::<u32>().ok())
                    .unwrap_or(0);
                (fc, ins, del)
            } else {
                (0, 0, 0)
            };

        // Skip blank lines after stat before next entry
        while i < lines.len() && lines[i].is_empty() {
            i += 1;
        }

        entries.push(GitLogEntry {
            hash,
            short_hash,
            message,
            author,
            date,
            files_changed,
            insertions,
            deletions,
        });
    }

    Ok(entries)
}
