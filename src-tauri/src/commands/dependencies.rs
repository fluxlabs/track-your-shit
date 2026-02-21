// Control Tower - Dependency Status Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::DependencyStatus;
use rusqlite::params;
use std::path::Path;
use std::sync::Arc;

type DbState = Arc<crate::db::DbPool>;

/// Get dependency status for a project by checking its package manager
/// Caches results in dependency_cache table
#[tauri::command]
pub async fn get_dependency_status(
    db: tauri::State<'_, DbState>,
    project_id: String,
    project_path: String,
) -> Result<DependencyStatus, String> {
    // Check cache first (within 15 minutes)
    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();

        let cached: Option<(String, String)> = conn
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
        run_npm_audit(&project_path).await
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

    // Cache the result
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

        // Get the actual checked_at from DB
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

async fn run_npm_audit(project_path: &str) -> Result<DependencyStatus, String> {
    let output: std::process::Output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new("npm")
            .args(["audit", "--json"])
            .current_dir(project_path)
            .output(),
    )
    .await
    .map_err(|_| "npm audit timed out after 30s".to_string())?
    .map_err(|e| format!("Failed to run npm audit: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let details: Option<serde_json::Value> = serde_json::from_str(&stdout).ok();

    let vulnerable_count = details
        .as_ref()
        .and_then(|d| d.get("metadata"))
        .and_then(|m| m.get("vulnerabilities"))
        .and_then(|v| v.as_object())
        .map(|vulns| vulns.values().filter_map(|v| v.as_i64()).sum::<i64>() as i32)
        .unwrap_or(0);

    // Check outdated
    let outdated_output: std::process::Output = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        tokio::process::Command::new("npm")
            .args(["outdated", "--json"])
            .current_dir(project_path)
            .output(),
    )
    .await
    .map_err(|_| "npm outdated timed out".to_string())?
    .map_err(|e| format!("Failed to run npm outdated: {}", e))?;

    let outdated_stdout = String::from_utf8_lossy(&outdated_output.stdout);
    let outdated_json: Option<serde_json::Value> = serde_json::from_str(&outdated_stdout).ok();
    let outdated_count = outdated_json
        .as_ref()
        .and_then(|v| v.as_object().map(|o| o.len() as i32))
        .unwrap_or(0);

    // Merge audit + outdated into a single details object
    let merged_details = {
        let mut obj = serde_json::Map::new();
        if let Some(audit) = details {
            obj.insert("audit".to_string(), audit);
        }
        if let Some(outdated) = outdated_json {
            obj.insert("outdated".to_string(), outdated);
        }
        Some(serde_json::Value::Object(obj))
    };

    Ok(DependencyStatus {
        package_manager: "npm".to_string(),
        outdated_count,
        vulnerable_count,
        details: merged_details,
        checked_at: String::new(),
    })
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

/// Invalidate the dependency cache for a project, forcing a fresh scan on next query
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

// ---------------------------------------------------------------------------
// Vulnerability scanning structs & commands
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct VulnerabilityInfo {
    pub id: String,
    pub package: String,
    pub severity: String, // "critical" | "high" | "moderate" | "low"
    pub title: String,
    pub url: Option<String>,
    pub fixable: bool,
    pub fixed_in: Option<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct AuditResult {
    pub ecosystem: String, // "npm" | "cargo" | "pip"
    pub vulnerabilities: Vec<VulnerabilityInfo>,
    pub total: usize,
    pub critical: usize,
    pub high: usize,
    pub moderate: usize,
    pub low: usize,
    pub audit_ran: bool,
    pub error: Option<String>,
}

impl AuditResult {
    fn empty(ecosystem: &str) -> Self {
        AuditResult {
            ecosystem: ecosystem.to_string(),
            vulnerabilities: vec![],
            total: 0,
            critical: 0,
            high: 0,
            moderate: 0,
            low: 0,
            audit_ran: false,
            error: None,
        }
    }

    fn with_error(ecosystem: &str, error: impl Into<String>) -> Self {
        AuditResult {
            error: Some(error.into()),
            ..Self::empty(ecosystem)
        }
    }

    fn tally(mut self) -> Self {
        self.total = self.vulnerabilities.len();
        self.critical = self.vulnerabilities.iter().filter(|v| v.severity == "critical").count();
        self.high = self.vulnerabilities.iter().filter(|v| v.severity == "high").count();
        self.moderate = self.vulnerabilities.iter().filter(|v| v.severity == "moderate").count();
        self.low = self.vulnerabilities.iter().filter(|v| v.severity == "low").count();
        self
    }
}

/// Detect ecosystems present in the project and run the appropriate audit tools.
/// Returns one AuditResult per detected ecosystem.
#[tauri::command]
pub async fn run_dependency_audit(
    project_path: String,
) -> Result<Vec<AuditResult>, String> {
    let path = std::path::Path::new(&project_path);
    let mut results: Vec<AuditResult> = Vec::new();

    // npm
    if path.join("package.json").exists() {
        results.push(audit_npm(&project_path).await);
    }

    // cargo
    if path.join("Cargo.toml").exists() {
        results.push(audit_cargo(&project_path).await);
    }

    // pip
    if path.join("requirements.txt").exists() || path.join("pyproject.toml").exists() {
        results.push(audit_pip(&project_path).await);
    }

    Ok(results)
}

// ----- npm audit -----

async fn audit_npm(project_path: &str) -> AuditResult {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        tokio::process::Command::new("npm")
            .args(["audit", "--json"])
            .current_dir(project_path)
            .output(),
    )
    .await;

    let out = match output {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return AuditResult::with_error("npm", format!("Failed to run npm audit: {}", e)),
        Err(_) => return AuditResult::with_error("npm", "npm audit timed out after 60s"),
    };

    let stdout = String::from_utf8_lossy(&out.stdout);
    let json: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(e) => {
            return AuditResult::with_error(
                "npm",
                format!("Failed to parse npm audit JSON: {}. stderr: {}", e,
                    String::from_utf8_lossy(&out.stderr).chars().take(200).collect::<String>()),
            );
        }
    };

    // npm v7+ format: top-level "vulnerabilities" object; each value is a vuln record
    let mut vulns: Vec<VulnerabilityInfo> = Vec::new();

    if let Some(vulns_obj) = json.get("vulnerabilities").and_then(|v| v.as_object()) {
        for (pkg_name, record) in vulns_obj {
            let severity = record
                .get("severity")
                .and_then(|s| s.as_str())
                .unwrap_or("low")
                .to_string();

            // `via` can be a mix of strings (transitive) and objects (direct advisories)
            let via = record.get("via").and_then(|v| v.as_array()).cloned().unwrap_or_default();

            // Collect advisory objects from `via`
            let advisory_entries: Vec<&serde_json::Value> =
                via.iter().filter(|v| v.is_object()).collect();

            if advisory_entries.is_empty() {
                // Transitive-only — emit one entry with limited info
                let fix_available = record.get("fixAvailable");
                let fixable = match fix_available {
                    Some(serde_json::Value::Bool(b)) => *b,
                    Some(serde_json::Value::Object(_)) => true,
                    _ => false,
                };

                let id = record
                    .get("via")
                    .and_then(|v| v.as_array())
                    .and_then(|a| a.first())
                    .and_then(|v| v.as_str())
                    .unwrap_or("UNKNOWN")
                    .to_string();

                vulns.push(VulnerabilityInfo {
                    id,
                    package: pkg_name.clone(),
                    severity,
                    title: format!("Vulnerability in {}", pkg_name),
                    url: None,
                    fixable,
                    fixed_in: None,
                });
            } else {
                for advisory in advisory_entries {
                    let id = advisory
                        .get("source")
                        .and_then(|s| s.as_u64())
                        .map(|s| format!("GHSA-{}", s))
                        .or_else(|| advisory.get("url").and_then(|u| u.as_str()).map(|u| {
                            u.split('/').last().unwrap_or("UNKNOWN").to_string()
                        }))
                        .unwrap_or_else(|| "UNKNOWN".to_string());

                    let title = advisory
                        .get("title")
                        .and_then(|t| t.as_str())
                        .unwrap_or("Unknown vulnerability")
                        .to_string();

                    let url = advisory
                        .get("url")
                        .and_then(|u| u.as_str())
                        .map(|u| u.to_string());

                    let adv_severity = advisory
                        .get("severity")
                        .and_then(|s| s.as_str())
                        .unwrap_or(severity.as_str())
                        .to_string();

                    let fix_available = record.get("fixAvailable");
                    let fixable = match fix_available {
                        Some(serde_json::Value::Bool(b)) => *b,
                        Some(serde_json::Value::Object(_)) => true,
                        _ => false,
                    };

                    let fixed_in = advisory
                        .get("range")
                        .and_then(|r| r.as_str())
                        .map(|r| r.to_string());

                    vulns.push(VulnerabilityInfo {
                        id,
                        package: pkg_name.clone(),
                        severity: adv_severity,
                        title,
                        url,
                        fixable,
                        fixed_in,
                    });
                }
            }
        }
    }

    AuditResult {
        ecosystem: "npm".to_string(),
        vulnerabilities: vulns,
        audit_ran: true,
        error: None,
        total: 0, critical: 0, high: 0, moderate: 0, low: 0,
    }
    .tally()
}

// ----- cargo audit -----

async fn audit_cargo(project_path: &str) -> AuditResult {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        tokio::process::Command::new("cargo")
            .args(["audit", "--json"])
            .current_dir(project_path)
            .stderr(std::process::Stdio::null())
            .output(),
    )
    .await;

    let out = match output {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => {
            let msg = e.to_string();
            if msg.contains("No such file") || msg.contains("not found") {
                return AuditResult::with_error(
                    "cargo",
                    "cargo-audit not installed. Run: cargo install cargo-audit",
                );
            }
            return AuditResult::with_error("cargo", format!("Failed to run cargo audit: {}", msg));
        }
        Err(_) => return AuditResult::with_error("cargo", "cargo audit timed out after 60s"),
    };

    let stdout = String::from_utf8_lossy(&out.stdout);

    // If stdout is empty, cargo-audit may not be installed (exit code != 0 but no JSON)
    if stdout.trim().is_empty() {
        return AuditResult::with_error(
            "cargo",
            "cargo-audit not installed or returned no output. Run: cargo install cargo-audit",
        );
    }

    let json: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(e) => {
            return AuditResult::with_error(
                "cargo",
                format!("Failed to parse cargo audit JSON: {}", e),
            );
        }
    };

    let vuln_list = json
        .get("vulnerabilities")
        .and_then(|v| v.get("list"))
        .and_then(|l| l.as_array())
        .cloned()
        .unwrap_or_default();

    let mut vulns: Vec<VulnerabilityInfo> = Vec::new();

    for entry in &vuln_list {
        let advisory = match entry.get("advisory") {
            Some(a) => a,
            None => continue,
        };

        let id = advisory
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("UNKNOWN")
            .to_string();

        let package = advisory
            .get("package")
            .and_then(|p| p.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("unknown")
            .to_string();

        let severity = advisory
            .get("severity")
            .and_then(|s| s.as_str())
            .unwrap_or("unknown")
            .to_lowercase();

        // Map cargo-audit severities to our standard set
        let severity = match severity.as_str() {
            "critical" => "critical",
            "high" => "high",
            "medium" | "moderate" => "moderate",
            _ => "low",
        }
        .to_string();

        let title = advisory
            .get("title")
            .and_then(|t| t.as_str())
            .unwrap_or("Unknown vulnerability")
            .to_string();

        let url = advisory
            .get("url")
            .and_then(|u| u.as_str())
            .map(|u| u.to_string());

        // patched versions
        let patched = entry
            .get("versions")
            .and_then(|v| v.get("patched"))
            .and_then(|p| p.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            });

        let fixable = patched.as_ref().map(|p| !p.is_empty()).unwrap_or(false);

        vulns.push(VulnerabilityInfo {
            id,
            package,
            severity,
            title,
            url,
            fixable,
            fixed_in: patched,
        });
    }

    AuditResult {
        ecosystem: "cargo".to_string(),
        vulnerabilities: vulns,
        audit_ran: true,
        error: None,
        total: 0, critical: 0, high: 0, moderate: 0, low: 0,
    }
    .tally()
}

