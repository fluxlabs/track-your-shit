// VCCA - Dependency Status Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::DependencyStatus;
use rusqlite::params;
use std::path::Path;
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

/// Detect which JS package manager to use based on lock files.
/// Priority: pnpm > yarn > npm (fallback).
fn detect_js_package_manager(project_path: &Path) -> &'static str {
    if project_path.join("pnpm-lock.yaml").exists() {
        "pnpm"
    } else if project_path.join("yarn.lock").exists() {
        "yarn"
    } else {
        "npm"
    }
}

/// Get dependency status for a project by checking its package manager.
/// Caches results in dependency_cache table.
#[tauri::command]
pub async fn get_dependency_status(
    db: tauri::State<'_, DbState>,
    project_id: String,
    project_path: String,
) -> Result<DependencyStatus, String> {
    // Check cache first (within 15 minutes) — read lock is sufficient
    {
        let reader = db.read().await;

        let cached: Option<(String, String)> = reader
            .query_row(
                "SELECT status, checked_at FROM dependency_cache
                 WHERE project_id = ?1
                 AND datetime(checked_at, '+15 minutes') > datetime('now')",
                params![project_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        if let Some((status_json, checked_at)) = cached {
            if let Ok(mut status) = serde_json::from_str::<DependencyStatus>(&status_json) {
                status.checked_at = checked_at;
                return Ok(status);
            }
        }
    }

    // Detect package manager and run audit
    let path = Path::new(&project_path);
    let status = if path.join("package.json").exists() {
        let pm = detect_js_package_manager(path);
        run_js_audit(pm, &project_path).await
    } else if path.join("Cargo.toml").exists() {
        run_cargo_audit(&project_path).await
    } else if path.join("pyproject.toml").exists() || path.join("requirements.txt").exists() {
        run_pip_audit(&project_path).await
    } else {
        Ok(DependencyStatus {
            package_manager: "unknown".to_string(),
            outdated_count: 0,
            vulnerable_count: 0,
            details: None,
            checked_at: String::new(),
        })
    }?;

    // Cache the result — write lock for INSERT
    let status_json = serde_json::to_string(&status).map_err(|e| e.to_string())?;
    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        conn.execute(
            "INSERT INTO dependency_cache (project_id, status, checked_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(project_id) DO UPDATE SET status = ?2, checked_at = datetime('now')",
            params![project_id, status_json],
        )
        .map_err(|e| e.to_string())?;

        let checked_at: String = conn
            .query_row(
                "SELECT checked_at FROM dependency_cache WHERE project_id = ?1",
                params![project_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "unknown".to_string());

        let mut result = status;
        result.checked_at = checked_at;
        Ok(result)
    }
}

/// Run audit + outdated for a JS package manager (npm, pnpm, yarn).
async fn run_js_audit(pm: &str, project_path: &str) -> Result<DependencyStatus, String> {
    // --- Audit ---
    let audit_output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new(pm)
            .args(["audit", "--json"])
            .current_dir(project_path)
            .output(),
    )
    .await
    .map_err(|_| format!("{pm} audit timed out after 30s"))?
    .map_err(|e| format!("Failed to run {pm} audit: {e}"))?;

    let audit_stdout = String::from_utf8_lossy(&audit_output.stdout);
    let audit_json: Option<serde_json::Value> = serde_json::from_str(&audit_stdout).ok();

    let vulnerable_count = extract_vuln_count(&audit_json, pm);

    // --- Outdated ---
    let outdated_args: Vec<&str> = match pm {
        "pnpm" => vec!["outdated", "--format", "json"],
        _ => vec!["outdated", "--json"],
    };

    let outdated_output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new(pm)
            .args(&outdated_args)
            .current_dir(project_path)
            .output(),
    )
    .await
    .map_err(|_| format!("{pm} outdated timed out"))?
    .map_err(|e| format!("Failed to run {pm} outdated: {e}"))?;

    let outdated_stdout = String::from_utf8_lossy(&outdated_output.stdout);
    let outdated_json: Option<serde_json::Value> = serde_json::from_str(&outdated_stdout).ok();

    let outdated_count = extract_outdated_count(&outdated_json, pm);

    // Normalize pnpm outdated format to npm-compatible { "pkg": { current, wanted, latest } }
    let normalized_outdated = normalize_outdated(&outdated_json, pm);

    // Merge audit + outdated into a single details object
    let merged_details = {
        let mut obj = serde_json::Map::new();
        if let Some(audit) = audit_json {
            obj.insert("audit".to_string(), audit);
        }
        if let Some(outdated) = normalized_outdated {
            obj.insert("outdated".to_string(), outdated);
        }
        Some(serde_json::Value::Object(obj))
    };

    Ok(DependencyStatus {
        package_manager: pm.to_string(),
        outdated_count,
        vulnerable_count,
        details: merged_details,
        checked_at: String::new(),
    })
}

