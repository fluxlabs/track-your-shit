// VCCA - GSD (Get Stuff Done) Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
//
// Native .planning/ file parsing and CRUD for GSD projects

use crate::db::Database;
use crate::models::{
    GsdConfig, GsdCurrentPosition, GsdDebugSession, GsdMilestone, GsdMilestoneAudit,
    GsdPhaseContext, GsdPhaseDoc, GsdPhaseDocSet, GsdPhaseResearch, GsdPhaseVelocity, GsdPlan,
    GsdPlanTask, GsdProcessDoc, GsdProjectInfo, GsdRequirement, GsdResearchDoc, GsdState,
    GsdSummary, GsdSummaryDecision, GsdSyncResult, GsdTodo, GsdTodoInput, GsdUatResult,
    GsdValidation, GsdVelocity, GsdVerification, TaskVerification, UatIssue, UatTestResult,
    WaveTracking,
};
use regex::Regex;
use rusqlite::params;
use std::fs;
use std::path::Path;
use std::sync::{Arc, OnceLock};

type DbState = Arc<crate::db::DbPool>;

// ============================================================
// Helpers (imported from gsd_common — D-05)
// ============================================================

use super::gsd_common::{
    extract_nested_progress, extract_section, extract_xml_tag, extract_yaml_list, get_project_path,
    parse_frontmatter, resolve_gsd_path, warn_unknown_fields,
};
use super::gsd_common::{KNOWN_PLAN_KEYS, KNOWN_STATE_KEYS, KNOWN_SUMMARY_KEYS};

/// Generate a short hex ID
fn gen_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}", now)
}

// ============================================================
// Project Info (PROJECT.md)
// ============================================================