// ----- pip audit -----

async fn audit_pip(project_path: &str) -> AuditResult {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        tokio::process::Command::new("pip-audit")
            .args(["--format=json"])
            .current_dir(project_path)
            .stderr(std::process::Stdio::null())
            .output(),
    )
    .await;

    let out = match output {
        Ok(Ok(o)) => o,
        Ok(Err(_)) => {
            return AuditResult::with_error("pip", "pip-audit not installed. Run: pip install pip-audit");
        }
        Err(_) => return AuditResult::with_error("pip", "pip-audit timed out after 60s"),
    };

    let stdout = String::from_utf8_lossy(&out.stdout);
    if stdout.trim().is_empty() {
        return AuditResult::with_error("pip", "pip-audit not installed. Run: pip install pip-audit");
    }

    let json: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(e) => {
            return AuditResult::with_error("pip", format!("Failed to parse pip-audit JSON: {}", e));
        }
    };

    // pip-audit JSON format: array of { name, version, vulns: [{ id, fix_versions, aliases, description }] }
    let packages = json.as_array().cloned().unwrap_or_default();
    let mut vulns: Vec<VulnerabilityInfo> = Vec::new();

    for pkg in &packages {
        let pkg_name = pkg
            .get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("unknown")
            .to_string();

        let pkg_vulns = pkg
            .get("vulns")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        for vuln in &pkg_vulns {
            let id = vuln
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("UNKNOWN")
                .to_string();

            // pip-audit doesn't always provide severity; default to "moderate"
            let severity = "moderate".to_string();

            let title = vuln
                .get("description")
                .and_then(|d| d.as_str())
                .unwrap_or("Unknown vulnerability")
                .to_string();

            let fix_versions: Vec<String> = vuln
                .get("fix_versions")
                .and_then(|f| f.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            let fixable = !fix_versions.is_empty();
            let fixed_in = if fixable { Some(fix_versions.join(", ")) } else { None };

            let url = vuln
                .get("aliases")
                .and_then(|a| a.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.as_str())
                .map(|alias| format!("https://osv.dev/vulnerability/{}", alias));

            vulns.push(VulnerabilityInfo {
                id,
                package: pkg_name.clone(),
                severity,
                title,
                url,
                fixable,
                fixed_in,
            });
        }
    }

    AuditResult {
        ecosystem: "pip".to_string(),
        vulnerabilities: vulns,
        audit_ran: true,
        error: None,
        total: 0, critical: 0, high: 0, moderate: 0, low: 0,
    }
    .tally()
}