/// Extract vulnerability count from audit JSON — handles npm and pnpm formats.
fn extract_vuln_count(json: &Option<serde_json::Value>, pm: &str) -> i32 {
    let Some(data) = json else { return 0 };

    match pm {
        // npm: { metadata: { vulnerabilities: { total: N } } }
        "npm" => data
            .get("metadata")
            .and_then(|m| m.get("vulnerabilities"))
            .and_then(|v| v.as_object())
            .map(|vulns| vulns.values().filter_map(|v| v.as_i64()).sum::<i64>() as i32)
            .unwrap_or(0),
        // pnpm: { metadata: { vulnerabilities: { total: N } } } (same schema since pnpm 8)
        "pnpm" => data
            .get("metadata")
            .and_then(|m| m.get("vulnerabilities"))
            .and_then(|v| v.as_object())
            .map(|vulns| vulns.values().filter_map(|v| v.as_i64()).sum::<i64>() as i32)
            .unwrap_or(0),
        _ => 0,
    }
}

/// Extract outdated count — handles npm and pnpm JSON formats.
fn extract_outdated_count(json: &Option<serde_json::Value>, pm: &str) -> i32 {
    let Some(data) = json else { return 0 };

    match pm {
        // npm: top-level object { "pkg": { current, wanted, latest } }
        "npm" | "yarn" => data.as_object().map(|o| o.len() as i32).unwrap_or(0),
        // pnpm: array of { "name", "current", "latest", "wanted" } (pnpm 9+)
        //    or object { "pkg": { current, latest } } (older pnpm)
        "pnpm" => {
            if let Some(arr) = data.as_array() {
                arr.len() as i32
            } else if let Some(obj) = data.as_object() {
                obj.len() as i32
            } else {
                0
            }
        }
        _ => 0,
    }
}

/// Normalize pnpm outdated output to npm-compatible format.
/// pnpm 9+ `outdated --format json` returns an array:
///   [{ "name": "foo", "current": "1.0", "latest": "2.0", "wanted": "1.5", "dependencyType": "..." }]
/// We convert to: { "foo": { "current": "1.0", "wanted": "1.5", "latest": "2.0" } }
fn normalize_outdated(json: &Option<serde_json::Value>, pm: &str) -> Option<serde_json::Value> {
    let data = json.as_ref()?;

    match pm {
        "pnpm" => {
            if let Some(arr) = data.as_array() {
                // pnpm 9+ array format
                let mut result = serde_json::Map::new();
                for item in arr {
                    let name = item
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("unknown");
                    let current = item.get("current").and_then(|v| v.as_str()).unwrap_or("");
                    let wanted = item
                        .get("wanted")
                        .and_then(|v| v.as_str())
                        .unwrap_or(current);
                    let latest = item.get("latest").and_then(|v| v.as_str()).unwrap_or("");
                    result.insert(
                        name.to_string(),
                        serde_json::json!({
                            "current": current,
                            "wanted": wanted,
                            "latest": latest,
                        }),
                    );
                }
                Some(serde_json::Value::Object(result))
            } else {
                // Older pnpm object format — already compatible
                Some(data.clone())
            }
        }
        _ => Some(data.clone()),
    }
}

async fn run_cargo_audit(project_path: &str) -> Result<DependencyStatus, String> {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new("cargo")
            .args(["audit", "--json"])
            .current_dir(project_path)
            .output(),
    )
    .await;

    match output {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let details: Option<serde_json::Value> = serde_json::from_str(&stdout).ok();

            let vulnerable_count = details
                .as_ref()
                .and_then(|d| d.get("vulnerabilities"))
                .and_then(|v| v.get("found"))
                .and_then(|f| f.as_i64())
                .unwrap_or(0) as i32;

            Ok(DependencyStatus {
                package_manager: "cargo".to_string(),
                outdated_count: 0,
                vulnerable_count,
                details,
                checked_at: String::new(),
            })
        }
        _ => {
            // cargo-audit may not be installed
            Ok(DependencyStatus {
                package_manager: "cargo".to_string(),
                outdated_count: 0,
                vulnerable_count: 0,
                details: Some(serde_json::json!({"note": "cargo-audit not available"})),
                checked_at: String::new(),
            })
        }
    }
}

async fn run_pip_audit(project_path: &str) -> Result<DependencyStatus, String> {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new("pip-audit")
            .args(["--format", "json"])
            .current_dir(project_path)
            .output(),
    )
    .await;

    match output {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let details: Option<serde_json::Value> = serde_json::from_str(&stdout).ok();

            let vulnerable_count = details
                .as_ref()
                .and_then(|d| d.as_array())
                .map(|arr| arr.len() as i32)
                .unwrap_or(0);

            Ok(DependencyStatus {
                package_manager: "pip".to_string(),
                outdated_count: 0,
                vulnerable_count,
                details,
                checked_at: String::new(),
            })
        }
        _ => Ok(DependencyStatus {
            package_manager: "pip".to_string(),
            outdated_count: 0,
            vulnerable_count: 0,
            details: Some(serde_json::json!({"note": "pip-audit not available"})),
            checked_at: String::new(),
        }),
    }
}

/// Invalidate the dependency cache for a project, forcing a fresh scan on next query.
#[tauri::command]
pub async fn invalidate_dependency_cache(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<bool, String> {
    let db_guard = db.write().await;
    let conn = db_guard.conn();

    conn.execute(
        "DELETE FROM dependency_cache WHERE project_id = ?1",
        params![project_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(true)
}