#[tauri::command]
pub async fn gsd_get_project_info(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<GsdProjectInfo, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Shared file — intentionally root-scoped (not workstream-aware per SCHM-04 / Pitfall 3)
    let path = Path::new(&project_path)
        .join(".planning")
        .join("PROJECT.md");

    if !path.exists() {
        return Err("No .planning/PROJECT.md found".to_string());
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let (frontmatter, body) = parse_frontmatter(&content);

    Ok(GsdProjectInfo {
        // SCHM-02: add "what this is" alias so projects using the next template resolve vision
        vision: extract_section(&body, "vision")
            .or_else(|| extract_section(&body, "description"))
            .or_else(|| extract_section(&body, "what this is")),
        milestone: frontmatter
            .get("milestone")
            .or_else(|| frontmatter.get("current_milestone"))
            .cloned()
            .or_else(|| extract_section(&body, "current milestone")),
        version: frontmatter.get("version").cloned(),
        core_value: extract_section(&body, "core value"),
        current_focus: extract_section(&body, "current focus")
            .or_else(|| extract_section(&body, "focus")),
        raw_content: content,
    })
}

// ============================================================
// GSD State (STATE.md)
// ============================================================

#[tauri::command]
pub async fn gsd_get_state(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<GsdState, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: STATE.md lives under the active workstream subtree (SCHM-04)
    let path = resolve_gsd_path(&project_path, None, "STATE.md");

    if !path.exists() {
        return Ok(GsdState {
            current_position: None,
            decisions: vec![],
            pending_todos: vec![],
            session_continuity: None,
            velocity: None,
            blockers: vec![],
        });
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let (frontmatter, body) = parse_frontmatter(&content);

    // SCHM-02: extract nested progress.* values from the raw frontmatter string.
    // parse_frontmatter skips indented lines, so we re-slice the --- block for the
    // second-pass nested-key extractor. This is safe even if the frontmatter is absent.
    let fm_raw: &str = if content.starts_with("---") {
        let after = &content[3..];
        after.find("\n---").map(|end| &after[..end]).unwrap_or("")
    } else {
        content
            .find("\n---")
            .and_then(|start| {
                let after = &content[start + 4..];
                after.find("\n---").map(|end| &after[..end])
            })
            .unwrap_or("")
    };
    let nested_progress = extract_nested_progress(fm_raw);

    // D-04: log any unrecognized STATE.md frontmatter fields via tracing (never hard-fail)
    warn_unknown_fields(&frontmatter, KNOWN_STATE_KEYS, "STATE.md");

    let current_position = Some(GsdCurrentPosition {
        milestone: frontmatter.get("milestone").cloned(),
        phase: frontmatter
            .get("phase")
            .cloned()
            .or_else(|| frontmatter.get("current_phase").cloned()),
        plan: frontmatter.get("plan").cloned(),
        status: frontmatter
            .get("status")
            .cloned()
            .or_else(|| extract_section(&body, "status")),
        last_activity: frontmatter.get("last_activity").cloned(),
        progress: extract_section(&body, "progress"),
        // SCHM-02: nested progress counters
        progress_total_phases: nested_progress
            .get("progress.total_phases")
            .and_then(|v| v.parse::<i32>().ok()),
        progress_completed_phases: nested_progress
            .get("progress.completed_phases")
            .and_then(|v| v.parse::<i32>().ok()),
        progress_total_plans: nested_progress
            .get("progress.total_plans")
            .and_then(|v| v.parse::<i32>().ok()),
        progress_completed_plans: nested_progress
            .get("progress.completed_plans")
            .and_then(|v| v.parse::<i32>().ok()),
        progress_percent: nested_progress
            .get("progress.percent")
            .and_then(|v| v.parse::<f32>().ok()),
        // SCHM-02: gsd_state_version from frontmatter
        gsd_state_version: frontmatter.get("gsd_state_version").cloned(),
    });

    // Extract decisions as bullet points
    let decisions = extract_section(&body, "decisions")
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    // Extract pending todos
    let pending_todos = extract_section(&body, "pending")
        .or_else(|| extract_section(&body, "todos"))
        .map(|s| {
            s.lines()
                .filter(|l| {
                    l.trim().starts_with('-') || l.trim().starts_with('*') || l.contains("[ ]")
                })
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    let session_continuity =
        extract_section(&body, "session continuity").or_else(|| extract_section(&body, "context"));

    // Extract velocity metrics from "Performance Metrics" or "Velocity" section
    let velocity = parse_velocity_from_state(&body);

    // Extract blockers
    let blockers = extract_section(&body, "blockers")
        .or_else(|| extract_section(&body, "concerns"))
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(GsdState {
        current_position,
        decisions,
        pending_todos,
        session_continuity,
        velocity,
        blockers,
    })
}

// ============================================================
// GSD Config (config.json)
// ============================================================

#[tauri::command]
pub async fn gsd_get_config(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<GsdConfig, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Shared file — intentionally root-scoped (not workstream-aware per SCHM-04 / Pitfall 3)
    let path = Path::new(&project_path)
        .join(".planning")
        .join("config.json");

    if !path.exists() {
        return Ok(GsdConfig {
            workflow_mode: None,
            model_profile: None,
            raw_json: None,
            depth: None,
            parallelization: None,
            commit_docs: None,
            workflow_research: None,
            workflow_inspection: None,
            workflow_plan_verification: None,
        });
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let workflow = json.get("workflow");

    Ok(GsdConfig {
        workflow_mode: json
            .get("workflow_mode")
            .or_else(|| json.get("workflowMode"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        model_profile: json
            .get("model_profile")
            .or_else(|| json.get("modelProfile"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        depth: json
            .get("depth")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        parallelization: json.get("parallelization").and_then(|v| v.as_bool()),
        commit_docs: json.get("commit_docs").and_then(|v| v.as_bool()),
        workflow_research: workflow
            .and_then(|w| w.get("research"))
            .and_then(|v| v.as_bool()),
        workflow_inspection: workflow
            .and_then(|w| w.get("inspection"))
            .and_then(|v| v.as_bool()),
        workflow_plan_verification: workflow
            .and_then(|w| w.get("plan_verification"))
            .and_then(|v| v.as_bool()),
        raw_json: Some(json),
    })
}

// ============================================================
// Requirements (REQUIREMENTS.md)
// ============================================================

#[tauri::command]
pub async fn gsd_list_requirements(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdRequirement>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: REQUIREMENTS.md lives under the active workstream subtree (SCHM-04)
    let path = resolve_gsd_path(&project_path, None, "REQUIREMENTS.md");

    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    parse_requirements(&content)
}

fn parse_requirements(content: &str) -> Result<Vec<GsdRequirement>, String> {
    let mut requirements = Vec::new();
    let mut current_category: Option<String> = None;

    // Match requirement lines like: - REQ-001: Description [priority: high] [status: done] [phase: 1]
    let req_re = Regex::new(r"^[-*]\s+(?:(\w+-\d+):?\s+)?(.+)$").map_err(|e| e.to_string())?;
    let tag_re = Regex::new(r"\[(\w+):\s*([^\]]+)\]").map_err(|e| e.to_string())?;

    // gsd-core@next requirement lines: `- [ ] **QWIN-01** ⚡: desc` / `- [x] **METHOD-01**: desc`
    // (bold ID, optional checkbox + marker emoji before the colon).
    let bold_req_re =
        Regex::new(r"^[-*]\s+(?:\[([ xX])\]\s*)?\*\*([A-Z][A-Z0-9_-]*-\d+)\*\*[^:]*:\s*(.+)$")
            .map_err(|e| e.to_string())?;

    for line in content.lines() {
        let trimmed = line.trim();

        // Track current category from headings
        if trimmed.starts_with('#') {
            let heading = trimmed.trim_start_matches('#').trim();
            if !heading.is_empty()
                && !heading.to_lowercase().contains("requirement")
                && !heading.to_lowercase().contains("overview")
            {
                current_category = Some(heading.to_string());
            }
            continue;
        }

        // gsd-core@next bold-ID/checkbox format takes precedence over the legacy bare-ID format.
        if let Some(caps) = bold_req_re.captures(trimmed) {
            let req_id = caps.get(2).unwrap().as_str().to_string();
            let mut description = caps.get(3).map_or("", |m| m.as_str()).trim().to_string();
            let mut priority = None;
            let mut status = match caps.get(1).map(|m| m.as_str()) {
                Some("x") | Some("X") => Some("done".to_string()),
                _ => None,
            };
            let mut phase = None;

            for tag_cap in tag_re.captures_iter(&description.clone()) {
                let key = tag_cap.get(1).unwrap().as_str().to_lowercase();
                let val = tag_cap.get(2).unwrap().as_str().trim().to_string();
                match key.as_str() {
                    "priority" | "p" => priority = Some(val),
                    "status" | "s" => status = Some(val),
                    "phase" => phase = Some(val),
                    _ => {}
                }
                description = description
                    .replace(tag_cap.get(0).unwrap().as_str(), "")
                    .trim()
                    .to_string();
            }

            requirements.push(GsdRequirement {
                req_id,
                description,
                category: current_category.clone(),
                priority,
                status,
                phase,
            });
            continue;
        }

        if let Some(caps) = req_re.captures(trimmed) {
            let req_id = caps.get(1).map_or_else(
                || format!("REQ-{:03}", requirements.len() + 1),
                |m| m.as_str().to_string(),
            );
            let mut description = caps.get(2).map_or("", |m| m.as_str()).to_string();

            let mut priority = None;
            let mut status = None;
            let mut phase = None;

            // Extract inline tags
            for tag_cap in tag_re.captures_iter(trimmed) {
                let key = tag_cap.get(1).unwrap().as_str().to_lowercase();
                let val = tag_cap.get(2).unwrap().as_str().trim().to_string();
                match key.as_str() {
                    "priority" | "p" => priority = Some(val),
                    "status" | "s" => status = Some(val),
                    "phase" => phase = Some(val),
                    _ => {}
                }
                // Remove the tag from description
                description = description
                    .replace(tag_cap.get(0).unwrap().as_str(), "")
                    .trim()
                    .to_string();
            }

            // Handle checkbox status
            if trimmed.contains("[x]") || trimmed.contains("[X]") {
                status = Some("done".to_string());
            }

            requirements.push(GsdRequirement {
                req_id,
                description,
                category: current_category.clone(),
                priority,
                status,
                phase,
            });
        }
    }

    Ok(requirements)
}

// ============================================================
// Milestones (ROADMAP.md)
// ============================================================

#[tauri::command]
pub async fn gsd_list_milestones(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdMilestone>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: ROADMAP.md lives under the active workstream subtree (SCHM-04)
    let path = resolve_gsd_path(&project_path, None, "ROADMAP.md");

    if !path.exists() {
        return Ok(vec![]);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    parse_milestones(&content)
}

fn parse_milestones(content: &str) -> Result<Vec<GsdMilestone>, String> {
    let mut milestones = Vec::new();

    // Match milestone headings like: ## Milestone 1: Core MVP (v0.1)
    // or: ## v0.1 — Core MVP
    let ms_re = Regex::new(r"(?i)^##\s+(?:milestone\s*\d*:?\s*)?(.+?)(?:\s*\(v?([\d.]+)\))?\s*$")
        .map_err(|e| e.to_string())?;

    // Also match version-first format: ## v0.1 — Name
    let ver_re = Regex::new(r"(?i)^##\s+v?([\d.]+)\s*[—\-:]\s*(.+)$").map_err(|e| e.to_string())?;

    // Match phase ranges like: Phases 1-5 or Phases: 10-15
    let phase_re =
        Regex::new(r"(?i)phases?:?\s*(\d+)\s*[-–]\s*(\d+)").map_err(|e| e.to_string())?;

    // Bullet-point milestone format:
    // - ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-02-07)
    // - 🚧 **v1.1 Name** — Phases 6-9 (current)
    let bullet_re =
        Regex::new(r"^[-*]\s+[^*]*\*{2}\s*(?:v?([\d.]+)\s+)?(.+?)\s*\*{2}\s*[—\-]+\s*(.+)$")
            .map_err(|e| e.to_string())?;

    // gsd-core@next: milestones are H3 headings under `## Phases`, e.g.
    //   ### Milestone 1 — Newcomer Readiness (fast-track, ASAP)
    let h3_ms_re = Regex::new(r"(?i)^###\s+milestone\b\s*\d*\s*[—–\-:]*\s*(.+)$")
        .map_err(|e| e.to_string())?;

    // Single phase reference (e.g. "**Phase 13:**") for deriving a milestone's phase range
    // from its checkbox bullets when no explicit "Phases N-M" range is present.
    let single_phase_re = Regex::new(r"(?i)phase\s+(\d+)").map_err(|e| e.to_string())?;

    let mut current_name: Option<String> = None;
    let mut current_version: Option<String> = None;
    let mut current_body = String::new();

    // Match dates like: 2026-02-07, Completed: 2026-02-07, completed on 2026-02-07
    let date_re = Regex::new(r"(\d{4}-\d{2}-\d{2})").map_err(|e| e.to_string())?;

    let flush = |name: &Option<String>,
                 version: &Option<String>,
                 body: &str,
                 milestones: &mut Vec<GsdMilestone>| {
        if let Some(name) = name {
            // Phase range: explicit "Phases N-M" first; otherwise derive min/max from individual
            // "Phase N" references (gsd-core@next lists each phase as its own checkbox bullet).
            let (mut phase_start, mut phase_end) = phase_re
                .captures(body)
                .map(|c| {
                    (
                        c.get(1).and_then(|m| m.as_str().parse().ok()),
                        c.get(2).and_then(|m| m.as_str().parse().ok()),
                    )
                })
                .unwrap_or((None, None));
            if phase_start.is_none() {
                let nums: Vec<i32> = single_phase_re
                    .captures_iter(body)
                    .filter_map(|c| c.get(1).and_then(|m| m.as_str().parse::<i32>().ok()))
                    .collect();
                if !nums.is_empty() {
                    phase_start = nums.iter().min().copied();
                    phase_end = nums.iter().max().copied();
                }
            }

            // Status: checkbox-aware (gsd-core@next uses `- [x]` / `- [ ]` phase bullets), falling
            // back to emoji/keyword markers used by the legacy bullet format.
            let body_lower = body.to_lowercase();
            let has_unchecked = body.contains("- [ ]") || body.contains("- []");
            let has_checked = body.contains("- [x]") || body.contains("- [X]");
            let is_completed = (has_checked && !has_unchecked)
                || body_lower.contains("✅")
                || body_lower.contains("shipped")
                || (body_lower.contains("completed") && !has_unchecked);
            let status = if is_completed {
                Some("completed".to_string())
            } else if (has_checked && has_unchecked)
                || body_lower.contains("🔄")
                || body_lower.contains("🚧")
                || body_lower.contains("in progress")
                || body_lower.contains("(current)")
            {
                Some("in_progress".to_string())
            } else {
                Some("planned".to_string())
            };

            // Extract completed_at date from body when milestone is completed
            let completed_at = if is_completed {
                // Look for date near "completed" text or fall back to any date in body
                let completed_line = body.lines().find(|l| {
                    let lower = l.to_lowercase();
                    lower.contains("completed") || lower.contains("✅")
                });
                completed_line
                    .and_then(|line| date_re.captures(line).map(|c| c[1].to_string()))
                    .or_else(|| date_re.captures(body).map(|c| c[1].to_string()))
            } else {
                None
            };

            milestones.push(GsdMilestone {
                name: name.clone(),
                version: version.clone(),
                phase_start,
                phase_end,
                status,
                completed_at,
            });
        }
    };

    for line in content.lines() {
        // gsd-core@next H3 milestone heading (### Milestone N — Name) under ## Phases
        if let Some(caps) = h3_ms_re.captures(line.trim()) {
            flush(
                &current_name,
                &current_version,
                &current_body,
                &mut milestones,
            );
            current_name = caps.get(1).map(|m| m.as_str().trim().to_string());
            current_version = None;
            current_body.clear();
            continue;
        }

        // Try bullet-point milestone format (e.g. - ✅ **v1.0 Name** — Phases 1-5).
        // Checkbox bullets (- [x] / - [ ]) are phase items, not milestone rows — skip them so
        // they fall through to the current milestone's body (for phase-range + status).
        let bullet_trim = line.trim();
        let bullet_caps = if bullet_trim.starts_with("- [") || bullet_trim.starts_with("* [") {
            None
        } else {
            bullet_re.captures(bullet_trim)
        };
        if let Some(caps) = bullet_caps {
            flush(
                &current_name,
                &current_version,
                &current_body,
                &mut milestones,
            );
            let version = caps.get(1).map(|m| m.as_str().to_string());
            let name = caps.get(2).map(|m| m.as_str().trim().to_string());
            let detail = caps.get(3).map(|m| m.as_str()).unwrap_or("");
            // Build body from original line + detail for status/phase extraction
            current_name = name;
            current_version = version;
            current_body = format!("{}\n{}", line, detail);
            // Bullet milestones are single-line; flush immediately
            flush(
                &current_name,
                &current_version,
                &current_body,
                &mut milestones,
            );
            current_name = None;
            current_version = None;
            current_body.clear();
            continue;
        }

        // Try version-first format
        if let Some(caps) = ver_re.captures(line.trim()) {
            flush(
                &current_name,
                &current_version,
                &current_body,
                &mut milestones,
            );
            current_version = caps.get(1).map(|m| m.as_str().to_string());
            current_name = caps.get(2).map(|m| m.as_str().trim().to_string());
            current_body.clear();
            continue;
        }

        // Try milestone heading format
        if let Some(caps) = ms_re.captures(line.trim()) {
            let name = caps.get(1).map(|m| m.as_str().trim().to_string());
            let version = caps.get(2).map(|m| m.as_str().to_string());

            // Skip generic section headings (not actual milestone definitions)
            let is_section = version.is_none()
                && name.as_ref().map_or(true, |n| {
                    let lower = n.to_lowercase();
                    lower.len() <= 2
                        || matches!(
                            lower.as_str(),
                            "milestones"
                                | "phases"
                                | "progress"
                                | "notes"
                                | "overview"
                                | "summary"
                                | "appendix"
                                | "requirements"
                                | "changelog"
                                | "phase details"
                                | "phase numbering"
                        )
                });

            if is_section {
                // Flush previous milestone but don't start a new one
                flush(
                    &current_name,
                    &current_version,
                    &current_body,
                    &mut milestones,
                );
                current_name = None;
                current_version = None;
                current_body.clear();
                continue;
            }

            flush(
                &current_name,
                &current_version,
                &current_body,
                &mut milestones,
            );
            current_name = name;
            current_version = version;
            current_body.clear();
            continue;
        }

        if current_name.is_some() {
            current_body.push_str(line);
            current_body.push('\n');
        }
    }

    // Flush last milestone
    flush(
        &current_name,
        &current_version,
        &current_body,
        &mut milestones,
    );

    Ok(milestones)
}

/// Parse milestone history from STATE.md's "Milestone History" table.
/// Returns milestones that were archived/completed and may no longer appear in ROADMAP.md.
/// Table format: | Milestone | Phases | Plans | Requirements | Status |
fn parse_milestone_history(content: &str) -> Vec<GsdMilestone> {
    let mut milestones = Vec::new();

    // Find the Milestone History section
    let section_start = content.find("## Milestone History");
    if section_start.is_none() {
        return milestones;
    }

    let section = &content[section_start.unwrap()..];
    // End at the next ## heading
    let section_end = section[3..]
        .find("\n## ")
        .map(|i| i + 3)
        .unwrap_or(section.len());
    let section = &section[..section_end];

    // Parse table rows (skip header + separator)
    let rows: Vec<&str> = section
        .lines()
        .filter(|l| l.starts_with('|') && !l.contains("---"))
        .collect();

    // Skip header row (index 0)
    for row in rows.iter().skip(1) {
        let cols: Vec<&str> = row
            .split('|')
            .map(|c| c.trim())
            .filter(|c| !c.is_empty())
            .collect();
        if cols.len() >= 4 {
            let name = cols[0].to_string();
            let phases_str = cols[1]; // e.g. "1-5" or "Phases 1-5"
            let status = cols.last().unwrap_or(&"completed").to_string();

            // Extract phase range
            let phase_re = Regex::new(r"(\d+)\s*[-–]\s*(\d+)").ok();
            let (phase_start, phase_end) = phase_re
                .and_then(|re| re.captures(phases_str))
                .map(|c| {
                    (
                        c.get(1).and_then(|m| m.as_str().parse().ok()),
                        c.get(2).and_then(|m| m.as_str().parse().ok()),
                    )
                })
                .unwrap_or((None, None));

            // Try to extract version from name (e.g. "Core MVP (v0.1)" or "v0.1 — Core MVP")
            let ver_re = Regex::new(r"v?([\d.]+)").ok();
            let version = ver_re.and_then(|re| re.captures(&name).map(|c| c[1].to_string()));

            milestones.push(GsdMilestone {
                name,
                version,
                phase_start,
                phase_end,
                status: Some(status.to_lowercase()),
                completed_at: None,
            });
        }
    }

    milestones
}

// ============================================================
// Todos (todos/pending/ and todos/done/)
// ============================================================

#[tauri::command]
pub async fn gsd_list_todos(
    db: tauri::State<'_, DbState>,
    project_id: String,
    status_filter: Option<String>,
) -> Result<Vec<GsdTodo>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let planning = Path::new(&project_path).join(".planning").join("todos");

    let mut todos = Vec::new();

    let dirs_to_scan: Vec<(&str, &str)> = match status_filter.as_deref() {
        Some("done") | Some("completed") => vec![("done", "done")],
        Some("pending") => vec![("pending", "pending")],
        _ => vec![("pending", "pending"), ("done", "done")],
    };

    for (dir_name, status) in dirs_to_scan {
        let dir = planning.join(dir_name);
        if dir.exists() {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map_or(false, |e| e == "md") {
                        if let Ok(content) = fs::read_to_string(&path) {
                            let todo = parse_todo_file(&content, &path, status);
                            todos.push(todo);
                        }
                    }
                }
            }
        }
    }

    // Sort by priority (blocker first, then high/medium/low)
    todos.sort_by(|a, b| {
        let priority_ord = |t: &GsdTodo| -> i32 {
            if t.is_blocker {
                return 0;
            }
            match t.priority.as_deref() {
                Some("critical") | Some("blocker") => 0,
                Some("high") => 1,
                Some("medium") => 2,
                Some("low") => 3,
                _ => 4,
            }
        };
        priority_ord(a).cmp(&priority_ord(b))
    });

    Ok(todos)
}

fn parse_todo_file(content: &str, path: &Path, status: &str) -> GsdTodo {
    let (frontmatter, body) = parse_frontmatter(content);
    let filename = path
        .file_stem()
        .map_or("unknown".to_string(), |f| f.to_string_lossy().to_string());

    let title = frontmatter
        .get("title")
        .cloned()
        .or_else(|| {
            body.lines()
                .find(|l| l.starts_with('#'))
                .map(|l| l.trim_start_matches('#').trim().to_string())
        })
        .unwrap_or_else(|| filename.clone());

    let files: Option<Vec<String>> = frontmatter.get("files").map(|f| {
        f.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    let is_blocker = frontmatter
        .get("blocker")
        .or_else(|| frontmatter.get("is_blocker"))
        .map_or(false, |v| v == "true" || v == "yes" || v == "1");

    GsdTodo {
        id: filename,
        title,
        description: if body.trim().is_empty() {
            None
        } else {
            Some(body.trim().to_string())
        },
        area: frontmatter.get("area").cloned(),
        phase: frontmatter.get("phase").cloned(),
        priority: frontmatter.get("priority").cloned(),
        is_blocker,
        files,
        status: status.to_string(),
        source_file: Some(path.to_string_lossy().to_string()),
        created_at: frontmatter.get("created").cloned(),
        completed_at: frontmatter.get("completed").cloned(),
    }
}

#[tauri::command]
pub async fn gsd_create_todo(
    db: tauri::State<'_, DbState>,
    project_id: String,
    input: GsdTodoInput,
) -> Result<GsdTodo, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let pending_dir = Path::new(&project_path)
        .join(".planning")
        .join("todos")
        .join("pending");

    // Ensure directory exists
    fs::create_dir_all(&pending_dir).map_err(|e| e.to_string())?;

    // Generate filename from title
    let slug: String = input
        .title
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let id = format!(
        "{}-{}",
        slug.chars().take(40).collect::<String>(),
        &gen_id()[..8]
    );
    let filename = format!("{}.md", id);
    let filepath = pending_dir.join(&filename);

    // Build frontmatter
    let mut fm_lines = vec!["---".to_string(), format!("title: {}", input.title)];
    if let Some(ref area) = input.area {
        fm_lines.push(format!("area: {}", area));
    }
    if let Some(ref phase) = input.phase {
        fm_lines.push(format!("phase: {}", phase));
    }
    if let Some(ref priority) = input.priority {
        fm_lines.push(format!("priority: {}", priority));
    }
    if input.is_blocker.unwrap_or(false) {
        fm_lines.push("blocker: true".to_string());
    }
    if let Some(ref files) = input.files {
        fm_lines.push(format!("files: {}", files.join(", ")));
    }
    fm_lines.push(format!(
        "created: {}",
        chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ")
    ));
    fm_lines.push("---".to_string());

    let mut content = fm_lines.join("\n");
    content.push('\n');
    if let Some(ref desc) = input.description {
        content.push('\n');
        content.push_str(desc);
        content.push('\n');
    }

    fs::write(&filepath, &content).map_err(|e| e.to_string())?;

    Ok(GsdTodo {
        id,
        title: input.title,
        description: input.description,
        area: input.area,
        phase: input.phase,
        priority: input.priority,
        is_blocker: input.is_blocker.unwrap_or(false),
        files: input.files,
        status: "pending".to_string(),
        source_file: Some(filepath.to_string_lossy().to_string()),
        created_at: Some(chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
        completed_at: None,
    })
}

#[tauri::command]
pub async fn gsd_update_todo(
    db: tauri::State<'_, DbState>,
    project_id: String,
    todo_id: String,
    input: GsdTodoInput,
) -> Result<GsdTodo, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let planning = Path::new(&project_path).join(".planning").join("todos");

    // Find the todo file in pending or done
    let filename = format!("{}.md", todo_id);
    let pending_path = planning.join("pending").join(&filename);
    let done_path = planning.join("done").join(&filename);

    let (current_path, status) = if pending_path.exists() {
        (pending_path, "pending")
    } else if done_path.exists() {
        (done_path, "done")
    } else {
        return Err(format!("Todo not found: {}", todo_id));
    };

    // Read existing to preserve created date
    let existing = fs::read_to_string(&current_path).map_err(|e| e.to_string())?;
    let (old_fm, _) = parse_frontmatter(&existing);
    let created = old_fm.get("created").cloned();

    // Build updated content
    let mut fm_lines = vec!["---".to_string(), format!("title: {}", input.title)];
    if let Some(ref area) = input.area {
        fm_lines.push(format!("area: {}", area));
    }
    if let Some(ref phase) = input.phase {
        fm_lines.push(format!("phase: {}", phase));
    }
    if let Some(ref priority) = input.priority {
        fm_lines.push(format!("priority: {}", priority));
    }
    if input.is_blocker.unwrap_or(false) {
        fm_lines.push("blocker: true".to_string());
    }
    if let Some(ref files) = input.files {
        fm_lines.push(format!("files: {}", files.join(", ")));
    }
    if let Some(ref c) = created {
        fm_lines.push(format!("created: {}", c));
    }
    fm_lines.push("---".to_string());

    let mut content = fm_lines.join("\n");
    content.push('\n');
    if let Some(ref desc) = input.description {
        content.push('\n');
        content.push_str(desc);
        content.push('\n');
    }

    fs::write(&current_path, &content).map_err(|e| e.to_string())?;

    Ok(GsdTodo {
        id: todo_id,
        title: input.title,
        description: input.description,
        area: input.area,
        phase: input.phase,
        priority: input.priority,
        is_blocker: input.is_blocker.unwrap_or(false),
        files: input.files,
        status: status.to_string(),
        source_file: Some(current_path.to_string_lossy().to_string()),
        created_at: created,
        completed_at: None,
    })
}

#[tauri::command]
pub async fn gsd_complete_todo(
    db: tauri::State<'_, DbState>,
    project_id: String,
    todo_id: String,
) -> Result<GsdTodo, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let planning = Path::new(&project_path).join(".planning").join("todos");

    let filename = format!("{}.md", todo_id);
    let pending_path = planning.join("pending").join(&filename);
    let done_dir = planning.join("done");

    if !pending_path.exists() {
        return Err(format!("Todo not found in pending: {}", todo_id));
    }

    // Ensure done directory exists
    fs::create_dir_all(&done_dir).map_err(|e| e.to_string())?;

    // Read, add completed timestamp, move
    let content = fs::read_to_string(&pending_path).map_err(|e| e.to_string())?;
    let completed_at = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    // Insert completed date into frontmatter
    let updated = if content.starts_with("---") {
        if let Some(end_idx) = content[3..].find("---") {
            let insert_pos = end_idx + 3;
            format!(
                "{}\ncompleted: {}\n{}",
                &content[..insert_pos],
                completed_at,
                &content[insert_pos..]
            )
        } else {
            content.clone()
        }
    } else {
        format!("---\ncompleted: {}\n---\n{}", completed_at, content)
    };

    let done_path = done_dir.join(&filename);
    fs::write(&done_path, &updated).map_err(|e| e.to_string())?;
    fs::remove_file(&pending_path).map_err(|e| e.to_string())?;

    let todo = parse_todo_file(&updated, &done_path, "done");
    Ok(todo)
}

#[tauri::command]
pub async fn gsd_delete_todo(
    db: tauri::State<'_, DbState>,
    project_id: String,
    todo_id: String,
) -> Result<(), String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let planning = Path::new(&project_path).join(".planning").join("todos");

    let filename = format!("{}.md", todo_id);
    let pending_path = planning.join("pending").join(&filename);
    let done_path = planning.join("done").join(&filename);

    if pending_path.exists() {
        fs::remove_file(&pending_path).map_err(|e| e.to_string())?;
    } else if done_path.exists() {
        fs::remove_file(&done_path).map_err(|e| e.to_string())?;
    } else {
        return Err(format!("Todo not found: {}", todo_id));
    }

    Ok(())
}

// ============================================================
// Debug Sessions (.planning/debug/)
// ============================================================

#[tauri::command]
pub async fn gsd_list_debug_sessions(
    db: tauri::State<'_, DbState>,
    project_id: String,
    include_resolved: Option<bool>,
) -> Result<Vec<GsdDebugSession>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let debug_dir = Path::new(&project_path).join(".planning").join("debug");

    if !debug_dir.exists() {
        return Ok(vec![]);
    }

    let mut sessions = Vec::new();
    let include_resolved = include_resolved.unwrap_or(true);

    if let Ok(entries) = fs::read_dir(&debug_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let session = parse_debug_session(&content, &path);
                    if include_resolved || session.status != "resolved" {
                        sessions.push(session);
                    }
                }
            }
        }
    }

    // Sort by created_at descending
    sessions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(sessions)
}

#[tauri::command]
pub async fn gsd_get_debug_session(
    db: tauri::State<'_, DbState>,
    project_id: String,
    session_id: String,
) -> Result<GsdDebugSession, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let debug_dir = Path::new(&project_path).join(".planning").join("debug");

    let filename = format!("{}.md", session_id);
    let path = debug_dir.join(&filename);

    if !path.exists() {
        return Err(format!("Debug session not found: {}", session_id));
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(parse_debug_session(&content, &path))
}

fn parse_debug_session(content: &str, path: &Path) -> GsdDebugSession {
    let (frontmatter, body) = parse_frontmatter(content);
    let filename = path
        .file_stem()
        .map_or("unknown".to_string(), |f| f.to_string_lossy().to_string());

    let title = frontmatter
        .get("title")
        .cloned()
        .or_else(|| {
            body.lines()
                .find(|l| l.starts_with('#'))
                .map(|l| l.trim_start_matches('#').trim().to_string())
        })
        .unwrap_or_else(|| filename.clone());

    let status = frontmatter.get("status").cloned().unwrap_or_else(|| {
        if body.to_lowercase().contains("resolved") || body.to_lowercase().contains("✅") {
            "resolved".to_string()
        } else {
            "active".to_string()
        }
    });

    GsdDebugSession {
        id: filename,
        title,
        error_type: frontmatter
            .get("error_type")
            .or_else(|| frontmatter.get("type"))
            .cloned(),
        status,
        summary: extract_section(&body, "summary").or_else(|| extract_section(&body, "problem")),
        resolution: extract_section(&body, "resolution")
            .or_else(|| extract_section(&body, "solution")),
        source_file: Some(path.to_string_lossy().to_string()),
        created_at: frontmatter.get("created").cloned(),
        resolved_at: frontmatter.get("resolved").cloned(),
    }
}

// ============================================================
// Research (.planning/research/)
// ============================================================

#[tauri::command]
pub async fn gsd_list_research(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdResearchDoc>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let research_dir = Path::new(&project_path).join(".planning").join("research");

    if !research_dir.exists() {
        return Ok(vec![]);
    }

    let mut docs = Vec::new();

    if let Ok(entries) = fs::read_dir(&research_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let filename = path
                        .file_name()
                        .map_or("unknown".to_string(), |f| f.to_string_lossy().to_string());
                    let (frontmatter, body) = parse_frontmatter(&content);

                    let title = frontmatter.get("title").cloned().or_else(|| {
                        body.lines()
                            .find(|l| l.starts_with('#'))
                            .map(|l| l.trim_start_matches('#').trim().to_string())
                    });

                    docs.push(GsdResearchDoc {
                        filename: filename.clone(),
                        title,
                        category: frontmatter.get("category").cloned(),
                        content,
                        source_file: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    docs.sort_by(|a, b| a.filename.cmp(&b.filename));
    Ok(docs)
}

// ============================================================
// Verification (.planning/phases/XX-YY/VERIFICATION.md)
// ============================================================

#[tauri::command]
pub async fn gsd_get_verification(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<GsdVerification, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    // Find matching phase directory (formats: "01", "01-02", "001", etc.)
    let phase_dir = find_phase_dir(&phases_dir, &phase_number.to_string())?;
    let verification_path = find_phase_doc(&phase_dir, "VERIFICATION").ok_or_else(|| {
        format!("No VERIFICATION.md found for phase {}", phase_number)
    })?;

    let content = fs::read_to_string(&verification_path).map_err(|e| e.to_string())?;
    parse_verification(&content, phase_number)
}

/// Precompiled regex for decimal-aware phase number extraction (Pitfall 4 — compile once).
/// Matches the leading number from phase directory names like "01-name", "02.1-hotfix".
/// Zero-stripping via 0* before the integer part so "01" and "1" compare equal as strings.
static PHASE_DIR_RE: OnceLock<Regex> = OnceLock::new();

fn phase_dir_regex() -> &'static Regex {
    PHASE_DIR_RE.get_or_init(|| {
        // SCHM-03: extended to capture decimal phases (e.g. "2.1") without collision with "2"
        Regex::new(r"^0*(\d+(?:\.\d+)?)").expect("PHASE_DIR_RE is valid")
    })
}

/// Find a phase directory by phase number string.
///
/// Handles both integer phases ("2") and decimal phases ("2.1") without collision (SCHM-03).
/// Phase identity is compared by string equality after zero-stripping (e.g. "2" vs "2.1").
///
/// The `phase_number` parameter is `&str` so callers can pass "2" or "2.1".
/// IPC commands that receive `i32` should call `find_phase_dir(..., &phase_number.to_string())`.
fn find_phase_dir(phases_dir: &Path, phase_number: &str) -> Result<std::path::PathBuf, String> {
    if !phases_dir.exists() {
        return Err("No .planning/phases/ directory found".to_string());
    }

    let re = phase_dir_regex();
    if let Ok(entries) = fs::read_dir(phases_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path
                    .file_name()
                    .map_or("".to_string(), |f| f.to_string_lossy().to_string());

                // SCHM-03: extract decimal-aware phase id, then compare as strings so
                // "2" != "2.1" and both resolve to distinct directories.
                if let Some(caps) = re.captures(&dir_name) {
                    let extracted = caps.get(1).unwrap().as_str();
                    // Strip leading zeros for integer comparison (e.g. "02" → "2")
                    let normalized = strip_leading_zeros(extracted);
                    let target = strip_leading_zeros(phase_number);
                    if normalized == target {
                        return Ok(path);
                    }
                }
            }
        }
    }

    Err(format!(
        "Phase directory not found for phase {}",
        phase_number
    ))
}

/// Strip leading zeros from a numeric string for comparison, preserving decimal parts.
/// "02" → "2", "02.1" → "2.1", "2.1" → "2.1", "2" → "2"
fn strip_leading_zeros(s: &str) -> String {
    if let Some(dot) = s.find('.') {
        // Decimal: strip integer part and keep fractional
        let int_part = s[..dot].trim_start_matches('0');
        let int_part = if int_part.is_empty() { "0" } else { int_part };
        format!("{}{}", int_part, &s[dot..])
    } else {
        let stripped = s.trim_start_matches('0');
        if stripped.is_empty() { "0" } else { stripped }.to_string()
    }
}

fn parse_verification(content: &str, phase_number: i32) -> Result<GsdVerification, String> {
    let mut checks_total = 0;
    let mut checks_passed = 0;
    let mut gaps = Vec::new();

    // Count checkbox items
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("- [") || trimmed.starts_with("* [") {
            checks_total += 1;
            if trimmed.contains("[x]") || trimmed.contains("[X]") {
                checks_passed += 1;
            }
        }
    }

    // Extract gaps section
    if let Some(gaps_section) = extract_section(content, "gaps") {
        for line in gaps_section.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with('-') || trimmed.starts_with('*') {
                gaps.push(
                    trimmed
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string(),
                );
            }
        }
    }

    let result = if checks_total == 0 {
        None
    } else if checks_passed == checks_total {
        Some("passed".to_string())
    } else if checks_passed as f64 / checks_total as f64 >= 0.8 {
        Some("partial".to_string())
    } else {
        Some("failed".to_string())
    };

    Ok(GsdVerification {
        phase_number,
        checks_total,
        checks_passed,
        result,
        gaps,
        raw_content: content.to_string(),
    })
}