// ---------------------------------------------------------------------------
// Outdated packages structs & command
// ---------------------------------------------------------------------------

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct OutdatedPackage {
    pub name: String,
    pub current: String,
    pub wanted: String,
    pub latest: String,
    pub ecosystem: String,
}

/// Return packages that have newer versions available across all detected ecosystems.
#[tauri::command]
pub async fn get_outdated_packages(
    project_path: String,
) -> Result<Vec<OutdatedPackage>, String> {
    let path = std::path::Path::new(&project_path);
    let mut all: Vec<OutdatedPackage> = Vec::new();

    if path.join("package.json").exists() {
        let mut npm_outdated = outdated_npm(&project_path).await;
        all.append(&mut npm_outdated);
    }

    if path.join("Cargo.toml").exists() {
        let mut cargo_outdated = outdated_cargo(&project_path).await;
        all.append(&mut cargo_outdated);
    }

    Ok(all)
}

async fn outdated_npm(project_path: &str) -> Vec<OutdatedPackage> {
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        tokio::process::Command::new("npm")
            .args(["outdated", "--json"])
            .current_dir(project_path)
            .output(),
    )
    .await;

    let out = match output {
        Ok(Ok(o)) => o,
        _ => return vec![],
    };

    let stdout = String::from_utf8_lossy(&out.stdout);
    let json: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let obj = match json.as_object() {
        Some(o) => o,
        None => return vec![],
    };

    obj.iter()
        .map(|(name, info)| OutdatedPackage {
            name: name.clone(),
            current: info
                .get("current")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            wanted: info
                .get("wanted")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            latest: info
                .get("latest")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            ecosystem: "npm".to_string(),
        })
        .collect()
}