// ============================================================
// Phase Context (.planning/phases/XX-YY/CONTEXT.md)
// ============================================================

#[tauri::command]
pub async fn gsd_get_phase_context(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<GsdPhaseContext, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    let phase_dir = find_phase_dir(&phases_dir, &phase_number.to_string())?;
    let context_path = find_phase_doc(&phase_dir, "CONTEXT")
        .ok_or_else(|| format!("No CONTEXT.md found for phase {}", phase_number))?;

    let content = fs::read_to_string(&context_path).map_err(|e| e.to_string())?;

    let decisions = extract_section(&content, "decisions")
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    let deferred_ideas = extract_section(&content, "deferred")
        .or_else(|| extract_section(&content, "deferred ideas"))
        .or_else(|| extract_section(&content, "future"))
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(GsdPhaseContext {
        decisions,
        deferred_ideas,
        raw_content: content,
    })
}

// ============================================================
// Plans (.planning/phases/XX-YY/XX-YY-PLAN.md)
// ============================================================

fn find_plan_files(phase_dir: &Path) -> Vec<std::path::PathBuf> {
    // Accept both legacy `{NN}-{MM}-PLAN.md` and gsd-core@next `{NN}-PLAN.md` (one plan per phase).
    let re = Regex::new(r"^\d+(-\d+)?-PLAN\.md$").unwrap();
    let mut files: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(entries) = fs::read_dir(phase_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            if re.is_match(&name) {
                files.push(entry.path());
            }
        }
    }

    files.sort();
    files
}

/// Resolve a phase doc (CONTEXT/VERIFICATION/etc.) within a phase directory, supporting
/// gsd-core@next `{NN}-NAME.md`, legacy `{NN}-{MM}-NAME.md`, and plain `NAME.md` naming.
/// Returns the first match (plain name preferred for determinism).
fn find_phase_doc(phase_dir: &Path, doc_name: &str) -> Option<std::path::PathBuf> {
    // Plain `NAME.md` preferred for determinism (legacy layout).
    let plain = phase_dir.join(format!("{doc_name}.md"));
    if plain.exists() {
        return Some(plain);
    }
    // gsd-core@next `{NN}-NAME.md` (and legacy `{NN}-{MM}-NAME.md`): scan for a prefixed match.
    let re = Regex::new(&format!(r"^\d+(-\d+)?-{doc_name}\.md$")).ok()?;
    let mut matches: Vec<std::path::PathBuf> = fs::read_dir(phase_dir)
        .ok()?
        .filter_map(|e| e.ok())
        .filter(|e| re.is_match(&e.file_name().to_string_lossy()))
        .map(|e| e.path())
        .collect();
    matches.sort();
    matches.into_iter().next()
}

fn parse_plan_file(content: &str, path: &Path, phase_num: i32, plan_num: i32) -> GsdPlan {
    let (frontmatter, body) = parse_frontmatter(content);

    // D-04: log any unrecognized PLAN.md frontmatter fields (never hard-fail)
    warn_unknown_fields(&frontmatter, KNOWN_PLAN_KEYS, "PLAN.md");

    let plan_type = frontmatter.get("type").cloned();
    let group_number = frontmatter.get("group_number")
        .and_then(|v| v.parse::<i32>().ok());
    let autonomous = frontmatter
        .get("autonomous")
        .map_or(true, |v| v == "true" || v == "yes" || v == "1");

    // SCHM-01: new next frontmatter fields
    let wave = frontmatter.get("wave").and_then(|v| v.parse::<i32>().ok());
    let depends_on = extract_yaml_list(content, "depends_on");
    let requirements = extract_yaml_list(content, "requirements");
    let user_setup = extract_yaml_list(content, "user_setup");

    // Extract files_modified from YAML list in frontmatter
    let files_modified = extract_yaml_list(content, "files_modified");

    // Extract objective from XML-like tag
    let objective = extract_xml_tag(&body, "objective");

    // Parse tasks from <task> blocks
    let mut tasks = Vec::new();
    let task_re = Regex::new(r#"<task[^>]*type="([^"]*)"[^>]*>"#).ok();
    let task_name_re = Regex::new(r"<name>([^<]+)</name>").ok();

    // Simpler approach: parse task blocks by looking at body structure
    let task_block_re = Regex::new(r#"<task\b[^>]*>"#).ok();
    if let Some(re) = &task_block_re {
        for mat in re.find_iter(&body) {
            let start = mat.end();
            let block_end = body[start..].find("</task>").unwrap_or(body.len() - start);
            let block = &body[start..start + block_end];

            let task_type = task_re
                .as_ref()
                .and_then(|r| r.captures(mat.as_str()))
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().to_string());

            let name = task_name_re
                .as_ref()
                .and_then(|r| r.captures(block))
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().trim().to_string())
                .unwrap_or_else(|| {
                    // Fall back to first line of block
                    block
                        .lines()
                        .find(|l| !l.trim().is_empty())
                        .unwrap_or("Unknown task")
                        .trim()
                        .to_string()
                });

            // Extract files from <files> block
            let task_files: Vec<String> = extract_xml_tag(block, "files")
                .map(|f| {
                    f.lines()
                        .map(|l| l.trim().to_string())
                        .filter(|l| !l.is_empty())
                        .collect()
                })
                .unwrap_or_default();

            tasks.push(GsdPlanTask {
                name,
                task_type,
                files: task_files,
            });
        }
    }

    // Also try parsing numbered "Task N:" lines as a fallback
    if tasks.is_empty() {
        let task_line_re = Regex::new(r"(?m)^#+\s*Task\s+\d+[:.]\s*(.+)$").ok();
        if let Some(re) = &task_line_re {
            for cap in re.captures_iter(&body) {
                if let Some(name) = cap.get(1) {
                    tasks.push(GsdPlanTask {
                        name: name.as_str().trim().to_string(),
                        task_type: None,
                        files: vec![],
                    });
                }
            }
        }
    }

    // gsd-core@next: plans express steps as a numbered list under `## Method`
    // (or `## Steps` / `## Tasks` / `## Approach`), not <task> blocks.
    if tasks.is_empty() {
        if let Some(step_re) = Regex::new(r"(?m)^\s*\d+\.\s+(.+?)\s*$").ok() {
            for section in ["Method", "Steps", "Tasks", "Approach"] {
                if let Some(body_section) = extract_section(&body, section) {
                    for cap in step_re.captures_iter(&body_section) {
                        if let Some(name) = cap.get(1) {
                            tasks.push(GsdPlanTask {
                                name: name.as_str().trim().to_string(),
                                task_type: None,
                                files: vec![],
                            });
                        }
                    }
                    if !tasks.is_empty() {
                        break;
                    }
                }
            }
        }
    }

    let task_count = tasks.len() as i32;

    GsdPlan {
        phase_number: phase_num,
        plan_number: plan_num,
        plan_type,
        group_number,
        autonomous,
        objective,
        task_count,
        tasks,
        files_modified,
        source_file: path.to_string_lossy().to_string(),
        // SCHM-01: new next frontmatter fields
        wave,
        depends_on,
        requirements,
        user_setup,
    }
}

fn parse_summary_file(content: &str, path: &Path, phase_num: i32, plan_num: i32) -> GsdSummary {
    let (frontmatter, body) = parse_frontmatter(content);

    // D-04: log any unrecognized SUMMARY.md frontmatter fields (never hard-fail)
    warn_unknown_fields(&frontmatter, KNOWN_SUMMARY_KEYS, "SUMMARY.md");

    let tags: Vec<String> = frontmatter
        .get("tags")
        .map(|t| {
            t.trim_start_matches('[')
                .trim_end_matches(']')
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    // Extract accomplishments from "## Accomplishments" section
    let accomplishments = extract_section(&body, "accomplishments")
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    // Extract decisions from "key-decisions" in frontmatter or "## Decisions" section
    let decisions: Vec<GsdSummaryDecision> = frontmatter
        .get("key-decisions")
        .map(|_| extract_yaml_list(content, "key-decisions"))
        .unwrap_or_default()
        .into_iter()
        .map(|d| GsdSummaryDecision {
            decision: d,
            rationale: None,
        })
        .chain(
            extract_section(&body, "decisions")
                .or_else(|| extract_section(&body, "key decisions"))
                .map(|s| {
                    s.lines()
                        .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                        .map(|l| {
                            let text = l
                                .trim()
                                .trim_start_matches('-')
                                .trim_start_matches('*')
                                .trim();
                            // Try to split on " — " or " -- " for decision/rationale
                            let split = text
                                .find(" — ")
                                .map(|i| (i, " — ".len()))
                                .or_else(|| text.find(" -- ").map(|i| (i, " -- ".len())));
                            if let Some((idx, delim_len)) = split {
                                GsdSummaryDecision {
                                    decision: text[..idx].trim().to_string(),
                                    rationale: Some(text[idx + delim_len..].trim().to_string()),
                                }
                            } else {
                                GsdSummaryDecision {
                                    decision: text.to_string(),
                                    rationale: None,
                                }
                            }
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default(),
        )
        .collect();

    let files_created = extract_yaml_list(content, "key-files")
        .into_iter()
        .chain(
            frontmatter
                .get("key-files")
                .map(|_| extract_yaml_list(content, "created"))
                .unwrap_or_default(),
        )
        .collect();

    let files_modified_list = extract_yaml_list(content, "files_modified");
    let deviations = extract_section(&body, "deviations");
    let self_check = extract_section(&body, "self-check")
        .or_else(|| extract_section(&body, "self check"))
        .or_else(|| extract_section(&body, "verification"));

    // SCHM-01: new next frontmatter fields for dependency graph + requirements tracking
    let status = frontmatter.get("status").cloned();
    let requirements_completed = extract_yaml_list(content, "requirements-completed");
    let provides = extract_yaml_list(content, "provides");
    let affects = extract_yaml_list(content, "affects");
    let patterns_established = extract_yaml_list(content, "patterns-established");
    // requires: may contain nested {phase, provides} maps — extract top-level list items as strings
    let requires = extract_yaml_list(content, "requires");

    GsdSummary {
        phase_number: phase_num,
        plan_number: plan_num,
        subsystem: frontmatter.get("subsystem").cloned(),
        tags,
        duration: frontmatter.get("duration").cloned(),
        completed: frontmatter.get("completed").cloned(),
        accomplishments,
        decisions,
        files_created,
        files_modified: files_modified_list,
        deviations,
        self_check,
        source_file: path.to_string_lossy().to_string(),
        // SCHM-01: new next fields
        status,
        requirements_completed,
        requires,
        provides,
        affects,
        patterns_established,
    }
}

fn parse_phase_research_file(content: &str, path: &Path, phase_num: i32) -> GsdPhaseResearch {
    let (frontmatter, body) = parse_frontmatter(content);

    let domain = frontmatter.get("domain").cloned().or_else(|| {
        // Try to extract from first line like "**Domain:** X"
        body.lines().find(|l| l.contains("**Domain:**")).map(|l| {
            l.split("**Domain:**")
                .nth(1)
                .unwrap_or("")
                .trim()
                .to_string()
        })
    });

    let confidence = frontmatter.get("confidence").cloned().or_else(|| {
        body.lines()
            .find(|l| l.contains("**Confidence:**"))
            .map(|l| {
                l.split("**Confidence:**")
                    .nth(1)
                    .unwrap_or("")
                    .trim()
                    .to_string()
            })
    });

    let summary = extract_section(&body, "summary");

    let anti_patterns = extract_section(&body, "anti-patterns")
        .or_else(|| extract_section(&body, "anti patterns"))
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    let pitfalls = extract_section(&body, "pitfalls")
        .or_else(|| extract_section(&body, "gotchas"))
        .or_else(|| extract_section(&body, "risks"))
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .collect()
        })
        .unwrap_or_default();

    GsdPhaseResearch {
        phase_number: phase_num,
        domain,
        confidence,
        summary,
        anti_patterns,
        pitfalls,
        raw_content: content.to_string(),
        source_file: path.to_string_lossy().to_string(),
    }
}

/// Parse velocity metrics from STATE.md body
fn parse_velocity_from_state(body: &str) -> Option<GsdVelocity> {
    let perf_section = extract_section(body, "performance metrics")
        .or_else(|| extract_section(body, "velocity"))?;

    let mut total_plans = None;
    let mut avg_duration = None;
    let mut total_time = None;
    let mut by_phase = Vec::new();

    for line in perf_section.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("- Total plans") || trimmed.starts_with("- Total Plans") {
            total_plans = trimmed
                .split(':')
                .nth(1)
                .and_then(|s| s.trim().split_whitespace().next())
                .and_then(|s| s.parse::<i32>().ok());
        } else if trimmed.starts_with("- Average duration")
            || trimmed.starts_with("- Average Duration")
        {
            avg_duration = trimmed.split(':').nth(1).map(|s| s.trim().to_string());
        } else if trimmed.starts_with("- Total execution")
            || trimmed.starts_with("- Total Execution")
            || trimmed.starts_with("- Total time")
        {
            total_time = trimmed.split(':').nth(1).map(|s| s.trim().to_string());
        }
    }

    // Parse velocity table rows: | Phase | Plans | Total | Avg/Plan |
    let table_re = Regex::new(r"^\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$").ok();
    if let Some(re) = &table_re {
        for line in perf_section.lines() {
            let trimmed = line.trim();
            if trimmed.contains("---") || trimmed.to_lowercase().contains("phase") {
                continue;
            }
            if let Some(caps) = re.captures(trimmed) {
                let phase_name = caps.get(1).map_or("", |m| m.as_str()).trim().to_string();
                if phase_name.is_empty() {
                    continue;
                }
                let plans = caps
                    .get(2)
                    .and_then(|m| m.as_str().parse::<i32>().ok())
                    .unwrap_or(0);
                let duration = caps.get(3).map_or("", |m| m.as_str()).trim().to_string();
                let avg_per_plan = caps.get(4).map_or("", |m| m.as_str()).trim().to_string();

                by_phase.push(GsdPhaseVelocity {
                    phase: phase_name,
                    plans,
                    duration,
                    avg_per_plan,
                });
            }
        }
    }

    if total_plans.is_some() || !by_phase.is_empty() {
        Some(GsdVelocity {
            total_plans,
            avg_duration,
            total_time,
            by_phase,
        })
    } else {
        None
    }
}

#[tauri::command]
pub async fn gsd_list_plans(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdPlan>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    if !phases_dir.exists() {
        return Ok(vec![]);
    }

    let mut plans = Vec::new();
    let num_re = Regex::new(r"^0*(\d+)").unwrap();
    let plan_num_re = Regex::new(r"^\d+-(\d+)-PLAN\.md$").unwrap();

    if let Ok(entries) = fs::read_dir(&phases_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let dir_name = path
                .file_name()
                .map_or("".to_string(), |f| f.to_string_lossy().to_string());
            if let Some(caps) = num_re.captures(&dir_name) {
                if let Ok(phase_num) = caps.get(1).unwrap().as_str().parse::<i32>() {
                    for plan_path in find_plan_files(&path) {
                        let filename = plan_path
                            .file_name()
                            .map_or("".to_string(), |f| f.to_string_lossy().to_string());
                        let plan_num = plan_num_re
                            .captures(&filename)
                            .and_then(|c| c.get(1))
                            .and_then(|m| m.as_str().parse::<i32>().ok())
                            .unwrap_or(0);

                        if let Ok(content) = fs::read_to_string(&plan_path) {
                            plans.push(parse_plan_file(&content, &plan_path, phase_num, plan_num));
                        }
                    }
                }
            }
        }
    }

    plans.sort_by(|a, b| {
        a.phase_number
            .cmp(&b.phase_number)
            .then(a.plan_number.cmp(&b.plan_number))
    });
    Ok(plans)
}

#[tauri::command]
pub async fn gsd_get_phase_plans(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<Vec<GsdPlan>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");
    let phase_dir = find_phase_dir(&phases_dir, &phase_number.to_string())?;

    let plan_num_re = Regex::new(r"^\d+-(\d+)-PLAN\.md$").unwrap();
    let mut plans = Vec::new();

    for plan_path in find_plan_files(&phase_dir) {
        let filename = plan_path
            .file_name()
            .map_or("".to_string(), |f| f.to_string_lossy().to_string());
        let plan_num = plan_num_re
            .captures(&filename)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<i32>().ok())
            .unwrap_or(0);

        if let Ok(content) = fs::read_to_string(&plan_path) {
            plans.push(parse_plan_file(
                &content,
                &plan_path,
                phase_number,
                plan_num,
            ));
        }
    }

    plans.sort_by_key(|p| p.plan_number);
    Ok(plans)
}

// ============================================================
// Summaries (.planning/phases/XX-YY/XX-YY-SUMMARY.md)
// ============================================================

fn find_summary_files(phase_dir: &Path) -> Vec<std::path::PathBuf> {
    // Accept both legacy `{NN}-{MM}-SUMMARY.md` and gsd-core@next `{NN}-SUMMARY.md`.
    let re = Regex::new(r"^\d+(-\d+)?-SUMMARY\.md$").unwrap();
    let mut files: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(entries) = fs::read_dir(phase_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let name = entry.file_name().to_string_lossy().to_string();
            if re.is_match(&name) {
                files.push(entry.path());
            }
        }
    }

    files.sort();
    files
}