async fn outdated_cargo(project_path: &str) -> Vec<OutdatedPackage> {
    // cargo-outdated is an optional third-party tool; skip gracefully if absent
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(60),
        tokio::process::Command::new("cargo")
            .args(["outdated", "--format", "json"])
            .current_dir(project_path)
            .stderr(std::process::Stdio::null())
            .output(),
    )
    .await;

    let out = match output {
        Ok(Ok(o)) => o,
        _ => return vec![],
    };

    let stdout = String::from_utf8_lossy(&out.stdout);
    if stdout.trim().is_empty() {
        return vec![];
    }

    let json: serde_json::Value = match serde_json::from_str(&stdout) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    // cargo-outdated JSON: { "dependencies": [ { "name", "project", "compat", "latest", ... } ] }
    let deps = json
        .get("dependencies")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default();

    deps.iter()
        .filter_map(|dep| {
            let name = dep.get("name")?.as_str()?.to_string();
            let current = dep.get("project")?.as_str().unwrap_or("unknown").to_string();
            let wanted = dep.get("compat")?.as_str().unwrap_or("unknown").to_string();
            let latest = dep.get("latest")?.as_str().unwrap_or("unknown").to_string();
            // Skip if already up-to-date
            if latest == "---" || latest == current {
                return None;
            }
            Some(OutdatedPackage {
                name,
                current,
                wanted,
                latest,
                ecosystem: "cargo".to_string(),
            })
        })
        .collect()
}