#[tauri::command]
pub async fn gsd_list_summaries(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdSummary>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    if !phases_dir.exists() {
        return Ok(vec![]);
    }

    let mut summaries = Vec::new();
    let num_re = Regex::new(r"^0*(\d+)").unwrap();
    let sum_num_re = Regex::new(r"^\d+-(\d+)-SUMMARY\.md$").unwrap();

    if let Ok(entries) = fs::read_dir(&phases_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let dir_name = path
                .file_name()
                .map_or("".to_string(), |f| f.to_string_lossy().to_string());
            if let Some(caps) = num_re.captures(&dir_name) {
                if let Ok(phase_num) = caps.get(1).unwrap().as_str().parse::<i32>() {
                    for sum_path in find_summary_files(&path) {
                        let filename = sum_path
                            .file_name()
                            .map_or("".to_string(), |f| f.to_string_lossy().to_string());
                        let plan_num = sum_num_re
                            .captures(&filename)
                            .and_then(|c| c.get(1))
                            .and_then(|m| m.as_str().parse::<i32>().ok())
                            .unwrap_or(0);

                        if let Ok(content) = fs::read_to_string(&sum_path) {
                            summaries
                                .push(parse_summary_file(&content, &sum_path, phase_num, plan_num));
                        }
                    }
                }
            }
        }
    }

    summaries.sort_by(|a, b| {
        a.phase_number
            .cmp(&b.phase_number)
            .then(a.plan_number.cmp(&b.plan_number))
    });
    Ok(summaries)
}

#[tauri::command]
pub async fn gsd_get_phase_summaries(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<Vec<GsdSummary>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");
    let phase_dir = find_phase_dir(&phases_dir, &phase_number.to_string())?;

    let sum_num_re = Regex::new(r"^\d+-(\d+)-SUMMARY\.md$").unwrap();
    let mut summaries = Vec::new();

    for sum_path in find_summary_files(&phase_dir) {
        let filename = sum_path
            .file_name()
            .map_or("".to_string(), |f| f.to_string_lossy().to_string());
        let plan_num = sum_num_re
            .captures(&filename)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<i32>().ok())
            .unwrap_or(0);

        if let Ok(content) = fs::read_to_string(&sum_path) {
            summaries.push(parse_summary_file(
                &content,
                &sum_path,
                phase_number,
                plan_num,
            ));
        }
    }

    summaries.sort_by_key(|s| s.plan_number);
    Ok(summaries)
}

// ============================================================
// Phase Research (.planning/phases/XX-YY/XX-RESEARCH.md)
// ============================================================

#[tauri::command]
pub async fn gsd_list_phase_research(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdPhaseResearch>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    if !phases_dir.exists() {
        return Ok(vec![]);
    }

    let mut research_docs = Vec::new();
    let num_re = Regex::new(r"^0*(\d+)").unwrap();
    let research_re = Regex::new(r"^\d+-RESEARCH\.md$").unwrap();

    if let Ok(entries) = fs::read_dir(&phases_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let dir_name = path
                .file_name()
                .map_or("".to_string(), |f| f.to_string_lossy().to_string());
            if let Some(caps) = num_re.captures(&dir_name) {
                if let Ok(phase_num) = caps.get(1).unwrap().as_str().parse::<i32>() {
                    // Look for XX-RESEARCH.md in this phase dir
                    if let Ok(phase_entries) = fs::read_dir(&path) {
                        for pe in phase_entries.flatten() {
                            let fname = pe.file_name().to_string_lossy().to_string();
                            if research_re.is_match(&fname) {
                                if let Ok(content) = fs::read_to_string(pe.path()) {
                                    research_docs.push(parse_phase_research_file(
                                        &content,
                                        &pe.path(),
                                        phase_num,
                                    ));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    research_docs.sort_by_key(|r| r.phase_number);
    Ok(research_docs)
}

#[tauri::command]
pub async fn gsd_get_phase_research(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<GsdPhaseResearch, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: phases/ lives under the active workstream subtree (SCHM-04)
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");
    let phase_dir = find_phase_dir(&phases_dir, &phase_number.to_string())?;

    let research_re = Regex::new(r"^\d+-RESEARCH\.md$").unwrap();

    if let Ok(entries) = fs::read_dir(&phase_dir) {
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            if research_re.is_match(&fname) {
                let content = fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
                return Ok(parse_phase_research_file(
                    &content,
                    &entry.path(),
                    phase_number,
                ));
            }
        }
    }

    Err(format!("No RESEARCH.md found for phase {}", phase_number))
}

// ============================================================
// Milestone Audits (.planning/milestones/vX.X-MILESTONE-AUDIT.md)
// ============================================================

#[tauri::command]
pub async fn gsd_list_milestone_audits(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdMilestoneAudit>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let milestones_dir = Path::new(&project_path)
        .join(".planning")
        .join("milestones");

    if !milestones_dir.exists() {
        return Ok(vec![]);
    }

    let mut audits = Vec::new();
    let audit_re = Regex::new(r"(?i)MILESTONE[-_]AUDIT\.md$").unwrap();

    if let Ok(entries) = fs::read_dir(&milestones_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let fname = path
                .file_name()
                .map_or("".to_string(), |f| f.to_string_lossy().to_string());
            if audit_re.is_match(&fname) {
                if let Ok(content) = fs::read_to_string(&path) {
                    let (frontmatter, body) = parse_frontmatter(&content);

                    // Try to extract version from filename or frontmatter
                    let version = frontmatter.get("version").cloned().or_else(|| {
                        let ver_re = Regex::new(r"v?([\d.]+)").ok();
                        ver_re.and_then(|re| re.captures(&fname).map(|c| c[1].to_string()))
                    });

                    let gaps = extract_section(&body, "gaps")
                        .or_else(|| extract_section(&body, "open gaps"))
                        .map(|s| {
                            s.lines()
                                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                                .map(|l| {
                                    l.trim()
                                        .trim_start_matches('-')
                                        .trim_start_matches('*')
                                        .trim()
                                        .to_string()
                                })
                                .collect()
                        })
                        .unwrap_or_default();

                    let tech_debt = extract_section(&body, "tech debt")
                        .or_else(|| extract_section(&body, "technical debt"))
                        .map(|s| {
                            s.lines()
                                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                                .map(|l| {
                                    l.trim()
                                        .trim_start_matches('-')
                                        .trim_start_matches('*')
                                        .trim()
                                        .to_string()
                                })
                                .collect()
                        })
                        .unwrap_or_default();

                    audits.push(GsdMilestoneAudit {
                        version,
                        status: frontmatter.get("status").cloned(),
                        req_score: frontmatter
                            .get("req_score")
                            .or_else(|| frontmatter.get("requirements_score"))
                            .cloned(),
                        phase_score: frontmatter
                            .get("phase_score")
                            .or_else(|| frontmatter.get("phases_score"))
                            .cloned(),
                        integration_score: frontmatter.get("integration_score").cloned(),
                        gaps,
                        tech_debt,
                        raw_content: content,
                        source_file: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }

    audits.sort_by(|a, b| a.version.cmp(&b.version));
    Ok(audits)
}

// ============================================================
// Sync Project (parse all .planning/ files into DB cache)
// ============================================================

/// Internal sync function that can be called without tauri::State.
/// Takes a direct reference to the Database and the project_id.
pub fn gsd_sync_project_internal(db: &Database, project_id: &str) -> Result<GsdSyncResult, String> {
    let project_path = get_project_path(db, project_id)?;
    gsd_sync_project_by_path(db, project_id, &project_path)
}

/// Core sync logic that operates on a project path.
/// Used by both the Tauri command and the internal helper.
fn gsd_sync_project_by_path(
    db: &Database,
    project_id: &str,
    project_path: &str,
) -> Result<GsdSyncResult, String> {
    let planning_dir = Path::new(project_path).join(".planning");

    // GSD-2 projects use .gsd/ instead of .planning/ — no DB sync needed (reads files directly)
    if !planning_dir.exists() {
        if Path::new(project_path).join(".gsd").exists() {
            return Ok(GsdSyncResult {
                todos_synced: 0,
                milestones_synced: 0,
                requirements_synced: 0,
                verifications_synced: 0,
                plans_synced: 0,
                summaries_synced: 0,
                phase_research_synced: 0,
                uat_synced: 0,
            });
        }
        return Err("No .planning/ directory found".to_string());
    }

    let mut result = GsdSyncResult {
        todos_synced: 0,
        milestones_synced: 0,
        requirements_synced: 0,
        verifications_synced: 0,
        plans_synced: 0,
        summaries_synced: 0,
        phase_research_synced: 0,
        uat_synced: 0,
    };

    // Sync todos
    let todos_dir = planning_dir.join("todos");
    if todos_dir.exists() {
        db.conn()
            .execute(
                "DELETE FROM gsd_todos WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;

        for (dir_name, status) in &[("pending", "pending"), ("done", "done")] {
            let dir = todos_dir.join(dir_name);
            if dir.exists() {
                if let Ok(entries) = fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().map_or(false, |e| e == "md") {
                            if let Ok(content) = fs::read_to_string(&path) {
                                let todo = parse_todo_file(&content, &path, status);
                                let files_json = todo
                                    .files
                                    .as_ref()
                                    .map(|f| serde_json::to_string(f).unwrap_or_default());

                                db.conn()
                                    .execute(
                                        "INSERT INTO gsd_todos (id, project_id, title, description, area, phase, priority, status, is_blocker, files, source_file, created_at, completed_at)
                                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                                        params![
                                            todo.id,
                                            project_id,
                                            todo.title,
                                            todo.description,
                                            todo.area,
                                            todo.phase,
                                            todo.priority,
                                            todo.status,
                                            todo.is_blocker as i32,
                                            files_json,
                                            todo.source_file,
                                            todo.created_at,
                                            todo.completed_at,
                                        ],
                                    )
                                    .map_err(|e| e.to_string())?;
                                result.todos_synced += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    // Sync requirements
    let req_path = planning_dir.join("REQUIREMENTS.md");
    if req_path.exists() {
        db.conn()
            .execute(
                "DELETE FROM gsd_requirements WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;

        if let Ok(content) = fs::read_to_string(&req_path) {
            if let Ok(reqs) = parse_requirements(&content) {
                for req in &reqs {
                    db.conn()
                        .execute(
                            "INSERT INTO gsd_requirements (project_id, req_id, description, category, priority, status, phase)
                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                            params![
                                project_id,
                                req.req_id,
                                req.description,
                                req.category,
                                req.priority,
                                req.status,
                                req.phase,
                            ],
                        )
                        .map_err(|e| e.to_string())?;
                }
                result.requirements_synced = reqs.len() as i32;
            }
        }
    }

    // Sync milestones from ROADMAP.md + archived milestones from STATE.md
    db.conn()
        .execute(
            "DELETE FROM gsd_milestones WHERE project_id = ?1",
            params![project_id],
        )
        .map_err(|e| e.to_string())?;

    let mut all_milestones: Vec<GsdMilestone> = Vec::new();

    // Source 1: ROADMAP.md (current/active milestones)
    let roadmap_path = planning_dir.join("ROADMAP.md");
    if roadmap_path.exists() {
        if let Ok(content) = fs::read_to_string(&roadmap_path) {
            if let Ok(milestones) = parse_milestones(&content) {
                all_milestones.extend(milestones);
            }
        }
    }

    // Source 2: STATE.md Milestone History (archived/completed milestones)
    let state_path = planning_dir.join("STATE.md");
    if state_path.exists() {
        if let Ok(content) = fs::read_to_string(&state_path) {
            let history = parse_milestone_history(&content);
            // Only add milestones not already present from ROADMAP.md (match by name)
            for hist_ms in history {
                let already_exists = all_milestones
                    .iter()
                    .any(|m| m.name.to_lowercase() == hist_ms.name.to_lowercase());
                if !already_exists {
                    all_milestones.push(hist_ms);
                }
            }
        }
    }

    for ms in &all_milestones {
        db.conn()
            .execute(
                "INSERT INTO gsd_milestones (project_id, name, version, phase_start, phase_end, status, completed_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    project_id,
                    ms.name,
                    ms.version,
                    ms.phase_start,
                    ms.phase_end,
                    ms.status,
                    ms.completed_at,
                ],
            )
            .map_err(|e| e.to_string())?;
    }
    result.milestones_synced = all_milestones.len() as i32;

    // Sync verifications from phase directories
    let phases_dir = planning_dir.join("phases");
    if phases_dir.exists() {
        db.conn()
            .execute(
                "DELETE FROM gsd_verifications WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;

        if let Ok(entries) = fs::read_dir(&phases_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let dir_name = path
                        .file_name()
                        .map_or("".to_string(), |f| f.to_string_lossy().to_string());

                    let num_re = Regex::new(r"^0*(\d+)").unwrap();
                    if let Some(caps) = num_re.captures(&dir_name) {
                        if let Ok(phase_num) = caps.get(1).unwrap().as_str().parse::<i32>() {
                            let verification_path = path.join("VERIFICATION.md");
                            if verification_path.exists() {
                                if let Ok(content) = fs::read_to_string(&verification_path) {
                                    if let Ok(v) = parse_verification(&content, phase_num) {
                                        db.conn()
                                            .execute(
                                                "INSERT INTO gsd_verifications (project_id, phase_number, checks_total, checks_passed, result, raw_content, source_file)
                                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                                                params![
                                                    project_id,
                                                    v.phase_number,
                                                    v.checks_total,
                                                    v.checks_passed,
                                                    v.result,
                                                    v.raw_content,
                                                    verification_path.to_string_lossy().to_string(),
                                                ],
                                            )
                                            .map_err(|e| e.to_string())?;
                                        result.verifications_synced += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Sync plans, summaries, and phase research from phase directories
    let plan_num_re = Regex::new(r"^\d+-(\d+)-PLAN\.md$").unwrap();
    let sum_num_re = Regex::new(r"^\d+-(\d+)-SUMMARY\.md$").unwrap();
    let research_re = Regex::new(r"^\d+-RESEARCH\.md$").unwrap();

    if phases_dir.exists() {
        // Clear existing data
        db.conn()
            .execute(
                "DELETE FROM gsd_plans WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;
        db.conn()
            .execute(
                "DELETE FROM gsd_summaries WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;
        db.conn()
            .execute(
                "DELETE FROM gsd_phase_research WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;

        let num_re2 = Regex::new(r"^0*(\d+)").unwrap();
        if let Ok(entries) = fs::read_dir(&phases_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let dir_name = path
                    .file_name()
                    .map_or("".to_string(), |f| f.to_string_lossy().to_string());
                if let Some(caps) = num_re2.captures(&dir_name) {
                    if let Ok(phase_num) = caps.get(1).unwrap().as_str().parse::<i32>() {
                        // Sync plans
                        for plan_path in find_plan_files(&path) {
                            let fname = plan_path
                                .file_name()
                                .map_or("".to_string(), |f| f.to_string_lossy().to_string());
                            let pnum = plan_num_re
                                .captures(&fname)
                                .and_then(|c| c.get(1))
                                .and_then(|m| m.as_str().parse::<i32>().ok())
                                .unwrap_or(0);

                            if let Ok(content) = fs::read_to_string(&plan_path) {
                                let plan = parse_plan_file(&content, &plan_path, phase_num, pnum);
                                db.conn()
                                    .execute(
                                        "INSERT OR REPLACE INTO gsd_plans (project_id, phase_number, plan_number, plan_type, group_number, autonomous, objective, task_count, source_file)
                                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                                        params![
                                            project_id,
                                            plan.phase_number,
                                            plan.plan_number,
                                            plan.plan_type,
                                            plan.group_number,
                                            plan.autonomous as i32,
                                            plan.objective,
                                            plan.task_count,
                                            plan.source_file,
                                        ],
                                    )
                                    .map_err(|e| e.to_string())?;
                                result.plans_synced += 1;
                            }
                        }

                        // Sync summaries
                        for sum_path in find_summary_files(&path) {
                            let fname = sum_path
                                .file_name()
                                .map_or("".to_string(), |f| f.to_string_lossy().to_string());
                            let snum = sum_num_re
                                .captures(&fname)
                                .and_then(|c| c.get(1))
                                .and_then(|m| m.as_str().parse::<i32>().ok())
                                .unwrap_or(0);

                            if let Ok(content) = fs::read_to_string(&sum_path) {
                                let summary =
                                    parse_summary_file(&content, &sum_path, phase_num, snum);
                                let accomplishments_json =
                                    serde_json::to_string(&summary.accomplishments)
                                        .unwrap_or_default();
                                let files_created_json =
                                    serde_json::to_string(&summary.files_created)
                                        .unwrap_or_default();
                                let files_modified_json =
                                    serde_json::to_string(&summary.files_modified)
                                        .unwrap_or_default();

                                db.conn()
                                    .execute(
                                        "INSERT OR REPLACE INTO gsd_summaries (project_id, phase_number, plan_number, subsystem, duration, completed, accomplishments, files_created, files_modified, self_check, source_file)
                                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                                        params![
                                            project_id,
                                            summary.phase_number,
                                            summary.plan_number,
                                            summary.subsystem,
                                            summary.duration,
                                            summary.completed,
                                            accomplishments_json,
                                            files_created_json,
                                            files_modified_json,
                                            summary.self_check,
                                            summary.source_file,
                                        ],
                                    )
                                    .map_err(|e| e.to_string())?;
                                result.summaries_synced += 1;
                            }
                        }

                        // Sync phase research
                        if let Ok(phase_entries) = fs::read_dir(&path) {
                            for pe in phase_entries.flatten() {
                                let fname = pe.file_name().to_string_lossy().to_string();
                                if research_re.is_match(&fname) {
                                    if let Ok(content) = fs::read_to_string(pe.path()) {
                                        let research = parse_phase_research_file(
                                            &content,
                                            &pe.path(),
                                            phase_num,
                                        );
                                        db.conn()
                                            .execute(
                                                "INSERT OR REPLACE INTO gsd_phase_research (project_id, phase_number, domain, confidence, summary, raw_content, source_file)
                                                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                                                params![
                                                    project_id,
                                                    research.phase_number,
                                                    research.domain,
                                                    research.confidence,
                                                    research.summary,
                                                    research.raw_content,
                                                    research.source_file,
                                                ],
                                            )
                                            .map_err(|e| e.to_string())?;
                                        result.phase_research_synced += 1;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Sync config
    let config_path = planning_dir.join("config.json");
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let workflow_mode = json
                    .get("workflow_mode")
                    .or_else(|| json.get("workflowMode"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let model_profile = json
                    .get("model_profile")
                    .or_else(|| json.get("modelProfile"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                db.conn()
                    .execute(
                        "INSERT OR REPLACE INTO gsd_config (project_id, workflow_mode, model_profile, raw_json, synced_at)
                         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
                        params![project_id, workflow_mode, model_profile, content],
                    )
                    .map_err(|e| e.to_string())?;
            }
        }
    }

    // Sync VALIDATION.md files from phase directories
    if phases_dir.exists() {
        db.conn()
            .execute(
                "DELETE FROM gsd_validations WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;

        let num_re_v = Regex::new(r"^0*(\d+)").unwrap();
        if let Ok(entries) = fs::read_dir(&phases_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let dir_name = path
                    .file_name()
                    .map_or("".to_string(), |f| f.to_string_lossy().to_string());
                if let Some(caps) = num_re_v.captures(&dir_name) {
                    let phase_num_str = caps.get(1).unwrap().as_str().to_string();
                    let validation_path = path.join("VALIDATION.md");
                    if validation_path.exists() {
                        if let Ok(content) = fs::read_to_string(&validation_path) {
                            let v = parse_validation_file(
                                &content,
                                &validation_path,
                                &phase_num_str,
                                project_id,
                            );
                            if let Err(e) = upsert_validation(db, project_id, &v) {
                                tracing::warn!(
                                    "[gsd_sync_project] Failed to upsert validation for phase {}: {}",
                                    phase_num_str, e
                                );
                            }
                        }
                    }
                }
            }
        }
    }

    // Sync UAT results from phase directories
    let uat_re = Regex::new(r"^\d+-UAT\.md$").unwrap();
    if phases_dir.exists() {
        db.conn()
            .execute(
                "DELETE FROM gsd_uat_results WHERE project_id = ?1",
                params![project_id],
            )
            .map_err(|e| e.to_string())?;

        let num_re_uat = Regex::new(r"^0*(\d+)").unwrap();
        if let Ok(uat_entries) = fs::read_dir(&phases_dir) {
            for entry in uat_entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let dir_name = path
                    .file_name()
                    .map_or("".to_string(), |f| f.to_string_lossy().to_string());
                if let Some(caps) = num_re_uat.captures(&dir_name) {
                    let phase_str = caps.get(1).unwrap().as_str().to_string();
                    if let Ok(phase_entries) = fs::read_dir(&path) {
                        for pe in phase_entries.flatten() {
                            let fname = pe.file_name().to_string_lossy().to_string();
                            if uat_re.is_match(&fname) {
                                if let Ok(content) = fs::read_to_string(pe.path()) {
                                    let uat = parse_uat_file(&content, &pe.path(), &phase_str);
                                    let tests_json =
                                        serde_json::to_string(&uat.tests).unwrap_or_default();
                                    let issues_json =
                                        serde_json::to_string(&uat.issues).unwrap_or_default();
                                    let gaps_json =
                                        serde_json::to_string(&uat.gaps).unwrap_or_default();

                                    db.conn()
                                        .execute(
                                            "INSERT OR REPLACE INTO gsd_uat_results
                                             (id, project_id, phase_number, session_number, status,
                                              tests_json, issues_json, gaps_json, diagnosis,
                                              raw_content, source_file)
                                             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                                            params![
                                                uat.id,
                                                project_id,
                                                uat.phase_number,
                                                uat.session_number,
                                                uat.status,
                                                tests_json,
                                                issues_json,
                                                gaps_json,
                                                uat.diagnosis,
                                                uat.raw_content,
                                                uat.source_file,
                                            ],
                                        )
                                        .map_err(|e| e.to_string())?;
                                    result.uat_synced += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    tracing::info!(
        "[gsd_sync_project] Synced project {}: {} todos, {} milestones, {} requirements, {} verifications, {} plans, {} summaries, {} phase_research, {} uat",
        project_id,
        result.todos_synced,
        result.milestones_synced,
        result.requirements_synced,
        result.verifications_synced,
        result.plans_synced,
        result.summaries_synced,
        result.phase_research_synced,
        result.uat_synced
    );

    Ok(result)
}

#[tauri::command]
pub async fn gsd_sync_project(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<GsdSyncResult, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    gsd_sync_project_internal(&db, &project_id)
}

// ============================================================
// UAT (.planning/phases/XX-YY/XX-UAT.md)
// ============================================================

/// Parse a UAT.md file into a GsdUatResult struct
fn parse_uat_file(content: &str, path: &Path, phase_number: &str) -> GsdUatResult {
    // Parse Status: **Status:** testing | complete | diagnosed
    let status_raw = content
        .lines()
        .find(|l| l.contains("**Status:**"))
        .and_then(|l| l.split("**Status:**").nth(1))
        .map(|s| s.trim().to_lowercase())
        .unwrap_or_else(|| "testing".to_string());

    let status = if status_raw.contains("complete") {
        "complete".to_string()
    } else if status_raw.contains("diagnosed") || status_raw.contains("diagnosis") {
        "diagnosed".to_string()
    } else {
        "testing".to_string()
    };

    // Parse Test Session: **Test Session:** N
    let session_number = content
        .lines()
        .find(|l| l.contains("**Test Session:**"))
        .and_then(|l| l.split("**Test Session:**").nth(1))
        .and_then(|s| s.trim().parse::<i32>().ok())
        .unwrap_or(1);

    // Parse ## Test Results table rows
    let mut tests: Vec<UatTestResult> = Vec::new();
    if let Some(table_section) = extract_section(content, "test results") {
        let row_re = Regex::new(
            r"^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.*?)\s*\|",
        )
        .ok();
        for line in table_section.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with('|') || trimmed.contains("---") {
                continue;
            }
            if let Some(re) = &row_re {
                if let Some(caps) = re.captures(trimmed) {
                    let number = caps
                        .get(1)
                        .and_then(|m| m.as_str().parse::<i32>().ok())
                        .unwrap_or(0);
                    let test = caps.get(2).map_or("", |m| m.as_str()).trim().to_string();
                    let expected = caps.get(3).map_or("", |m| m.as_str()).trim().to_string();
                    let result_raw = caps.get(4).map_or("", |m| m.as_str()).trim().to_string();
                    let notes_raw = caps.get(5).map_or("", |m| m.as_str()).trim().to_string();

                    let result = if result_raw.contains('✅')
                        || result_raw.to_lowercase().contains("pass")
                    {
                        "pass".to_string()
                    } else if result_raw.contains('❌')
                        || result_raw.to_lowercase().contains("issue")
                        || result_raw.to_lowercase().contains("fail")
                    {
                        "issue".to_string()
                    } else if result_raw.contains('⏳')
                        || result_raw.to_lowercase().contains("pending")
                    {
                        "pending".to_string()
                    } else if result_raw.contains('⏭')
                        || result_raw.to_lowercase().contains("skip")
                    {
                        "skipped".to_string()
                    } else {
                        "pending".to_string()
                    };

                    let notes = if notes_raw.is_empty() {
                        None
                    } else {
                        Some(notes_raw)
                    };

                    if !test.is_empty() {
                        tests.push(UatTestResult {
                            number,
                            test,
                            expected,
                            result,
                            notes,
                        });
                    }
                }
            }
        }
    }

    // Parse ## Issues Found
    let mut issues: Vec<UatIssue> = Vec::new();
    let issues_section = extract_section(content, "issues found")
        .or_else(|| extract_section(content, "issues"));
    if let Some(section) = issues_section {
        let issue_re = Regex::new(r"^\s*[-*]\s*\*\*\[(\w+)\]\*\*\s*(.+)$").ok();
        for line in section.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with('-') && !trimmed.starts_with('*') {
                continue;
            }
            let mut pushed = false;
            if let Some(re) = &issue_re {
                if let Some(caps) = re.captures(trimmed) {
                    let sev_raw =
                        caps.get(1).map_or("minor", |m| m.as_str()).to_lowercase();
                    let desc = caps.get(2).map_or("", |m| m.as_str()).trim().to_string();
                    let severity = match sev_raw.as_str() {
                        "blocker" | "critical" => "blocker".to_string(),
                        "major" => "major".to_string(),
                        "cosmetic" => "cosmetic".to_string(),
                        _ => "minor".to_string(),
                    };
                    if !desc.is_empty() {
                        issues.push(UatIssue { severity, description: desc });
                        pushed = true;
                    }
                }
            }
            if !pushed {
                let desc = trimmed
                    .trim_start_matches('-')
                    .trim_start_matches('*')
                    .trim()
                    .to_string();
                if !desc.is_empty() {
                    issues.push(UatIssue {
                        severity: "minor".to_string(),
                        description: desc,
                    });
                }
            }
        }
    }

    // Parse ## Gaps
    let gaps: Vec<String> = extract_section(content, "gaps")
        .map(|s| {
            s.lines()
                .filter(|l| l.trim().starts_with('-') || l.trim().starts_with('*'))
                .map(|l| {
                    l.trim()
                        .trim_start_matches('-')
                        .trim_start_matches('*')
                        .trim()
                        .to_string()
                })
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    // Parse ## Diagnosis
    let diagnosis = extract_section(content, "diagnosis");

    let pass_count = tests.iter().filter(|t| t.result == "pass").count() as i32;
    let issue_count = tests.iter().filter(|t| t.result == "issue").count() as i32;
    let pending_count = tests.iter().filter(|t| t.result == "pending").count() as i32;

    GsdUatResult {
        id: gen_id(),
        project_id: String::new(),
        phase_number: phase_number.to_string(),
        session_number,
        status,
        tests,
        issues,
        gaps,
        diagnosis,
        raw_content: Some(content.to_string()),
        source_file: Some(path.to_string_lossy().to_string()),
        pass_count,
        issue_count,
        pending_count,
    }
}

/// Deserialize a GsdUatResult from a SQLite row
fn row_to_uat_result(row: &rusqlite::Row) -> rusqlite::Result<GsdUatResult> {
    let id: String = row.get(0)?;
    let project_id: String = row.get(1)?;
    let phase_number: String = row.get(2)?;
    let session_number: i32 = row.get(3)?;
    let status: String = row.get(4)?;
    let tests_json: Option<String> = row.get(5)?;
    let issues_json: Option<String> = row.get(6)?;
    let gaps_json: Option<String> = row.get(7)?;
    let diagnosis: Option<String> = row.get(8)?;
    let raw_content: Option<String> = row.get(9)?;
    let source_file: Option<String> = row.get(10)?;

    let tests: Vec<UatTestResult> = tests_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default();
    let issues: Vec<UatIssue> = issues_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default();
    let gaps: Vec<String> = gaps_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default();

    let pass_count = tests.iter().filter(|t| t.result == "pass").count() as i32;
    let issue_count = tests.iter().filter(|t| t.result == "issue").count() as i32;
    let pending_count = tests.iter().filter(|t| t.result == "pending").count() as i32;

    Ok(GsdUatResult {
        id,
        project_id,
        phase_number,
        session_number,
        status,
        tests,
        issues,
        gaps,
        diagnosis,
        raw_content,
        source_file,
        pass_count,
        issue_count,
        pending_count,
    })
}

#[tauri::command]
pub async fn gsd_list_uat_results(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdUatResult>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let conn = db.read().await;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, phase_number, session_number, status,
                    tests_json, issues_json, gaps_json, diagnosis, raw_content, source_file
             FROM gsd_uat_results
             WHERE project_id = ?1
             ORDER BY phase_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![project_id], row_to_uat_result)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

#[tauri::command]
pub async fn gsd_get_uat_by_phase(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: String,
) -> Result<Option<GsdUatResult>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let conn = db.read().await;
    let result = conn
        .query_row(
            "SELECT id, project_id, phase_number, session_number, status,
                    tests_json, issues_json, gaps_json, diagnosis, raw_content, source_file
             FROM gsd_uat_results
             WHERE project_id = ?1 AND phase_number = ?2
             ORDER BY session_number DESC
             LIMIT 1",
            params![project_id, phase_number],
            row_to_uat_result,
        )
        .ok();

    Ok(result)
}

// ============================================================
// VALIDATION.md Parsing and Commands (per-phase test strategy)
// ============================================================

/// Parse a VALIDATION.md file into a GsdValidation struct.
fn parse_validation_file(
    content: &str,
    source_file: &Path,
    phase_number: &str,
    project_id: &str,
) -> GsdValidation {
    let id = gen_id();

    // --- Test Infrastructure ---
    let infra = extract_section(content, "test infrastructure");
    let mut test_framework: Option<String> = None;
    let mut quick_run_cmd: Option<String> = None;
    let mut full_run_cmd: Option<String> = None;

    if let Some(section) = &infra {
        for line in section.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("- Framework:") {
                test_framework = Some(rest.trim().to_string());
            } else if let Some(rest) = trimmed.strip_prefix("- Quick run:") {
                quick_run_cmd = Some(rest.trim().trim_matches('`').to_string());
            } else if let Some(rest) = trimmed.strip_prefix("- Full run:") {
                full_run_cmd = Some(rest.trim().trim_matches('`').to_string());
            } else if let Some(rest) = trimmed.strip_prefix("- framework:") {
                if test_framework.is_none() {
                    test_framework = Some(rest.trim().to_string());
                }
            } else if let Some(rest) = trimmed.strip_prefix("- quick run:") {
                if quick_run_cmd.is_none() {
                    quick_run_cmd = Some(rest.trim().trim_matches('`').to_string());
                }
            } else if let Some(rest) = trimmed.strip_prefix("- full run:") {
                if full_run_cmd.is_none() {
                    full_run_cmd = Some(rest.trim().trim_matches('`').to_string());
                }
            }
        }
    }

    // --- Nyquist Sampling Rate ---
    let nyquist_rate = extract_section(content, "nyquist sampling rate").and_then(|s| {
        s.lines()
            .find(|l| !l.trim().is_empty())
            .map(|l| l.trim().to_string())
    });

    // --- Per-Task Verification Map (markdown table) ---
    let mut task_map: Vec<TaskVerification> = Vec::new();
    if let Some(section) = extract_section(content, "per-task verification map") {
        for line in section.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with('|') {
                continue;
            }
            let cells: Vec<&str> = trimmed
                .split('|')
                .map(|c| c.trim())
                .filter(|c| !c.is_empty())
                .collect();
            if cells.len() < 3 {
                continue;
            }
            // Skip header row and separator row
            let first = cells[0].to_lowercase();
            if first == "task" || first.contains("---") {
                continue;
            }
            let task_id = cells[0].to_string();
            let requirement = if cells.len() > 1 && !cells[1].is_empty() && cells[1] != "-" {
                Some(cells[1].to_string())
            } else {
                None
            };
            let test_type = if cells.len() > 2 {
                cells[2].to_lowercase()
            } else {
                "automated".to_string()
            };
            let status = if cells.len() > 3 {
                cells[3].to_lowercase()
            } else {
                "pending".to_string()
            };
            task_map.push(TaskVerification {
                task_id,
                requirement,
                test_type,
                status,
            });
        }
    }

    // --- Manual-Only Verifications ---
    let mut manual_checks: Vec<String> = Vec::new();
    if let Some(section) = extract_section(content, "manual-only verifications") {
        for line in section.lines() {
            let trimmed = line.trim();
            if let Some(rest) = trimmed.strip_prefix("- [ ]") {
                manual_checks.push(rest.trim().to_string());
            } else if let Some(rest) = trimmed.strip_prefix("- [x]") {
                manual_checks.push(format!("[done] {}", rest.trim()));
            } else if let Some(rest) = trimmed.strip_prefix("- [X]") {
                manual_checks.push(format!("[done] {}", rest.trim()));
            } else if trimmed.starts_with("- ") && !trimmed.starts_with("- [") {
                manual_checks.push(trimmed[2..].to_string());
            }
        }
    }

    // --- Wave Execution Tracking ---
    let mut wave_tracking: Vec<WaveTracking> = Vec::new();
    if let Some(section) = extract_section(content, "wave execution tracking") {
        let wave_re = Regex::new(r"###\s+Wave\s+(\d+)").unwrap();
        let mut waves: Vec<(i32, usize)> = Vec::new();
        let lines_vec: Vec<&str> = section.lines().collect();
        for (idx, line) in lines_vec.iter().enumerate() {
            if let Some(caps) = wave_re.captures(line) {
                if let Ok(wnum) = caps.get(1).unwrap().as_str().parse::<i32>() {
                    waves.push((wnum, idx));
                }
            }
        }
        for (i, (wnum, start)) in waves.iter().enumerate() {
            let end = if i + 1 < waves.len() {
                waves[i + 1].1
            } else {
                lines_vec.len()
            };
            let wave_lines = &lines_vec[start + 1..end];
            let mut wave_status: Option<String> = None;
            let mut tests_passed: Option<String> = None;
            let mut issues: Option<String> = None;
            let mut task_ids: Vec<String> = Vec::new();

            // Parse task IDs from header: "### Wave 1 (Tasks 2-1, 2-2)"
            let header_line = lines_vec[*start];
            if let Some(paren_start) = header_line.find('(') {
                if let Some(paren_end) = header_line.find(')') {
                    let inner = &header_line[paren_start + 1..paren_end];
                    let inner = inner.strip_prefix("Tasks").unwrap_or(inner).trim();
                    for part in inner.split(',') {
                        let tid = part.trim().to_string();
                        if !tid.is_empty() {
                            task_ids.push(tid);
                        }
                    }
                }
            }

            for wl in wave_lines {
                let wl = wl.trim();
                if let Some(rest) = wl.strip_prefix("- Status:") {
                    wave_status = Some(rest.trim().to_string());
                } else if let Some(rest) = wl.strip_prefix("- Tests passed:") {
                    tests_passed = Some(rest.trim().to_string());
                } else if let Some(rest) = wl.strip_prefix("- Issues:") {
                    issues = Some(rest.trim().to_string());
                }
            }

            wave_tracking.push(WaveTracking {
                wave_number: *wnum,
                task_ids,
                status: wave_status,
                tests_passed,
                issues,
            });
        }
    }

    GsdValidation {
        id,
        project_id: project_id.to_string(),
        phase_number: phase_number.to_string(),
        test_framework,
        quick_run_cmd,
        full_run_cmd,
        nyquist_rate,
        task_map,
        manual_checks,
        wave_tracking,
        raw_content: Some(content.to_string()),
        source_file: Some(source_file.to_string_lossy().to_string()),
    }
}

/// Insert or replace a GsdValidation row into the database.
fn upsert_validation(db: &Database, project_id: &str, v: &GsdValidation) -> Result<(), String> {
    let task_map_json = serde_json::to_string(&v.task_map).unwrap_or_default();
    let manual_checks_json = serde_json::to_string(&v.manual_checks).unwrap_or_default();
    let wave_tracking_json = serde_json::to_string(&v.wave_tracking).unwrap_or_default();
    db.conn()
        .execute(
            "INSERT OR REPLACE INTO gsd_validations
             (id, project_id, phase_number, test_framework, quick_run_cmd, full_run_cmd,
              nyquist_rate, task_map_json, manual_checks_json, wave_tracking_json,
              raw_content, source_file)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                v.id,
                project_id,
                v.phase_number,
                v.quick_run_cmd,
                v.full_run_cmd,
                v.test_framework,
                v.nyquist_rate,
                task_map_json,
                manual_checks_json,
                wave_tracking_json,
                v.raw_content,
                v.source_file,
            ],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Map a SQLite row to a GsdValidation (SELECT column order must match).
fn row_to_validation(row: &rusqlite::Row) -> rusqlite::Result<GsdValidation> {
    let task_map_json: Option<String> = row.get(7)?;
    let manual_checks_json: Option<String> = row.get(8)?;
    let wave_tracking_json: Option<String> = row.get(9)?;

    let task_map: Vec<TaskVerification> = task_map_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default();
    let manual_checks: Vec<String> = manual_checks_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default();
    let wave_tracking: Vec<WaveTracking> = wave_tracking_json
        .as_deref()
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_default();

    Ok(GsdValidation {
        id: row.get(0)?,
        project_id: row.get(1)?,
        phase_number: row.get(2)?,
        test_framework: row.get(3)?,
        quick_run_cmd: row.get(4)?,
        full_run_cmd: row.get(5)?,
        nyquist_rate: row.get(6)?,
        task_map,
        manual_checks,
        wave_tracking,
        raw_content: row.get(10)?,
        source_file: row.get(11)?,
    })
}

#[tauri::command]
pub async fn gsd_list_validations(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdValidation>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let conn = db.read().await;
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, phase_number, test_framework, quick_run_cmd, full_run_cmd,
                    nyquist_rate, task_map_json, manual_checks_json, wave_tracking_json,
                    raw_content, source_file
             FROM gsd_validations
             WHERE project_id = ?1
             ORDER BY phase_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![project_id], row_to_validation)
        .map_err(|e| e.to_string())?;

    let mut validations = Vec::new();
    for row in rows {
        validations.push(row.map_err(|e| e.to_string())?);
    }
    Ok(validations)
}

#[tauri::command]
pub async fn gsd_get_validation_by_phase(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: String,
) -> Result<Option<GsdValidation>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let conn = db.read().await;
    let result = conn
        .prepare(
            "SELECT id, project_id, phase_number, test_framework, quick_run_cmd, full_run_cmd,
                    nyquist_rate, task_map_json, manual_checks_json, wave_tracking_json,
                    raw_content, source_file
             FROM gsd_validations
             WHERE project_id = ?1 AND phase_number = ?2
             LIMIT 1",
        )
        .map_err(|e| e.to_string())?
        .query_row(params![project_id, phase_number], row_to_validation);

    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// ============================================================
// Phase 12 Artifact Readers (ARTF-01..04)
// ============================================================

/// Private helper: read one phase-level markdown doc. NEVER returns Err (D-06).
/// Returns present=false with None fields when the file is absent.
fn read_phase_doc(phase_dir: &Path, filename: &str, doc_type: &str) -> GsdPhaseDoc {
    let path = phase_dir.join(filename);
    if path.exists() {
        match fs::read_to_string(&path) {
            Ok(content) => GsdPhaseDoc {
                doc_type: doc_type.to_string(),
                present: true,
                raw_content: Some(content),
                source_file: Some(path.to_string_lossy().to_string()),
            },
            Err(_) => GsdPhaseDoc {
                doc_type: doc_type.to_string(),
                present: false,
                raw_content: None,
                source_file: None,
            },
        }
    } else {
        GsdPhaseDoc {
            doc_type: doc_type.to_string(),
            present: false,
            raw_content: None,
            source_file: None,
        }
    }
}

/// Private helper: iterate a codebase/ directory and return sorted GsdResearchDoc vec.
/// Returns empty Vec when the directory is absent (ARTF-03 absent case). NEVER returns Err.
fn list_codebase_docs(dir: &Path) -> Vec<GsdResearchDoc> {
    if !dir.exists() {
        return vec![];
    }
    let mut docs = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let filename = path
                        .file_name()
                        .map_or("unknown".to_string(), |f| f.to_string_lossy().to_string());
                    let (frontmatter, body) = parse_frontmatter(&content);
                    let title = frontmatter.get("title").cloned().or_else(|| {
                        body.lines()
                            .find(|l| l.starts_with('#'))
                            .map(|l| l.trim_start_matches('#').trim().to_string())
                    });
                    docs.push(GsdResearchDoc {
                        filename: filename.clone(),
                        title,
                        category: frontmatter.get("category").cloned(),
                        content,
                        source_file: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
    docs.sort_by(|a, b| a.filename.cmp(&b.filename));
    docs
}

/// Private helper: read one project-level process doc. NEVER returns Err (D-06).
/// Returns present=false with None fields when the file is absent (ARTF-04 absent case).
fn read_process_doc(path: &Path, doc_type: &str) -> GsdProcessDoc {
    if path.exists() {
        match fs::read_to_string(path) {
            Ok(content) => GsdProcessDoc {
                doc_type: doc_type.to_string(),
                present: true,
                raw_content: Some(content),
                source_file: Some(path.to_string_lossy().to_string()),
            },
            Err(_) => GsdProcessDoc {
                doc_type: doc_type.to_string(),
                present: false,
                raw_content: None,
                source_file: None,
            },
        }
    } else {
        GsdProcessDoc {
            doc_type: doc_type.to_string(),
            present: false,
            raw_content: None,
            source_file: None,
        }
    }
}

/// ARTF-01: Return SPEC.md, AI-SPEC.md, UI-SPEC.md for the given phase.
/// Phase dir missing → empty docs vec. Never errors on absent files.
#[tauri::command]
pub async fn gsd_get_phase_spec(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<GsdPhaseDocSet, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    let phase_dir = match find_phase_dir(&phases_dir, &phase_number.to_string()) {
        Ok(d) => d,
        Err(_) => {
            return Ok(GsdPhaseDocSet {
                phase_number,
                docs: vec![],
            });
        }
    };

    Ok(GsdPhaseDocSet {
        phase_number,
        docs: vec![
            read_phase_doc(&phase_dir, "SPEC.md", "SPEC"),
            read_phase_doc(&phase_dir, "AI-SPEC.md", "AI-SPEC"),
            read_phase_doc(&phase_dir, "UI-SPEC.md", "UI-SPEC"),
        ],
    })
}

/// ARTF-02: Return SECURITY.md for the given phase. Present:false when absent, never errors.
#[tauri::command]
pub async fn gsd_get_phase_security(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<GsdPhaseDoc, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    let phase_dir = match find_phase_dir(&phases_dir, &phase_number.to_string()) {
        Ok(d) => d,
        Err(_) => {
            return Ok(GsdPhaseDoc {
                doc_type: "SECURITY".to_string(),
                present: false,
                raw_content: None,
                source_file: None,
            });
        }
    };

    Ok(read_phase_doc(&phase_dir, "SECURITY.md", "SECURITY"))
}

/// ARTF-02: Return VALIDATION.md for the given phase. Named _validation_doc to avoid
/// collision with gsd_get_validation_by_phase. Present:false when absent, never errors.
#[tauri::command]
pub async fn gsd_get_phase_validation_doc(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<GsdPhaseDoc, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    let phase_dir = match find_phase_dir(&phases_dir, &phase_number.to_string()) {
        Ok(d) => d,
        Err(_) => {
            return Ok(GsdPhaseDoc {
                doc_type: "VALIDATION".to_string(),
                present: false,
                raw_content: None,
                source_file: None,
            });
        }
    };

    Ok(read_phase_doc(&phase_dir, "VALIDATION.md", "VALIDATION"))
}

/// ARTF-02: Return REVIEW.md for the given phase. Present:false when absent, never errors.
#[tauri::command]
pub async fn gsd_get_phase_review(
    db: tauri::State<'_, DbState>,
    project_id: String,
    phase_number: i32,
) -> Result<GsdPhaseDoc, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let phases_dir = resolve_gsd_path(&project_path, None, "phases");

    let phase_dir = match find_phase_dir(&phases_dir, &phase_number.to_string()) {
        Ok(d) => d,
        Err(_) => {
            return Ok(GsdPhaseDoc {
                doc_type: "REVIEW".to_string(),
                present: false,
                raw_content: None,
                source_file: None,
            });
        }
    };

    Ok(read_phase_doc(&phase_dir, "REVIEW.md", "REVIEW"))
}

/// ARTF-03: Return all *.md files from .planning/codebase/ as GsdResearchDoc vec.
/// Codebase is a SHARED file area — uses plain path join, NOT resolve_gsd_path.
/// Returns empty Vec when the directory is absent, never errors.
#[tauri::command]
pub async fn gsd_get_codebase_docs(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdResearchDoc>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // SHARED file area: always root .planning/codebase/, never workstream-scoped
    let codebase_dir = Path::new(&project_path).join(".planning").join("codebase");
    Ok(list_codebase_docs(&codebase_dir))
}

/// ARTF-04: Return all six project-level process docs (present or absent).
/// Resolution via resolve_gsd_path for workstream awareness.
/// Returns all six entries so the UI can render a consistent doc list.
#[tauri::command]
pub async fn gsd_get_process_docs(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdProcessDoc>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;

    // Process docs that live at the workstream-scoped root of .planning/
    let process_doc_specs: &[(&str, &str)] = &[
        ("discussion-log", "discussion-log.md"),
        ("retrospective", "RETROSPECTIVE.md"),
        ("discovery", "DISCOVERY.md"),
        ("dev-preferences", "dev-preferences.md"),
        ("continue-here", "CONTINUE-HERE.md"),
        ("milestone-archive", "milestone-archive.md"),
    ];

    let docs = process_doc_specs
        .iter()
        .map(|(doc_type, filename)| {
            let path = resolve_gsd_path(&project_path, None, filename);
            read_process_doc(&path, doc_type)
        })
        .collect();

    Ok(docs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap as StdHashMap;
    use std::fs;

    #[test]
    fn test_plan_summary_matching() {
        // Create temp directory with GSD-style structure
        let tmp = std::env::temp_dir().join("gsd_test_matching");
        let phases_dir = tmp.join("phases");
        let phase_dir = phases_dir.join("17-foundation");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&phase_dir).unwrap();

        // Create plan and summary files
        fs::write(
            phase_dir.join("17-01-PLAN.md"),
            "---\ntype: execute\nwave: 1\n---\n<task type=\"code\"><name>Build thing</name></task>",
        )
        .unwrap();
        fs::write(
            phase_dir.join("17-02-PLAN.md"),
            "---\ntype: execute\nwave: 1\n---\n<task type=\"code\"><name>Build other</name></task>",
        )
        .unwrap();
        // Only plan 1 has a summary (plan 2 is in progress)
        fs::write(
            phase_dir.join("17-01-SUMMARY.md"),
            "# Phase 17 Plan 01 Summary\n---\nphase: 17\nplan: 01\ncompleted: 2026-02-01\n---\n## Accomplishments\n- Built thing\n",
        ).unwrap();

        // Test find_plan_files
        let plan_files = find_plan_files(&phase_dir);
        assert_eq!(plan_files.len(), 2, "Should find 2 plan files");

        // Test find_summary_files
        let summary_files = find_summary_files(&phase_dir);
        assert_eq!(summary_files.len(), 1, "Should find 1 summary file");

        // Test plan_number extraction
        let plan_num_re = Regex::new(r"^\d+-(\d+)-PLAN\.md$").unwrap();
        let sum_num_re = Regex::new(r"^\d+-(\d+)-SUMMARY\.md$").unwrap();
        let num_re = Regex::new(r"^0*(\d+)").unwrap();

        let dir_name = "17-foundation";
        let phase_num: i32 = num_re
            .captures(dir_name)
            .unwrap()
            .get(1)
            .unwrap()
            .as_str()
            .parse()
            .unwrap();
        assert_eq!(phase_num, 17);

        // Parse plans
        let mut plans = Vec::new();
        for plan_path in &plan_files {
            let filename = plan_path.file_name().unwrap().to_string_lossy().to_string();
            let plan_num = plan_num_re
                .captures(&filename)
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<i32>().ok())
                .unwrap_or(0);
            let content = fs::read_to_string(plan_path).unwrap();
            plans.push(parse_plan_file(&content, plan_path, phase_num, plan_num));
        }

        // Parse summaries
        let mut summaries = Vec::new();
        for sum_path in &summary_files {
            let filename = sum_path.file_name().unwrap().to_string_lossy().to_string();
            let plan_num = sum_num_re
                .captures(&filename)
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<i32>().ok())
                .unwrap_or(0);
            let content = fs::read_to_string(sum_path).unwrap();
            summaries.push(parse_summary_file(&content, sum_path, phase_num, plan_num));
        }

        // Build summary map (same as frontend)
        let mut summary_map: StdHashMap<String, &GsdSummary> = StdHashMap::new();
        for s in &summaries {
            let key = format!("{}-{}", s.phase_number, s.plan_number);
            summary_map.insert(key, s);
        }

        // Verify matching
        assert_eq!(plans.len(), 2, "Should have 2 plans");
        assert_eq!(summaries.len(), 1, "Should have 1 summary");

        let plan1_key = format!("{}-{}", plans[0].phase_number, plans[0].plan_number);
        let plan2_key = format!("{}-{}", plans[1].phase_number, plans[1].plan_number);

        assert!(
            summary_map.contains_key(&plan1_key),
            "Plan 1 (key={}) should have a matching summary",
            plan1_key
        );
        assert!(
            !summary_map.contains_key(&plan2_key),
            "Plan 2 (key={}) should NOT have a matching summary",
            plan2_key
        );

        // Count completed (same as frontend)
        let completed = plans
            .iter()
            .filter(|p| summary_map.contains_key(&format!("{}-{}", p.phase_number, p.plan_number)))
            .count();
        assert_eq!(completed, 1, "Should count 1 completed plan");

        // Cleanup
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_gsd_next_single_number_phase_artifacts() {
        // gsd-core@next names phase artifacts with a single phase-number prefix and no
        // per-phase plan sub-number: 13-PLAN.md / 13-SUMMARY.md / 13-CONTEXT.md /
        // 13-VERIFICATION.md (vs legacy 13-01-PLAN.md and plain CONTEXT.md). The readers
        // must discover BOTH shapes so gsd-core@next projects populate.
        let tmp = std::env::temp_dir().join("gsd_test_next_single_number");
        let phase_dir = tmp.join("phases").join("13-concern-sweep");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&phase_dir).unwrap();

        fs::write(
            phase_dir.join("13-PLAN.md"),
            "---\ntype: execute\n---\n<task type=\"code\"><name>X</name></task>",
        )
        .unwrap();
        fs::write(phase_dir.join("13-SUMMARY.md"), "---\nphase: 13\n---\n## Done\n").unwrap();
        fs::write(phase_dir.join("13-CONTEXT.md"), "## Decisions\n- chose X\n").unwrap();
        fs::write(phase_dir.join("13-VERIFICATION.md"), "## Result\nPASS\n").unwrap();

        assert_eq!(
            find_plan_files(&phase_dir).len(),
            1,
            "should find 13-PLAN.md (single-number gsd-core@next naming)"
        );
        assert_eq!(
            find_summary_files(&phase_dir).len(),
            1,
            "should find 13-SUMMARY.md"
        );
        assert!(
            find_phase_doc(&phase_dir, "CONTEXT").is_some(),
            "should find 13-CONTEXT.md"
        );
        assert!(
            find_phase_doc(&phase_dir, "VERIFICATION").is_some(),
            "should find 13-VERIFICATION.md"
        );

        // Backward compat: legacy two-number plans + plain doc names must STILL work.
        let legacy = tmp.join("phases").join("14-legacy");
        fs::create_dir_all(&legacy).unwrap();
        fs::write(legacy.join("14-01-PLAN.md"), "---\n---\n").unwrap();
        fs::write(legacy.join("CONTEXT.md"), "## Decisions\n").unwrap();
        assert_eq!(
            find_plan_files(&legacy).len(),
            1,
            "legacy 14-01-PLAN.md must still be found"
        );
        assert!(
            find_phase_doc(&legacy, "CONTEXT").is_some(),
            "legacy plain CONTEXT.md must still be found"
        );

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_parse_requirements_gsd_next_bold_checkbox_format() {
        // gsd-core@next: `- [ ] **QWIN-01** ⚡: desc` / `- [x] **METHOD-01**: desc`
        // The ID is bold, prefixed by a checkbox, optionally followed by a ⚡ marker.
        let content = "## v1 Requirements\n\n\
### Method & Instrumentation\n\n\
- [ ] **QWIN-01** ⚡: A quick-win backlog is produced\n\
- [x] **METHOD-01**: The audit method is grounded in best practice\n";
        let reqs = parse_requirements(content).unwrap();
        assert_eq!(reqs.len(), 2, "should parse 2 requirements");
        assert_eq!(reqs[0].req_id, "QWIN-01", "extract bold ID, not auto REQ-001");
        assert_eq!(reqs[0].description, "A quick-win backlog is produced");
        assert_eq!(reqs[1].req_id, "METHOD-01");
        assert_eq!(reqs[1].status.as_deref(), Some("done"), "[x] => done");
        assert!(reqs[1]
            .category
            .as_deref()
            .unwrap_or("")
            .contains("Method"));
    }

    #[test]
    fn test_parse_requirements_legacy_format_still_works() {
        // Backward compat: `- REQ-001: desc [priority: high] [phase: 2]`
        let content = "## Requirements\n- AUTH-1: Users can log in [priority: high] [phase: 2]\n";
        let reqs = parse_requirements(content).unwrap();
        assert_eq!(reqs.len(), 1);
        assert_eq!(reqs[0].req_id, "AUTH-1");
        assert_eq!(reqs[0].priority.as_deref(), Some("high"));
        assert_eq!(reqs[0].phase.as_deref(), Some("2"));
        assert_eq!(reqs[0].description, "Users can log in");
    }

    #[test]
    fn test_parse_milestones_gsd_next_h3_format() {
        // gsd-core@next ROADMAP puts milestones as `### Milestone N — Name` (H3) under a
        // `## Phases` section, with `- [x] **Phase N: ...**` checkbox bullets — not H2 headings
        // or `**vX.Y** — Phases A-B` summary bullets. The H2 sections (Overview/Phases/Phase
        // Details) must NOT be mistaken for milestones.
        let content = "# Roadmap: Test\n\n\
## Overview\n\n\
- **Milestone 1 — Foo:** narrative description, not a milestone row\n\n\
## Phases\n\n\
### Milestone 1 — Foo\n\n\
- [x] **Phase 1: Alpha** - did alpha\n\
- [x] **Phase 2: Beta** - did beta\n\n\
### Milestone 2 — Bar\n\n\
- [ ] **Phase 3: Gamma** - todo gamma\n\
- [ ] **Phase 4: Delta** - todo delta\n\n\
## Phase Details\n\n\
### Phase 1: Alpha\n\
**Goal**: x\n";

        let ms = parse_milestones(content).unwrap();
        assert_eq!(ms.len(), 2, "should find exactly 2 H3 milestones (not the H2 sections)");
        assert!(ms[0].name.contains("Foo"), "milestone 0 name: {}", ms[0].name);
        assert_eq!(ms[0].phase_start, Some(1));
        assert_eq!(ms[0].phase_end, Some(2));
        assert_eq!(ms[0].status.as_deref(), Some("completed"), "all [x] => completed");
        assert!(ms[1].name.contains("Bar"));
        assert_eq!(ms[1].phase_start, Some(3));
        assert_eq!(ms[1].phase_end, Some(4));
        assert_ne!(ms[1].status.as_deref(), Some("completed"), "[ ] => not completed");
    }

    #[test]
    fn test_parse_milestones_legacy_bullet_format_still_works() {
        // Backward compat: VCCA's own `- ✅ **v1.0 MVP** - Phases 1-4 (shipped ...)` format.
        let content = "# Roadmap\n\n## Milestones\n\n\
- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-03-01)\n\
- 🚧 **v1.1 Polish** - Phases 5-10 (in progress)\n";
        let ms = parse_milestones(content).unwrap();
        assert_eq!(ms.len(), 2, "legacy bullet milestones still parse");
        assert_eq!(ms[0].phase_start, Some(1));
        assert_eq!(ms[0].phase_end, Some(4));
        assert_eq!(ms[0].status.as_deref(), Some("completed"));
    }

    #[test]
    fn test_parse_plan_extracts_method_steps_when_no_task_blocks() {
        // gsd-core@next plans carry no <task> blocks; the steps are a numbered list under
        // `## Method` (the heading often has a parenthetical suffix). The parser must surface
        // those as tasks so the Plans tab shows a non-zero task count.
        let content = "---\nphase: 13\nplan: 13\n---\n\n# Phase 13 Plan\n\n## Objective\n\nProduce a thing.\n\n## Method (locked by 13-CONTEXT)\n\n1. Read the upstream evidence.\n2. Target via HOTSPOTS.\n3. Run the engine read-only.\n\n## Verification\n\n- criteria met\n";
        let plan = parse_plan_file(content, Path::new("13-PLAN.md"), 13, 13);
        assert_eq!(
            plan.task_count, 3,
            "should extract 3 numbered ## Method steps as tasks"
        );
        assert_eq!(plan.tasks[0].name, "Read the upstream evidence.");
    }

    #[test]
    fn test_parse_plan_still_prefers_task_blocks() {
        // Backward compat: legacy plans with <task> blocks must keep parsing those, not Method.
        let content = "---\nphase: 1\nplan: 1\n---\n## Method\n\n1. should be ignored\n\n<task type=\"code\"><name>Real task</name></task>";
        let plan = parse_plan_file(content, Path::new("01-01-PLAN.md"), 1, 1);
        assert_eq!(plan.task_count, 1, "legacy <task> blocks take precedence");
        assert_eq!(plan.tasks[0].name, "Real task");
    }

    #[test]
    fn test_plan_summary_matching_fixture_project() {
        // FIX-01 (D-07): replaced hardcoded developer-machine path with a fixture-based tempdir
        // seeded from gsd-next fixtures. Verifies plan/summary matching logic in CI without any
        // developer-specific path. The original intent (plan/summary matching) is preserved
        // against a controlled fixture tree.
        use std::io::Write;

        let plan_content = include_str!("../../tests/fixtures/gsd-next/plan-standard.md");
        let summary_content = include_str!("../../tests/fixtures/gsd-next/summary-full.md");

        let tmp = std::env::temp_dir().join(format!(
            "vcca_fix01_test_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let phase_dir = tmp.join("11-schema-fidelity-and-cleanup");
        fs::create_dir_all(&phase_dir).unwrap();

        // Write one PLAN (phase 11, plan 01) and one SUMMARY (phase 11, plan 01)
        let plan_path = phase_dir.join("11-01-PLAN.md");
        let summary_path = phase_dir.join("11-01-SUMMARY.md");
        let mut f = fs::File::create(&plan_path).unwrap();
        f.write_all(plan_content.as_bytes()).unwrap();
        let mut f = fs::File::create(&summary_path).unwrap();
        f.write_all(summary_content.as_bytes()).unwrap();

        // Write a second PLAN (phase 11, plan 02) with NO matching summary
        let plan2_content = "---\nphase: 11-schema-fidelity\nplan: 02\ntype: execute\nautonomous: true\n---\n<objective>Task 2</objective>\n";
        let plan2_path = phase_dir.join("11-02-PLAN.md");
        let mut f = fs::File::create(&plan2_path).unwrap();
        f.write_all(plan2_content.as_bytes()).unwrap();

        let plan_num_re = Regex::new(r"^\d+-(\d+)-PLAN\.md$").unwrap();
        let sum_num_re = Regex::new(r"^\d+-(\d+)-SUMMARY\.md$").unwrap();

        let plan_files = find_plan_files(&phase_dir);
        let summary_files = find_summary_files(&phase_dir);
        assert_eq!(plan_files.len(), 2, "Should find 2 plan files in fixture phase dir");
        assert_eq!(summary_files.len(), 1, "Should find 1 summary file in fixture phase dir");

        // Build plans
        let mut plans = Vec::new();
        for pp in &plan_files {
            let fname = pp.file_name().unwrap().to_string_lossy().to_string();
            let pnum = plan_num_re
                .captures(&fname)
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<i32>().ok())
                .unwrap_or(0);
            let content = fs::read_to_string(pp).unwrap();
            plans.push(parse_plan_file(&content, pp, 11, pnum));
        }

        // Build summary map
        let mut summary_map: StdHashMap<String, GsdSummary> = StdHashMap::new();
        for sp in &summary_files {
            let fname = sp.file_name().unwrap().to_string_lossy().to_string();
            let snum = sum_num_re
                .captures(&fname)
                .and_then(|c| c.get(1))
                .and_then(|m| m.as_str().parse::<i32>().ok())
                .unwrap_or(0);
            let content = fs::read_to_string(sp).unwrap();
            let s = parse_summary_file(&content, sp, 11, snum);
            summary_map.insert(format!("{}-{}", s.phase_number, s.plan_number), s);
        }

        // Plan 01 should match the summary; plan 02 should not
        let plan1 = plans.iter().find(|p| p.plan_number == 1).expect("plan 01 must exist");
        let plan2 = plans.iter().find(|p| p.plan_number == 2).expect("plan 02 must exist");

        assert!(
            summary_map.contains_key(&format!("{}-{}", plan1.phase_number, plan1.plan_number)),
            "Plan 01 should have a matching summary"
        );
        assert!(
            !summary_map.contains_key(&format!("{}-{}", plan2.phase_number, plan2.plan_number)),
            "Plan 02 should NOT have a matching summary"
        );

        let completed = plans
            .iter()
            .filter(|p| summary_map.contains_key(&format!("{}-{}", p.phase_number, p.plan_number)))
            .count();
        assert_eq!(completed, 1, "Should count exactly 1 completed plan");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_parse_frontmatter_standard() {
        // Standard frontmatter at start of file
        let content = "---\nphase: 17\nplan: 01\ntype: execute\n---\n# Body\nSome content";
        let (fm, body) = parse_frontmatter(content);
        assert_eq!(fm.get("phase"), Some(&"17".to_string()));
        assert_eq!(fm.get("plan"), Some(&"01".to_string()));
        assert_eq!(fm.get("type"), Some(&"execute".to_string()));
        assert!(body.contains("Body"), "Body should contain heading");
    }

    #[test]
    fn test_parse_frontmatter_after_heading() {
        // GSD summary format: heading + copyright BEFORE frontmatter
        let content = "# Phase 17 Plan 01 Summary\n// Copyright\n\n---\nphase: 17\nplan: 01\ncompleted: 2026-02-01\nduration: 12 min\n---\n## Accomplishments\n- Built thing\n";
        let (fm, body) = parse_frontmatter(content);
        assert_eq!(
            fm.get("phase"),
            Some(&"17".to_string()),
            "Should parse phase from non-start frontmatter"
        );
        assert_eq!(
            fm.get("plan"),
            Some(&"01".to_string()),
            "Should parse plan from non-start frontmatter"
        );
        assert_eq!(
            fm.get("completed"),
            Some(&"2026-02-01".to_string()),
            "Should parse completed date"
        );
        assert_eq!(
            fm.get("duration"),
            Some(&"12 min".to_string()),
            "Should parse duration"
        );
        assert!(
            body.contains("Accomplishments"),
            "Body should contain content after frontmatter"
        );
    }

    #[test]
    fn test_parse_frontmatter_with_yaml_lists() {
        // Frontmatter with multiline YAML lists (should skip list items)
        let content = "---\nphase: 17\ntags: [a, b, c]\nrequires:\n  - thing1\n  - thing2\nstatus: done\n---\n# Body\n";
        let (fm, _body) = parse_frontmatter(content);
        assert_eq!(fm.get("phase"), Some(&"17".to_string()));
        assert_eq!(fm.get("tags"), Some(&"[a, b, c]".to_string()));
        assert_eq!(fm.get("status"), Some(&"done".to_string()));
        // List items and continuation lines should be skipped
        assert!(
            !fm.contains_key("  - thing1"),
            "Should not include list items as keys"
        );
    }

    #[test]
    fn test_parse_summary_with_real_format() {
        // Test parse_summary_file with a real GSD summary format
        let content = r#"# Phase 17 Plan 01: Foundation Summary
// Copyright (c) 2026

---
phase: 17-foundation
plan: 01
subsystem: performance
tags: [measurement, ci]
duration: 15 min
completed: 2026-02-01T12:00:00Z
---

## Accomplishments
- Built bundle analysis tooling
- Integrated Lighthouse audits

## Decisions
- Used Lighthouse v13 — better CI support
"#;
        let path = std::path::Path::new("test-summary.md");
        let summary = parse_summary_file(content, path, 17, 1);

        assert_eq!(summary.phase_number, 17);
        assert_eq!(summary.plan_number, 1);
        assert_eq!(summary.subsystem, Some("performance".to_string()));
        assert_eq!(summary.duration, Some("15 min".to_string()));
        assert_eq!(summary.completed, Some("2026-02-01T12:00:00Z".to_string()));
        assert_eq!(
            summary.accomplishments.len(),
            2,
            "Should find 2 accomplishments"
        );
        assert!(summary.accomplishments[0].contains("bundle analysis"));
        assert_eq!(summary.decisions.len(), 1, "Should find 1 decision");
    }

    // ── SCHM-03: decimal-aware find_phase_dir test ──────────────────────────

    #[test]
    fn test_find_decimal_phase_dir() {
        // SCHM-03: "2" and "2.1" must resolve to distinct directories without collision.
        let tmp = std::env::temp_dir().join(format!(
            "vcca_decimal_phase_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        // Create both integer and decimal phase dirs
        let int_phase = tmp.join("02-normal-phase");
        let dec_phase = tmp.join("02.1-hotfix");
        fs::create_dir_all(&int_phase).unwrap();
        fs::create_dir_all(&dec_phase).unwrap();

        // "2" must resolve to "02-normal-phase", not "02.1-hotfix"
        let found_int = find_phase_dir(&tmp, "2").unwrap();
        assert_eq!(found_int, int_phase,
            "Phase '2' must resolve to '02-normal-phase', not '02.1-hotfix'");

        // "2.1" must resolve to "02.1-hotfix", not "02-normal-phase"
        let found_dec = find_phase_dir(&tmp, "2.1").unwrap();
        assert_eq!(found_dec, dec_phase,
            "Phase '2.1' must resolve to '02.1-hotfix', not '02-normal-phase'");

        // Integer call sites: i32 phases still work via .to_string()
        let found_via_to_string = find_phase_dir(&tmp, &(2_i32).to_string()).unwrap();
        assert_eq!(found_via_to_string, int_phase,
            "i32 phase 2 converted via .to_string() must still resolve correctly");

        let _ = fs::remove_dir_all(&tmp);
    }

    // ── Phase 12 artifact reader tests (ARTF-01..04) ────────────────────────

    #[test]
    fn test_read_phase_doc_present() {
        // read_phase_doc on a phase dir containing the file returns present=true (ARTF-01/02)
        let tmp = std::env::temp_dir().join(format!(
            "vcca_phase_doc_present_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let content = "# Phase Spec\nSome spec content here.";
        fs::write(tmp.join("SPEC.md"), content).unwrap();

        let doc = read_phase_doc(&tmp, "SPEC.md", "SPEC");
        assert!(doc.present, "present must be true when file exists");
        assert_eq!(doc.doc_type, "SPEC");
        assert_eq!(doc.raw_content.as_deref(), Some(content));
        assert!(doc.source_file.is_some(), "source_file must be Some when file exists");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_read_phase_doc_absent() {
        // read_phase_doc on a phase dir WITHOUT the file returns present=false (ARTF-01/02, D-06)
        let tmp = std::env::temp_dir().join(format!(
            "vcca_phase_doc_absent_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        // Do NOT write SPEC.md — test the absent case

        let doc = read_phase_doc(&tmp, "SPEC.md", "SPEC");
        assert!(!doc.present, "present must be false when file is absent");
        assert_eq!(doc.doc_type, "SPEC");
        assert!(doc.raw_content.is_none(), "raw_content must be None when absent");
        assert!(doc.source_file.is_none(), "source_file must be None when absent");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_codebase_docs_listing() {
        // list_codebase_docs over a dir with two *.md files returns 2 docs sorted by filename (ARTF-03)
        let tmp = std::env::temp_dir().join(format!(
            "vcca_codebase_listing_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let codebase_dir = tmp.join(".planning").join("codebase");
        fs::create_dir_all(&codebase_dir).unwrap();

        fs::write(
            codebase_dir.join("STACK.md"),
            "---\ntitle: Tech Stack\ncategory: architecture\n---\n# Stack\nRust + React",
        )
        .unwrap();
        fs::write(
            codebase_dir.join("ARCHITECTURE.md"),
            "---\ntitle: Architecture\ncategory: design\n---\n# Architecture\nOverview",
        )
        .unwrap();

        let docs = list_codebase_docs(&codebase_dir);
        assert_eq!(docs.len(), 2, "Should return 2 docs");
        // Sorted by filename: ARCHITECTURE.md before STACK.md
        assert_eq!(docs[0].filename, "ARCHITECTURE.md");
        assert_eq!(docs[1].filename, "STACK.md");
        assert_eq!(docs[0].title.as_deref(), Some("Architecture"));
        assert_eq!(docs[0].category.as_deref(), Some("design"));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_codebase_docs_missing_dir() {
        // list_codebase_docs on a non-existent dir returns empty Vec (ARTF-03 absent case)
        let nonexistent = std::path::Path::new("/tmp/vcca_this_does_not_exist_artf03");
        let docs = list_codebase_docs(nonexistent);
        assert!(docs.is_empty(), "Missing codebase dir must return empty Vec, not error");
    }

    #[test]
    fn test_process_doc_present_and_absent() {
        // read_process_doc returns present=true for existing file, present=false for missing (ARTF-04)
        let tmp = std::env::temp_dir().join(format!(
            "vcca_process_doc_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();

        let discussion_path = tmp.join("discussion-log.md");
        fs::write(&discussion_path, "# Discussion Log\nSome entries here.").unwrap();

        // Present case
        let doc_present = read_process_doc(&discussion_path, "discussion-log");
        assert!(doc_present.present, "present must be true when file exists");
        assert_eq!(doc_present.doc_type, "discussion-log");
        assert!(doc_present.raw_content.is_some());
        assert!(doc_present.source_file.is_some());

        // Absent case
        let missing_path = tmp.join("RETROSPECTIVE.md");
        let doc_absent = read_process_doc(&missing_path, "retrospective");
        assert!(!doc_absent.present, "present must be false when file is absent");
        assert_eq!(doc_absent.doc_type, "retrospective");
        assert!(doc_absent.raw_content.is_none());
        assert!(doc_absent.source_file.is_none());

        let _ = fs::remove_dir_all(&tmp);
    }
}

// ============================================================
// Roadmap Progress
// ============================================================

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct RoadmapPhaseProgress {
    pub name: String,
    pub number: Option<f32>,
    pub total: usize,
    pub completed: usize,
    pub percent: f32,
    pub status: String, // "complete" | "in_progress" | "pending"
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct RoadmapProgress {
    pub phases: Vec<RoadmapPhaseProgress>,
    pub total_tasks: usize,
    pub completed_tasks: usize,
    pub percent: f32,
    pub current_phase: Option<String>,
}

/// Parse a phase number from a heading like "Phase 1: Setup" or "Phase 2.1: Something"
fn parse_phase_number(heading: &str) -> Option<f32> {
    // Match "Phase N" or "Phase N.M" at the start of the string (case-insensitive)
    let re = Regex::new(r"(?i)phase\s+(\d+(?:\.\d+)?)").ok()?;
    re.captures(heading)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<f32>().ok())
}

#[tauri::command]
pub async fn gsd_get_roadmap_progress(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Option<RoadmapProgress>, String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    // Workstream-aware: ROADMAP.md lives under the active workstream subtree (SCHM-04)
    let roadmap_path = resolve_gsd_path(&project_path, None, "ROADMAP.md");

    if !roadmap_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&roadmap_path).map_err(|e| e.to_string())?;

    let mut phases: Vec<RoadmapPhaseProgress> = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_total: usize = 0;
    let mut current_completed: usize = 0;

    for line in content.lines() {
        if line.starts_with("## ") {
            // Flush previous phase
            if let Some(name) = current_name.take() {
                let percent = if current_total > 0 {
                    (current_completed as f32 / current_total as f32) * 100.0
                } else {
                    0.0
                };
                let status = if current_total == 0 {
                    "pending".to_string()
                } else if current_completed == current_total {
                    "complete".to_string()
                } else if current_completed > 0 {
                    "in_progress".to_string()
                } else {
                    "pending".to_string()
                };
                let number = parse_phase_number(&name);
                phases.push(RoadmapPhaseProgress {
                    name,
                    number,
                    total: current_total,
                    completed: current_completed,
                    percent,
                    status,
                });
            }
            // Start new phase — strip the "## " prefix
            current_name = Some(line[3..].trim().to_string());
            current_total = 0;
            current_completed = 0;
        } else if line.trim_start().starts_with("- [") {
            let trimmed = line.trim_start();
            if trimmed.starts_with("- [x]") || trimmed.starts_with("- [X]") {
                current_total += 1;
                current_completed += 1;
            } else if trimmed.starts_with("- [ ]") {
                current_total += 1;
            }
        }
    }

    // Flush the last phase
    if let Some(name) = current_name.take() {
        let percent = if current_total > 0 {
            (current_completed as f32 / current_total as f32) * 100.0
        } else {
            0.0
        };
        let status = if current_total == 0 {
            "pending".to_string()
        } else if current_completed == current_total {
            "complete".to_string()
        } else if current_completed > 0 {
            "in_progress".to_string()
        } else {
            "pending".to_string()
        };
        let number = parse_phase_number(&name);
        phases.push(RoadmapPhaseProgress {
            name,
            number,
            total: current_total,
            completed: current_completed,
            percent,
            status,
        });
    }

    let total_tasks: usize = phases.iter().map(|p| p.total).sum();
    let completed_tasks: usize = phases.iter().map(|p| p.completed).sum();
    let overall_percent = if total_tasks > 0 {
        (completed_tasks as f32 / total_tasks as f32) * 100.0
    } else {
        0.0
    };

    // current_phase = first in_progress phase, then first pending phase
    let current_phase = phases
        .iter()
        .find(|p| p.status == "in_progress")
        .or_else(|| phases.iter().find(|p| p.status == "pending"))
        .map(|p| p.name.clone());

    Ok(Some(RoadmapProgress {
        phases,
        total_tasks,
        completed_tasks,
        percent: overall_percent,
        current_phase,
    }))
}

// ============================================================
// Config Update
// ============================================================

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct GsdConfigUpdate {
    pub workflow_mode: Option<String>,
    pub depth: Option<String>,
    pub model_profile: Option<String>,
    pub parallelization: Option<bool>,
    pub workflow_research: Option<bool>,
    pub workflow_inspection: Option<bool>,
    pub workflow_plan_verification: Option<bool>,
}

#[tauri::command]
pub async fn gsd_update_config(
    db: tauri::State<'_, DbState>,
    project_id: String,
    update: GsdConfigUpdate,
) -> Result<(), String> {
    // GSD-2 guard: reject gsd2 projects with explicit error
    {
        let reader = db.read().await;
        let version: Option<String> = reader
            .query_row(
                "SELECT gsd_version FROM projects WHERE id = ?1",
                params![&project_id],
                |row| row.get(0),
            )
            .ok();
        if version.as_deref() == Some("gsd2") {
            return Err("This project uses GSD-2. Use gsd2_* commands instead.".to_string());
        }
    }
    let db = db.write().await;
    let project_path = get_project_path(&db, &project_id)?;
    let config_path = Path::new(&project_path)
        .join(".planning")
        .join("config.json");

    // Read existing JSON or start with an empty object
    let mut json: serde_json::Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::Value::Object(serde_json::Map::new())
    };

    // Merge top-level fields
    if let Some(mode) = update.workflow_mode {
        json["workflow_mode"] = serde_json::Value::String(mode);
    }
    if let Some(depth) = update.depth {
        json["depth"] = serde_json::Value::String(depth);
    }
    if let Some(profile) = update.model_profile {
        json["model_profile"] = serde_json::Value::String(profile);
    }
    if let Some(par) = update.parallelization {
        json["parallelization"] = serde_json::Value::Bool(par);
    }

    // Merge nested workflow fields
    let any_workflow = update.workflow_research.is_some()
        || update.workflow_inspection.is_some()
        || update.workflow_plan_verification.is_some();

    if any_workflow {
        // Ensure "workflow" key exists as an object
        if !json.get("workflow").map(|v| v.is_object()).unwrap_or(false) {
            json["workflow"] = serde_json::Value::Object(serde_json::Map::new());
        }
        if let Some(workflow) = json.get_mut("workflow").and_then(|v| v.as_object_mut()) {
            if let Some(research) = update.workflow_research {
                workflow.insert("research".to_string(), serde_json::Value::Bool(research));
            }
            if let Some(inspection) = update.workflow_inspection {
                workflow.insert(
                    "inspection".to_string(),
                    serde_json::Value::Bool(inspection),
                );
            }
            if let Some(plan_ver) = update.workflow_plan_verification {
                workflow.insert(
                    "plan_verification".to_string(),
                    serde_json::Value::Bool(plan_ver),
                );
            }
        }
    }

    // Write back with pretty-printing to keep the file human-readable
    let serialized =
        serde_json::to_string_pretty(&json).map_err(|e| format!("Serialize error: {}", e))?;
    fs::write(&config_path, serialized).map_err(|e| format!("Write error: {}", e))?;

    Ok(())
}

// ============================================================
// Global Todos (all GSD projects)
// ============================================================

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct GsdTodoWithProject {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub area: Option<String>,
    pub phase: Option<String>,
    pub priority: Option<String>,
    pub is_blocker: bool,
    pub files: Option<Vec<String>>,
    pub status: String,
    pub source_file: Option<String>,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub project_id: String,
    pub project_name: String,
}

#[tauri::command]
pub async fn gsd_list_all_todos(
    db: tauri::State<'_, DbState>,
) -> Result<Vec<GsdTodoWithProject>, String> {
    // TODO: GSD-2 guard not possible without DB state — no project_id parameter
    // This command iterates all projects; GSD-2 projects will not have .planning/todos/ so their
    // todos will naturally be absent (the .planning check at the top of the loop handles this).
    let db = db.write().await;

    // Fetch all projects that have a .planning directory
    let projects: Vec<(String, String, String)> = db
        .conn()
        .prepare("SELECT id, name, path FROM projects ORDER BY name ASC")
        .map_err(|e| e.to_string())
        .and_then(|mut stmt| {
            let rows: Vec<(String, String, String)> = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            Ok(rows)
        })?;

    let mut all_todos: Vec<GsdTodoWithProject> = Vec::new();

    for (project_id, project_name, project_path) in projects {
        let planning = Path::new(&project_path).join(".planning").join("todos");
        if !planning.exists() {
            continue;
        }

        // Scan both pending and done subdirectories
        for (dir_name, status) in &[("pending", "pending"), ("done", "done")] {
            let dir = planning.join(dir_name);
            if dir.exists() {
                if let Ok(entries) = fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.extension().map_or(false, |e| e == "md") {
                            if let Ok(content) = fs::read_to_string(&path) {
                                let todo = parse_todo_file(&content, &path, status);
                                all_todos.push(GsdTodoWithProject {
                                    id: todo.id,
                                    title: todo.title,
                                    description: todo.description,
                                    area: todo.area,
                                    phase: todo.phase,
                                    priority: todo.priority,
                                    is_blocker: todo.is_blocker,
                                    files: todo.files,
                                    status: todo.status,
                                    source_file: todo.source_file,
                                    created_at: todo.created_at,
                                    completed_at: todo.completed_at,
                                    project_id: project_id.clone(),
                                    project_name: project_name.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort: blockers first, then by priority, then by project name
    all_todos.sort_by(|a, b| {
        let priority_ord = |t: &GsdTodoWithProject| -> i32 {
            if t.is_blocker {
                return 0;
            }
            match t.priority.as_deref() {
                Some("critical") | Some("blocker") => 0,
                Some("high") => 1,
                Some("medium") => 2,
                Some("low") => 3,
                _ => 4,
            }
        };
        priority_ord(a)
            .cmp(&priority_ord(b))
            .then_with(|| a.project_name.cmp(&b.project_name))
    });

    Ok(all_todos)
}
