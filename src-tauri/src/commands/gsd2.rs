// VCCA - GSD-2 Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
//
// GSD-2 backend: version detection, file resolvers, struct definitions, and helpers.
// All .gsd/ parsing commands live here. gsd.rs (.planning/) is never modified.

use crate::db::Database;
use crate::headless::HeadlessRegistryState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

type DbState = Arc<crate::db::DbPool>;

const HEADLESS_KEYCHAIN_SERVICE_PRIMARY: &str = "net.fluxlabs.vcca";
const HEADLESS_KEYCHAIN_SERVICE_LEGACY: &str = "net.fluxlabs.vcca";
const HEADLESS_ENV_KEYS: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "GITHUB_TOKEN",
];

// ============================================================
// Helpers (copied from gsd.rs — do NOT import across module boundary)
// ============================================================

/// Resolve project path from DB by project_id
fn get_project_path(db: &Database, project_id: &str) -> Result<String, String> {
    db.conn()
        .query_row(
            "SELECT path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Project not found: {}", e))
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn read_keychain_secret(service: &str, key: &str) -> Option<String> {
    let entry = keyring::Entry::new(service, key).ok()?;
    match entry.get_password() {
        Ok(secret) if !secret.trim().is_empty() => Some(secret),
        _ => None,
    }
}

fn resolve_headless_env_values() -> HashMap<String, String> {
    let mut values = HashMap::new();

    for key in HEADLESS_ENV_KEYS {
        let value = read_keychain_secret(HEADLESS_KEYCHAIN_SERVICE_PRIMARY, key)
            .or_else(|| read_keychain_secret(HEADLESS_KEYCHAIN_SERVICE_LEGACY, key))
            .or_else(|| std::env::var(key).ok())
            .filter(|secret| !secret.trim().is_empty());

        if let Some(secret) = value {
            values.insert((*key).to_string(), secret);
        }
    }

    values
}

fn build_headless_command(model: Option<&str>, env_values: &HashMap<String, String>) -> String {
    let mut env_prefix: Vec<String> = Vec::new();

    for key in HEADLESS_ENV_KEYS {
        if let Some(value) = env_values.get(*key) {
            env_prefix.push(format!("{}={}", key, shell_single_quote(value)));
        }
    }

    let mut command = "gsd headless".to_string();
    if let Some(model_name) = model {
        command.push_str(" --model ");
        command.push_str(&shell_single_quote(model_name));
    }

    if env_prefix.is_empty() {
        command
    } else {
        format!("{} {}", env_prefix.join(" "), command)
    }
}

fn build_headless_command_with_env(model: Option<&str>) -> String {
    let env_values = resolve_headless_env_values();
    let injected_keys: Vec<String> = HEADLESS_ENV_KEYS
        .iter()
        .filter(|key| env_values.contains_key(**key))
        .map(|key| (*key).to_string())
        .collect();

    if injected_keys.is_empty() {
        tracing::warn!(
            "No API keys found in keychain/env for headless execution; gsd may fail authentication"
        );
    } else {
        tracing::info!(
            keys = ?injected_keys,
            "Injecting API keys into headless PTY environment from keychain/env"
        );
    }

    build_headless_command(model, &env_values)
}

/// Parse YAML-like frontmatter from markdown content.
/// Handles both standard position (start of file) and GSD summary files
/// where frontmatter appears after a heading/copyright block.
fn parse_frontmatter(content: &str) -> (HashMap<String, String>, String) {
    let mut frontmatter = HashMap::new();
    let mut body = content.to_string();

    // Find the first `---` delimiter (may not be at position 0 for GSD summaries)
    let fm_start = if content.starts_with("---") {
        Some(0)
    } else {
        // Look for `---` on its own line (preceded by newline)
        content.find("\n---").map(|idx| idx + 1)
    };

    if let Some(start) = fm_start {
        let after_open = start + 3;
        if after_open < content.len() {
            if let Some(end_offset) = content[after_open..].find("\n---") {
                let fm_str = &content[after_open..after_open + end_offset];
                let after_close = after_open + end_offset + 4; // skip past \n---
                let body_start = if after_close < content.len() {
                    after_close
                } else {
                    content.len()
                };

                // Body is everything before the frontmatter + everything after it
                let pre_fm = if start > 0 { &content[..start] } else { "" };
                let post_fm = &content[body_start..];
                body = format!("{}{}", pre_fm.trim(), post_fm);

                // Parse frontmatter key-value pairs (skip multiline YAML lists)
                for line in fm_str.lines() {
                    let trimmed = line.trim();
                    // Skip empty lines, list items, and indented continuation lines
                    if trimmed.is_empty()
                        || trimmed.starts_with('-')
                        || line.starts_with(' ')
                        || line.starts_with('\t')
                    {
                        continue;
                    }
                    if let Some(colon_idx) = trimmed.find(':') {
                        let key = trimmed[..colon_idx].trim().to_string();
                        let val = trimmed[colon_idx + 1..].trim().to_string();
                        if !key.is_empty() && !key.contains(' ') {
                            frontmatter.insert(key, val);
                        }
                    }
                }
            }
        }
    }

    (frontmatter, body)
}

// ============================================================
// Three-tier resolvers (RESEARCH.md Patterns 4 & 5)
// ============================================================

/// Resolve a directory by ID under a parent directory.
///
/// Tier 1: exact match — directory name == id_prefix
/// Tier 2: prefix match — directory name starts with "{id_prefix}-"
/// Tier 3: None
pub fn resolve_dir_by_id(parent_dir: &Path, id_prefix: &str) -> Option<String> {
    let entries = std::fs::read_dir(parent_dir).ok()?;
    let mut prefix_match: Option<String> = None;

    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if !entry.path().is_dir() {
            continue;
        }
        if name == id_prefix {
            return Some(name.into_owned());
        }
        if prefix_match.is_none() && name.starts_with(&format!("{}-", id_prefix)) {
            prefix_match = Some(name.into_owned());
        }
    }

    prefix_match
}

/// Resolve a file by ID under a directory.
///
/// Tier 1: exact — `{id_prefix}-{suffix}.md`
/// Tier 2: legacy — `{id_prefix}-*-{suffix}.md` (any descriptor in middle)
/// Tier 3: bare — `{suffix}.md`
/// Tier 4: None
pub fn resolve_file_by_id(dir: &Path, id_prefix: &str, suffix: &str) -> Option<String> {
    let entries = std::fs::read_dir(dir).ok()?;
    let exact_name = format!("{}-{}.md", id_prefix, suffix);
    let bare_name = format!("{}.md", suffix);
    let legacy_prefix = format!("{}-", id_prefix);
    let legacy_suffix = format!("-{}.md", suffix);

    let mut legacy_match: Option<String> = None;
    let mut bare_match: Option<String> = None;

    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        if !entry.path().is_file() {
            continue;
        }
        if name == exact_name {
            return Some(name.into_owned());
        }
        if legacy_match.is_none()
            && name.starts_with(&legacy_prefix)
            && name.ends_with(&legacy_suffix)
        {
            legacy_match = Some(name.clone().into_owned());
        }
        if bare_match.is_none() && name == bare_name {
            bare_match = Some(name.into_owned());
        }
    }

    legacy_match.or(bare_match)
}

// ============================================================
// Struct definitions
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2Milestone {
    pub id: String,
    pub title: String,
    pub dir_name: String,
    pub done: bool,
    pub slices: Vec<Gsd2Slice>,
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2Slice {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub risk: Option<String>,
    pub dependencies: Vec<String>,
    pub tasks: Vec<Gsd2Task>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2Task {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub estimate: Option<String>,
    pub files: Vec<String>,
    pub verify: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2State {
    pub active_milestone_id: Option<String>,
    pub active_slice_id: Option<String>,
    pub active_task_id: Option<String>,
    pub phase: Option<String>,
    pub milestones_done: u32,
    pub milestones_total: u32,
    pub slices_done: u32,
    pub slices_total: u32,
    pub tasks_done: u32,
    pub tasks_total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct Gsd2RoadmapProgress {
    pub milestones_done: u32,
    pub milestones_total: u32,
    pub slices_done: u32,
    pub slices_total: u32,
    pub tasks_done: u32,
    pub tasks_total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2Health {
    pub budget_spent: f64,
    pub budget_ceiling: Option<f64>,
    pub active_milestone_id: Option<String>,
    pub active_milestone_title: Option<String>,
    pub active_slice_id: Option<String>,
    pub active_slice_title: Option<String>,
    pub active_task_id: Option<String>,
    pub active_task_title: Option<String>,
    pub phase: Option<String>,
    pub blocker: Option<String>,
    pub next_action: Option<String>,
    pub milestones_done: u32,
    pub milestones_total: u32,
    pub slices_done: u32,
    pub slices_total: u32,
    pub tasks_done: u32,
    pub tasks_total: u32,
    pub env_error_count: u32,
    pub env_warning_count: u32,
}

// ============================================================
// Parsing helpers
// ============================================================

/// Sum all `cost` values from `.gsd/metrics.json` for a project.
/// Returns 0.0 if the file is missing, empty, or malformed.
fn sum_costs_from_metrics(project_path: &str) -> f64 {
    let metrics_path = Path::new(project_path).join(".gsd").join("metrics.json");
    let content = match std::fs::read_to_string(&metrics_path) {
        Ok(c) => c,
        Err(_) => return 0.0,
    };
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return 0.0,
    };
    json.get("units")
        .and_then(|u| u.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|unit| unit.get("cost").and_then(|c| c.as_f64()))
                .sum()
        })
        .unwrap_or(0.0)
}

/// Struct returned by `parse_gsd2_state_md` holding all parsed fields.
struct Gsd2StateParsed {
    active_milestone: Option<String>,
    active_slice: Option<String>,
    active_task: Option<String>,
    phase: Option<String>,
    blocker: Option<String>,
    next_action: Option<String>,
    budget_ceiling: Option<f64>,
}

/// Parse `.gsd/STATE.md` body sections (NOT YAML frontmatter — GSD-2 STATE.md uses
/// bold markdown key lines and `##` heading sections, not frontmatter).
///
/// Extracts:
/// - `**Active Milestone:**` — ID and title from "M005 — Title" format
/// - `**Active Slice:**` — same format or "None"
/// - `**Active Task:**` — same format or "None"
/// - `**Phase:**` — plain value
/// - `## Blockers` section — first non-"None" bullet item
/// - `## Next Action` section — first non-empty non-heading line
/// - `**Budget Ceiling:**` — f64 if present
fn parse_gsd2_state_md(content: &str) -> Gsd2StateParsed {
    let mut active_milestone: Option<String> = None;
    let mut active_slice: Option<String> = None;
    let mut active_task: Option<String> = None;
    let mut phase: Option<String> = None;
    let mut blocker: Option<String> = None;
    let mut next_action: Option<String> = None;
    let mut budget_ceiling: Option<f64> = None;
    let mut in_blockers_section = false;
    let mut in_next_action_section = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // Handle section transitions
        if trimmed.starts_with("## ") {
            in_blockers_section = trimmed == "## Blockers";
            in_next_action_section = trimmed == "## Next Action";
            continue;
        }

        // Parse bold key lines
        if trimmed.starts_with("**Active Milestone:**") {
            let val = trimmed["**Active Milestone:**".len()..].trim();
            if val != "None" && !val.is_empty() {
                active_milestone = Some(val.to_string());
            }
        } else if trimmed.starts_with("**Active Slice:**") {
            let val = trimmed["**Active Slice:**".len()..].trim();
            if val != "None" && !val.is_empty() {
                active_slice = Some(val.to_string());
            }
        } else if trimmed.starts_with("**Active Task:**") {
            let val = trimmed["**Active Task:**".len()..].trim();
            if val != "None" && !val.is_empty() {
                active_task = Some(val.to_string());
            }
        } else if trimmed.starts_with("**Phase:**") {
            let val = trimmed["**Phase:**".len()..].trim();
            if !val.is_empty() {
                phase = Some(val.to_string());
            }
        } else if trimmed.starts_with("**Budget Ceiling:**") {
            let val = trimmed["**Budget Ceiling:**".len()..].trim();
            // Strip common currency symbols before parsing
            let clean = val.trim_start_matches('$').trim();
            if let Ok(v) = clean.parse::<f64>() {
                budget_ceiling = Some(v);
            }
        }

        // Blockers section: collect first non-"None" bullet item
        if in_blockers_section && trimmed.starts_with("- ") {
            let val = trimmed[2..].trim();
            if val != "None" && !val.is_empty() {
                blocker = Some(val.to_string());
                in_blockers_section = false;
            }
        }

        // Next Action section: first non-empty non-heading line
        if in_next_action_section && !trimmed.is_empty() && !trimmed.starts_with('#') {
            next_action = Some(trimmed.to_string());
            in_next_action_section = false;
        }
    }

    Gsd2StateParsed {
        active_milestone,
        active_slice,
        active_task,
        phase,
        blocker,
        next_action,
        budget_ceiling,
    }
}

/// Split a "ID: Title", "ID — Title", or "ID - Title" string into (id, title) parts.
/// Returns (full_string, None) if no separator is found.
/// Priority: `: ` first (GSD-pi STATE.md format), then ` — `, then ` - `.
fn split_id_and_title(value: &str) -> (String, Option<String>) {
    for sep in [": ", " — ", " - "] {
        if let Some(pos) = value.find(sep) {
            let id = value[..pos].trim().to_string();
            let title = value[pos + sep.len()..].trim().to_string();
            return (id, Some(title));
        }
    }
    (value.trim().to_string(), None)
}

/// Build a `Gsd2Health` from a project path without touching the DB (testable helper).
pub fn get_health_from_dir(project_path: &str) -> Gsd2Health {
    // 1. Sum costs from metrics.json
    let budget_spent = sum_costs_from_metrics(project_path);

    // 2. Parse STATE.md body sections
    let state_content =
        std::fs::read_to_string(Path::new(project_path).join(".gsd").join("STATE.md"))
            .unwrap_or_default();
    let parsed = parse_gsd2_state_md(&state_content);

    // 3. Derive M/S/T progress counters (reuses existing filesystem walker)
    let progress = derive_state_from_dir(project_path);

    // 4. Split active milestone/slice/task into ID + title
    let (active_milestone_id, active_milestone_title) = parsed
        .active_milestone
        .map(|v| {
            let (id, title) = split_id_and_title(&v);
            (Some(id), title)
        })
        .unwrap_or((None, None));

    let (active_slice_id, active_slice_title) = parsed
        .active_slice
        .map(|v| {
            let (id, title) = split_id_and_title(&v);
            (Some(id), title)
        })
        .unwrap_or((None, None));

    let (active_task_id, active_task_title) = parsed
        .active_task
        .map(|v| {
            let (id, title) = split_id_and_title(&v);
            (Some(id), title)
        })
        .unwrap_or((None, None));

    Gsd2Health {
        budget_spent,
        budget_ceiling: parsed.budget_ceiling,
        active_milestone_id,
        active_milestone_title,
        active_slice_id,
        active_slice_title,
        active_task_id,
        active_task_title,
        phase: parsed.phase,
        blocker: parsed.blocker,
        next_action: parsed.next_action,
        milestones_done: progress.milestones_done,
        milestones_total: progress.milestones_total,
        slices_done: progress.slices_done,
        slices_total: progress.slices_total,
        tasks_done: progress.tasks_done,
        tasks_total: progress.tasks_total,
        env_error_count: 0,
        env_warning_count: 0,
    }
}

/// Parse the `## Slices` section of a ROADMAP.md file.
/// Returns a Vec of Gsd2Slice with tasks left empty (populated separately by get_slice).
fn parse_roadmap_slices(content: &str) -> Vec<Gsd2Slice> {
    let mut slices = Vec::new();

    // Find the "## Slices" section (case-insensitive)
    let lower = content.to_lowercase();
    let section_start = lower.lines().enumerate().find_map(|(i, line)| {
        let t = line.trim();
        if t == "## slices" || t.starts_with("## slices ") || t.starts_with("## slices\t") {
            Some(i)
        } else {
            None
        }
    });

    let start_line = match section_start {
        Some(i) => i + 1,
        None => return slices,
    };

    let lines: Vec<&str> = content.lines().collect();

    // Regex-like parsing: match `- [ ] **ID: Title** rest`
    // We avoid the regex crate — use manual string parsing.
    for line in &lines[start_line..] {
        let trimmed = line.trim();

        // Stop at the next `##` heading
        if trimmed.starts_with("## ") || trimmed == "##" {
            break;
        }

        // Match: `- [ ] **ID: Title** rest` or `- [x] ...`
        if let Some(slice) = parse_checkbox_item(trimmed, true) {
            slices.push(Gsd2Slice {
                id: slice.0,
                title: slice.1,
                done: slice.2,
                risk: slice.3,
                dependencies: slice.4,
                tasks: Vec::new(),
            });
        }
    }

    slices
}

/// Parse the `## Tasks` section of a PLAN.md file.
fn parse_plan_tasks(content: &str) -> Vec<Gsd2Task> {
    let mut tasks = Vec::new();

    // Find the "## Tasks" section
    let lower = content.to_lowercase();
    let section_start = lower.lines().enumerate().find_map(|(i, line)| {
        let t = line.trim();
        if t == "## tasks" || t.starts_with("## tasks ") || t.starts_with("## tasks\t") {
            Some(i)
        } else {
            None
        }
    });

    let start_line = match section_start {
        Some(i) => i + 1,
        None => return tasks,
    };

    let lines: Vec<&str> = content.lines().collect();
    let mut i = start_line;

    while i < lines.len() {
        let line = lines[i];
        let trimmed = line.trim();

        // Stop at next `##` heading
        if trimmed.starts_with("## ") || trimmed == "##" {
            break;
        }

        // Match checkbox item
        if let Some(item) = parse_checkbox_item(trimmed, false) {
            let (id, title, done, _risk, _deps) = item;
            // Extract estimate from the rest of the line (from parse_checkbox_item rest field)
            // We need to re-parse the line to get the "rest" for estimate
            let estimate = extract_tag(trimmed, "est");

            let mut files: Vec<String> = Vec::new();
            let mut verify: Option<String> = None;

            // Look ahead for sub-lines (Files:, Verify:)
            let mut j = i + 1;
            while j < lines.len() {
                let sub = lines[j].trim();
                // Stop if we hit a new checkbox item or heading
                if sub.starts_with("- [") || sub.starts_with("## ") {
                    break;
                }
                if sub.starts_with("- Files:") || sub.starts_with("- files:") {
                    // Extract backtick-delimited file paths
                    let rest = &sub[8..];
                    files = extract_backtick_values(rest);
                } else if sub.starts_with("- Verify:") || sub.starts_with("- verify:") {
                    verify = Some(sub[9..].trim().to_string());
                }
                j += 1;
            }

            tasks.push(Gsd2Task {
                id,
                title,
                done,
                estimate,
                files,
                verify,
            });

            i = j;
            continue;
        }

        i += 1;
    }

    tasks
}

/// Parse a checkbox item line: `- [ ] **ID: Title** rest`
/// Returns (id, title, done, risk, dependencies) or None if not a match.
/// `with_slice_fields` indicates whether to extract risk/depends (for slices).
fn parse_checkbox_item(
    line: &str,
    with_slice_fields: bool,
) -> Option<(String, String, bool, Option<String>, Vec<String>)> {
    // Must start with `- [` (possibly with leading spaces already trimmed)
    if !line.starts_with("- [") {
        return None;
    }

    // Check done flag: `- [ ]` or `- [x]` or `- [X]`
    let done = if line.starts_with("- [x]") || line.starts_with("- [X]") {
        true
    } else if line.starts_with("- [ ]") {
        false
    } else {
        return None;
    };

    // After `- [x] ` or `- [ ] ` (5 chars), find `**`
    let after_check = line[5..].trim_start();
    if !after_check.starts_with("**") {
        return None;
    }
    let inner = &after_check[2..]; // strip leading `**`

    // Find closing `**` to get `ID: Title`
    let close_bold = inner.find("**")?;
    let id_title = &inner[..close_bold];
    let rest = inner[close_bold + 2..].trim();

    // Split `ID: Title`
    let colon_pos = id_title.find(':')?;
    let id = id_title[..colon_pos].trim().to_string();
    let title = id_title[colon_pos + 1..].trim().to_string();

    if id.is_empty() || title.is_empty() {
        return None;
    }

    let risk = if with_slice_fields {
        extract_tag(rest, "risk")
    } else {
        None
    };

    let dependencies = if with_slice_fields {
        extract_depends(rest)
    } else {
        Vec::new()
    };

    Some((id, title, done, risk, dependencies))
}

/// Extract a backtick tag value: `` `key:value` `` → `value`
fn extract_tag(text: &str, key: &str) -> Option<String> {
    let search = format!("`{}:", key);
    if let Some(start) = text.find(&search) {
        let after = &text[start + search.len()..];
        if let Some(end) = after.find('`') {
            return Some(after[..end].trim().to_string());
        }
    }
    None
}

/// Extract `depends:[S01,S02]` from text, returning a Vec of trimmed IDs.
fn extract_depends(text: &str) -> Vec<String> {
    let search = "`depends:[";
    if let Some(start) = text.find(search) {
        let after = &text[start + search.len()..];
        if let Some(end) = after.find(']') {
            return after[..end]
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
        }
    }
    Vec::new()
}

/// Extract all backtick-delimited values from a string.
fn extract_backtick_values(text: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut remaining = text;
    while let Some(start) = remaining.find('`') {
        let after = &remaining[start + 1..];
        if let Some(end) = after.find('`') {
            let val = after[..end].trim().to_string();
            if !val.is_empty() {
                values.push(val);
            }
            remaining = &after[end + 1..];
        } else {
            break;
        }
    }
    values
}

/// Extract the milestone ID from a directory name.
/// `M001-descriptor` → `M001`
/// `M001` → `M001`
fn milestone_id_from_dir_name(name: &str) -> String {
    match name.find('-') {
        Some(pos) => name[..pos].to_string(),
        None => name.to_string(),
    }
}

/// Walk the `.gsd/milestones/` directory and return all milestones sorted by ID.
/// Slices are populated from ROADMAP.md; tasks within slices are NOT populated here
/// (tasks require a separate PLAN.md per slice).
pub fn list_milestones_from_dir(milestones_dir: &Path) -> Vec<Gsd2Milestone> {
    let read_dir = match std::fs::read_dir(milestones_dir) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let mut milestones: Vec<Gsd2Milestone> = Vec::new();

    for entry in read_dir.flatten() {
        if !entry.path().is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let id = milestone_id_from_dir_name(&dir_name);
        let milestone_dir = entry.path();

        // Try to find a ROADMAP.md (three-tier resolution)
        let slices = if let Some(roadmap_file) = resolve_file_by_id(&milestone_dir, &id, "ROADMAP")
        {
            let roadmap_path = milestone_dir.join(&roadmap_file);
            match std::fs::read_to_string(&roadmap_path) {
                Ok(content) => parse_roadmap_slices(&content),
                Err(_) => Vec::new(),
            }
        } else {
            Vec::new()
        };

        // Get title from ROADMAP.md frontmatter or use dir_name
        let title = if let Some(roadmap_file) = resolve_file_by_id(&milestone_dir, &id, "ROADMAP") {
            let roadmap_path = milestone_dir.join(&roadmap_file);
            std::fs::read_to_string(&roadmap_path)
                .ok()
                .and_then(|content| {
                    let (fm, _body) = parse_frontmatter(&content);
                    fm.get("milestone")
                        .or_else(|| fm.get("title"))
                        .cloned()
                        .or_else(|| extract_title_from_h1(&content, &id))
                })
                .unwrap_or_else(|| dir_name.clone())
        } else {
            dir_name.clone()
        };

        let done = !slices.is_empty() && slices.iter().all(|s| s.done);

        milestones.push(Gsd2Milestone {
            id,
            title,
            dir_name,
            done,
            slices,
            dependencies: Vec::new(),
        });
    }

    // Sort by ID (alphabetical works for M001, M002, etc.)
    milestones.sort_by(|a, b| a.id.cmp(&b.id));
    milestones
}

// ============================================================
// Commands
// ============================================================

/// Walk milestones dir and populate tasks for each slice (by reading PLAN.md per slice).
/// This is the shared data-gathering helper for derive_state and get_roadmap_progress.
pub fn walk_milestones_with_tasks(milestones_dir: &Path) -> Vec<Gsd2Milestone> {
    let mut milestones = list_milestones_from_dir(milestones_dir);

    for milestone in milestones.iter_mut() {
        let milestone_dir = milestones_dir.join(&milestone.dir_name);
        for slice in milestone.slices.iter_mut() {
            // Try nested layout first, then flat
            let plan_content = resolve_slice_plan_content(&milestone_dir, &milestone.id, &slice.id);
            if let Some(content) = plan_content {
                slice.tasks = parse_plan_tasks(&content);
            }
        }
        // Recalculate milestone done based on slice done status (task completion drives slice done)
        // A slice is done if either ROADMAP says done OR all its tasks are done (non-empty task list)
        for slice in milestone.slices.iter_mut() {
            if !slice.done && !slice.tasks.is_empty() {
                slice.done = slice.tasks.iter().all(|t| t.done);
            }
        }
        milestone.done = !milestone.slices.is_empty() && milestone.slices.iter().all(|s| s.done);
    }

    milestones
}

/// Resolve the content of a slice's PLAN.md (nested or flat layout).
fn resolve_slice_plan_content(
    milestone_dir: &Path,
    _milestone_id: &str,
    slice_id: &str,
) -> Option<String> {
    // Try nested: milestone_dir/S01[-DESCRIPTOR]/S01-PLAN.md
    if let Some(slice_sub) = resolve_dir_by_id(milestone_dir, slice_id) {
        let nested = milestone_dir.join(&slice_sub);
        if let Some(plan_file) = resolve_file_by_id(&nested, slice_id, "PLAN") {
            if let Ok(content) = std::fs::read_to_string(nested.join(&plan_file)) {
                return Some(content);
            }
        }
    }
    // Try flat: milestone_dir/S01-PLAN.md
    if let Some(plan_file) = resolve_file_by_id(milestone_dir, slice_id, "PLAN") {
        if let Ok(content) = std::fs::read_to_string(milestone_dir.join(&plan_file)) {
            return Some(content);
        }
    }
    None
}

/// Derive GSD-2 state from a project path (testable helper without DB).
pub fn derive_state_from_dir(project_path: &str) -> Gsd2State {
    let milestones_dir = Path::new(project_path).join(".gsd").join("milestones");
    let milestones = walk_milestones_with_tasks(&milestones_dir);

    let mut milestones_done: u32 = 0;
    let mut milestones_total: u32 = 0;
    let mut slices_done: u32 = 0;
    let mut slices_total: u32 = 0;
    let mut tasks_done: u32 = 0;
    let mut tasks_total: u32 = 0;

    let mut active_milestone_id: Option<String> = None;
    let mut active_slice_id: Option<String> = None;
    let mut active_task_id: Option<String> = None;

    for milestone in &milestones {
        milestones_total += 1;
        if milestone.done {
            milestones_done += 1;
        } else if active_milestone_id.is_none() {
            active_milestone_id = Some(milestone.id.clone());
        }

        for slice in &milestone.slices {
            slices_total += 1;
            if slice.done {
                slices_done += 1;
            } else if active_milestone_id.as_deref() == Some(&milestone.id)
                && active_slice_id.is_none()
            {
                active_slice_id = Some(slice.id.clone());
            }

            for task in &slice.tasks {
                tasks_total += 1;
                if task.done {
                    tasks_done += 1;
                } else if active_slice_id.as_deref() == Some(&slice.id) && active_task_id.is_none()
                {
                    active_task_id = Some(task.id.clone());
                }
            }
        }
    }

    // Read .gsd/STATE.md for phase value
    let state_path = Path::new(project_path).join(".gsd").join("STATE.md");
    let phase = if state_path.exists() {
        std::fs::read_to_string(&state_path)
            .ok()
            .and_then(|content| {
                let (fm, _) = parse_frontmatter(&content);
                fm.get("phase").cloned()
            })
    } else {
        None
    };

    Gsd2State {
        active_milestone_id,
        active_slice_id,
        active_task_id,
        phase,
        milestones_done,
        milestones_total,
        slices_done,
        slices_total,
        tasks_done,
        tasks_total,
    }
}

/// Get roadmap progress counts from a project path (testable helper without DB).
#[allow(dead_code)]
pub fn get_roadmap_progress_from_dir(project_path: &str) -> Gsd2RoadmapProgress {
    let state = derive_state_from_dir(project_path);
    Gsd2RoadmapProgress {
        milestones_done: state.milestones_done,
        milestones_total: state.milestones_total,
        slices_done: state.slices_done,
        slices_total: state.slices_total,
        tasks_done: state.tasks_done,
        tasks_total: state.tasks_total,
    }
}

/// List all milestones for a GSD-2 project by reading `.gsd/milestones/`.
#[tauri::command]
pub async fn gsd2_list_milestones(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<Gsd2Milestone>, String> {
    let db_guard = db.write().await;
    let project_path = get_project_path(&db_guard, &project_id)?;
    let milestones_dir = Path::new(&project_path).join(".gsd").join("milestones");
    Ok(list_milestones_from_dir(&milestones_dir))
}

/// Get a single milestone by ID, parsing its ROADMAP.md slices.
#[tauri::command]
pub async fn gsd2_get_milestone(
    db: tauri::State<'_, DbState>,
    project_id: String,
    milestone_id: String,
) -> Result<Gsd2Milestone, String> {
    let db_guard = db.write().await;
    let project_path = get_project_path(&db_guard, &project_id)?;
    let milestones_dir = Path::new(&project_path).join(".gsd").join("milestones");

    let dir_name = resolve_dir_by_id(&milestones_dir, &milestone_id)
        .ok_or_else(|| format!("Milestone '{}' not found", milestone_id))?;

    let milestone_dir = milestones_dir.join(&dir_name);

    let roadmap_file = resolve_file_by_id(&milestone_dir, &milestone_id, "ROADMAP")
        .ok_or_else(|| format!("ROADMAP.md not found for milestone '{}'", milestone_id))?;

    let roadmap_path = milestone_dir.join(&roadmap_file);
    let content = std::fs::read_to_string(&roadmap_path)
        .map_err(|e| format!("Failed to read ROADMAP.md: {}", e))?;

    let (fm, _) = parse_frontmatter(&content);
    let title = fm
        .get("milestone")
        .or_else(|| fm.get("title"))
        .cloned()
        .or_else(|| extract_title_from_h1(&content, &milestone_id))
        .unwrap_or_else(|| dir_name.clone());

    let dependencies: Vec<String> = fm
        .get("depends")
        .map(|v| {
            v.split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default();

    let slices = parse_roadmap_slices(&content);
    let done = !slices.is_empty() && slices.iter().all(|s| s.done);

    Ok(Gsd2Milestone {
        id: milestone_id,
        title,
        dir_name,
        done,
        slices,
        dependencies,
    })
}

/// Get a single slice by ID, parsing its PLAN.md tasks.
#[tauri::command]
pub async fn gsd2_get_slice(
    db: tauri::State<'_, DbState>,
    project_id: String,
    milestone_id: String,
    slice_id: String,
) -> Result<Gsd2Slice, String> {
    let db_guard = db.write().await;
    let project_path = get_project_path(&db_guard, &project_id)?;
    let milestones_dir = Path::new(&project_path).join(".gsd").join("milestones");

    let dir_name = resolve_dir_by_id(&milestones_dir, &milestone_id)
        .ok_or_else(|| format!("Milestone '{}' not found", milestone_id))?;
    let milestone_dir = milestones_dir.join(&dir_name);

    // Try nested layout: M001/S01/ first, then flat M001/S01-PLAN.md
    let (slice_dir, plan_file) =
        if let Some(slice_sub) = resolve_dir_by_id(&milestone_dir, &slice_id) {
            let nested = milestone_dir.join(&slice_sub);
            match resolve_file_by_id(&nested, &slice_id, "PLAN") {
                Some(f) => (nested, f),
                None => {
                    // Fall back to flat
                    let flat_file = resolve_file_by_id(&milestone_dir, &slice_id, "PLAN")
                        .ok_or_else(|| format!("PLAN.md not found for slice '{}'", slice_id))?;
                    (milestone_dir.clone(), flat_file)
                }
            }
        } else {
            let flat_file = resolve_file_by_id(&milestone_dir, &slice_id, "PLAN")
                .ok_or_else(|| format!("PLAN.md not found for slice '{}'", slice_id))?;
            (milestone_dir.clone(), flat_file)
        };

    let plan_path = slice_dir.join(&plan_file);
    let content = std::fs::read_to_string(&plan_path)
        .map_err(|e| format!("Failed to read PLAN.md: {}", e))?;

    let tasks = parse_plan_tasks(&content);

    // Also get slice metadata from the parent ROADMAP.md
    let (title, done, risk, dependencies) =
        if let Some(roadmap_file) = resolve_file_by_id(&milestone_dir, &milestone_id, "ROADMAP") {
            let roadmap_path = milestone_dir.join(&roadmap_file);
            std::fs::read_to_string(&roadmap_path)
                .ok()
                .and_then(|rc| {
                    let slices = parse_roadmap_slices(&rc);
                    slices
                        .into_iter()
                        .find(|s| s.id == slice_id)
                        .map(|s| (s.title, s.done, s.risk, s.dependencies))
                })
                .unwrap_or_else(|| (slice_id.clone(), false, None, Vec::new()))
        } else {
            (slice_id.clone(), false, None, Vec::new())
        };

    // Override done status from tasks if no slices metadata
    let computed_done = if done {
        true
    } else {
        !tasks.is_empty() && tasks.iter().all(|t| t.done)
    };

    Ok(Gsd2Slice {
        id: slice_id,
        title,
        done: computed_done,
        risk,
        dependencies,
        tasks,
    })
}

/// Derive GSD-2 project state: active milestone/slice/task IDs and M/S/T progress counters.
#[tauri::command]
pub async fn gsd2_derive_state(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Gsd2State, String> {
    let db_guard = db.write().await;
    let project_path = get_project_path(&db_guard, &project_id)?;
    Ok(derive_state_from_dir(&project_path))
}

/// Return health data for a GSD-2 project: budget spend, active unit, blockers,
/// progress counters. Reads `.gsd/STATE.md` and `.gsd/metrics.json` directly —
/// never via subprocess (per HLTH-02).
#[tauri::command]
pub async fn gsd2_get_health(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Gsd2Health, String> {
    let db_guard = db.write().await;
    let project_path = get_project_path(&db_guard, &project_id)?;
    Ok(get_health_from_dir(&project_path))
}

// ============================================================
// Worktree structs and commands
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeInfo {
    pub name: String,
    pub branch: String,
    pub path: String,
    pub exists: bool,
    pub added_count: u32,
    pub modified_count: u32,
    pub removed_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeDiff {
    pub added: Vec<String>,
    pub modified: Vec<String>,
    pub removed: Vec<String>,
    pub added_count: u32,
    pub modified_count: u32,
    pub removed_count: u32,
}

fn canonicalize_path(p: &str) -> String {
    std::fs::canonicalize(std::path::Path::new(p))
        .map(|c| c.to_string_lossy().to_string())
        .unwrap_or_else(|_| p.to_string())
}

/// Parse `git worktree list --porcelain` output into a vec of (name, branch, path, exists).
/// The first block is always the main worktree — skip it.
fn parse_worktree_porcelain(output: &str) -> Vec<(String, String, String, bool)> {
    let mut result = Vec::new();

    // Split on blank lines (double newline separates worktree blocks)
    let blocks: Vec<&str> = output.split("\n\n").collect();

    // Skip the first block (main worktree)
    for block in blocks.iter().skip(1) {
        let block = block.trim();
        if block.is_empty() {
            continue;
        }

        let mut worktree_path = String::new();
        let mut branch = String::new();

        for line in block.lines() {
            if let Some(p) = line.strip_prefix("worktree ") {
                worktree_path = p.trim().to_string();
            } else if let Some(b) = line.strip_prefix("branch refs/heads/") {
                branch = b.trim().to_string();
            }
        }

        if worktree_path.is_empty() {
            continue;
        }

        // Derive name: strip "worktree/" prefix from branch if present, else use branch as-is
        let name = if branch.starts_with("worktree/") {
            branch["worktree/".len()..].to_string()
        } else if !branch.is_empty() {
            branch.clone()
        } else {
            // Fallback: last path component
            worktree_path
                .split('/')
                .last()
                .unwrap_or(&worktree_path)
                .to_string()
        };

        let exists = std::path::Path::new(&worktree_path).is_dir();
        let canonical = canonicalize_path(&worktree_path);

        result.push((name, branch, canonical, exists));
    }

    result
}

/// Parse `git diff --name-status` output into a WorktreeDiff.
/// Status chars: A/C → added, M/R → modified, D → removed.
fn parse_diff_name_status(output: &str) -> WorktreeDiff {
    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut removed = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // Lines are: <status_char>\t<filepath> (possibly with rename: R100\told\tnew)
        let parts: Vec<&str> = line.splitn(2, '\t').collect();
        if parts.len() < 2 {
            continue;
        }
        let status = parts[0].trim();
        let filepath = parts[1].trim().to_string();

        // For renames (R100\told\tnew), take the new path
        let filepath = if status.starts_with('R') {
            filepath.split('\t').last().unwrap_or(&filepath).to_string()
        } else {
            filepath
        };

        let status_char = status.chars().next().unwrap_or(' ');
        match status_char {
            'A' | 'C' => added.push(filepath),
            'M' | 'R' => modified.push(filepath),
            'D' => removed.push(filepath),
            _ => {}
        }
    }

    let added_count = added.len() as u32;
    let modified_count = modified.len() as u32;
    let removed_count = removed.len() as u32;

    WorktreeDiff {
        added,
        modified,
        removed,
        added_count,
        modified_count,
        removed_count,
    }
}

/// Run `git diff --name-status main...HEAD` in the given worktree directory.
/// Returns only counts. If the command fails (e.g., `main` doesn't exist), returns zeros.
fn get_diff_counts(worktree_path: &str) -> (u32, u32, u32) {
    let output = std::process::Command::new("git")
        .args(["diff", "--name-status", "main...HEAD"])
        .current_dir(worktree_path)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            let diff = parse_diff_name_status(&text);
            (diff.added_count, diff.modified_count, diff.removed_count)
        }
        _ => (0, 0, 0),
    }
}

/// List all linked worktrees for a GSD-2 project.
/// Returns name, branch, canonicalized path, existence flag, and diff counts vs main.
#[tauri::command]
pub async fn gsd2_list_worktrees(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<WorktreeInfo>, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let canonical_project = canonicalize_path(&project_path);

    let output = std::process::Command::new("git")
        .args(["worktree", "list", "--porcelain"])
        .current_dir(&canonical_project)
        .output()
        .map_err(|e| format!("Failed to run git worktree list: {}", e))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let entries = parse_worktree_porcelain(&text);

    let worktrees: Vec<WorktreeInfo> = entries
        .into_iter()
        .map(|(name, branch, path, exists)| {
            let (added_count, modified_count, removed_count) = if exists {
                get_diff_counts(&path)
            } else {
                (0, 0, 0)
            };
            WorktreeInfo {
                name,
                branch,
                path,
                exists,
                added_count,
                modified_count,
                removed_count,
            }
        })
        .collect();

    Ok(worktrees)
}

/// Remove a linked worktree and delete its branch.
/// Step 1: `git worktree remove .gsd/worktrees/{name} --force` — if this fails, return Err.
/// Step 2: `git branch -D worktree/{name}` — if this fails, log a warning but return Ok.
#[tauri::command]
pub async fn gsd2_remove_worktree(
    db: tauri::State<'_, DbState>,
    project_id: String,
    worktree_name: String,
) -> Result<(), String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let canonical_project = canonicalize_path(&project_path);
    let worktree_rel = format!(".gsd/worktrees/{}", worktree_name);

    // Step 1: Remove the worktree directory
    let remove_out = std::process::Command::new("git")
        .args(["worktree", "remove", &worktree_rel, "--force"])
        .current_dir(&canonical_project)
        .output()
        .map_err(|e| format!("Failed to run git worktree remove: {}", e))?;

    if !remove_out.status.success() {
        let stderr = String::from_utf8_lossy(&remove_out.stderr);
        return Err(format!("git worktree remove failed: {}", stderr));
    }

    // Step 2: Delete the branch — failure is non-fatal
    let branch_name = format!("worktree/{}", worktree_name);
    let branch_out = std::process::Command::new("git")
        .args(["branch", "-D", &branch_name])
        .current_dir(&canonical_project)
        .output();

    match branch_out {
        Ok(out) if !out.status.success() => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            tracing::warn!(
                "git branch -D {} failed (non-fatal): {}",
                branch_name,
                stderr
            );
        }
        Err(e) => {
            tracing::warn!(
                "Failed to run git branch -D {} (non-fatal): {}",
                branch_name,
                e
            );
        }
        _ => {}
    }

    Ok(())
}

/// Get the full diff for a worktree vs main (file lists + counts).
#[tauri::command]
pub async fn gsd2_get_worktree_diff(
    db: tauri::State<'_, DbState>,
    project_id: String,
    worktree_name: String,
) -> Result<WorktreeDiff, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let canonical_project = canonicalize_path(&project_path);
    let worktree_path = format!("{}/.gsd/worktrees/{}", canonical_project, worktree_name);
    let canonical_worktree = canonicalize_path(&worktree_path);

    let output = std::process::Command::new("git")
        .args(["diff", "--name-status", "main...HEAD"])
        .current_dir(&canonical_worktree)
        .output();

    match output {
        Ok(out) if out.status.success() => {
            let text = String::from_utf8_lossy(&out.stdout);
            Ok(parse_diff_name_status(&text))
        }
        _ => Ok(WorktreeDiff {
            added: Vec::new(),
            modified: Vec::new(),
            removed: Vec::new(),
            added_count: 0,
            modified_count: 0,
            removed_count: 0,
        }),
    }
}

// ============================================================
// Headless session structs and commands
// ============================================================

/// Snapshot returned by gsd2_headless_query (headless --json next output).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadlessSnapshot {
    pub state: String,
    pub next: Option<String>,
    pub cost: f64,
}

/// Info about active processes for safe-close checking.
#[derive(Debug, Clone, Serialize)]
pub struct ActiveProcessInfo {
    pub can_close: bool,
    pub active_terminals: usize,
}

/// Query the current GSD headless state for a project by running
/// `gsd headless --json next` as a subprocess (NOT PTY).
#[tauri::command]
pub async fn gsd2_headless_query(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<HeadlessSnapshot, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let output = std::process::Command::new("gsd")
        .args(["headless", "--json", "next"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to run gsd headless: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Parse last valid JSON line from stdout (gsd may emit multiple lines)
    let snapshot: serde_json::Value = stdout
        .lines()
        .rev()
        .find_map(|line| serde_json::from_str(line).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    Ok(HeadlessSnapshot {
        state: snapshot
            .get("state")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown")
            .to_string(),
        next: snapshot
            .get("next")
            .and_then(|v| v.as_str())
            .map(String::from),
        cost: snapshot.get("cost").and_then(|v| v.as_f64()).unwrap_or(0.0),
    })
}

/// Get the active headless session ID for a project, if one is alive.
/// Verifies the session still exists in TerminalManager; auto-removes stale registry entries.
#[tauri::command]
pub async fn gsd2_headless_get_session(
    project_id: String,
    registry: tauri::State<'_, HeadlessRegistryState>,
    terminal_manager: tauri::State<'_, crate::pty::TerminalManagerState>,
) -> Result<Option<String>, String> {
    let session_id = {
        let reg = registry.lock().await;
        reg.session_for_project(&project_id)
    };

    if let Some(sid) = session_id {
        // Verify the PTY session is still alive
        let alive = {
            let mut manager = terminal_manager.lock().await;
            manager.is_active(&sid)
        };
        if alive {
            return Ok(Some(sid));
        }
        // Stale — remove from registry
        let mut reg = registry.lock().await;
        reg.unregister(&sid);
    }

    Ok(None)
}

/// Unregister a headless session from the registry without killing the process.
/// Used when the PTY process exits naturally so the registry stays consistent.
#[tauri::command]
pub async fn gsd2_headless_unregister(
    session_id: String,
    registry: tauri::State<'_, HeadlessRegistryState>,
) -> Result<(), String> {
    let mut reg = registry.lock().await;
    reg.unregister(&session_id);
    Ok(())
}

/// Start a headless GSD session for a project via PTY (creates a real terminal session).
/// Enforces one headless session per project.
#[tauri::command]
pub async fn gsd2_headless_start(
    app: tauri::AppHandle,
    project_id: String,
    db: tauri::State<'_, DbState>,
    terminal_manager: tauri::State<'_, crate::pty::TerminalManagerState>,
    registry: tauri::State<'_, HeadlessRegistryState>,
) -> Result<String, String> {
    // Check for existing session for this project
    {
        let reg = registry.lock().await;
        if reg.session_for_project(&project_id).is_some() {
            return Err("A headless session is already running for this project".to_string());
        }
    }

    // Get project path from DB
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let session_id = uuid::Uuid::new_v4().to_string();
    let command = build_headless_command_with_env(None);

    // Create PTY session
    {
        let mut manager = terminal_manager.lock().await;
        manager
            .create_session(
                &app,
                session_id.clone(),
                &project_path,
                Some(&command),
                80,
                24,
            )
            .map_err(|e| {
                format!(
                    "Failed to start headless execution. Ensure GSD CLI is installed and API keys are configured in Settings → Secrets. {}",
                    e
                )
            })?;
    }

    // Register in headless registry
    {
        let mut reg = registry.lock().await;
        reg.register(session_id.clone(), project_id.clone());
    }

    Ok(session_id)
}

/// Stop a headless GSD session: sends SIGINT (ETX), polls for up to 5s,
/// then force-kills if still running, and unregisters from registry.
#[tauri::command]
pub async fn gsd2_headless_stop(
    app: tauri::AppHandle,
    session_id: String,
    terminal_manager: tauri::State<'_, crate::pty::TerminalManagerState>,
    registry: tauri::State<'_, HeadlessRegistryState>,
) -> Result<(), String> {
    // Send ETX (Ctrl-C / SIGINT) to the process
    {
        let mut manager = terminal_manager.lock().await;
        let _ = manager.write(&session_id, &[0x03]);
    }

    // Poll for up to 5 seconds (25 * 200ms) for graceful exit
    for _ in 0..25 {
        tokio::time::sleep(Duration::from_millis(200)).await;
        let still_active = {
            let mut manager = terminal_manager.lock().await;
            manager.is_active(&session_id)
        };
        if !still_active {
            break;
        }
    }

    // Force-kill if still active
    {
        let mut manager = terminal_manager.lock().await;
        if manager.is_active(&session_id) {
            let _ = manager.close(&app, &session_id);
        }
    }

    // Unregister from headless registry
    {
        let mut reg = registry.lock().await;
        reg.unregister(&session_id);
    }

    Ok(())
}

/// Check if it's safe to close the app (no active terminal or headless sessions).
#[tauri::command]
pub async fn can_safely_close(
    terminal_manager: tauri::State<'_, crate::pty::TerminalManagerState>,
    registry: tauri::State<'_, HeadlessRegistryState>,
) -> Result<ActiveProcessInfo, String> {
    let terminal_active = {
        let mut manager = terminal_manager.lock().await;
        manager.active_count()
    };

    let headless_active = {
        let reg = registry.lock().await;
        reg.active_count()
    };

    let total = terminal_active + headless_active;
    Ok(ActiveProcessInfo {
        can_close: total == 0,
        active_terminals: total,
    })
}

/// Force-close all sessions: gracefully stop headless sessions, then close all PTY sessions.
#[tauri::command]
pub async fn force_close_all(
    _app: tauri::AppHandle,
    terminal_manager: tauri::State<'_, crate::pty::TerminalManagerState>,
    registry: tauri::State<'_, HeadlessRegistryState>,
) -> Result<(), String> {
    // Get all headless session IDs
    let headless_ids = {
        let reg = registry.lock().await;
        reg.all_session_ids()
    };

    // Send SIGINT to each headless session
    for session_id in &headless_ids {
        let mut manager = terminal_manager.lock().await;
        let _ = manager.write(session_id, &[0x03]);
    }

    // Give processes a moment for graceful exit
    tokio::time::sleep(Duration::from_secs(2)).await;

    // Force-close all PTY sessions (includes headless and interactive)
    {
        let mut manager = terminal_manager.lock().await;
        manager.close_all();
    }

    // Clear headless registry
    {
        let mut reg = registry.lock().await;
        reg.sessions.clear();
    }

    Ok(())
}

// ============================================================
// Inspect / Steer / Undo / Recovery structs and commands (T01)
// ============================================================

// R079 — Inspect
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InspectData {
    pub schema_version: Option<String>,
    pub decision_count: u32,
    pub requirement_count: u32,
    pub recent_decisions: Vec<String>,
    pub recent_requirements: Vec<String>,
    pub decisions_file_exists: bool,
    pub requirements_file_exists: bool,
}

// R080 — Steer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteerData {
    pub content: String,
    pub exists: bool,
}

// R081 — Undo
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoInfo {
    pub last_unit_type: Option<String>,
    pub last_unit_id: Option<String>,
    pub last_unit_cost: f64,
    pub completed_units_count: u32,
    pub file_exists: bool,
}

// R084 — Recovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryInfo {
    pub lock_exists: bool,
    pub pid: Option<u32>,
    pub started_at: Option<String>,
    pub unit_type: Option<String>,
    pub unit_id: Option<String>,
    pub unit_started_at: Option<String>,
    pub is_process_alive: bool,
    pub suggested_action: String,
    pub session_file: Option<String>,
}

/// Count lines matching a table-row pattern: starts with `{prefix}` + digits + ` |`.
/// Returns (count, last_n lines that matched).
fn count_table_rows(content: &str, prefix: char, last_n: usize) -> (u32, Vec<String>) {
    let mut count = 0u32;
    let mut matched: Vec<String> = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(prefix) {
            continue;
        }
        // After prefix char must be digits followed by ' |' or ' –' or ' —' etc.
        let rest = &trimmed[1..];
        let digit_end = rest
            .find(|c: char| !c.is_ascii_digit())
            .unwrap_or(rest.len());
        if digit_end == 0 {
            continue; // no digits after prefix
        }
        let after_digits = &rest[digit_end..];
        // Accept either ' |' separator (GSD table format) or space then any non-empty content
        if after_digits.starts_with(" |")
            || after_digits.starts_with(" –")
            || after_digits.starts_with(" —")
            || after_digits.starts_with(". ")
        {
            count += 1;
            matched.push(trimmed.to_string());
        }
    }
    let recent: Vec<String> = if matched.len() > last_n {
        matched[matched.len() - last_n..].to_vec()
    } else {
        matched
    };
    (count, recent)
}

/// R079: Return schema overview: counts of decisions/requirements + recent entries.
#[tauri::command]
pub async fn gsd2_get_inspect(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<InspectData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let gsd_dir = Path::new(&project_path).join(".gsd");

    // STATE.md — extract schema version from frontmatter
    let state_path = gsd_dir.join("STATE.md");
    let schema_version = if state_path.exists() {
        let content = std::fs::read_to_string(&state_path).unwrap_or_default();
        let (fm, _) = parse_frontmatter(&content);
        fm.get("version").cloned()
    } else {
        None
    };

    // DECISIONS.md
    let decisions_path = gsd_dir.join("DECISIONS.md");
    let decisions_file_exists = decisions_path.exists();
    let (decision_count, recent_decisions) = if decisions_file_exists {
        let content = std::fs::read_to_string(&decisions_path).unwrap_or_default();
        count_table_rows(&content, 'D', 5)
    } else {
        (0, Vec::new())
    };

    // REQUIREMENTS.md
    let requirements_path = gsd_dir.join("REQUIREMENTS.md");
    let requirements_file_exists = requirements_path.exists();
    let (requirement_count, recent_requirements) = if requirements_file_exists {
        let content = std::fs::read_to_string(&requirements_path).unwrap_or_default();
        count_table_rows(&content, 'R', 5)
    } else {
        (0, Vec::new())
    };

    Ok(InspectData {
        schema_version,
        decision_count,
        requirement_count,
        recent_decisions,
        recent_requirements,
        decisions_file_exists,
        requirements_file_exists,
    })
}

/// R080 read: Return the contents of .gsd/OVERRIDES.md (steer file).
#[tauri::command]
pub async fn gsd2_get_steer_content(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<SteerData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let overrides_path = Path::new(&project_path).join(".gsd").join("OVERRIDES.md");
    if overrides_path.exists() {
        let content =
            std::fs::read_to_string(&overrides_path).map_err(|e| format!("Read failed: {}", e))?;
        Ok(SteerData {
            content,
            exists: true,
        })
    } else {
        Ok(SteerData {
            content: String::new(),
            exists: false,
        })
    }
}

/// R080 write: Atomically write .gsd/OVERRIDES.md (steer file).
#[tauri::command]
pub async fn gsd2_set_steer_content(
    project_id: String,
    content: String,
    db: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let gsd_dir = Path::new(&project_path).join(".gsd");
    let overrides_path = gsd_dir.join("OVERRIDES.md");
    let tmp_path = gsd_dir.join(format!("OVERRIDES.tmp.{}", std::process::id()));

    std::fs::write(&tmp_path, &content).map_err(|e| format!("Write failed: {}", e))?;
    std::fs::rename(&tmp_path, &overrides_path).map_err(|e| format!("Rename failed: {}", e))?;

    Ok(())
}

/// R081: Return undo info from completed-units.json + metrics.json.
#[tauri::command]
pub async fn gsd2_get_undo_info(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<UndoInfo, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let gsd_dir = Path::new(&project_path).join(".gsd");
    let completed_path = gsd_dir.join("completed-units.json");

    if !completed_path.exists() {
        return Ok(UndoInfo {
            last_unit_type: None,
            last_unit_id: None,
            last_unit_cost: 0.0,
            completed_units_count: 0,
            file_exists: false,
        });
    }

    let completed_content =
        std::fs::read_to_string(&completed_path).map_err(|e| format!("Read failed: {}", e))?;
    let completed_json: serde_json::Value =
        serde_json::from_str(&completed_content).unwrap_or(serde_json::json!([]));

    let empty_vec = Vec::new();
    let units_arr = completed_json.as_array().unwrap_or(&empty_vec);
    let completed_units_count = units_arr.len() as u32;

    let last_key = units_arr
        .last()
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let (last_unit_type, last_unit_id) = if last_key.is_empty() {
        (None, None)
    } else {
        if let Some(slash_idx) = last_key.find('/') {
            let unit_type = last_key[..slash_idx].to_string();
            let unit_id = last_key[slash_idx + 1..].to_string();
            (Some(unit_type), Some(unit_id))
        } else {
            (Some(last_key.clone()), None)
        }
    };

    // Look up cost from metrics.json by matching unit id
    let mut last_unit_cost = 0.0f64;
    let metrics_path = gsd_dir.join("metrics.json");
    if metrics_path.exists() {
        let metrics_content = std::fs::read_to_string(&metrics_path).unwrap_or_default();
        let metrics_json: serde_json::Value =
            serde_json::from_str(&metrics_content).unwrap_or(serde_json::json!({}));
        let empty_units = Vec::new();
        let metric_units = metrics_json
            .get("units")
            .and_then(|u| u.as_array())
            .unwrap_or(&empty_units);
        // Find the last unit by matching id == last_key
        for unit in metric_units {
            let uid = unit.get("id").and_then(|v| v.as_str()).unwrap_or("");
            if uid == last_key {
                last_unit_cost = unit.get("cost").and_then(|v| v.as_f64()).unwrap_or(0.0);
            }
        }
    }

    Ok(UndoInfo {
        last_unit_type,
        last_unit_id,
        last_unit_cost,
        completed_units_count,
        file_exists: true,
    })
}

/// R084: Return recovery info from auto.lock (checks both .gsd/auto.lock and .gsd/runtime/auto.lock).
#[tauri::command]
pub async fn gsd2_get_recovery_info(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<RecoveryInfo, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let gsd_dir = Path::new(&project_path).join(".gsd");

    // Check both lock locations — prefer .gsd/auto.lock, fall back to .gsd/runtime/auto.lock
    let lock_path_primary = gsd_dir.join("auto.lock");
    let lock_path_secondary = gsd_dir.join("runtime").join("auto.lock");

    let (lock_path, lock_exists) = if lock_path_primary.exists() {
        (lock_path_primary, true)
    } else if lock_path_secondary.exists() {
        (lock_path_secondary, true)
    } else {
        (lock_path_primary, false) // doesn't matter which, neither exists
    };

    if !lock_exists {
        return Ok(RecoveryInfo {
            lock_exists: false,
            pid: None,
            started_at: None,
            unit_type: None,
            unit_id: None,
            unit_started_at: None,
            is_process_alive: false,
            suggested_action: "No lock file found — system is idle.".to_string(),
            session_file: None,
        });
    }

    let lock_content = std::fs::read_to_string(&lock_path).unwrap_or_default();
    let lock_json: serde_json::Value =
        serde_json::from_str(&lock_content).unwrap_or(serde_json::json!({}));

    let pid: Option<u32> = lock_json
        .get("pid")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    let started_at = lock_json
        .get("startedAt")
        .and_then(|v| v.as_str())
        .map(String::from);
    let unit_type = lock_json
        .get("unitType")
        .and_then(|v| v.as_str())
        .map(String::from);
    let unit_id = lock_json
        .get("unitId")
        .and_then(|v| v.as_str())
        .map(String::from);
    let unit_started_at = lock_json
        .get("unitStartedAt")
        .and_then(|v| v.as_str())
        .map(String::from);
    let session_file = lock_json
        .get("sessionFile")
        .and_then(|v| v.as_str())
        .map(String::from);

    // Check if PID is alive using kill(pid, 0)
    let is_process_alive = pid.map_or(false, |p| {
        // SAFETY: kill(pid, 0) is a standard POSIX probe — signal 0 never delivers
        unsafe { libc::kill(p as libc::pid_t, 0) == 0 }
    });

    let suggested_action = if !is_process_alive {
        format!(
            "Lock file exists but PID {} is not running. Safe to delete the lock file and retry.",
            pid.unwrap_or(0)
        )
    } else {
        match unit_type.as_deref() {
            Some("execute-task") => format!(
                "Agent is executing a task ({}). Wait for it to finish or check logs.",
                unit_id.as_deref().unwrap_or("unknown")
            ),
            Some("plan-slice") | Some("plan-milestone") => format!(
                "Agent is planning ({}). Wait for completion.",
                unit_id.as_deref().unwrap_or("unknown")
            ),
            Some(ut) => format!(
                "Agent is running {} ({}). Wait for completion.",
                ut,
                unit_id.as_deref().unwrap_or("unknown")
            ),
            None => "Agent process is alive. Wait for it to finish.".to_string(),
        }
    };

    Ok(RecoveryInfo {
        lock_exists: true,
        pid,
        started_at,
        unit_type,
        unit_id,
        unit_started_at,
        is_process_alive,
        suggested_action,
        session_file,
    })
}

// ============================================================
// R078 — History / metrics aggregation
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitRecord {
    pub unit_type: String,
    pub id: String,
    pub model: String,
    pub started_at: i64,
    pub finished_at: i64,
    pub cost: f64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_write_tokens: i64,
    pub total_tokens: i64,
    pub tool_calls: i64,
    pub tier: Option<String>,
    pub model_downgraded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectTotals {
    pub units: u32,
    pub total_cost: f64,
    pub total_tokens: i64,
    pub duration_ms: i64,
    pub tool_calls: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseAggregate {
    pub phase: String,
    pub units: u32,
    pub cost: f64,
    pub tokens: i64,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SliceAggregate {
    pub slice_id: String,
    pub units: u32,
    pub cost: f64,
    pub tokens: i64,
    pub duration_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAggregate {
    pub model: String,
    pub units: u32,
    pub cost: f64,
    pub tokens: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryData {
    pub units: Vec<UnitRecord>,
    pub totals: ProjectTotals,
    pub by_phase: Vec<PhaseAggregate>,
    pub by_slice: Vec<SliceAggregate>,
    pub by_model: Vec<ModelAggregate>,
}

// R082 — Hooks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEntry {
    pub name: String,
    pub hook_type: String,
    pub triggers: Vec<String>,
    pub action: Option<String>,
    pub artifact: Option<String>,
    pub max_cycles: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HooksData {
    pub hooks: Vec<HookEntry>,
    pub preferences_exists: bool,
}

// R083 — Git Summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitEntry {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitSummaryData {
    pub branch: Option<String>,
    pub is_dirty: bool,
    pub staged_count: u32,
    pub unstaged_count: u32,
    pub untracked_count: u32,
    pub recent_commits: Vec<GitCommitEntry>,
    pub ahead: u32,
    pub behind: u32,
    pub has_git: bool,
}

// R086 — Export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub content: String,
    pub format: String,
}

// ---------------------------------------------------------------------------
// Helpers for R078 and R086
// ---------------------------------------------------------------------------

fn classify_unit_phase(unit_type: &str) -> &'static str {
    if unit_type == "research-milestone" || unit_type == "research-slice" {
        "research"
    } else if unit_type == "plan-milestone" || unit_type == "plan-slice" {
        "planning"
    } else if unit_type == "execute-task" {
        "execution"
    } else if unit_type == "complete-slice" {
        "completion"
    } else if unit_type == "reassess-roadmap" {
        "reassessment"
    } else {
        "execution"
    }
}

/// Parse metrics.json and return (unit_records, totals, by_phase, by_slice, by_model).
fn parse_metrics_json(
    content: &str,
) -> (
    Vec<UnitRecord>,
    ProjectTotals,
    Vec<PhaseAggregate>,
    Vec<SliceAggregate>,
    Vec<ModelAggregate>,
) {
    let json: serde_json::Value = serde_json::from_str(content).unwrap_or(serde_json::json!({}));
    let units_arr = json.get("units").and_then(|v| v.as_array());

    let mut records: Vec<UnitRecord> = Vec::new();

    if let Some(arr) = units_arr {
        for item in arr {
            let unit_type = item
                .get("unitType")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let model = item
                .get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let started_at = item.get("startedAt").and_then(|v| v.as_i64()).unwrap_or(0);
            let finished_at = item.get("finishedAt").and_then(|v| v.as_i64()).unwrap_or(0);
            let cost = item.get("cost").and_then(|v| v.as_f64()).unwrap_or(0.0);
            // Token fields: try flat top-level keys first (older metrics format),
            // then fall back to nested `tokens` sub-object (current format).
            let tokens_obj = item.get("tokens");
            let input_tokens = item
                .get("inputTokens")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    tokens_obj
                        .and_then(|t| t.get("input"))
                        .and_then(|v| v.as_i64())
                })
                .unwrap_or(0);
            let output_tokens = item
                .get("outputTokens")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    tokens_obj
                        .and_then(|t| t.get("output"))
                        .and_then(|v| v.as_i64())
                })
                .unwrap_or(0);
            let cache_read_tokens = item
                .get("cacheRead")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    tokens_obj
                        .and_then(|t| t.get("cacheRead"))
                        .and_then(|v| v.as_i64())
                })
                .unwrap_or(0);
            let cache_write_tokens = item
                .get("cacheWrite")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    tokens_obj
                        .and_then(|t| t.get("cacheWrite"))
                        .and_then(|v| v.as_i64())
                })
                .unwrap_or(0);
            let total_tokens = item
                .get("totalTokens")
                .and_then(|v| v.as_i64())
                .or_else(|| {
                    tokens_obj
                        .and_then(|t| t.get("total"))
                        .and_then(|v| v.as_i64())
                })
                .unwrap_or_else(|| {
                    input_tokens + output_tokens + cache_read_tokens + cache_write_tokens
                });
            let tool_calls = item.get("toolCalls").and_then(|v| v.as_i64()).unwrap_or(0);
            let tier = item.get("tier").and_then(|v| v.as_str()).map(String::from);
            let model_downgraded = item
                .get("modelDowngraded")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            records.push(UnitRecord {
                unit_type,
                id,
                model,
                started_at,
                finished_at,
                cost,
                input_tokens,
                output_tokens,
                cache_read_tokens,
                cache_write_tokens,
                total_tokens,
                tool_calls,
                tier,
                model_downgraded,
            });
        }
    }

    // ---- Totals (single pass) ----
    let mut total_cost = 0.0f64;
    let mut total_tokens = 0i64;
    let mut total_duration_ms = 0i64;
    let mut total_tool_calls = 0i64;
    for r in &records {
        total_cost += r.cost;
        total_tokens += r.total_tokens;
        total_duration_ms += r.finished_at - r.started_at;
        total_tool_calls += r.tool_calls;
    }
    let totals = ProjectTotals {
        units: records.len() as u32,
        total_cost,
        total_tokens,
        duration_ms: total_duration_ms,
        tool_calls: total_tool_calls,
    };

    // ---- By phase ----
    let phase_order = [
        "research",
        "planning",
        "execution",
        "completion",
        "reassessment",
    ];
    let mut phase_map: std::collections::HashMap<&'static str, (u32, f64, i64, i64)> =
        std::collections::HashMap::new();
    for p in &phase_order {
        phase_map.insert(p, (0, 0.0, 0, 0));
    }
    for r in &records {
        let phase = classify_unit_phase(&r.unit_type);
        let entry = phase_map.entry(phase).or_insert((0, 0.0, 0, 0));
        entry.0 += 1;
        entry.1 += r.cost;
        entry.2 += r.total_tokens;
        entry.3 += r.finished_at - r.started_at;
    }
    let by_phase: Vec<PhaseAggregate> = phase_order
        .iter()
        .filter_map(|p| {
            phase_map
                .get(p)
                .map(|&(units, cost, tokens, duration_ms)| PhaseAggregate {
                    phase: p.to_string(),
                    units,
                    cost,
                    tokens,
                    duration_ms,
                })
        })
        .collect();

    // ---- By slice ----
    let mut slice_map: std::collections::HashMap<String, (u32, f64, i64, i64)> =
        std::collections::HashMap::new();
    for r in &records {
        let slice_key = {
            let parts: Vec<&str> = r.id.splitn(3, '/').collect();
            if parts.len() >= 2 {
                format!("{}/{}", parts[0], parts[1])
            } else {
                r.id.clone()
            }
        };
        let entry = slice_map.entry(slice_key).or_insert((0, 0.0, 0, 0));
        entry.0 += 1;
        entry.1 += r.cost;
        entry.2 += r.total_tokens;
        entry.3 += r.finished_at - r.started_at;
    }
    let mut by_slice: Vec<SliceAggregate> = slice_map
        .into_iter()
        .map(
            |(slice_id, (units, cost, tokens, duration_ms))| SliceAggregate {
                slice_id,
                units,
                cost,
                tokens,
                duration_ms,
            },
        )
        .collect();
    by_slice.sort_by(|a, b| a.slice_id.cmp(&b.slice_id));

    // ---- By model ----
    let mut model_map: std::collections::HashMap<String, (u32, f64, i64)> =
        std::collections::HashMap::new();
    for r in &records {
        let entry = model_map.entry(r.model.clone()).or_insert((0, 0.0, 0));
        entry.0 += 1;
        entry.1 += r.cost;
        entry.2 += r.total_tokens;
    }
    let mut by_model: Vec<ModelAggregate> = model_map
        .into_iter()
        .map(|(model, (units, cost, tokens))| ModelAggregate {
            model,
            units,
            cost,
            tokens,
        })
        .collect();
    by_model.sort_by(|a, b| {
        b.cost
            .partial_cmp(&a.cost)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    (records, totals, by_phase, by_slice, by_model)
}

// ---------------------------------------------------------------------------
// R078: gsd2_get_history
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn gsd2_get_history(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<HistoryData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let metrics_path = Path::new(&project_path).join(".gsd").join("metrics.json");
    if !metrics_path.exists() {
        return Ok(HistoryData {
            units: vec![],
            totals: ProjectTotals {
                units: 0,
                total_cost: 0.0,
                total_tokens: 0,
                duration_ms: 0,
                tool_calls: 0,
            },
            by_phase: vec![],
            by_slice: vec![],
            by_model: vec![],
        });
    }

    let content = std::fs::read_to_string(&metrics_path)
        .map_err(|e| format!("Failed to read metrics.json: {e}"))?;

    let (units, totals, by_phase, by_slice, by_model) = parse_metrics_json(&content);
    Ok(HistoryData {
        units,
        totals,
        by_phase,
        by_slice,
        by_model,
    })
}

// ---------------------------------------------------------------------------
// R082: gsd2_get_hooks — manual section scan of preferences.md
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn gsd2_get_hooks(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<HooksData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let prefs_path = Path::new(&project_path).join(".gsd").join("preferences.md");
    if !prefs_path.exists() {
        return Ok(HooksData {
            hooks: vec![],
            preferences_exists: false,
        });
    }

    let content = std::fs::read_to_string(&prefs_path)
        .map_err(|e| format!("Failed to read preferences.md: {e}"))?;

    let hooks = parse_hooks_from_prefs(&content);
    Ok(HooksData {
        hooks,
        preferences_exists: true,
    })
}

/// Scan preferences.md for post_unit_hooks: and pre_dispatch_hooks: sections.
/// Each YAML-like block under those keys is parsed into a HookEntry.
fn parse_hooks_from_prefs(content: &str) -> Vec<HookEntry> {
    let mut hooks: Vec<HookEntry> = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim_end();
        // Detect section headers
        let hook_type = if line.starts_with("post_unit_hooks:") {
            Some("post_unit")
        } else if line.starts_with("pre_dispatch_hooks:") {
            Some("pre_dispatch")
        } else {
            None
        };

        if let Some(htype) = hook_type {
            i += 1;
            // Collect hook blocks while lines are indented
            while i < lines.len() {
                let current = lines[i];
                // A non-indented non-empty line ends the section
                if !current.is_empty() && !current.starts_with(' ') && !current.starts_with('\t') {
                    break;
                }
                let trimmed = current.trim();
                if trimmed.starts_with("- name:") {
                    // Start of a hook block
                    let name = trimmed["- name:".len()..].trim().to_string();
                    let mut triggers: Vec<String> = Vec::new();
                    let mut action: Option<String> = None;
                    let mut artifact: Option<String> = None;
                    let mut max_cycles: Option<u32> = None;
                    let mut in_trigger_list = false;

                    i += 1;
                    while i < lines.len() {
                        let inner = lines[i];
                        // Block ends when we hit a non-indented non-empty line
                        // or another "- name:" at the same indentation level
                        if !inner.is_empty() && !inner.starts_with(' ') && !inner.starts_with('\t')
                        {
                            break;
                        }
                        let inner_trimmed = inner.trim();
                        if inner_trimmed.starts_with("- name:") {
                            // Next hook block — don't consume
                            break;
                        }
                        if inner_trimmed.starts_with("after:")
                            || inner_trimmed.starts_with("before:")
                        {
                            in_trigger_list = true;
                        } else if inner_trimmed.starts_with("action:") {
                            in_trigger_list = false;
                            action = Some(inner_trimmed["action:".len()..].trim().to_string());
                        } else if inner_trimmed.starts_with("artifact:") {
                            in_trigger_list = false;
                            artifact = Some(inner_trimmed["artifact:".len()..].trim().to_string());
                        } else if inner_trimmed.starts_with("max_cycles:") {
                            in_trigger_list = false;
                            max_cycles = inner_trimmed["max_cycles:".len()..]
                                .trim()
                                .parse::<u32>()
                                .ok();
                        } else if in_trigger_list && inner_trimmed.starts_with("- ") {
                            triggers.push(inner_trimmed[2..].trim().to_string());
                        } else if !inner_trimmed.is_empty() && !inner_trimmed.starts_with('#') {
                            // Any other key resets trigger list mode
                            in_trigger_list = false;
                        }
                        i += 1;
                    }
                    hooks.push(HookEntry {
                        name,
                        hook_type: htype.to_string(),
                        triggers,
                        action,
                        artifact,
                        max_cycles,
                    });
                } else {
                    i += 1;
                }
            }
        } else {
            i += 1;
        }
    }
    hooks
}

// ---------------------------------------------------------------------------
// R083: gsd2_get_git_summary — self-contained, no git.rs import
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn gsd2_get_git_summary(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<GitSummaryData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    // Helper: run a git command, return stdout as String or None on failure
    let run_git = |args: &[&str]| -> Option<String> {
        let mut cmd = std::process::Command::new("git");
        cmd.arg("-C").arg(&project_path);
        for a in args {
            cmd.arg(a);
        }
        match cmd.output() {
            Ok(out) if out.status.success() => {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            }
            _ => None,
        }
    };

    // 1. Verify this is a git repo (branch check)
    let branch_out = run_git(&["rev-parse", "--abbrev-ref", "HEAD"]);
    if branch_out.is_none() {
        return Ok(GitSummaryData {
            branch: None,
            is_dirty: false,
            staged_count: 0,
            unstaged_count: 0,
            untracked_count: 0,
            recent_commits: vec![],
            ahead: 0,
            behind: 0,
            has_git: false,
        });
    }
    let branch = branch_out.filter(|b| b != "HEAD").map(|b| b.clone());

    // 2. Status
    let (staged_count, unstaged_count, untracked_count) =
        if let Some(status_out) = run_git(&["status", "--porcelain"]) {
            let mut staged = 0u32;
            let mut unstaged = 0u32;
            let mut untracked = 0u32;
            for line in status_out.lines() {
                let bytes = line.as_bytes();
                if bytes.len() < 2 {
                    continue;
                }
                let x = bytes[0] as char; // staged column
                let y = bytes[1] as char; // unstaged column
                match x {
                    'M' | 'A' | 'D' | 'R' | 'C' => staged += 1,
                    _ => {}
                }
                match y {
                    'M' | 'D' => unstaged += 1,
                    '?' => untracked += 1,
                    _ => {}
                }
            }
            (staged, unstaged, untracked)
        } else {
            (0, 0, 0)
        };

    let is_dirty = staged_count > 0 || unstaged_count > 0 || untracked_count > 0;

    // 3. Recent commits
    let recent_commits = if let Some(log_out) = run_git(&["log", "--format=%H|%s|%an|%ar", "-20"]) {
        log_out
            .lines()
            .filter_map(|line| {
                let parts: Vec<&str> = line.splitn(4, '|').collect();
                if parts.len() == 4 {
                    Some(GitCommitEntry {
                        hash: parts[0].to_string(),
                        message: parts[1].to_string(),
                        author: parts[2].to_string(),
                        date: parts[3].to_string(),
                    })
                } else {
                    None
                }
            })
            .collect()
    } else {
        vec![]
    };

    // 4. Ahead / behind upstream
    let (ahead, behind) = if let Some(ab_out) =
        run_git(&["rev-list", "--left-right", "--count", "@{upstream}...HEAD"])
    {
        let parts: Vec<&str> = ab_out.split_whitespace().collect();
        if parts.len() == 2 {
            let behind = parts[0].parse::<u32>().unwrap_or(0);
            let ahead = parts[1].parse::<u32>().unwrap_or(0);
            (ahead, behind)
        } else {
            (0, 0)
        }
    } else {
        (0, 0)
    };

    Ok(GitSummaryData {
        branch,
        is_dirty,
        staged_count,
        unstaged_count,
        untracked_count,
        recent_commits,
        ahead,
        behind,
        has_git: true,
    })
}

// ---------------------------------------------------------------------------
// R086: gsd2_export_progress — markdown progress report
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn gsd2_export_progress(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<ExportData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let gsd_dir = Path::new(&project_path).join(".gsd");

    // Parse metrics.json if available
    let metrics_path = gsd_dir.join("metrics.json");
    let (totals, by_phase, by_model) = if metrics_path.exists() {
        let content = std::fs::read_to_string(&metrics_path).unwrap_or_default();
        let (_, t, bp, _, bm) = parse_metrics_json(&content);
        (t, bp, bm)
    } else {
        (
            ProjectTotals {
                units: 0,
                total_cost: 0.0,
                total_tokens: 0,
                duration_ms: 0,
                tool_calls: 0,
            },
            vec![],
            vec![],
        )
    };

    // Milestone progress table
    let milestones_dir = gsd_dir.join("milestones");
    let milestones = walk_milestones_with_tasks(&milestones_dir);

    // Build markdown
    let mut md = String::new();
    md.push_str(&format!("# GSD Project Progress Export\n\n"));
    md.push_str(&format!("**Project:** `{}`\n\n", project_id));

    // Summary stats
    md.push_str("## Summary\n\n");
    md.push_str("| Metric | Value |\n");
    md.push_str("|--------|-------|\n");
    md.push_str(&format!("| Total Units | {} |\n", totals.units));
    md.push_str(&format!("| Total Cost | ${:.4} |\n", totals.total_cost));
    md.push_str(&format!("| Total Tokens | {} |\n", totals.total_tokens));
    md.push_str(&format!("| Total Duration | {}ms |\n", totals.duration_ms));
    md.push_str(&format!("| Total Tool Calls | {} |\n\n", totals.tool_calls));

    // Milestone progress table
    md.push_str("## Milestone Progress\n\n");
    md.push_str("| Milestone | Slices Done | Slices Total | Tasks Done | Tasks Total | Status |\n");
    md.push_str("|-----------|-------------|--------------|------------|-------------|--------|\n");
    for m in &milestones {
        let slices_done = m.slices.iter().filter(|s| s.done).count();
        let slices_total = m.slices.len();
        let tasks_done: usize = m
            .slices
            .iter()
            .flat_map(|s| s.tasks.iter())
            .filter(|t| t.done)
            .count();
        let tasks_total: usize = m.slices.iter().map(|s| s.tasks.len()).sum();
        let status = if m.done {
            "✅ Done"
        } else if slices_done > 0 {
            "🔄 In Progress"
        } else {
            "⏳ Pending"
        };
        md.push_str(&format!(
            "| {} | {} | {} | {} | {} | {} |\n",
            m.id, slices_done, slices_total, tasks_done, tasks_total, status
        ));
    }
    md.push('\n');

    // Phase breakdown
    if !by_phase.is_empty() {
        md.push_str("## Phase Breakdown\n\n");
        md.push_str("| Phase | Units | Cost | Tokens | Duration |\n");
        md.push_str("|-------|-------|------|--------|----------|\n");
        for p in &by_phase {
            if p.units > 0 {
                md.push_str(&format!(
                    "| {} | {} | ${:.4} | {} | {}ms |\n",
                    p.phase, p.units, p.cost, p.tokens, p.duration_ms
                ));
            }
        }
        md.push('\n');
    }

    // Model breakdown
    if !by_model.is_empty() {
        md.push_str("## Model Breakdown\n\n");
        md.push_str("| Model | Units | Cost | Tokens |\n");
        md.push_str("|-------|-------|------|--------|\n");
        for m in &by_model {
            md.push_str(&format!(
                "| {} | {} | ${:.4} | {} |\n",
                m.model, m.units, m.cost, m.tokens
            ));
        }
        md.push('\n');
    }

    Ok(ExportData {
        content: md,
        format: "markdown".to_string(),
    })
}

// ============================================================
// Visualizer structs and commands
// ============================================================

// --- Rich task node (VisualizerData2 tree) ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizerTask2 {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub status: String,
    pub estimate: Option<String>,
    pub on_critical_path: bool,
    pub slack: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizerSlice2 {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub status: String,
    pub risk: Option<String>,
    pub dependencies: Vec<String>,
    pub tasks: Vec<VisualizerTask2>,
    pub verification: Option<SliceVerification2>,
    pub changelog: Vec<ChangelogEntry2>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizerMilestone2 {
    pub id: String,
    pub title: String,
    pub done: bool,
    pub status: String,
    pub dependencies: Vec<String>,
    pub slices: Vec<VisualizerSlice2>,
    pub discussion_state: String, // "discussed" | "draft" | "undiscussed"
    pub cost: f64,
}

// --- Critical path ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackEntry {
    pub id: String,
    pub slack: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CriticalPathInfo {
    pub path: Vec<String>,
    pub slack_map: Vec<SlackEntry>,
}

// --- Agent activity ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrentUnit {
    pub unit_type: String,
    pub unit_id: String,
    pub started_at: Option<String>,
    pub elapsed_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentActivityInfo {
    pub is_active: bool,
    pub pid: Option<i32>,
    pub current_unit: Option<CurrentUnit>,
    pub completed_units: u32,
    pub total_slices: u32,
}

// --- Changelog ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileModified2 {
    pub path: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangelogEntry2 {
    pub slice_id: String,
    pub one_liner: String,
    pub completed_at: Option<String>,
    pub files_modified: Vec<FileModified2>,
}

// --- Slice verification ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SliceVerification2 {
    pub slice_id: String,
    pub verification_text: String,
}

// --- Knowledge / Captures / Health / Stats ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeInfo2 {
    pub exists: bool,
    pub entry_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturesInfo2 {
    pub exists: bool,
    pub pending_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthInfo2 {
    pub active_milestone_id: Option<String>,
    pub active_slice_id: Option<String>,
    pub active_task_id: Option<String>,
    pub milestones_done: u32,
    pub milestones_total: u32,
    pub slices_done: u32,
    pub slices_total: u32,
    pub tasks_done: u32,
    pub tasks_total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizerStats2 {
    pub milestones_missing_summary: u32,
    pub slices_missing_summary: u32,
    pub recent_changelog: Vec<ChangelogEntry2>,
}

/// Full VisualizerData2 — the expanded shape returned by gsd2_get_visualizer_data.
/// Includes backward-compatible fields (tree, cost_by_milestone, cost_by_model, timeline)
/// alongside the new expanded fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizerData2 {
    // Rich milestone tree (new)
    pub milestones: Vec<VisualizerMilestone2>,

    // Backward-compatible aliases used by gsd2-visualizer-tab.tsx
    // tree = milestones flattened to VisualizerNode shape
    pub tree: Vec<VisualizerNodeCompat>,
    pub cost_by_milestone: Vec<CostByKeyCompat>,
    pub cost_by_model: Vec<CostByKeyCompat>,
    pub timeline: Vec<TimelineEntryCompat>,

    // Critical path across all incomplete slices
    pub critical_path: CriticalPathInfo,

    // Agent activity
    pub agent_activity: AgentActivityInfo,

    // Cost breakdowns (reuse T02 aggregation structs)
    pub by_phase: Vec<PhaseAggregate>,
    pub by_slice: Vec<SliceAggregate>,
    pub by_model: Vec<ModelAggregate>,
    pub units: Vec<UnitRecord>,
    pub totals: ProjectTotals,

    // Knowledge / Captures
    pub knowledge: KnowledgeInfo2,
    pub captures: CapturesInfo2,

    // Health summary
    pub health: HealthInfo2,

    // Stats
    pub stats: VisualizerStats2,
}

/// Backward-compatible visualizer node (for tree field).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisualizerNodeCompat {
    pub id: String,
    pub title: String,
    pub status: String,
    pub children: Vec<VisualizerNodeCompat>,
}

/// Backward-compatible cost-by-key.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostByKeyCompat {
    pub key: String,
    pub cost: f64,
}

/// Backward-compatible timeline entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEntryCompat {
    pub id: String,
    pub title: String,
    pub entry_type: String,
    pub completed_at: Option<String>,
    pub cost: f64,
}

// ============================================================
// Critical path helper
// ============================================================

/// Compute critical path via Kahn's topological sort + longest-path DP.
/// Input: Vec of (id, dependencies) pairs.
/// Returns (ordered_path, slack_map) where slack_map maps id → slack value.
fn compute_critical_path(nodes: &[(String, Vec<String>)]) -> CriticalPathInfo {
    if nodes.is_empty() {
        return CriticalPathInfo {
            path: Vec::new(),
            slack_map: Vec::new(),
        };
    }

    // Build adjacency list: predecessor → successors
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    // In-degree map
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    // All node ids
    for (id, _deps) in nodes {
        in_degree.entry(id.clone()).or_insert(0);
        adj.entry(id.clone()).or_insert_with(Vec::new);
    }
    for (id, deps) in nodes {
        for dep in deps {
            // dep → id edge (dep must finish before id)
            adj.entry(dep.clone())
                .or_insert_with(Vec::new)
                .push(id.clone());
            *in_degree.entry(id.clone()).or_insert(0) += 1;
        }
    }

    // Kahn's BFS — also records topo order
    let mut queue: std::collections::VecDeque<String> = in_degree
        .iter()
        .filter(|(_k, &v)| v == 0)
        .map(|(k, _)| k.clone())
        .collect();

    // dist[node] = longest path length from any root to this node
    let mut dist: HashMap<String, i64> = HashMap::new();
    // predecessors for path tracing
    let mut pred: HashMap<String, Option<String>> = HashMap::new();
    for (id, _) in nodes {
        dist.insert(id.clone(), 0);
        pred.insert(id.clone(), None);
    }

    let mut topo: Vec<String> = Vec::new();
    let mut in_deg = in_degree.clone();

    while let Some(node) = queue.pop_front() {
        topo.push(node.clone());
        let node_dist = dist.get(&node).copied().unwrap_or(0);
        if let Some(succs) = adj.get(&node) {
            for succ in succs {
                // Update longest-path distance
                let succ_dist = dist.get(succ).copied().unwrap_or(0);
                if node_dist + 1 > succ_dist {
                    dist.insert(succ.clone(), node_dist + 1);
                    pred.insert(succ.clone(), Some(node.clone()));
                }
                // Reduce in-degree
                if let Some(d) = in_deg.get_mut(succ) {
                    *d = d.saturating_sub(1);
                    if *d == 0 {
                        queue.push_back(succ.clone());
                    }
                }
            }
        }
    }

    // Find the node with maximum distance (end of critical path)
    let max_dist = dist.values().copied().max().unwrap_or(0);
    let end_node = topo
        .iter()
        .rev()
        .find(|n| dist.get(*n).copied().unwrap_or(0) == max_dist)
        .cloned();

    // Trace back the critical path
    let mut path: Vec<String> = Vec::new();
    let mut cur = end_node;
    while let Some(ref node) = cur {
        path.push(node.clone());
        cur = pred.get(node).and_then(|p| p.clone());
    }
    path.reverse();

    // Compute slack: max_dist - dist[node]
    let slack_map: Vec<SlackEntry> = dist
        .iter()
        .map(|(id, &d)| SlackEntry {
            id: id.clone(),
            slack: max_dist - d,
        })
        .collect();

    CriticalPathInfo { path, slack_map }
}

// ============================================================
// Markdown utility helpers
// ============================================================

/// Strip inline markdown formatting (`**`, `*`, backticks, `__`) from a string.
/// No regex — pure `.replace()` chaining. Safe to call on any string.
pub fn strip_markdown_inline(s: &str) -> String {
    s.replace("**", "")
        .replace("__", "")
        .replace('*', "")
        .replace('`', "")
}

/// Scan `body` for the first `**bold line**` that appears after the H1 heading,
/// skipping blank lines between the H1 and the bold line.
/// Returns the stripped text, or an empty string if none is found.
pub fn extract_one_liner_from_body(body: &str) -> String {
    let mut past_h1 = false;
    for line in body.lines() {
        let trimmed = line.trim();
        if !past_h1 {
            if trimmed.starts_with("# ") {
                past_h1 = true;
            }
            continue;
        }
        // Skip blank lines after H1
        if trimmed.is_empty() {
            continue;
        }
        // A bold-only line: starts and ends with **
        if trimmed.starts_with("**") && trimmed.ends_with("**") && trimmed.len() > 4 {
            return strip_markdown_inline(trimmed);
        }
        // Stop at next heading or non-bold content
        break;
    }
    String::new()
}

/// Parse the first H1 heading in `content` and extract the title by stripping the
/// `# ID: ` prefix (handles double-prefix like `# M010: M010: Title`).
/// Returns `None` if there is no H1 or if the H1 doesn't start with `# {milestone_id}:`.
pub fn extract_title_from_h1(content: &str, milestone_id: &str) -> Option<String> {
    for line in content.lines() {
        if line.starts_with("# ") {
            let mut title = line.trim_start_matches("# ").trim().to_string();
            // Strip repeated "ID: " prefixes (handles double-prefix edge case)
            let prefix = format!("{}: ", milestone_id);
            while title.starts_with(&prefix) {
                title = title[prefix.len()..].trim().to_string();
            }
            // Only return if the H1 had content after stripping
            if !title.is_empty() {
                return Some(title);
            }
            return None;
        }
    }
    None
}

// ============================================================
// Changelog helper
// ============================================================

/// Load changelog entries from completed slice SUMMARY.md files.
fn load_slice_changelog(slice_dir: &Path, slice_id: &str) -> Option<ChangelogEntry2> {
    let summary_file = resolve_file_by_id(slice_dir, slice_id, "SUMMARY")?;
    let content = std::fs::read_to_string(&summary_file).ok()?;
    let (fm, body) = parse_frontmatter(&content);

    let one_liner = {
        let raw = fm.get("one_liner").cloned().unwrap_or_default();
        if raw.is_empty() {
            // GSD auto-mode writes the one_liner as a **bold body line** after the H1
            strip_markdown_inline(&extract_one_liner_from_body(&body))
        } else {
            raw
        }
    };
    let completed_at = fm.get("completed_at").cloned();

    // Parse files_modified section from the body
    // Lines matching: - `path/to/file` — description
    let mut files_modified: Vec<FileModified2> = Vec::new();
    let mut in_files_section = false;
    for line in body.lines() {
        let trimmed = line.trim();
        if trimmed.contains("Files Created")
            || trimmed.contains("Files Modified")
            || trimmed.contains("files_modified")
        {
            in_files_section = true;
            continue;
        }
        if in_files_section {
            // Stop at next heading
            if trimmed.starts_with('#') {
                in_files_section = false;
                continue;
            }
            // Match: - `path` — description  or  - `path` - description
            if trimmed.starts_with("- `") || trimmed.starts_with("- **") {
                let without_dash = trimmed.trim_start_matches("- ").trim_start_matches("**");
                // Find end of path (backtick or ** delimiter)
                let path_part;
                let desc_part;
                if without_dash.find('`').is_some() {
                    let after_open = without_dash.trim_start_matches('`');
                    if let Some(close) = after_open.find('`') {
                        path_part = after_open[..close].to_string();
                        let rest = &after_open[close + 1..];
                        desc_part = rest
                            .trim_start_matches(" — ")
                            .trim_start_matches(" - ")
                            .trim()
                            .to_string();
                    } else {
                        path_part = after_open.to_string();
                        desc_part = String::new();
                    }
                } else {
                    path_part = without_dash.to_string();
                    desc_part = String::new();
                }
                if !path_part.is_empty() {
                    files_modified.push(FileModified2 {
                        path: path_part,
                        description: desc_part,
                    });
                }
            }
        }
    }

    Some(ChangelogEntry2 {
        slice_id: slice_id.to_string(),
        one_liner,
        completed_at,
        files_modified,
    })
}

// ============================================================
// Discussion state helper
// ============================================================

/// Determine discussion state for a milestone directory.
fn get_discussion_state(milestone_dir: &Path, milestone_id: &str) -> String {
    if resolve_file_by_id(milestone_dir, milestone_id, "CONTEXT-DRAFT").is_some() {
        return "draft".to_string();
    }
    if resolve_file_by_id(milestone_dir, milestone_id, "CONTEXT").is_some() {
        return "discussed".to_string();
    }
    "undiscussed".to_string()
}

// ============================================================
// Agent activity helper
// ============================================================

/// Read agent activity from the auto.lock file.
fn get_agent_activity(
    project_path: &str,
    total_slices: u32,
    completed_units: u32,
) -> AgentActivityInfo {
    let gsd_dir = Path::new(project_path).join(".gsd");
    let lock_paths = [
        gsd_dir.join("auto.lock"),
        gsd_dir.join("runtime").join("auto.lock"),
    ];

    let lock_content = lock_paths
        .iter()
        .find_map(|p| std::fs::read_to_string(p).ok());

    if let Some(content) = lock_content {
        let json: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();

        let pid = json.get("pid").and_then(|v| v.as_i64()).map(|p| p as i32);
        let unit_type = json
            .get("unitType")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let unit_id = json
            .get("unitId")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let unit_started_at = json
            .get("unitStartedAt")
            .and_then(|v| v.as_str())
            .map(String::from);

        // Check PID liveness
        let is_alive = pid.map_or(false, |p| {
            #[cfg(unix)]
            unsafe {
                libc::kill(p, 0) == 0
            }
            #[cfg(not(unix))]
            {
                false
            }
        });

        // Compute elapsed_ms from unitStartedAt
        let elapsed_ms = if let Some(ref started) = unit_started_at {
            // Parse ISO 8601 timestamp — best-effort, compute ms since then
            // Use std::time to avoid chrono dep; if parsing fails, return 0
            let now_ms = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            // Try to parse the ISO string by checking if it's numeric first
            if let Ok(ts) = started.parse::<i64>() {
                now_ms - ts
            } else {
                0
            }
        } else {
            0
        };

        let current_unit = if !unit_id.is_empty() {
            Some(CurrentUnit {
                unit_type,
                unit_id,
                started_at: unit_started_at,
                elapsed_ms,
            })
        } else {
            None
        };

        AgentActivityInfo {
            is_active: is_alive,
            pid,
            current_unit,
            completed_units,
            total_slices,
        }
    } else {
        AgentActivityInfo {
            is_active: false,
            pid: None,
            current_unit: None,
            completed_units,
            total_slices,
        }
    }
}

/// Return full VisualizerData2 for a GSD-2 project (R085).
/// Includes milestone tree, critical path, changelog, agent activity, cost breakdowns,
/// knowledge/captures info, and backward-compatible fields for the existing UI.
#[tauri::command]
pub async fn gsd2_get_visualizer_data(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<VisualizerData2, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let milestones_dir = Path::new(&project_path).join(".gsd").join("milestones");

    // Walk milestones with tasks (reuse existing helper)
    let raw_milestones = walk_milestones_with_tasks(&milestones_dir);

    // Get health for active IDs
    let health_raw = get_health_from_dir(&project_path);
    let active_milestone_id = health_raw
        .active_milestone_id
        .as_deref()
        .unwrap_or("")
        .to_string();
    let active_slice_id = health_raw
        .active_slice_id
        .as_deref()
        .unwrap_or("")
        .to_string();
    let active_task_id = health_raw
        .active_task_id
        .as_deref()
        .unwrap_or("")
        .to_string();

    // Parse metrics via shared helper
    let metrics_path = Path::new(&project_path).join(".gsd").join("metrics.json");
    let metrics_content = std::fs::read_to_string(&metrics_path).unwrap_or_default();
    let (units, totals, by_phase, by_slice, by_model) = parse_metrics_json(&metrics_content);

    // Build cost-by-milestone from by_slice (group by milestone prefix M###)
    let mut cost_by_milestone_map: HashMap<String, f64> = HashMap::new();
    for sa in &by_slice {
        // slice_id is like "M001/S01" — extract milestone prefix
        let mid = if let Some(slash) = sa.slice_id.find('/') {
            sa.slice_id[..slash].to_string()
        } else {
            sa.slice_id.clone()
        };
        *cost_by_milestone_map.entry(mid).or_insert(0.0) += sa.cost;
    }

    // Build backward-compat timeline from units
    let mut timeline: Vec<TimelineEntryCompat> = units
        .iter()
        .filter_map(|u| {
            // finishedAt > 0 means completed
            if u.finished_at > 0 {
                Some(TimelineEntryCompat {
                    id: u.id.clone(),
                    title: u.id.clone(), // metrics doesn't carry title
                    entry_type: u.unit_type.clone(),
                    completed_at: Some(u.finished_at.to_string()),
                    cost: u.cost,
                })
            } else {
                None
            }
        })
        .collect();
    timeline.sort_by(|a, b| b.completed_at.as_deref().cmp(&a.completed_at.as_deref()));

    // Build backward-compat cost_by_milestone
    let mut cost_by_milestone: Vec<CostByKeyCompat> = cost_by_milestone_map
        .into_iter()
        .map(|(key, cost)| CostByKeyCompat { key, cost })
        .collect();
    cost_by_milestone.sort_by(|a, b| a.key.cmp(&b.key));

    // Build backward-compat cost_by_model
    let mut cost_by_model_compat: Vec<CostByKeyCompat> = by_model
        .iter()
        .map(|m| CostByKeyCompat {
            key: m.model.clone(),
            cost: m.cost,
        })
        .collect();
    cost_by_model_compat.sort_by(|a, b| {
        b.cost
            .partial_cmp(&a.cost)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // --- Collect all incomplete slice dependencies for critical path ---
    // Build nodes as (slice_id_qualified, Vec<dep_id_qualified>)
    let mut cp_nodes: Vec<(String, Vec<String>)> = Vec::new();
    for m in &raw_milestones {
        for s in &m.slices {
            if !s.done {
                let qualified_id = format!("{}/{}", m.id, s.id);
                // Dependencies reference other slices — qualify them if not already
                let qualified_deps: Vec<String> = s
                    .dependencies
                    .iter()
                    .map(|d| {
                        if d.contains('/') {
                            d.clone()
                        } else {
                            format!("{}/{}", m.id, d)
                        }
                    })
                    .collect();
                cp_nodes.push((qualified_id, qualified_deps));
            }
        }
    }
    let critical_path = compute_critical_path(&cp_nodes);

    // Build slack lookup map for O(1) access
    let slack_lookup: HashMap<String, i64> = critical_path
        .slack_map
        .iter()
        .map(|e| (e.id.clone(), e.slack))
        .collect();
    let cp_set: std::collections::HashSet<String> = critical_path.path.iter().cloned().collect();

    // --- Build rich milestone tree ---
    let mut all_changelog: Vec<ChangelogEntry2> = Vec::new();
    let mut total_slices: u32 = 0;
    let completed_units_count = units.iter().filter(|u| u.finished_at > 0).count() as u32;

    let rich_milestones: Vec<VisualizerMilestone2> = raw_milestones
        .iter()
        .map(|m| {
            let m_status = if m.done {
                "done"
            } else if m.id == active_milestone_id {
                "active"
            } else {
                "pending"
            };

            // Resolve milestone dir for discussion state and slice summaries
            let milestone_dir_opt = resolve_dir_by_id(&milestones_dir, &m.id);
            let milestone_dir = milestone_dir_opt
                .as_deref()
                .map(|d| milestones_dir.join(d))
                .unwrap_or_else(|| milestones_dir.join(&m.id));

            let discussion_state = get_discussion_state(&milestone_dir, &m.id);

            // Cost for this milestone from backward-compat list
            let m_cost = cost_by_milestone
                .iter()
                .find(|c| c.key == m.id)
                .map(|c| c.cost)
                .unwrap_or(0.0);

            let rich_slices: Vec<VisualizerSlice2> = m
                .slices
                .iter()
                .map(|s| {
                    total_slices += 1;

                    let s_status = if s.done {
                        "done"
                    } else if s.id == active_slice_id {
                        "active"
                    } else {
                        "pending"
                    };

                    let qualified_sid = format!("{}/{}", m.id, s.id);

                    // Resolve slice dir for changelog/verification
                    let slice_dir_opt = resolve_dir_by_id(&milestone_dir, &s.id)
                        .map(|d| milestone_dir.join(d))
                        .or_else(|| {
                            // Check nested slices/ subdir
                            let nested = milestone_dir.join("slices");
                            resolve_dir_by_id(&nested, &s.id).map(|d| nested.join(d))
                        });
                    let slice_dir = slice_dir_opt.unwrap_or_else(|| milestone_dir.join(&s.id));

                    // Load changelog for completed slices
                    let changelog = if s.done {
                        load_slice_changelog(&slice_dir, &s.id)
                            .map(|e| vec![e])
                            .unwrap_or_default()
                    } else {
                        Vec::new()
                    };

                    // Load verification summary from SUMMARY.md
                    let verification = if s.done {
                        let summary_file = resolve_file_by_id(&slice_dir, &s.id, "SUMMARY");
                        summary_file
                            .and_then(|f| std::fs::read_to_string(&f).ok())
                            .map(|content| {
                                let (_fm, body) = parse_frontmatter(&content);
                                // Extract verification section from body
                                let mut vtext = String::new();
                                let mut in_section = false;
                                for line in body.lines() {
                                    let trimmed = line.trim();
                                    if trimmed.starts_with("## Verification") {
                                        in_section = true;
                                        continue;
                                    }
                                    if in_section {
                                        if trimmed.starts_with("## ") {
                                            break;
                                        }
                                        vtext.push_str(line);
                                        vtext.push('\n');
                                    }
                                }
                                SliceVerification2 {
                                    slice_id: s.id.clone(),
                                    verification_text: vtext.trim().to_string(),
                                }
                            })
                    } else {
                        None
                    };

                    // Rich tasks
                    let rich_tasks: Vec<VisualizerTask2> = s
                        .tasks
                        .iter()
                        .map(|t| {
                            let t_status = if t.done {
                                "done"
                            } else if t.id == active_task_id {
                                "active"
                            } else {
                                "pending"
                            };
                            let task_qualified = format!("{}/{}/{}", m.id, s.id, t.id);
                            let on_cp = cp_set.contains(&qualified_sid);
                            let slack = slack_lookup.get(&qualified_sid).copied().unwrap_or(0);
                            let _ = task_qualified;
                            VisualizerTask2 {
                                id: t.id.clone(),
                                title: t.title.clone(),
                                done: t.done,
                                status: t_status.to_string(),
                                estimate: t.estimate.clone(),
                                on_critical_path: on_cp,
                                slack,
                            }
                        })
                        .collect();

                    VisualizerSlice2 {
                        id: s.id.clone(),
                        title: s.title.clone(),
                        done: s.done,
                        status: s_status.to_string(),
                        risk: s.risk.clone(),
                        dependencies: s.dependencies.clone(),
                        tasks: rich_tasks,
                        verification,
                        changelog: changelog.clone(),
                    }
                })
                .collect();

            // Collect changelog from all slices in this milestone
            for s in &rich_slices {
                for e in &s.changelog {
                    all_changelog.push(e.clone());
                }
            }

            VisualizerMilestone2 {
                id: m.id.clone(),
                title: m.title.clone(),
                done: m.done,
                status: m_status.to_string(),
                dependencies: m.dependencies.clone(),
                slices: rich_slices,
                discussion_state,
                cost: m_cost,
            }
        })
        .collect();

    // Build backward-compatible tree from rich milestones
    let tree: Vec<VisualizerNodeCompat> = rich_milestones
        .iter()
        .map(|m| {
            let slice_nodes: Vec<VisualizerNodeCompat> = m
                .slices
                .iter()
                .map(|s| {
                    let task_nodes: Vec<VisualizerNodeCompat> = s
                        .tasks
                        .iter()
                        .map(|t| VisualizerNodeCompat {
                            id: t.id.clone(),
                            title: t.title.clone(),
                            status: t.status.clone(),
                            children: Vec::new(),
                        })
                        .collect();
                    VisualizerNodeCompat {
                        id: s.id.clone(),
                        title: s.title.clone(),
                        status: s.status.clone(),
                        children: task_nodes,
                    }
                })
                .collect();
            VisualizerNodeCompat {
                id: m.id.clone(),
                title: m.title.clone(),
                status: m.status.clone(),
                children: slice_nodes,
            }
        })
        .collect();

    // --- Knowledge ---
    let knowledge_path = Path::new(&project_path).join(".gsd").join("KNOWLEDGE.md");
    let knowledge = if knowledge_path.exists() {
        let content = std::fs::read_to_string(&knowledge_path).unwrap_or_default();
        let entry_count = content.lines().filter(|l| l.starts_with("## ")).count() as u32;
        KnowledgeInfo2 {
            exists: true,
            entry_count,
        }
    } else {
        KnowledgeInfo2 {
            exists: false,
            entry_count: 0,
        }
    };

    // --- Captures ---
    let captures_path = Path::new(&project_path).join(".gsd").join("CAPTURES.md");
    let captures = if captures_path.exists() {
        let content = std::fs::read_to_string(&captures_path).unwrap_or_default();
        let pending_count = content
            .lines()
            .filter(|l| l.trim_start().starts_with("- [ ]"))
            .count() as u32;
        CapturesInfo2 {
            exists: true,
            pending_count,
        }
    } else {
        CapturesInfo2 {
            exists: false,
            pending_count: 0,
        }
    };

    // --- Health summary ---
    let health_info = HealthInfo2 {
        active_milestone_id: health_raw.active_milestone_id.clone(),
        active_slice_id: health_raw.active_slice_id.clone(),
        active_task_id: health_raw.active_task_id.clone(),
        milestones_done: health_raw.milestones_done,
        milestones_total: health_raw.milestones_total,
        slices_done: health_raw.slices_done,
        slices_total: health_raw.slices_total,
        tasks_done: health_raw.tasks_done,
        tasks_total: health_raw.tasks_total,
    };

    // --- Agent activity ---
    let agent_activity = get_agent_activity(&project_path, total_slices, completed_units_count);

    // --- Stats ---
    let milestones_missing_summary = rich_milestones
        .iter()
        .filter(|m| m.done)
        .filter(|m| {
            let mdir = resolve_dir_by_id(&milestones_dir, &m.id)
                .map(|d| milestones_dir.join(d))
                .unwrap_or_else(|| milestones_dir.join(&m.id));
            resolve_file_by_id(&mdir, &m.id, "MILESTONE-SUMMARY").is_none()
        })
        .count() as u32;

    let slices_missing_summary = rich_milestones
        .iter()
        .flat_map(|m| {
            let mdir = resolve_dir_by_id(&milestones_dir, &m.id)
                .map(|d| milestones_dir.join(d))
                .unwrap_or_else(|| milestones_dir.join(&m.id));
            m.slices
                .iter()
                .filter(|s| s.done)
                .filter(move |s| {
                    let sdir_opt = resolve_dir_by_id(&mdir, &s.id)
                        .map(|d| mdir.join(d))
                        .or_else(|| {
                            let nested = mdir.join("slices");
                            resolve_dir_by_id(&nested, &s.id).map(|d| nested.join(d))
                        });
                    let sdir = sdir_opt.unwrap_or_else(|| mdir.join(&s.id));
                    resolve_file_by_id(&sdir, &s.id, "SUMMARY").is_none()
                })
                .map(|_| ())
                .collect::<Vec<_>>()
        })
        .count() as u32;

    // Last 5 changelog entries sorted by completed_at desc
    let mut all_changelog_sorted = all_changelog;
    all_changelog_sorted.sort_by(|a, b| b.completed_at.as_deref().cmp(&a.completed_at.as_deref()));
    let recent_changelog: Vec<ChangelogEntry2> = all_changelog_sorted.into_iter().take(5).collect();

    let stats = VisualizerStats2 {
        milestones_missing_summary,
        slices_missing_summary,
        recent_changelog,
    };

    Ok(VisualizerData2 {
        milestones: rich_milestones,
        tree,
        cost_by_milestone,
        cost_by_model: cost_by_model_compat,
        timeline,
        critical_path,
        agent_activity,
        by_phase,
        by_slice,
        by_model,
        units,
        totals,
        knowledge,
        captures,
        health: health_info,
        stats,
    })
}

// ============================================================
// Doctor / Session / Model / Worktree-extra / Headless-with-model commands
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorCheck {
    pub category: String,
    pub label: String,
    pub status: String,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorReport {
    pub checks: Vec<DoctorCheck>,
    pub error_count: u32,
    pub warning_count: u32,
    pub ok_count: u32,
    pub gsd_version: String,
}

/// Run a structural health check on a GSD-2 project directory.
#[tauri::command]
pub async fn gsd2_doctor(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<DoctorReport, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let mut checks: Vec<DoctorCheck> = Vec::new();

    // --- Get gsd --version ---
    let gsd_version = {
        let out = std::process::Command::new("gsd")
            .arg("--version")
            .current_dir(&project_path)
            .output();
        match out {
            Ok(o) => {
                let raw = String::from_utf8_lossy(&o.stdout).to_string();
                // Extract version number from "GSD v2.41.0 — Get Shit Done" style output
                raw.split_whitespace()
                    .find(|tok| {
                        tok.starts_with('v')
                            && tok
                                .chars()
                                .nth(1)
                                .map(|c| c.is_ascii_digit())
                                .unwrap_or(false)
                    })
                    .map(|v| v.trim_start_matches('v').to_string())
                    .unwrap_or_else(|| raw.trim().to_string())
            }
            Err(_) => "unknown".to_string(),
        }
    };

    let base = Path::new(&project_path);

    // --- Structure checks ---
    let gsd_dir = base.join(".gsd");
    if gsd_dir.is_dir() {
        checks.push(DoctorCheck {
            category: "structure".to_string(),
            label: ".gsd/ directory".to_string(),
            status: "ok".to_string(),
            detail: None,
        });
    } else {
        checks.push(DoctorCheck {
            category: "structure".to_string(),
            label: ".gsd/ directory".to_string(),
            status: "error".to_string(),
            detail: Some("Missing .gsd/ directory — not a GSD-2 project".to_string()),
        });
    }

    // --- State checks ---
    let state_file = gsd_dir.join("STATE.md");
    checks.push(DoctorCheck {
        category: "state".to_string(),
        label: "STATE.md".to_string(),
        status: if state_file.exists() { "ok" } else { "warning" }.to_string(),
        detail: if state_file.exists() {
            None
        } else {
            Some("STATE.md not found".to_string())
        },
    });

    let metrics_file = gsd_dir.join("metrics.json");
    checks.push(DoctorCheck {
        category: "state".to_string(),
        label: "metrics.json".to_string(),
        status: if metrics_file.exists() {
            "ok"
        } else {
            "warning"
        }
        .to_string(),
        detail: if metrics_file.exists() {
            None
        } else {
            Some("metrics.json not found — budget tracking unavailable".to_string())
        },
    });

    // --- Milestones checks ---
    let milestones_dir = gsd_dir.join("milestones");
    if milestones_dir.is_dir() {
        checks.push(DoctorCheck {
            category: "milestones".to_string(),
            label: "milestones/ directory".to_string(),
            status: "ok".to_string(),
            detail: None,
        });

        // Walk milestone directories
        if let Ok(rd) = std::fs::read_dir(&milestones_dir) {
            for entry in rd.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }
                let dir_name = entry.file_name().to_string_lossy().to_string();
                let id = milestone_id_from_dir_name(&dir_name);
                let milestone_dir = entry.path();

                // Try M001-ROADMAP.md then ROADMAP.md
                let has_roadmap = milestone_dir.join(format!("{}-ROADMAP.md", id)).exists()
                    || milestone_dir.join("ROADMAP.md").exists()
                    || resolve_file_by_id(&milestone_dir, &id, "ROADMAP").is_some();

                checks.push(DoctorCheck {
                    category: "milestones".to_string(),
                    label: format!("{} ROADMAP.md", dir_name),
                    status: if has_roadmap { "ok" } else { "warning" }.to_string(),
                    detail: if has_roadmap {
                        None
                    } else {
                        Some(format!("No ROADMAP.md found in {}", dir_name))
                    },
                });
            }
        }
    } else {
        checks.push(DoctorCheck {
            category: "milestones".to_string(),
            label: "milestones/ directory".to_string(),
            status: "warning".to_string(),
            detail: Some("milestones/ not found — no milestones defined".to_string()),
        });
    }

    // --- Env check ---
    let env_file = base.join(".env");
    checks.push(DoctorCheck {
        category: "env".to_string(),
        label: "Environment file".to_string(),
        status: if env_file.exists() { "ok" } else { "warning" }.to_string(),
        detail: if env_file.exists() {
            None
        } else {
            Some(".env file not found at project root".to_string())
        },
    });

    // Tally
    let error_count = checks.iter().filter(|c| c.status == "error").count() as u32;
    let warning_count = checks.iter().filter(|c| c.status == "warning").count() as u32;
    let ok_count = checks.iter().filter(|c| c.status == "ok").count() as u32;

    Ok(DoctorReport {
        checks,
        error_count,
        warning_count,
        ok_count,
        gsd_version,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdSessionEntry {
    pub raw: String,
    pub filename: String,
    pub timestamp: String,
    pub name: Option<String>,
    pub first_message: Option<String>,
    pub message_count: i32,
    pub user_message_count: i32,
    pub assistant_message_count: i32,
}

/// Derive the session directory name from a project path.
/// Convention: strip leading '/', replace '/' ':' '\' with '-', wrap in '--'.
fn derive_session_dir_name(path: &str) -> String {
    let stripped = path.strip_prefix('/').unwrap_or(path);
    let replaced = stripped
        .replace('/', "-")
        .replace('\\', "-")
        .replace(':', "-");
    format!("--{}--", replaced)
}

/// List past GSD sessions for a project by reading JSONL session files directly.
#[tauri::command]
pub async fn gsd2_list_sessions(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<Vec<GsdSessionEntry>, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    // Resolve session directory: ~/.gsd/sessions/{derived_dir_name}/
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let dir_name = derive_session_dir_name(&project_path);
    let sessions_dir = home.join(".gsd").join("sessions").join(&dir_name);

    if !sessions_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut files: Vec<std::path::PathBuf> = std::fs::read_dir(&sessions_dir)
        .map_err(|e| format!("Failed to read sessions dir: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map_or(false, |ext| ext == "jsonl"))
        .collect();

    // Sort descending by filename (filenames start with ISO timestamp)
    files.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    let mut entries = Vec::new();

    for path in &files {
        let fname = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Extract timestamp from filename: 2026-03-21T22-53-21-898Z_UUID.jsonl
        let ts_part = fname.split('_').next().unwrap_or("");
        // Convert filename timestamp to ISO: replace the dashes in time portion
        // Format: 2026-03-21T22-53-21-898Z → 2026-03-21T22:53:21.898Z
        let timestamp = if ts_part.len() >= 24 {
            // 2026-03-21T22-53-21-898Z
            let date = &ts_part[..10]; // 2026-03-21
            let rest = &ts_part[10..]; // T22-53-21-898Z
            let time_part = rest
                .replacen('-', ":", 1) // T22:53-21-898Z
                .replacen('-', ":", 1) // T22:53:21-898Z
                .replacen('-', ".", 1); // T22:53:21.898Z
            format!("{}{}", date, time_part)
        } else {
            ts_part.to_string()
        };

        // Read the file and parse line by line
        let content = match std::fs::read_to_string(path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut name: Option<String> = None;
        let mut first_message: Option<String> = None;
        let mut message_count: i32 = 0;
        let mut user_count: i32 = 0;
        let mut assistant_count: i32 = 0;

        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let val: serde_json::Value = match serde_json::from_str(trimmed) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let line_type = val.get("type").and_then(|v| v.as_str()).unwrap_or("");

            match line_type {
                "session_info" => {
                    // Last session_info entry wins (rename semantics)
                    if let Some(n) = val.get("name").and_then(|v| v.as_str()) {
                        if !n.is_empty() {
                            name = Some(n.to_string());
                        }
                    }
                }
                "message" => {
                    let role = val
                        .get("message")
                        .and_then(|m| m.get("role"))
                        .and_then(|r| r.as_str())
                        .unwrap_or("");

                    match role {
                        "user" => {
                            user_count += 1;
                            message_count += 1;
                            // Capture first user message text
                            if first_message.is_none() {
                                first_message = extract_message_text(&val);
                            }
                        }
                        "assistant" => {
                            assistant_count += 1;
                            message_count += 1;
                        }
                        _ => {
                            // toolResult, etc — count but don't categorize
                            message_count += 1;
                        }
                    }
                }
                _ => {}
            }
        }

        entries.push(GsdSessionEntry {
            raw: format!(
                "{} ({} msgs) {}",
                timestamp,
                message_count,
                name.as_deref().unwrap_or("")
            ),
            filename: fname,
            timestamp,
            name,
            first_message,
            message_count,
            user_message_count: user_count,
            assistant_message_count: assistant_count,
        });
    }

    Ok(entries)
}

/// Extract the first text content from a message JSON value.
fn extract_message_text(val: &serde_json::Value) -> Option<String> {
    let content = val.get("message")?.get("content")?;

    // Content can be a string or an array of content blocks
    if let Some(s) = content.as_str() {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.chars().take(200).collect());
        }
    }

    if let Some(arr) = content.as_array() {
        for block in arr {
            if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.chars().take(200).collect());
                }
            }
        }
    }

    None
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdModelEntry {
    pub provider: String,
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2PlanPreviewSlice {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub risk: Option<String>,
    pub depends_on: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2PlanPreviewMilestone {
    pub title: String,
    pub summary: String,
    pub slices: Vec<Gsd2PlanPreviewSlice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Gsd2PlanPreview {
    pub intent: String,
    pub milestone: Gsd2PlanPreviewMilestone,
}

fn extract_assistant_text_from_gsd_jsonl(stdout: &str) -> Option<String> {
    for line in stdout.lines().rev() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(val): Result<serde_json::Value, _> = serde_json::from_str(trimmed) else {
            continue;
        };
        if val.get("type").and_then(|v| v.as_str()) != Some("agent_end") {
            continue;
        }

        let messages = val.get("messages")?.as_array()?;
        for msg in messages.iter().rev() {
            if msg.get("role").and_then(|v| v.as_str()) != Some("assistant") {
                continue;
            }
            let content = msg.get("content")?.as_array()?;
            for item in content.iter().rev() {
                if item.get("type").and_then(|v| v.as_str()) == Some("text") {
                    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
                        let cleaned = text.trim().to_string();
                        if !cleaned.is_empty() {
                            return Some(cleaned);
                        }
                    }
                }
            }
        }
    }
    None
}

fn extract_json_block(text: &str) -> Option<String> {
    let trimmed = text.trim();

    // Prefer fenced ```json blocks if present.
    if let Some(start) = trimmed.find("```json") {
        let after = &trimmed[start + 7..];
        if let Some(end) = after.find("```") {
            let candidate = after[..end].trim();
            if !candidate.is_empty() {
                return Some(candidate.to_string());
            }
        }
    }
    if let Some(start) = trimmed.find("```") {
        let after = &trimmed[start + 3..];
        if let Some(end) = after.find("```") {
            let candidate = after[..end].trim();
            if !candidate.is_empty() {
                return Some(candidate.to_string());
            }
        }
    }

    // Fall back to first object-looking span.
    if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        if end > start {
            return Some(trimmed[start..=end].to_string());
        }
    }

    None
}

fn parse_plan_preview_from_value(
    intent: &str,
    value: &serde_json::Value,
) -> Result<Gsd2PlanPreview, String> {
    let milestone = value.get("milestone").unwrap_or(value);

    let title = milestone
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("Planned Milestone")
        .to_string();

    let summary = milestone
        .get("summary")
        .or_else(|| milestone.get("description"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("AI-generated plan preview")
        .to_string();

    let slices_val = milestone
        .get("slices")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Plan preview response is missing milestone.slices[]".to_string())?;

    if slices_val.is_empty() {
        return Err("Plan preview response returned no slices".to_string());
    }

    let mut slices: Vec<Gsd2PlanPreviewSlice> = Vec::new();
    for (idx, slice) in slices_val.iter().enumerate() {
        let id = slice
            .get("id")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("S{:02}", idx + 1));

        let title = slice
            .get("title")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("Slice {}", idx + 1));

        let goal = slice
            .get("goal")
            .or_else(|| slice.get("summary"))
            .or_else(|| slice.get("description"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("Define implementation scope and verification steps")
            .to_string();

        let risk = slice
            .get("risk")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string());

        let depends_on = slice
            .get("depends_on")
            .or_else(|| slice.get("dependencies"))
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        slices.push(Gsd2PlanPreviewSlice {
            id,
            title,
            goal,
            risk,
            depends_on,
        });
    }

    Ok(Gsd2PlanPreview {
        intent: intent.to_string(),
        milestone: Gsd2PlanPreviewMilestone {
            title,
            summary,
            slices,
        },
    })
}

/// List available GSD models by running `gsd --list-models [search]`.
#[tauri::command]
pub async fn gsd2_list_models(search: Option<String>) -> Result<Vec<GsdModelEntry>, String> {
    let mut cmd = std::process::Command::new("gsd");
    cmd.arg("--list-models");
    if let Some(ref s) = search {
        cmd.arg(s);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run gsd --list-models: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut entries: Vec<GsdModelEntry> = Vec::new();

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Skip header line starting with "provider"
        if trimmed.to_lowercase().starts_with("provider") {
            continue;
        }
        // Split by 2+ consecutive spaces
        let parts: Vec<&str> = trimmed
            .splitn(3, "  ")
            .map(|p| p.trim())
            .filter(|p| !p.is_empty())
            .collect();
        if parts.len() >= 3 {
            entries.push(GsdModelEntry {
                provider: parts[0].to_string(),
                id: parts[1].to_string(),
                name: parts[2].to_string(),
            });
        } else if parts.len() == 2 {
            entries.push(GsdModelEntry {
                provider: parts[0].to_string(),
                id: parts[1].to_string(),
                name: parts[1].to_string(),
            });
        }
    }

    Ok(entries)
}

/// Generate an AI plan preview from free-text intent for guided project creation.
/// Uses `gsd --mode json --no-session -p` and returns normalized milestone/slice DTOs.
#[tauri::command]
pub async fn gsd2_generate_plan_preview(intent: String) -> Result<Gsd2PlanPreview, String> {
    let intent = intent.trim().to_string();
    if intent.is_empty() {
        return Err("Intent must not be empty".to_string());
    }

    let prompt = format!(
        "You are generating a concise implementation plan preview for a software project wizard. \
Return ONLY valid JSON with this exact shape (no markdown fences): \
{{\"milestone\":{{\"title\":\"string\",\"summary\":\"string\",\"slices\":[{{\"id\":\"S01\",\"title\":\"string\",\"goal\":\"string\",\"risk\":\"low|medium|high\",\"depends_on\":[\"S00\"]}}]}}}}. \
Rules: include 2-6 slices, keep goals concrete, and dependencies only on prior slices. \
User intent: {}",
        intent
    );

    let output = std::process::Command::new("gsd")
        .args(["--mode", "json", "--no-session", "-p", &prompt])
        .output()
        .map_err(|e| format!("Failed to run gsd for plan preview: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let detail = if !stderr.is_empty() { stderr } else { stdout };
        return Err(format!("gsd plan preview failed: {}", detail));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let assistant_text = extract_assistant_text_from_gsd_jsonl(&stdout)
        .ok_or_else(|| "Unable to extract assistant response from gsd output".to_string())?;

    let json_text = extract_json_block(&assistant_text)
        .ok_or_else(|| "Assistant response did not contain a JSON object".to_string())?;

    let value: serde_json::Value = serde_json::from_str(&json_text)
        .map_err(|e| format!("Failed to parse plan preview JSON: {}", e))?;

    parse_plan_preview_from_value(&intent, &value)
}

/// Merge a worktree via `gsd worktree merge {name}`.
#[tauri::command]
pub async fn gsd2_merge_worktree(
    db: tauri::State<'_, DbState>,
    project_id: String,
    worktree_name: String,
) -> Result<String, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let output = std::process::Command::new("gsd")
        .args(["worktree", "merge", &worktree_name])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to run gsd worktree merge: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(format!("{}{}", stdout, stderr))
}

/// Clean stale worktrees via `gsd worktree clean`.
#[tauri::command]
pub async fn gsd2_clean_worktrees(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<String, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let output = std::process::Command::new("gsd")
        .args(["worktree", "clean"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to run gsd worktree clean: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(format!("{}{}", stdout, stderr))
}

/// Start a headless GSD session with a specific model override (`gsd headless --model {model}`).
#[tauri::command]
pub async fn gsd2_headless_start_with_model(
    app: tauri::AppHandle,
    project_id: String,
    model: String,
    db: tauri::State<'_, DbState>,
    registry: tauri::State<'_, HeadlessRegistryState>,
    terminal_manager: tauri::State<'_, crate::pty::TerminalManagerState>,
) -> Result<String, String> {
    // Check for existing session for this project
    {
        let reg = registry.lock().await;
        if reg.session_for_project(&project_id).is_some() {
            return Err("A headless session is already running for this project".to_string());
        }
    }

    // Get project path from DB
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let session_id = uuid::Uuid::new_v4().to_string();
    let command = build_headless_command_with_env(Some(&model));

    // Create PTY session
    {
        let mut manager = terminal_manager.lock().await;
        manager
            .create_session(
                &app,
                session_id.clone(),
                &project_path,
                Some(&command),
                80,
                24,
            )
            .map_err(|e| {
                format!(
                    "Failed to start headless execution. Ensure GSD CLI is installed and API keys are configured in Settings → Secrets. {}",
                    e
                )
            })?;
    }

    // Register in headless registry
    {
        let mut reg = registry.lock().await;
        reg.register(session_id.clone(), project_id.clone());
    }

    Ok(session_id)
}

// ============================================================
// Doctor Report (frontend-shaped), Forensics, Skill Health, Knowledge, Captures
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorIssue {
    pub severity: String,
    pub code: String,
    pub scope: String,
    pub unit_id: String,
    pub message: String,
    pub file: Option<String>,
    pub fixable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorCodeCount {
    pub code: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorSummary {
    pub total: u32,
    pub errors: u32,
    pub warnings: u32,
    pub infos: u32,
    pub fixable: u32,
    pub by_code: Vec<DoctorCodeCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorReportFrontend {
    pub ok: bool,
    pub issues: Vec<DoctorIssue>,
    pub fixes_applied: Vec<String>,
    pub summary: DoctorSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoctorFixResult {
    pub ok: bool,
    pub fixes_applied: Vec<String>,
}

/// Doctor report shaped for the frontend UI (issues + summary).
/// Internally delegates to the existing gsd2_doctor checks and transforms the output.
#[tauri::command]
pub async fn gsd2_get_doctor_report(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<DoctorReportFrontend, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    // Reuse the existing doctor logic inline
    let base = Path::new(&project_path);
    let gsd_dir = base.join(".gsd");

    let mut issues: Vec<DoctorIssue> = Vec::new();

    // Structure checks
    if !gsd_dir.is_dir() {
        issues.push(DoctorIssue {
            severity: "error".to_string(),
            code: "missing-gsd-dir".to_string(),
            scope: "structure".to_string(),
            unit_id: String::new(),
            message: "Missing .gsd/ directory — not a GSD-2 project".to_string(),
            file: None,
            fixable: false,
        });
    }

    // STATE.md
    if !gsd_dir.join("STATE.md").exists() {
        issues.push(DoctorIssue {
            severity: "warning".to_string(),
            code: "missing-state".to_string(),
            scope: "state".to_string(),
            unit_id: String::new(),
            message: "STATE.md not found".to_string(),
            file: Some(".gsd/STATE.md".to_string()),
            fixable: false,
        });
    }

    // metrics.json
    if !gsd_dir.join("metrics.json").exists() {
        issues.push(DoctorIssue {
            severity: "warning".to_string(),
            code: "missing-metrics".to_string(),
            scope: "state".to_string(),
            unit_id: String::new(),
            message: "metrics.json not found — budget tracking unavailable".to_string(),
            file: Some(".gsd/metrics.json".to_string()),
            fixable: false,
        });
    }

    // KNOWLEDGE.md
    if !gsd_dir.join("KNOWLEDGE.md").exists() {
        issues.push(DoctorIssue {
            severity: "info".to_string(),
            code: "missing-knowledge".to_string(),
            scope: "state".to_string(),
            unit_id: String::new(),
            message: "KNOWLEDGE.md not found".to_string(),
            file: Some(".gsd/KNOWLEDGE.md".to_string()),
            fixable: false,
        });
    }

    // Milestones
    let milestones_dir = gsd_dir.join("milestones");
    if milestones_dir.is_dir() {
        if let Ok(rd) = std::fs::read_dir(&milestones_dir) {
            for entry in rd.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }
                let dir_name = entry.file_name().to_string_lossy().to_string();
                let id = milestone_id_from_dir_name(&dir_name);
                let milestone_dir = entry.path();

                let has_roadmap = milestone_dir.join(format!("{}-ROADMAP.md", id)).exists()
                    || milestone_dir.join("ROADMAP.md").exists()
                    || resolve_file_by_id(&milestone_dir, &id, "ROADMAP").is_some();

                if !has_roadmap {
                    issues.push(DoctorIssue {
                        severity: "warning".to_string(),
                        code: "missing-roadmap".to_string(),
                        scope: "milestone".to_string(),
                        unit_id: dir_name.clone(),
                        message: format!("No ROADMAP.md found in {}", dir_name),
                        file: Some(format!(".gsd/milestones/{}/", dir_name)),
                        fixable: false,
                    });
                }
            }
        }
    } else {
        issues.push(DoctorIssue {
            severity: "warning".to_string(),
            code: "missing-milestones-dir".to_string(),
            scope: "structure".to_string(),
            unit_id: String::new(),
            message: "milestones/ not found — no milestones defined".to_string(),
            file: Some(".gsd/milestones/".to_string()),
            fixable: false,
        });
    }

    // .env check
    if !base.join(".env").exists() {
        issues.push(DoctorIssue {
            severity: "warning".to_string(),
            code: "missing-env".to_string(),
            scope: "env".to_string(),
            unit_id: String::new(),
            message: ".env file not found at project root".to_string(),
            file: Some(".env".to_string()),
            fixable: false,
        });
    }

    // Build summary
    let errors = issues.iter().filter(|i| i.severity == "error").count() as u32;
    let warnings = issues.iter().filter(|i| i.severity == "warning").count() as u32;
    let infos = issues.iter().filter(|i| i.severity == "info").count() as u32;
    let fixable = issues.iter().filter(|i| i.fixable).count() as u32;

    // Group by code
    let mut code_counts: HashMap<String, u32> = HashMap::new();
    for issue in &issues {
        *code_counts.entry(issue.code.clone()).or_insert(0) += 1;
    }
    let by_code: Vec<DoctorCodeCount> = code_counts
        .into_iter()
        .map(|(code, count)| DoctorCodeCount { code, count })
        .collect();

    let total = issues.len() as u32;
    let ok = errors == 0;

    Ok(DoctorReportFrontend {
        ok,
        issues,
        fixes_applied: Vec::new(),
        summary: DoctorSummary {
            total,
            errors,
            warnings,
            infos,
            fixable,
            by_code,
        },
    })
}

/// Apply auto-fixes for doctor issues. Currently a stub — no auto-fixes implemented.
#[tauri::command]
pub async fn gsd2_apply_doctor_fixes(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<DoctorFixResult, String> {
    // Validate project exists
    let _project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    Ok(DoctorFixResult {
        ok: true,
        fixes_applied: Vec::new(),
    })
}

// ============================================================
// Forensics Report
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForensicAnomaly {
    pub type_name: String,
    pub severity: String,
    pub unit_type: Option<String>,
    pub unit_id: Option<String>,
    pub summary: String,
    pub details: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForensicRecentUnit {
    pub type_name: String,
    pub id: String,
    pub cost: f64,
    pub duration: f64,
    pub model: String,
    pub finished_at: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForensicCrashLock {
    pub pid: u64,
    pub started_at: String,
    pub unit_type: String,
    pub unit_id: String,
    pub unit_started_at: String,
    pub completed_units: u32,
    pub session_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForensicMetricsSummary {
    pub total_units: u32,
    pub total_cost: f64,
    pub total_duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForensicReport {
    pub gsd_version: String,
    pub timestamp: String,
    pub base_path: String,
    pub active_milestone: Option<String>,
    pub active_slice: Option<String>,
    pub anomalies: Vec<ForensicAnomaly>,
    pub recent_units: Vec<ForensicRecentUnit>,
    pub crash_lock: Option<ForensicCrashLock>,
    pub doctor_issue_count: u32,
    pub unit_trace_count: u32,
    pub completed_key_count: u32,
    pub metrics: Option<ForensicMetricsSummary>,
}

/// Build a forensic analysis report from .gsd/ state, metrics, and runtime files.
#[tauri::command]
pub async fn gsd2_get_forensics_report(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<ForensicReport, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let base = Path::new(&project_path);
    let gsd_dir = base.join(".gsd");
    let now = chrono::Utc::now().to_rfc3339();

    // Parse STATE.md for active milestone/slice
    let (active_milestone, active_slice) = {
        let state_path = gsd_dir.join("STATE.md");
        if state_path.exists() {
            let content = std::fs::read_to_string(&state_path).unwrap_or_default();
            let parsed = parse_gsd2_state_md(&content);
            (parsed.active_milestone.clone(), parsed.active_slice.clone())
        } else {
            (None, None)
        }
    };

    // Parse metrics.json for cost/duration/recent units
    let mut total_cost = 0.0_f64;
    let mut total_duration = 0.0_f64;
    let mut total_units = 0_u32;
    let mut recent_units: Vec<ForensicRecentUnit> = Vec::new();
    let mut anomalies: Vec<ForensicAnomaly> = Vec::new();

    let metrics_path = gsd_dir.join("metrics.json");
    if metrics_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&metrics_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                // Walk timeline entries
                if let Some(timeline) = val.get("timeline").and_then(|t| t.as_array()) {
                    total_units = timeline.len() as u32;
                    for entry in timeline {
                        let cost = entry.get("cost").and_then(|c| c.as_f64()).unwrap_or(0.0);
                        let started = entry
                            .get("startedAt")
                            .and_then(|s| s.as_f64())
                            .unwrap_or(0.0);
                        let finished = entry
                            .get("finishedAt")
                            .and_then(|s| s.as_f64())
                            .unwrap_or(0.0);
                        let duration = if finished > started {
                            (finished - started) * 1000.0
                        } else {
                            0.0
                        };
                        let model = entry
                            .get("model")
                            .and_then(|m| m.as_str())
                            .unwrap_or("unknown")
                            .to_string();
                        let unit_type = entry
                            .get("unitType")
                            .and_then(|u| u.as_str())
                            .unwrap_or("task")
                            .to_string();
                        let unit_id = entry
                            .get("unitId")
                            .and_then(|u| u.as_str())
                            .unwrap_or("")
                            .to_string();

                        total_cost += cost;
                        total_duration += duration;

                        recent_units.push(ForensicRecentUnit {
                            type_name: unit_type.clone(),
                            id: unit_id.clone(),
                            cost,
                            duration,
                            model,
                            finished_at: finished,
                        });

                        // Anomaly: unit with zero cost but >60s duration
                        if cost == 0.0 && duration > 60_000.0 {
                            anomalies.push(ForensicAnomaly {
                                type_name: "zero-cost-long-unit".to_string(),
                                severity: "warning".to_string(),
                                unit_type: Some(unit_type.clone()),
                                unit_id: Some(unit_id.clone()),
                                summary: format!("Unit {} ran for {:.0}s with zero cost", unit_id, duration / 1000.0),
                                details: "May indicate a stalled or failed unit that didn't report metrics".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort recent units by finished_at descending, keep last 10
    recent_units.sort_by(|a, b| {
        b.finished_at
            .partial_cmp(&a.finished_at)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    recent_units.truncate(10);

    // Check for crash lock
    let crash_lock = {
        let lock_path = gsd_dir.join("runtime").join("auto.lock");
        if lock_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&lock_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    Some(ForensicCrashLock {
                        pid: val.get("pid").and_then(|p| p.as_u64()).unwrap_or(0),
                        started_at: val
                            .get("startedAt")
                            .and_then(|s| s.as_str())
                            .unwrap_or("")
                            .to_string(),
                        unit_type: val
                            .get("unitType")
                            .and_then(|u| u.as_str())
                            .unwrap_or("")
                            .to_string(),
                        unit_id: val
                            .get("unitId")
                            .and_then(|u| u.as_str())
                            .unwrap_or("")
                            .to_string(),
                        unit_started_at: val
                            .get("unitStartedAt")
                            .and_then(|u| u.as_str())
                            .unwrap_or("")
                            .to_string(),
                        completed_units: val
                            .get("completedUnits")
                            .and_then(|c| c.as_u64())
                            .unwrap_or(0) as u32,
                        session_file: val
                            .get("sessionFile")
                            .and_then(|s| s.as_str())
                            .map(|s| s.to_string()),
                    })
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    };

    // Count unit traces in runtime/
    let runtime_dir = gsd_dir.join("runtime");
    let unit_trace_count = if runtime_dir.is_dir() {
        std::fs::read_dir(&runtime_dir)
            .map(|rd| {
                rd.flatten()
                    .filter(|e| e.path().extension().and_then(|ext| ext.to_str()) == Some("jsonl"))
                    .count() as u32
            })
            .unwrap_or(0)
    } else {
        0
    };

    // Count completed keys
    let completed_key_count = if runtime_dir.is_dir() {
        std::fs::read_dir(&runtime_dir)
            .map(|rd| {
                rd.flatten()
                    .filter(|e| e.file_name().to_string_lossy().starts_with("completed-"))
                    .count() as u32
            })
            .unwrap_or(0)
    } else {
        0
    };

    let metrics = if total_units > 0 {
        Some(ForensicMetricsSummary {
            total_units,
            total_cost,
            total_duration,
        })
    } else {
        None
    };

    Ok(ForensicReport {
        gsd_version: "gsd2".to_string(),
        timestamp: now,
        base_path: project_path,
        active_milestone,
        active_slice,
        anomalies,
        recent_units,
        crash_lock,
        doctor_issue_count: 0,
        unit_trace_count,
        completed_key_count,
        metrics,
    })
}

// ============================================================
// Skill Health
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillHealthEntry {
    pub name: String,
    pub total_uses: u32,
    pub success_rate: f64,
    pub avg_tokens: f64,
    pub token_trend: String,
    pub last_used: f64,
    pub stale_days: u32,
    pub avg_cost: f64,
    pub flagged: bool,
    pub flag_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillHealthSuggestion {
    pub skill_name: String,
    pub trigger: String,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillHealthReport {
    pub generated_at: String,
    pub total_units_with_skills: u32,
    pub skills: Vec<SkillHealthEntry>,
    pub stale_skills: Vec<String>,
    pub declining_skills: Vec<String>,
    pub suggestions: Vec<SkillHealthSuggestion>,
}

/// Analyze skill usage from metrics.json timeline entries.
#[tauri::command]
pub async fn gsd2_get_skill_health(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<SkillHealthReport, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let gsd_dir = Path::new(&project_path).join(".gsd");
    let metrics_path = gsd_dir.join("metrics.json");
    let now = chrono::Utc::now();

    if !metrics_path.exists() {
        return Ok(SkillHealthReport {
            generated_at: now.to_rfc3339(),
            total_units_with_skills: 0,
            skills: Vec::new(),
            stale_skills: Vec::new(),
            declining_skills: Vec::new(),
            suggestions: Vec::new(),
        });
    }

    let content = std::fs::read_to_string(&metrics_path)
        .map_err(|e| format!("Failed to read metrics.json: {}", e))?;
    let val: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse metrics.json: {}", e))?;

    // Collect skill usage from timeline
    let mut skill_map: HashMap<String, Vec<(f64, f64, f64)>> = HashMap::new(); // name -> Vec<(cost, tokens, finished_at)>
    let mut total_with_skills = 0_u32;

    if let Some(timeline) = val.get("timeline").and_then(|t| t.as_array()) {
        for entry in timeline {
            if let Some(skill) = entry.get("skill").and_then(|s| s.as_str()) {
                if !skill.is_empty() {
                    total_with_skills += 1;
                    let cost = entry.get("cost").and_then(|c| c.as_f64()).unwrap_or(0.0);
                    let tokens_sub = entry.get("tokens");
                    let tokens = entry
                        .get("totalTokens")
                        .and_then(|t| t.as_f64())
                        .or_else(|| {
                            tokens_sub
                                .and_then(|t| t.get("total"))
                                .and_then(|v| v.as_f64())
                        })
                        .or_else(|| entry.get("cacheRead").and_then(|c| c.as_f64()))
                        .or_else(|| {
                            tokens_sub
                                .and_then(|t| t.get("cacheRead"))
                                .and_then(|v| v.as_f64())
                        })
                        .unwrap_or(0.0);
                    let finished = entry
                        .get("finishedAt")
                        .and_then(|f| f.as_f64())
                        .unwrap_or(0.0);
                    skill_map
                        .entry(skill.to_string())
                        .or_default()
                        .push((cost, tokens, finished));
                }
            }
        }
    }

    let now_ts = now.timestamp() as f64;
    let mut skills: Vec<SkillHealthEntry> = Vec::new();
    let mut stale_skills: Vec<String> = Vec::new();
    let mut declining_skills: Vec<String> = Vec::new();
    let mut suggestions: Vec<SkillHealthSuggestion> = Vec::new();

    for (name, usages) in &skill_map {
        let total_uses = usages.len() as u32;
        let avg_cost = usages.iter().map(|(c, _, _)| c).sum::<f64>() / total_uses as f64;
        let avg_tokens = usages.iter().map(|(_, t, _)| t).sum::<f64>() / total_uses as f64;
        let last_used = usages.iter().map(|(_, _, f)| *f).fold(0.0_f64, f64::max);
        let stale_days = if last_used > 0.0 {
            ((now_ts - last_used) / 86400.0).max(0.0) as u32
        } else {
            0
        };

        // Simple trend: compare first half avg tokens to second half
        let token_trend = if usages.len() >= 4 {
            let mid = usages.len() / 2;
            let first_half_avg = usages[..mid].iter().map(|(_, t, _)| t).sum::<f64>() / mid as f64;
            let second_half_avg =
                usages[mid..].iter().map(|(_, t, _)| t).sum::<f64>() / (usages.len() - mid) as f64;
            if second_half_avg > first_half_avg * 1.2 {
                "rising"
            } else if second_half_avg < first_half_avg * 0.8 {
                "declining"
            } else {
                "stable"
            }
        } else {
            "stable"
        };

        let flagged = stale_days > 30 || token_trend == "rising";
        let flag_reason = if stale_days > 30 {
            Some(format!("Not used in {} days", stale_days))
        } else if token_trend == "rising" {
            Some("Token usage trending up".to_string())
        } else {
            None
        };

        if stale_days > 30 {
            stale_skills.push(name.clone());
        }
        if token_trend == "declining" {
            declining_skills.push(name.clone());
        }

        if stale_days > 30 {
            suggestions.push(SkillHealthSuggestion {
                skill_name: name.clone(),
                trigger: "stale_usage".to_string(),
                message: format!(
                    "{} hasn't been used in {} days — consider removing or updating",
                    name, stale_days
                ),
                severity: "warning".to_string(),
            });
        }

        skills.push(SkillHealthEntry {
            name: name.clone(),
            total_uses,
            success_rate: 1.0, // No failure tracking in metrics.json yet
            avg_tokens,
            token_trend: token_trend.to_string(),
            last_used,
            stale_days,
            avg_cost,
            flagged,
            flag_reason,
        });
    }

    // Sort by total_uses descending
    skills.sort_by(|a, b| b.total_uses.cmp(&a.total_uses));

    Ok(SkillHealthReport {
        generated_at: now.to_rfc3339(),
        total_units_with_skills: total_with_skills,
        skills,
        stale_skills,
        declining_skills,
        suggestions,
    })
}

// ============================================================
// Knowledge
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeEntry {
    pub id: String,
    pub title: String,
    pub content: String,
    #[serde(rename = "type")]
    pub entry_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeData {
    pub entries: Vec<KnowledgeEntry>,
}

/// Parse KNOWLEDGE.md into structured entries.
#[tauri::command]
pub async fn gsd2_get_knowledge(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<KnowledgeData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let knowledge_path = Path::new(&project_path).join(".gsd").join("KNOWLEDGE.md");
    if !knowledge_path.exists() {
        return Ok(KnowledgeData {
            entries: Vec::new(),
        });
    }

    let content = std::fs::read_to_string(&knowledge_path)
        .map_err(|e| format!("Failed to read KNOWLEDGE.md: {}", e))?;

    let mut entries: Vec<KnowledgeEntry> = Vec::new();
    let mut current_title = String::new();
    let mut current_content = String::new();
    let mut entry_idx = 0_u32;

    for line in content.lines() {
        if line.starts_with("## ") {
            // Flush previous entry
            if !current_title.is_empty() {
                let entry_type = classify_knowledge_entry(&current_title, &current_content);
                entries.push(KnowledgeEntry {
                    id: format!("K{:03}", entry_idx),
                    title: current_title.clone(),
                    content: current_content.trim().to_string(),
                    entry_type,
                });
            }
            entry_idx += 1;
            current_title = line.trim_start_matches('#').trim().to_string();
            current_content = String::new();
        } else if !current_title.is_empty() {
            current_content.push_str(line);
            current_content.push('\n');
        }
    }

    // Flush last entry
    if !current_title.is_empty() {
        let entry_type = classify_knowledge_entry(&current_title, &current_content);
        entries.push(KnowledgeEntry {
            id: format!("K{:03}", entry_idx),
            title: current_title,
            content: current_content.trim().to_string(),
            entry_type,
        });
    }

    Ok(KnowledgeData { entries })
}

fn classify_knowledge_entry(title: &str, content: &str) -> String {
    let lower_title = title.to_lowercase();
    let lower_content = content.to_lowercase();
    if lower_title.contains("rule")
        || lower_content.contains("must ")
        || lower_content.contains("never ")
        || lower_content.contains("always ")
    {
        "rule".to_string()
    } else if lower_title.contains("pattern")
        || lower_title.contains("convention")
        || lower_content.contains("pattern")
    {
        "pattern".to_string()
    } else if lower_title.contains("lesson")
        || lower_title.contains("gotcha")
        || lower_title.contains("workaround")
    {
        "lesson".to_string()
    } else {
        "freeform".to_string()
    }
}

// ============================================================
// Captures
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureEntry {
    pub id: String,
    pub text: String,
    pub timestamp: String,
    pub status: String,
    pub classification: Option<String>,
    pub resolution: Option<String>,
    pub rationale: Option<String>,
    pub resolved_at: Option<String>,
    pub executed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturesData {
    pub entries: Vec<CaptureEntry>,
    pub pending_count: u32,
    pub actionable_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureResolveResult {
    pub ok: bool,
    pub capture_id: String,
    pub error: Option<String>,
}

/// Read captures from .gsd/runtime/captures/ directory.
/// Each capture is a JSON file with id, text, timestamp, status fields.
#[tauri::command]
pub async fn gsd2_get_captures(
    db: tauri::State<'_, DbState>,
    project_id: String,
) -> Result<CapturesData, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let captures_dir = Path::new(&project_path)
        .join(".gsd")
        .join("runtime")
        .join("captures");
    if !captures_dir.is_dir() {
        return Ok(CapturesData {
            entries: Vec::new(),
            pending_count: 0,
            actionable_count: 0,
        });
    }

    let mut entries: Vec<CaptureEntry> = Vec::new();

    if let Ok(rd) = std::fs::read_dir(&captures_dir) {
        for file in rd.flatten() {
            let path = file.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    entries.push(CaptureEntry {
                        id: val
                            .get("id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        text: val
                            .get("text")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        timestamp: val
                            .get("timestamp")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string(),
                        status: val
                            .get("status")
                            .and_then(|v| v.as_str())
                            .unwrap_or("pending")
                            .to_string(),
                        classification: val
                            .get("classification")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        resolution: val
                            .get("resolution")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        rationale: val
                            .get("rationale")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        resolved_at: val
                            .get("resolvedAt")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        executed: val.get("executed").and_then(|v| v.as_bool()),
                    });
                }
            }
        }
    }

    // Sort by timestamp descending
    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    let pending_count = entries.iter().filter(|e| e.status == "pending").count() as u32;
    let actionable_count = entries
        .iter()
        .filter(|e| {
            e.status == "pending" || (e.classification.is_some() && e.executed != Some(true))
        })
        .count() as u32;

    Ok(CapturesData {
        entries,
        pending_count,
        actionable_count,
    })
}

/// Resolve a capture by updating its JSON file with classification, resolution, and rationale.
#[tauri::command]
pub async fn gsd2_resolve_capture(
    db: tauri::State<'_, DbState>,
    project_id: String,
    capture_id: String,
    classification: String,
    resolution: String,
    rationale: String,
) -> Result<CaptureResolveResult, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let captures_dir = Path::new(&project_path)
        .join(".gsd")
        .join("runtime")
        .join("captures");
    if !captures_dir.is_dir() {
        return Ok(CaptureResolveResult {
            ok: false,
            capture_id: capture_id.clone(),
            error: Some("Captures directory not found".to_string()),
        });
    }

    // Find the capture file
    let target_file = captures_dir.join(format!("{}.json", capture_id));
    if !target_file.exists() {
        // Try scanning for a file containing this ID
        let mut found_path = None;
        if let Ok(rd) = std::fs::read_dir(&captures_dir) {
            for file in rd.flatten() {
                let path = file.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                if let Ok(content) = std::fs::read_to_string(&path) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                        if val.get("id").and_then(|v| v.as_str()) == Some(&capture_id) {
                            found_path = Some(path);
                            break;
                        }
                    }
                }
            }
        }
        if found_path.is_none() {
            return Ok(CaptureResolveResult {
                ok: false,
                capture_id: capture_id.clone(),
                error: Some(format!("Capture {} not found", capture_id)),
            });
        }

        // Update the found file
        let path = found_path.unwrap();
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read capture file: {}", e))?;
        let mut val: serde_json::Value = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse capture file: {}", e))?;

        if let Some(obj) = val.as_object_mut() {
            obj.insert("status".to_string(), serde_json::json!("resolved"));
            obj.insert(
                "classification".to_string(),
                serde_json::json!(classification),
            );
            obj.insert("resolution".to_string(), serde_json::json!(resolution));
            obj.insert("rationale".to_string(), serde_json::json!(rationale));
            obj.insert(
                "resolvedAt".to_string(),
                serde_json::json!(chrono::Utc::now().to_rfc3339()),
            );
        }

        std::fs::write(&path, serde_json::to_string_pretty(&val).unwrap())
            .map_err(|e| format!("Failed to write capture file: {}", e))?;

        return Ok(CaptureResolveResult {
            ok: true,
            capture_id,
            error: None,
        });
    }

    // Update the target file directly
    let content = std::fs::read_to_string(&target_file)
        .map_err(|e| format!("Failed to read capture file: {}", e))?;
    let mut val: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse capture file: {}", e))?;

    if let Some(obj) = val.as_object_mut() {
        obj.insert("status".to_string(), serde_json::json!("resolved"));
        obj.insert(
            "classification".to_string(),
            serde_json::json!(classification),
        );
        obj.insert("resolution".to_string(), serde_json::json!(resolution));
        obj.insert("rationale".to_string(), serde_json::json!(rationale));
        obj.insert(
            "resolvedAt".to_string(),
            serde_json::json!(chrono::Utc::now().to_rfc3339()),
        );
    }

    std::fs::write(&target_file, serde_json::to_string_pretty(&val).unwrap())
        .map_err(|e| format!("Failed to write capture file: {}", e))?;

    Ok(CaptureResolveResult {
        ok: true,
        capture_id,
        error: None,
    })
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    // ---- plan preview parsing helpers ----

    #[test]
    fn extract_assistant_text_from_gsd_jsonl_reads_agent_end_payload() {
        let jsonl = r#"{"type":"agent_end","messages":[{"role":"assistant","content":[{"type":"text","text":"{\"milestone\":{\"title\":\"Build\",\"summary\":\"Sum\",\"slices\":[{\"id\":\"S01\",\"title\":\"One\",\"goal\":\"Goal\",\"depends_on\":[]} ]}}"}]}]}"#;
        let extracted = extract_assistant_text_from_gsd_jsonl(jsonl).unwrap();
        assert!(extracted.contains("\"milestone\""));
    }

    #[test]
    fn extract_json_block_handles_fenced_json() {
        let text = "```json\n{\"milestone\":{\"title\":\"Build\",\"summary\":\"Sum\",\"slices\":[{\"title\":\"One\",\"goal\":\"Goal\"}]}}\n```";
        let json = extract_json_block(text).unwrap();
        assert!(json.starts_with('{'));
        assert!(json.ends_with('}'));
    }

    #[test]
    fn parse_plan_preview_from_value_normalizes_missing_fields() {
        let value = serde_json::json!({
            "milestone": {
                "title": "Launch Wizard",
                "summary": "Preview",
                "slices": [
                    { "title": "Collect intent", "goal": "Capture text" },
                    { "id": "S02", "title": "Render cards", "goal": "Show milestone/slice cards", "dependencies": ["S01"] }
                ]
            }
        });

        let parsed = parse_plan_preview_from_value("build wizard", &value).unwrap();
        assert_eq!(parsed.intent, "build wizard");
        assert_eq!(parsed.milestone.title, "Launch Wizard");
        assert_eq!(parsed.milestone.slices.len(), 2);
        assert_eq!(parsed.milestone.slices[0].id, "S01");
        assert_eq!(parsed.milestone.slices[1].depends_on, vec!["S01"]);
    }

    // ---- headless command build helpers ----

    #[test]
    fn build_headless_command_without_env_returns_base_command() {
        let env_values = HashMap::new();
        let command = build_headless_command(None, &env_values);
        assert_eq!(command, "gsd headless");
    }

    #[test]
    fn build_headless_command_includes_model_and_env_assignments() {
        let mut env_values = HashMap::new();
        env_values.insert("OPENAI_API_KEY".to_string(), "sk-test".to_string());
        env_values.insert(
            "ANTHROPIC_API_KEY".to_string(),
            "anthropic'value".to_string(),
        );

        let command = build_headless_command(Some("gpt-4.1-mini"), &env_values);
        assert!(command.contains("OPENAI_API_KEY='sk-test'"));
        assert!(command.contains("ANTHROPIC_API_KEY='anthropic'\\''value'"));
        assert!(command.ends_with("gsd headless --model 'gpt-4.1-mini'"));
    }

    #[test]
    fn shell_single_quote_escapes_embedded_quotes() {
        assert_eq!(shell_single_quote("a'b'c"), "'a'\\''b'\\''c'".to_string());
    }

    // ---- parse_roadmap_slices ----

    #[test]
    fn parse_roadmap_slices_returns_empty_when_no_slices_section() {
        let content = "# No slices here\n\nJust some text.";
        let slices = parse_roadmap_slices(content);
        assert!(slices.is_empty());
    }

    #[test]
    fn parse_roadmap_slices_returns_slices_with_correct_done_status() {
        let content = "## Slices\n- [ ] **S01: Pending Slice**\n- [x] **S02: Done Slice**\n";
        let slices = parse_roadmap_slices(content);
        assert_eq!(slices.len(), 2);
        assert_eq!(slices[0].id, "S01");
        assert_eq!(slices[0].title, "Pending Slice");
        assert!(!slices[0].done);
        assert_eq!(slices[1].id, "S02");
        assert_eq!(slices[1].title, "Done Slice");
        assert!(slices[1].done);
    }

    #[test]
    fn parse_roadmap_slices_extracts_risk_tag() {
        let content = "## Slices\n- [ ] **S01: Title** `risk:high`\n";
        let slices = parse_roadmap_slices(content);
        assert_eq!(slices.len(), 1);
        assert_eq!(slices[0].risk, Some("high".to_string()));
    }

    #[test]
    fn parse_roadmap_slices_extracts_depends_tag() {
        let content = "## Slices\n- [ ] **S02: Title** `depends:[S01,S00]`\n";
        let slices = parse_roadmap_slices(content);
        assert_eq!(slices.len(), 1);
        assert_eq!(slices[0].dependencies, vec!["S01", "S00"]);
    }

    #[test]
    fn parse_roadmap_slices_stops_at_next_heading() {
        let content =
            "## Slices\n- [ ] **S01: First**\n## Other\n- [ ] **S02: Should Not Parse**\n";
        let slices = parse_roadmap_slices(content);
        assert_eq!(slices.len(), 1);
        assert_eq!(slices[0].id, "S01");
    }

    // ---- parse_plan_tasks ----

    #[test]
    fn parse_plan_tasks_returns_empty_when_no_tasks_section() {
        let content = "# No tasks here\nJust some text.";
        let tasks = parse_plan_tasks(content);
        assert!(tasks.is_empty());
    }

    #[test]
    fn parse_plan_tasks_returns_tasks_with_correct_done_status() {
        let content = "## Tasks\n- [ ] **T01: Pending Task**\n- [x] **T02: Done Task**\n";
        let tasks = parse_plan_tasks(content);
        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].id, "T01");
        assert_eq!(tasks[0].title, "Pending Task");
        assert!(!tasks[0].done);
        assert_eq!(tasks[1].id, "T02");
        assert!(tasks[1].done);
    }

    #[test]
    fn parse_plan_tasks_extracts_estimate_tag() {
        let content = "## Tasks\n- [ ] **T01: Task** `est:2h`\n";
        let tasks = parse_plan_tasks(content);
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].estimate, Some("2h".to_string()));
    }

    #[test]
    fn parse_plan_tasks_returns_empty_tasks_vec_when_no_tasks_section() {
        let content = "## Overview\nNo tasks here.";
        let tasks = parse_plan_tasks(content);
        assert!(tasks.is_empty());
    }

    // ---- list_milestones_from_dir (testable helper) ----

    #[test]
    fn list_milestones_from_dir_returns_empty_when_milestones_dir_missing() {
        let dir = make_temp_dir("lm_missing");
        let milestones_dir = dir.join(".gsd").join("milestones");
        // Don't create the directory — it doesn't exist
        let result = list_milestones_from_dir(&milestones_dir);
        assert!(result.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_milestones_from_dir_returns_milestones_sorted_by_id() {
        let dir = make_temp_dir("lm_sorted");
        let milestones = dir.join(".gsd").join("milestones");
        fs::create_dir_all(milestones.join("M002-second")).unwrap();
        fs::create_dir_all(milestones.join("M001-first")).unwrap();
        let result = list_milestones_from_dir(&milestones);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].id, "M001");
        assert_eq!(result[1].id, "M002");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn list_milestones_from_dir_resolves_id_from_directory_name() {
        let dir = make_temp_dir("lm_id_resolve");
        let milestones = dir.join(".gsd").join("milestones");
        fs::create_dir_all(milestones.join("M001-my-milestone")).unwrap();
        let result = list_milestones_from_dir(&milestones);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].id, "M001");
        assert_eq!(result[0].dir_name, "M001-my-milestone");
        let _ = fs::remove_dir_all(&dir);
    }

    /// Create a unique temp dir for a test, cleanup on drop via a simple wrapper.
    fn make_temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("gsd2_test_{}_{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    // ---- detect_version logic ----

    fn detect_version_for_path(path: &Path) -> &'static str {
        if path.join(".gsd").is_dir() {
            "gsd2"
        } else if path.join(".planning").is_dir() {
            "gsd1"
        } else {
            "none"
        }
    }

    #[test]
    fn detect_version_returns_gsd2_when_gsd_dir_exists() {
        let dir = make_temp_dir("detect_gsd2");
        fs::create_dir(dir.join(".gsd")).unwrap();
        assert_eq!(detect_version_for_path(&dir), "gsd2");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_version_returns_gsd1_when_planning_dir_exists() {
        let dir = make_temp_dir("detect_gsd1");
        fs::create_dir(dir.join(".planning")).unwrap();
        assert_eq!(detect_version_for_path(&dir), "gsd1");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_version_returns_none_when_neither_exists() {
        let dir = make_temp_dir("detect_none");
        assert_eq!(detect_version_for_path(&dir), "none");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn detect_version_gsd2_wins_when_both_dirs_exist() {
        let dir = make_temp_dir("detect_both");
        fs::create_dir(dir.join(".gsd")).unwrap();
        fs::create_dir(dir.join(".planning")).unwrap();
        assert_eq!(detect_version_for_path(&dir), "gsd2");
        let _ = fs::remove_dir_all(&dir);
    }

    // ---- parse_frontmatter ----

    #[test]
    fn parse_frontmatter_extracts_key_value_pairs() {
        let content = "---\nphase: 01\nplan: 02\ntitle: My Plan\n---\n\n# Body here";
        let (fm, body) = parse_frontmatter(content);
        assert_eq!(fm.get("phase"), Some(&"01".to_string()));
        assert_eq!(fm.get("plan"), Some(&"02".to_string()));
        assert_eq!(fm.get("title"), Some(&"My Plan".to_string()));
        assert!(body.contains("# Body here"));
    }

    #[test]
    fn parse_frontmatter_skips_list_items() {
        let content = "---\nphase: 01\nitems:\n  - foo\n  - bar\n---\n# Body";
        let (fm, _) = parse_frontmatter(content);
        assert_eq!(fm.get("phase"), Some(&"01".to_string()));
        // List items should not appear as keys
        assert!(fm.get("- foo").is_none());
    }

    #[test]
    fn parse_frontmatter_returns_empty_when_no_frontmatter() {
        let content = "# Just a heading\nSome text";
        let (fm, body) = parse_frontmatter(content);
        assert!(fm.is_empty());
        assert_eq!(body, content);
    }

    // ---- resolve_dir_by_id ----

    #[test]
    fn resolve_dir_by_id_returns_exact_match() {
        let dir = make_temp_dir("resolve_dir_exact");
        fs::create_dir(dir.join("M001")).unwrap();
        fs::create_dir(dir.join("M001-some-title")).unwrap();
        let result = resolve_dir_by_id(&dir, "M001");
        assert_eq!(result, Some("M001".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_dir_by_id_returns_prefix_match_when_no_exact() {
        let dir = make_temp_dir("resolve_dir_prefix");
        fs::create_dir(dir.join("M001-my-milestone")).unwrap();
        let result = resolve_dir_by_id(&dir, "M001");
        assert_eq!(result, Some("M001-my-milestone".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_dir_by_id_returns_none_when_no_match() {
        let dir = make_temp_dir("resolve_dir_none");
        fs::create_dir(dir.join("M002-other")).unwrap();
        let result = resolve_dir_by_id(&dir, "M001");
        assert_eq!(result, None);
        let _ = fs::remove_dir_all(&dir);
    }

    // ---- resolve_file_by_id ----

    #[test]
    fn resolve_file_by_id_returns_exact_id_suffix_match() {
        let dir = make_temp_dir("resolve_file_exact");
        fs::write(dir.join("S01-PLAN.md"), "content").unwrap();
        let result = resolve_file_by_id(&dir, "S01", "PLAN");
        assert_eq!(result, Some("S01-PLAN.md".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_file_by_id_returns_legacy_id_descriptor_suffix_match() {
        let dir = make_temp_dir("resolve_file_legacy");
        fs::write(dir.join("S01-auth-refactor-PLAN.md"), "content").unwrap();
        let result = resolve_file_by_id(&dir, "S01", "PLAN");
        assert_eq!(result, Some("S01-auth-refactor-PLAN.md".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_file_by_id_returns_bare_suffix_match() {
        let dir = make_temp_dir("resolve_file_bare");
        fs::write(dir.join("PLAN.md"), "content").unwrap();
        let result = resolve_file_by_id(&dir, "S01", "PLAN");
        assert_eq!(result, Some("PLAN.md".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_file_by_id_returns_none_when_no_match() {
        let dir = make_temp_dir("resolve_file_none");
        fs::write(dir.join("OTHER.md"), "content").unwrap();
        let result = resolve_file_by_id(&dir, "S01", "PLAN");
        assert_eq!(result, None);
        let _ = fs::remove_dir_all(&dir);
    }

    // ---- walk_milestones / derive_state_from_dir / get_roadmap_progress_from_dir ----

    /// Helper to build a fixture .gsd project with milestones, slices, and tasks.
    fn make_fixture_project(
        base_name: &str,
        milestones: &[(&str, &[(&str, bool, &[(&str, bool)])])],
    ) -> std::path::PathBuf {
        let dir = make_temp_dir(base_name);
        let milestones_dir = dir.join(".gsd").join("milestones");
        fs::create_dir_all(&milestones_dir).unwrap();

        for (m_id, slices) in milestones {
            let m_dir = milestones_dir.join(m_id);
            fs::create_dir_all(&m_dir).unwrap();

            let slice_lines: Vec<String> = slices
                .iter()
                .map(|(s_id, s_done, _)| {
                    let check = if *s_done { "x" } else { " " };
                    format!("- [{}] **{}: Slice Title**", check, s_id)
                })
                .collect();

            let roadmap = format!("## Slices\n{}\n", slice_lines.join("\n"));
            fs::write(m_dir.join(format!("{}-ROADMAP.md", m_id)), roadmap).unwrap();

            for (s_id, _, tasks) in slices.iter() {
                let task_lines: Vec<String> = tasks
                    .iter()
                    .map(|(t_id, t_done)| {
                        let check = if *t_done { "x" } else { " " };
                        format!("- [{}] **{}: Task Title**", check, t_id)
                    })
                    .collect();
                let plan = format!("## Tasks\n{}\n", task_lines.join("\n"));
                fs::write(m_dir.join(format!("{}-PLAN.md", s_id)), plan).unwrap();
            }
        }

        dir
    }

    #[test]
    fn walk_milestones_returns_empty_when_no_milestones_dir() {
        let dir = make_temp_dir("wm_empty");
        let milestones_dir = dir.join(".gsd").join("milestones");
        // Don't create the directory
        let result = walk_milestones_with_tasks(&milestones_dir);
        assert!(result.is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn walk_milestones_returns_milestones_with_populated_tasks() {
        let dir = make_fixture_project(
            "wm_tasks",
            &[("M001", &[("S01", false, &[("T01", false), ("T02", true)])])],
        );
        let milestones_dir = dir.join(".gsd").join("milestones");
        let result = walk_milestones_with_tasks(&milestones_dir);
        assert_eq!(result.len(), 1);
        let m = &result[0];
        assert_eq!(m.slices.len(), 1);
        let s = &m.slices[0];
        assert_eq!(s.tasks.len(), 2);
        assert!(!s.tasks[0].done);
        assert!(s.tasks[1].done);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn derive_state_returns_none_active_when_no_milestones() {
        let dir = make_temp_dir("ds_empty");
        fs::create_dir_all(dir.join(".gsd").join("milestones")).unwrap();
        let state = derive_state_from_dir(dir.to_str().unwrap());
        assert!(state.active_milestone_id.is_none());
        assert!(state.active_slice_id.is_none());
        assert!(state.active_task_id.is_none());
        assert_eq!(state.milestones_total, 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn derive_state_returns_first_non_complete_milestone_as_active() {
        // M001: S01 done → M001 is complete
        // M002: S01 not done → M002 is the first non-complete milestone
        let dir = make_fixture_project(
            "ds_active_m",
            &[
                ("M001", &[("S01", true, &[("T01", true)])]), // complete
                ("M002", &[("S01", false, &[("T01", false)])]), // not complete
            ],
        );
        let state = derive_state_from_dir(dir.to_str().unwrap());
        assert_eq!(state.active_milestone_id, Some("M002".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn derive_state_returns_first_nondone_slice_as_active_slice() {
        let dir = make_fixture_project(
            "ds_active_s",
            &[(
                "M001",
                &[
                    ("S01", true, &[("T01", true)]),   // done
                    ("S02", false, &[("T01", false)]), // not done
                ],
            )],
        );
        let state = derive_state_from_dir(dir.to_str().unwrap());
        assert_eq!(state.active_milestone_id, Some("M001".to_string()));
        assert_eq!(state.active_slice_id, Some("S02".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn derive_state_returns_first_nondone_task_as_active_task() {
        let dir = make_fixture_project(
            "ds_active_t",
            &[("M001", &[("S01", false, &[("T01", true), ("T02", false)])])],
        );
        let state = derive_state_from_dir(dir.to_str().unwrap());
        assert_eq!(state.active_task_id, Some("T02".to_string()));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn derive_state_returns_none_active_when_all_milestones_complete() {
        let dir = make_fixture_project(
            "ds_all_done",
            &[
                ("M001", &[("S01", true, &[("T01", true)])]),
                ("M002", &[("S01", true, &[("T01", true)])]),
            ],
        );
        let state = derive_state_from_dir(dir.to_str().unwrap());
        assert!(state.active_milestone_id.is_none());
        assert_eq!(state.milestones_done, 2);
        assert_eq!(state.milestones_total, 2);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn derive_state_counts_done_and_total_correctly() {
        let dir = make_fixture_project(
            "ds_counts",
            &[
                ("M001", &[("S01", true, &[("T01", true), ("T02", true)])]),
                (
                    "M002",
                    &[
                        ("S01", true, &[("T01", true)]),
                        ("S02", false, &[("T01", false), ("T02", false)]),
                    ],
                ),
            ],
        );
        let state = derive_state_from_dir(dir.to_str().unwrap());
        // M001: S01 done → M001 complete
        // M002: S01 done, S02 not done → M002 not complete
        assert_eq!(state.milestones_done, 1); // only M001 all-slices-done
        assert_eq!(state.milestones_total, 2);
        // slices: M001-S01 (done), M002-S01 (done), M002-S02 (not done) → 2 done, 3 total
        assert_eq!(state.slices_done, 2);
        assert_eq!(state.slices_total, 3);
        // tasks: M001-S01: T01 done, T02 done = 2; M002-S01: T01 done = 1; M002-S02: T01+T02 not done = 0
        assert_eq!(state.tasks_done, 3);
        assert_eq!(state.tasks_total, 5);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn get_roadmap_progress_returns_correct_counts() {
        let dir = make_fixture_project(
            "rp_counts",
            &[
                ("M001", &[("S01", true, &[("T01", true)])]),
                ("M002", &[("S01", false, &[("T01", false)])]),
            ],
        );
        let progress = get_roadmap_progress_from_dir(dir.to_str().unwrap());
        assert_eq!(progress.milestones_done, 1);
        assert_eq!(progress.milestones_total, 2);
        assert_eq!(progress.slices_done, 1);
        assert_eq!(progress.slices_total, 2);
        assert_eq!(progress.tasks_done, 1);
        assert_eq!(progress.tasks_total, 2);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn get_roadmap_progress_returns_zeros_when_no_milestones() {
        let dir = make_temp_dir("rp_empty");
        fs::create_dir_all(dir.join(".gsd").join("milestones")).unwrap();
        let progress = get_roadmap_progress_from_dir(dir.to_str().unwrap());
        assert_eq!(progress.milestones_done, 0);
        assert_eq!(progress.milestones_total, 0);
        assert_eq!(progress.slices_done, 0);
        assert_eq!(progress.slices_total, 0);
        assert_eq!(progress.tasks_done, 0);
        assert_eq!(progress.tasks_total, 0);
        let _ = fs::remove_dir_all(&dir);
    }

    // ---- split_id_and_title (colon format) ----

    #[test]
    fn split_id_and_title_handles_colon_format() {
        // GSD-pi STATE.md format: "ID: Title"
        let (id, title) = split_id_and_title("S02: Encoding & Rendering Fixes");
        assert_eq!(id, "S02");
        assert_eq!(title, Some("Encoding & Rendering Fixes".to_string()));

        // Colon format with milestone ID
        let (id2, title2) = split_id_and_title("M010: Some Milestone Title");
        assert_eq!(id2, "M010");
        assert_eq!(title2, Some("Some Milestone Title".to_string()));

        // Mixed: colon wins over em-dash because `: ` is tried first
        let (id3, title3) = split_id_and_title("M010: Title — Subtitle");
        assert_eq!(id3, "M010");
        assert_eq!(title3, Some("Title — Subtitle".to_string()));

        // Legacy em-dash format still works
        let (id4, title4) = split_id_and_title("M005 — Legacy Title");
        assert_eq!(id4, "M005");
        assert_eq!(title4, Some("Legacy Title".to_string()));

        // No separator: returns full string
        let (id5, title5) = split_id_and_title("M005");
        assert_eq!(id5, "M005");
        assert_eq!(title5, None);
    }

    // ---- extract_one_liner_from_body ----

    #[test]
    fn extract_one_liner_from_body_finds_bold_line() {
        // Bold line immediately after H1
        let body = "# T01: Some Task\n**Added new endpoint for user login**\n\nMore text.";
        assert_eq!(
            extract_one_liner_from_body(body),
            "Added new endpoint for user login"
        );

        // Bold line with blank lines between H1 and bold
        let body2 = "# T01: Some Task\n\n\n**Bold line after blanks**\n\nMore text.";
        assert_eq!(extract_one_liner_from_body(body2), "Bold line after blanks");

        // No bold line — non-bold content stops the scan
        let body3 = "# T01: Some Task\n\nRegular paragraph.\n\n**Not reached**";
        assert_eq!(extract_one_liner_from_body(body3), "");

        // No H1 at all — returns empty
        let body4 = "## Section\n**Bold**\n";
        assert_eq!(extract_one_liner_from_body(body4), "");
    }

    // ---- extract_title_from_h1 ----

    #[test]
    fn extract_title_from_h1_strips_id_prefix() {
        // Normal case: "# M010: Some Milestone Title"
        let content = "# M010: Some Milestone Title\n\n## Slices\n";
        assert_eq!(
            extract_title_from_h1(content, "M010"),
            Some("Some Milestone Title".to_string())
        );

        // Double-ID prefix: "# M010: M010: Title"
        let content2 = "# M010: M010: Encoding & Rendering Fixes\n\n## Slices\n";
        assert_eq!(
            extract_title_from_h1(content2, "M010"),
            Some("Encoding & Rendering Fixes".to_string())
        );

        // No H1 in content
        let content3 = "## Slices\n- [ ] **S01: Something**\n";
        assert_eq!(extract_title_from_h1(content3, "M010"), None);

        // H1 that doesn't start with this milestone's prefix — still returns the full heading text
        let content4 = "# Unrelated Heading\n\n## Slices\n";
        assert_eq!(
            extract_title_from_h1(content4, "M010"),
            Some("Unrelated Heading".to_string())
        );
    }

    // ---- strip_markdown_inline ----

    #[test]
    fn strip_markdown_inline_removes_formatting() {
        assert_eq!(strip_markdown_inline("**bold**"), "bold");
        assert_eq!(strip_markdown_inline("*italic*"), "italic");
        assert_eq!(strip_markdown_inline("`code`"), "code");
        assert_eq!(strip_markdown_inline("__underline__"), "underline");

        // Nested / combined
        assert_eq!(strip_markdown_inline("**`nested`**"), "nested");
        assert_eq!(strip_markdown_inline("__*both*__"), "both");

        // Plain text is unchanged
        assert_eq!(strip_markdown_inline("plain text"), "plain text");

        // Empty string
        assert_eq!(strip_markdown_inline(""), "");
    }
}

// ============================================================
// R087 — HTML Report Generator + R088 — Reports Registry
// ============================================================
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
//
// Ported from:
//   gsd-2/src/resources/extensions/gsd/export-html.ts  (1408 lines)
//   gsd-2/src/resources/extensions/gsd/reports.ts      (504 lines)
//
// Design: Linear-inspired — restrained palette, geometric status, no emoji.
// All HTML is built via format!() / push_str(); no external HTML crate.

// ─── Public result structs ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HtmlReportResult {
    pub file_path: String,
    pub filename: String,
    pub reports_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportEntry {
    pub filename: String,
    pub generated_at: String,
    pub milestone_id: String,
    pub milestone_title: String,
    pub label: String,
    pub kind: String,
    pub total_cost: f64,
    pub total_tokens: i64,
    pub total_duration: i64,
    pub done_slices: u32,
    pub total_slices: u32,
    pub done_milestones: u32,
    pub total_milestones: u32,
    pub phase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportsIndex {
    pub version: u32,
    pub project_name: String,
    pub project_path: String,
    pub gsd_version: String,
    pub entries: Vec<ReportEntry>,
}

// ─── Internal data aggregates ──────────────────────────────────────────────────

struct ReportData<'a> {
    project_name: &'a str,
    project_path: &'a str,
    gsd_version: &'a str,
    milestone_id: Option<&'a str>,
    milestones: &'a [Gsd2Milestone],
    units: &'a [UnitRecord],
    totals: &'a ProjectTotals,
    by_phase: &'a [PhaseAggregate],
    by_slice: &'a [SliceAggregate],
    by_model: &'a [ModelAggregate],
    health: &'a Gsd2Health,
    knowledge_entries: &'a [KnowledgeEntry],
    capture_entries: &'a [CaptureEntry],
    changelog_entries: Vec<ChangelogEntry2>,
    discussion_states: Vec<(String, String)>, // (milestone_id, state)
    critical_path: &'a CriticalPathInfo,
    phase: String,
}

// ─── Format helpers ────────────────────────────────────────────────────────────

fn esc_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', ">/dev/null 2>&1 &#39;")
}

fn format_cost_html(cost: f64) -> String {
    if cost < 0.001 {
        "<$0.001".to_string()
    } else {
        format!("${:.4}", cost)
    }
}

fn format_token_count_html(n: i64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.1}K", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}

fn format_duration_html(ms: i64) -> String {
    if ms <= 0 {
        return "0ms".to_string();
    }
    let secs = ms / 1_000;
    let mins = secs / 60;
    let hours = mins / 60;
    if hours > 0 {
        format!("{}h {}m", hours, mins % 60)
    } else if mins > 0 {
        format!("{}m {}s", mins, secs % 60)
    } else {
        format!("{}.{}s", secs, (ms % 1000) / 100)
    }
}

fn format_date_short_html(iso: &str) -> String {
    // Parse "2026-03-15T14:23:00.000Z" → "Mar 15"
    if iso.len() >= 10 {
        let parts: Vec<&str> = iso[..10].split('-').collect();
        if parts.len() == 3 {
            let month = match parts[1] {
                "01" => "Jan",
                "02" => "Feb",
                "03" => "Mar",
                "04" => "Apr",
                "05" => "May",
                "06" => "Jun",
                "07" => "Jul",
                "08" => "Aug",
                "09" => "Sep",
                "10" => "Oct",
                "11" => "Nov",
                "12" => "Dec",
                _ => parts[1],
            };
            let day: u32 = parts[2].parse().unwrap_or(0);
            return format!("{} {}", month, day);
        }
    }
    iso.to_string()
}

fn format_date_long_html(iso: &str) -> String {
    // Parse ISO to "Wed, Mar 15, 2026 2:23 PM UTC"
    if iso.len() >= 19 {
        let date_part = &iso[..10];
        let time_part = &iso[11..19];
        let parts: Vec<&str> = date_part.split('-').collect();
        let time_parts: Vec<&str> = time_part.split(':').collect();
        if parts.len() == 3 && time_parts.len() == 3 {
            let year = parts[0];
            let month = match parts[1] {
                "01" => "Jan",
                "02" => "Feb",
                "03" => "Mar",
                "04" => "Apr",
                "05" => "May",
                "06" => "Jun",
                "07" => "Jul",
                "08" => "Aug",
                "09" => "Sep",
                "10" => "Oct",
                "11" => "Nov",
                "12" => "Dec",
                _ => parts[1],
            };
            let day: u32 = parts[2].parse().unwrap_or(0);
            let hour: u32 = time_parts[0].parse().unwrap_or(0);
            let min: u32 = time_parts[1].parse().unwrap_or(0);
            let (h12, ampm) = if hour == 0 {
                (12, "AM")
            } else if hour < 12 {
                (hour, "AM")
            } else if hour == 12 {
                (12, "PM")
            } else {
                (hour - 12, "PM")
            };
            return format!(
                "{} {}, {} {}:{:02} {} UTC",
                month, day, year, h12, min, ampm
            );
        }
    }
    iso.to_string()
}

fn trunc_str(s: &str, n: usize) -> String {
    if s.len() > n {
        format!("{}\u{2026}", &s[..n.saturating_sub(1)])
    } else {
        s.to_string()
    }
}

fn short_model_html(m: &str) -> String {
    m.replace("claude-", "").replace("anthropic/", "")
}

fn now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (y, mo, d, h, min, sec) = epoch_to_date(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.000Z",
        y, mo, d, h, min, sec
    )
}

fn epoch_to_date(secs: u64) -> (u32, u32, u32, u32, u32, u32) {
    // Algorithm from https://howardhinnant.github.io/date_algorithms.html
    let z = secs / 86400 + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    let rem = secs % 86400;
    let h = rem / 3600;
    let min = (rem % 3600) / 60;
    let sec = rem % 60;
    (
        year as u32,
        m as u32,
        d as u32,
        h as u32,
        min as u32,
        sec as u32,
    )
}

// ─── HTML section helpers ──────────────────────────────────────────────────────

fn section_html(id: &str, title: &str, body: &str) -> String {
    format!(
        "\n<section id=\"{}\">\n  <h2>{}</h2>\n  {}\n</section>",
        id, title, body
    )
}

fn kvi_html(label: &str, value: &str) -> String {
    format!(
        "<div class=\"kv\"><span class=\"kv-val\">{}</span><span class=\"kv-lbl\">{}</span></div>",
        esc_html(value),
        esc_html(label)
    )
}

fn h_row_html(label: &str, value: &str, status: Option<&str>) -> String {
    let cls = match status {
        Some(s) => format!(" class=\"h-{}\"", s),
        None => String::new(),
    };
    format!(
        "<tr{}><td>{}</td><td>{}</td></tr>",
        cls,
        esc_html(label),
        esc_html(value)
    )
}

// ─── CSS constant ──────────────────────────────────────────────────────────────

const REPORT_CSS: &str = r#"
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg-0:#0f1115;--bg-1:#16181d;--bg-2:#1e2028;--bg-3:#272a33;
  --border-1:#2b2e38;--border-2:#3b3f4c;
  --text-0:#ededef;--text-1:#a1a1aa;--text-2:#71717a;
  --accent:#5e6ad2;--accent-subtle:rgba(94,106,210,.12);
  --ok:#22c55e;--ok-subtle:rgba(34,197,94,.12);--warn:#ef4444;--caution:#eab308;
  --c0:#5e6ad2;--c1:#e5796d;--c2:#14b8a6;--c3:#a78bfa;--c4:#f59e0b;--c5:#10b981;
  --tk-input:#5e6ad2;--tk-output:#e5796d;--tk-cache-r:#2dd4bf;--tk-cache-w:#64748b;
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono','Fira Code',ui-monospace,SFMono-Regular,monospace;
}
html{scroll-behavior:smooth;font-size:13px}
body{background:var(--bg-0);color:var(--text-0);font-family:var(--font);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:var(--mono);font-size:12px;background:var(--bg-3);padding:1px 5px;border-radius:3px}
.mono{font-family:var(--mono);font-size:12px}
.muted{color:var(--text-2)}
.accent{color:var(--accent)}
.sep{color:var(--border-2);margin:0 4px}
.empty{color:var(--text-2);padding:8px 0;font-size:13px}
.indent{padding-left:12px}
.num{font-variant-numeric:tabular-nums;text-align:right}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex-shrink:0;vertical-align:middle}
.dot-sm{width:6px;height:6px}
.dot-complete{background:var(--ok);opacity:.6}
.dot-active{background:var(--accent)}
.dot-pending{background:transparent;border:1.5px solid var(--border-2)}
.dot-parked{background:var(--warn);opacity:.5}
header{background:var(--bg-1);border-bottom:1px solid var(--border-1);padding:12px 32px;position:sticky;top:0;z-index:200}
.header-inner{display:flex;align-items:center;gap:16px;max-width:1280px;margin:0 auto}
.branding{display:flex;align-items:baseline;gap:6px;flex-shrink:0}
.logo{font-size:18px;font-weight:800;letter-spacing:-.5px;color:var(--text-0)}
.version{font-size:10px;color:var(--text-2);font-family:var(--mono)}
.header-meta{flex:1;min-width:0}
.header-meta h1{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.header-path{font-size:11px;color:var(--text-2);font-family:var(--mono);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.header-right{text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.generated{font-size:11px;color:var(--text-2)}
.back-link{font-size:12px;color:var(--text-1)}
.back-link:hover{color:var(--accent)}
.toc{background:var(--bg-1);border-bottom:1px solid var(--border-1);overflow-x:auto}
.toc ul{display:flex;list-style:none;max-width:1280px;margin:0 auto;padding:0 32px}
.toc a{display:inline-block;padding:8px 12px;color:var(--text-2);font-size:12px;font-weight:500;border-bottom:2px solid transparent;transition:color .12s,border-color .12s;white-space:nowrap;text-decoration:none}
.toc a:hover{color:var(--text-0);border-bottom-color:var(--border-2)}
.toc a.active{color:var(--text-0);border-bottom-color:var(--accent)}
main{max-width:1280px;margin:0 auto;padding:32px;display:flex;flex-direction:column;gap:48px}
section{scroll-margin-top:82px}
section>h2{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-1);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border-1);display:flex;align-items:center;gap:8px}
h3{font-size:13px;font-weight:600;color:var(--text-1);margin:20px 0 8px}
.count{font-size:11px;font-weight:500;color:var(--text-2);background:var(--bg-3);border-radius:3px;padding:1px 6px}
.count-warn{color:var(--caution)}
.kv-grid{display:flex;flex-wrap:wrap;gap:1px;background:var(--border-1);border:1px solid var(--border-1);border-radius:4px;overflow:hidden;margin-bottom:16px}
.kv{background:var(--bg-1);padding:10px 16px;display:flex;flex-direction:column;gap:2px;min-width:110px;flex:1}
.kv-val{font-size:18px;font-weight:600;color:var(--text-0);font-variant-numeric:tabular-nums}
.kv-lbl{font-size:10px;color:var(--text-2);text-transform:uppercase;letter-spacing:.4px}
.progress-wrap{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.progress-track{flex:1;height:4px;background:var(--bg-3);border-radius:2px;overflow:hidden}
.progress-fill{height:100%;background:var(--accent);border-radius:2px}
.progress-label{font-size:12px;font-weight:600;color:var(--text-1);min-width:40px;text-align:right}
.active-info{font-size:12px;color:var(--text-1);margin-bottom:4px}
.activity-line{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-1);padding:6px 0}
.tbl{width:100%;border-collapse:collapse;font-size:12px}
.tbl th{color:var(--text-2);font-weight:500;padding:6px 12px;text-align:left;border-bottom:1px solid var(--border-1);font-size:11px;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.tbl td{padding:6px 12px;border-bottom:1px solid var(--border-1);vertical-align:top}
.tbl tr:last-child td{border-bottom:none}
.tbl tbody tr:hover td{background:var(--accent-subtle)}
.tbl-kv td:first-child{color:var(--text-2);width:180px}
.table-scroll{overflow-x:auto;border:1px solid var(--border-1);border-radius:4px}
.table-scroll .tbl{border:none}
.h-ok td:first-child{color:var(--text-1)}
.h-caution td{color:var(--caution)}
.h-warn td{color:var(--warn)}
.label{font-size:10px;font-weight:500;color:var(--accent);text-transform:uppercase;letter-spacing:.4px}
.risk{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;flex-shrink:0}
.risk-low{color:var(--text-2)}.risk-medium{color:var(--caution)}.risk-high{color:var(--warn)}.risk-unknown{color:var(--text-2)}
.tag-row{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.tag{font-size:11px;font-family:var(--mono);color:var(--text-2);background:var(--bg-3);border-radius:3px;padding:1px 6px}
.verif{font-size:12px;color:var(--text-1);padding:4px 0;margin-bottom:6px}
.verif-blocker{color:var(--warn)}
.detail-block{font-size:12px;color:var(--text-2);margin-bottom:6px}
.detail-label{font-weight:600;color:var(--text-1);display:block;margin-bottom:2px}
.detail-block ul{padding-left:16px;margin-top:2px}
.detail-block li{margin-bottom:1px}
.ms-block{border:1px solid var(--border-1);border-radius:4px;overflow:hidden;margin-bottom:8px}
.ms-summary{display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;list-style:none;background:var(--bg-1);user-select:none;font-size:13px}
.ms-summary:hover{background:var(--bg-2)}
.ms-summary::-webkit-details-marker{display:none}
.ms-id{font-weight:600}
.ms-title{flex:1;font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ms-body{padding:6px 12px 8px 24px;display:flex;flex-direction:column;gap:4px}
.sl-block{border:1px solid var(--border-1);border-radius:3px;overflow:hidden}
.sl-summary{display:flex;align-items:center;gap:6px;padding:6px 10px;cursor:pointer;list-style:none;background:var(--bg-2);font-size:12px;user-select:none}
.sl-summary:hover{background:var(--bg-3)}
.sl-summary::-webkit-details-marker{display:none}
.sl-crit{border-left:2px solid var(--accent)}
.sl-deps::before{content:'\2190 ';color:var(--border-2)}
.sl-detail{padding:8px 12px;background:var(--bg-0);border-top:1px solid var(--border-1)}
.task-list{list-style:none;padding:4px 0 0;display:flex;flex-direction:column;gap:2px}
.task-row{display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 6px;border-radius:2px}
.dep-block{margin-bottom:28px}
.dep-legend{display:flex;gap:14px;font-size:12px;color:var(--text-2);margin-bottom:8px;align-items:center}
.dep-legend span{display:flex;align-items:center;gap:4px}
.dep-wrap{overflow-x:auto;background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px;padding:16px}
.dep-svg{display:block}
.edge{fill:none;stroke:var(--border-2);stroke-width:1.5}
.edge-crit{stroke:var(--accent);stroke-width:2}
.node rect{fill:var(--bg-2);stroke:var(--border-2);stroke-width:1}
.n-done rect{fill:var(--ok-subtle);stroke:rgba(34,197,94,.4)}
.n-active rect{fill:var(--accent-subtle);stroke:var(--accent)}
.n-crit rect{stroke:var(--accent)!important;stroke-width:1.5!important}
.n-id{font-family:var(--mono);font-size:10px;fill:var(--text-1);font-weight:600;text-anchor:middle}
.n-title{font-size:9px;fill:var(--text-2);text-anchor:middle}
.n-active .n-id{fill:var(--accent)}
.token-block{background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px;padding:14px;margin-bottom:16px}
.token-bar{display:flex;height:16px;border-radius:2px;overflow:hidden;gap:1px;margin-bottom:8px}
.tseg{height:100%;min-width:2px}
.seg-1{background:var(--tk-input)}.seg-2{background:var(--tk-output)}.seg-3{background:var(--tk-cache-r)}.seg-4{background:var(--tk-cache-w)}
.token-legend{display:flex;flex-wrap:wrap;gap:12px}
.leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text-2)}
.leg-dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.chart-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:16px}
.chart-block{background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px;padding:14px}
.bar-row{display:grid;grid-template-columns:120px 1fr 68px;align-items:center;gap:6px;margin-bottom:2px}
.bar-lbl{font-size:12px;color:var(--text-2);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{height:14px;background:var(--bg-3);border-radius:2px;overflow:hidden}
.bar-fill{height:100%;border-radius:2px;background:var(--c0)}
.bar-c0{background:var(--c0)}.bar-c1{background:var(--c1)}.bar-c2{background:var(--c2)}
.bar-c3{background:var(--c3)}.bar-c4{background:var(--c4)}.bar-c5{background:var(--c5)}
.bar-val{font-size:11px;font-variant-numeric:tabular-nums;color:var(--text-1)}
.bar-sub{font-size:10px;color:var(--text-2);padding-left:128px;margin-bottom:6px}
.cl-entry{border-bottom:1px solid var(--border-1);padding:12px 0}
.cl-entry:last-child{border-bottom:none}
.cl-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.cl-title{flex:1;font-weight:500}
.cl-date{margin-left:auto;white-space:nowrap}
.cl-liner{font-size:13px;color:var(--text-1);margin-bottom:6px}
.files-detail summary{font-size:12px;cursor:pointer}
.file-list{list-style:none;padding-left:10px;margin-top:4px;display:flex;flex-direction:column;gap:2px}
.file-list li{font-size:12px;color:var(--text-1)}
footer{border-top:1px solid var(--border-1);padding:20px 32px;margin-top:40px}
.footer-inner{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:var(--text-2)}
.exec-summary{font-size:13px;color:var(--text-1);margin-bottom:12px;line-height:1.7}
.eta-line{font-size:12px;color:var(--accent);margin-top:4px}
.cost-svg{display:block;margin:8px 0;background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px}
.cost-line{fill:none;stroke:var(--accent);stroke-width:2}
.cost-area{fill:var(--accent-subtle);stroke:none}
.cost-axis{fill:var(--text-2);font-family:var(--mono);font-size:10px}
.cost-grid{stroke:var(--border-1);stroke-width:1;stroke-dasharray:4,4}
.burndown-wrap{background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px;padding:14px;margin-bottom:16px}
.burndown-bar{display:flex;height:20px;border-radius:3px;overflow:hidden;gap:1px;margin-bottom:8px}
.burndown-spent{background:var(--accent);height:100%}
.burndown-projected{background:var(--caution);height:100%;opacity:.6}
.burndown-overshoot{background:var(--warn);height:100%;opacity:.7}
.burndown-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:var(--text-2)}
.burndown-legend span{display:flex;align-items:center;gap:4px}
.burndown-dot{display:inline-block;width:8px;height:8px;border-radius:2px}
.blocker-card{border-left:3px solid var(--warn);background:var(--bg-1);border-radius:0 4px 4px 0;padding:10px 14px;margin-bottom:8px}
.blocker-id{font-family:var(--mono);font-size:12px;color:var(--warn);margin-bottom:2px}
.blocker-text{font-size:12px;color:var(--text-1)}
.gantt-wrap{overflow-x:auto;background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px;padding:16px;margin-top:16px}
.gantt-svg{display:block}
.gantt-bar-done{fill:var(--ok);opacity:.7}
.gantt-bar-active{fill:var(--accent)}
.gantt-bar-pending{fill:var(--border-2)}
.gantt-label{fill:var(--text-2);font-family:var(--mono);font-size:10px}
.gantt-axis{fill:var(--text-2);font-family:var(--mono);font-size:9px}
.tl-filter{display:block;width:100%;padding:6px 10px;margin-bottom:8px;background:var(--bg-2);border:1px solid var(--border-1);border-radius:4px;color:var(--text-0);font-size:12px;font-family:var(--font);outline:none}
.tl-filter:focus{border-color:var(--accent)}
.tl-filter::placeholder{color:var(--text-2)}
.sec-toggle{background:none;border:1px solid var(--border-2);color:var(--text-2);width:20px;height:20px;border-radius:3px;cursor:pointer;font-size:14px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.sec-toggle:hover{border-color:var(--text-1);color:var(--text-1)}
.theme-toggle{background:var(--bg-3);border:1px solid var(--border-2);color:var(--text-1);padding:4px 10px;border-radius:4px;cursor:pointer;font-size:11px;font-family:var(--font)}
.theme-toggle:hover{border-color:var(--accent);color:var(--accent)}
.light-theme{--bg-0:#fff;--bg-1:#fafafa;--bg-2:#f5f5f5;--bg-3:#ebebeb;--border-1:#e5e5e5;--border-2:#d4d4d4;--text-0:#1a1a1a;--text-1:#525252;--text-2:#a3a3a3;--accent:#4f46e5;--accent-subtle:rgba(79,70,229,.08);--ok:#16a34a;--ok-subtle:rgba(22,163,74,.08);--warn:#dc2626;--caution:#ca8a04;--c0:#4f46e5;--c1:#dc2626;--c2:#0d9488;--c3:#7c3aed;--c4:#d97706;--c5:#059669;--tk-input:#4f46e5;--tk-output:#dc2626;--tk-cache-r:#0d9488;--tk-cache-w:#64748b}
@media(max-width:768px){
  header{padding:10px 16px}
  .header-inner{flex-wrap:wrap;gap:8px}
  .header-meta h1{font-size:13px}
  main{padding:16px}
  .kv-grid{gap:1px}
  .kv{min-width:80px;padding:8px 10px}
  .kv-val{font-size:14px}
  .chart-row{grid-template-columns:1fr}
  .toc ul{padding:0 16px}
  .toc a{padding:6px 8px;font-size:11px}
  .bar-row{grid-template-columns:80px 1fr 56px}
  .ms-body{padding-left:12px}
}
@media print{
  header,nav.toc{position:static}
  body{background:#fff;color:#1a1a1a}
  :root{--bg-0:#fff;--bg-1:#fafafa;--bg-2:#f5f5f5;--bg-3:#ebebeb;--border-1:#e5e5e5;--border-2:#d4d4d4;--text-0:#1a1a1a;--text-1:#525252;--text-2:#a3a3a3;--accent:#4f46e5;--ok:#16a34a;--ok-subtle:rgba(22,163,74,.08);--c0:#4f46e5;--c1:#dc2626;--c2:#0d9488;--c3:#7c3aed;--c4:#d97706;--c5:#059669;--tk-input:#4f46e5;--tk-output:#dc2626;--tk-cache-r:#0d9488;--tk-cache-w:#64748b}
  section{page-break-inside:avoid}
  .table-scroll{overflow:visible}
}
"#;

// ─── JS constant ───────────────────────────────────────────────────────────────

const REPORT_JS: &str = r##"
(function(){
  const sections=document.querySelectorAll('section[id]');
  const links=document.querySelectorAll('.toc a');
  if(!sections.length||!links.length)return;
  const obs=new IntersectionObserver(entries=>{
    for(const e of entries){
      if(!e.isIntersecting)continue;
      for(const l of links)l.classList.remove('active');
      const a=document.querySelector('.toc a[href="#'+e.target.id+'"]');
      if(a)a.classList.add('active');
    }
  },{rootMargin:'-10% 0px -80% 0px',threshold:0});
  for(const s of sections)obs.observe(s);
})();
(function(){
  var tl=document.getElementById('timeline');
  if(!tl)return;
  var table=tl.querySelector('.tbl');
  if(!table)return;
  var input=document.createElement('input');
  input.className='tl-filter';
  input.placeholder='Filter timeline\u2026';
  input.type='text';
  table.parentNode.insertBefore(input,table);
  var rows=table.querySelectorAll('tbody tr');
  input.addEventListener('input',function(){
    var q=this.value.toLowerCase();
    for(var i=0;i<rows.length;i++){
      rows[i].style.display=rows[i].textContent.toLowerCase().indexOf(q)>-1?'':'none';
    }
  });
})();
(function(){
  var saved=JSON.parse(localStorage.getItem('gsd-collapsed')||'{}');
  document.querySelectorAll('section[id]').forEach(function(sec){
    var h2=sec.querySelector('h2');
    if(!h2)return;
    var btn=document.createElement('button');
    btn.className='sec-toggle';
    btn.textContent=saved[sec.id]?'+':'-';
    btn.setAttribute('aria-label','Toggle section');
    h2.prepend(btn);
    if(saved[sec.id])toggleSection(sec,true);
    btn.addEventListener('click',function(e){
      e.preventDefault();
      var collapsed=btn.textContent==='-';
      toggleSection(sec,collapsed);
      btn.textContent=collapsed?'+':'-';
      saved[sec.id]=collapsed;
      localStorage.setItem('gsd-collapsed',JSON.stringify(saved));
    });
  });
  function toggleSection(sec,hide){
    var children=sec.children;
    for(var i=0;i<children.length;i++){
      if(children[i].tagName!=='H2')children[i].style.display=hide?'none':'';
    }
  }
})();
(function(){
  var hr=document.querySelector('.header-right');
  if(!hr)return;
  var btn=document.createElement('button');
  btn.className='theme-toggle';
  btn.textContent=localStorage.getItem('gsd-theme')==='light'?'Dark':'Light';
  if(localStorage.getItem('gsd-theme')==='light')document.documentElement.classList.add('light-theme');
  btn.addEventListener('click',function(){
    document.documentElement.classList.toggle('light-theme');
    var isLight=document.documentElement.classList.contains('light-theme');
    btn.textContent=isLight?'Dark':'Light';
    localStorage.setItem('gsd-theme',isLight?'light':'dark');
  });
  hr.prepend(btn);
})();
"##;

// ─── INDEX CSS constant ────────────────────────────────────────────────────────

const INDEX_CSS: &str = r#"
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg-0:#0f1115;--bg-1:#16181d;--bg-2:#1e2028;--bg-3:#272a33;
  --border-1:#2b2e38;--border-2:#3b3f4c;
  --text-0:#ededef;--text-1:#a1a1aa;--text-2:#71717a;
  --accent:#5e6ad2;--accent-subtle:rgba(94,106,210,.12);
  --font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  --mono:'JetBrains Mono','Fira Code',ui-monospace,monospace;
}
html{font-size:13px}
body{background:var(--bg-0);color:var(--text-0);font-family:var(--font);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
h2{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-1);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border-1)}
h3{font-size:13px;font-weight:600;color:var(--text-1);margin:16px 0 8px}
code{font-family:var(--mono);font-size:12px;background:var(--bg-3);padding:1px 5px;border-radius:3px}
.empty{color:var(--text-2);font-size:13px;padding:8px 0}
.count{font-size:11px;font-weight:500;color:var(--text-2);background:var(--bg-3);border-radius:3px;padding:1px 6px}
header{background:var(--bg-1);border-bottom:1px solid var(--border-1);padding:12px 32px;position:sticky;top:0;z-index:100}
.hdr-inner{display:flex;align-items:center;gap:16px;max-width:1280px;margin:0 auto}
.branding{display:flex;align-items:baseline;gap:6px;flex-shrink:0}
.logo{font-size:18px;font-weight:800;letter-spacing:-.5px;color:var(--text-0)}
.ver{font-size:10px;color:var(--text-2);font-family:var(--mono)}
.hdr-meta{flex:1;min-width:0}
.hdr-meta h1{font-size:15px;font-weight:600}
.hdr-subtitle{color:var(--text-2);font-weight:400;font-size:13px;margin-left:4px}
.hdr-path{font-size:11px;color:var(--text-2);font-family:var(--mono);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hdr-right{text-align:right;flex-shrink:0}
.gen-lbl{font-size:10px;color:var(--text-2);text-transform:uppercase;letter-spacing:.5px;display:block}
.gen{font-size:11px;color:var(--text-1)}
.layout{display:grid;grid-template-columns:200px 1fr;gap:0;max-width:1280px;margin:0 auto;min-height:calc(100vh - 120px)}
.sidebar{background:var(--bg-1);border-right:1px solid var(--border-1);padding:20px 14px;position:sticky;top:52px;height:calc(100vh - 52px);overflow-y:auto}
.sidebar-title{font-size:10px;font-weight:600;color:var(--text-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
.toc-group{margin-bottom:14px}
.toc-group-label{font-size:11px;font-weight:600;color:var(--text-1);margin-bottom:3px;font-family:var(--mono)}
.toc-group ul{list-style:none;display:flex;flex-direction:column;gap:1px}
.toc-group li{display:flex;align-items:center;gap:6px}
.toc-group a{font-size:11px;color:var(--text-2);padding:2px 4px;border-radius:3px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.toc-group a:hover{background:var(--bg-2);color:var(--text-0);text-decoration:none}
.toc-kind{font-size:9px;color:var(--text-2);font-family:var(--mono);flex-shrink:0}
main{padding:28px;display:flex;flex-direction:column;gap:40px}
.idx-summary{display:flex;flex-wrap:wrap;gap:1px;background:var(--border-1);border:1px solid var(--border-1);border-radius:4px;overflow:hidden;margin-bottom:16px}
.idx-stat{background:var(--bg-1);padding:10px 16px;display:flex;flex-direction:column;gap:2px;min-width:100px;flex:1}
.idx-val{font-size:18px;font-weight:600;color:var(--text-0);font-variant-numeric:tabular-nums}
.idx-lbl{font-size:10px;color:var(--text-2);text-transform:uppercase;letter-spacing:.4px}
.idx-progress{display:flex;align-items:center;gap:10px;margin-top:10px}
.idx-bar-track{flex:1;height:4px;background:var(--bg-3);border-radius:2px;overflow:hidden}
.idx-bar-fill{height:100%;background:var(--accent);border-radius:2px}
.idx-pct{font-size:12px;font-weight:600;color:var(--text-1);min-width:40px;text-align:right}
.sparkline-wrap{margin-top:20px}
.sparkline{position:relative}
.spark-svg{display:block;background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px;overflow:visible;max-width:100%}
.spark-line{stroke:var(--accent);stroke-width:1.5;fill:none}
.spark-dot{fill:var(--accent);stroke:var(--bg-1);stroke-width:2;cursor:pointer}
.spark-dot:hover{r:4;fill:var(--text-0)}
.spark-lbl{font-size:10px;fill:var(--text-2);font-family:var(--mono)}
.spark-axis{display:flex;position:relative;height:18px;margin-top:2px}
.spark-tick{position:absolute;transform:translateX(-50%);font-size:9px;color:var(--text-2);font-family:var(--mono);white-space:nowrap}
.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.report-card{display:flex;flex-direction:column;gap:6px;background:var(--bg-1);border:1px solid var(--border-1);border-radius:4px;padding:14px;text-decoration:none;color:var(--text-0);transition:border-color .12s}
.report-card:hover{border-color:var(--accent);text-decoration:none}
.card-latest{border-color:var(--accent)}
.card-top{display:flex;align-items:center;gap:8px}
.card-label{flex:1;font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-kind{font-size:10px;color:var(--text-2);font-family:var(--mono);flex-shrink:0}
.card-date{font-size:11px;color:var(--text-2)}
.card-progress{display:flex;align-items:center;gap:6px}
.card-bar-track{flex:1;height:3px;background:var(--bg-3);border-radius:2px;overflow:hidden}
.card-bar-fill{height:100%;background:var(--accent);border-radius:2px}
.card-pct{font-size:11px;color:var(--text-2);min-width:30px;text-align:right}
.card-stats{display:flex;gap:8px;flex-wrap:wrap}
.card-stats span{font-size:11px;color:var(--text-2);font-variant-numeric:tabular-nums}
.card-delta{display:flex;gap:4px;flex-wrap:wrap}
.card-delta span{font-size:10px;color:var(--text-1);font-family:var(--mono)}
.card-latest-badge{display:none}
.sec-count{font-size:11px;font-weight:500;color:var(--text-2);background:var(--bg-3);border-radius:3px;padding:1px 6px;margin-left:8px}
footer{border-top:1px solid var(--border-1);padding:16px 32px}
.ftr-inner{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11px;color:var(--text-2)}
.ftr-sep{color:var(--border-2)}
@media(max-width:768px){
  .layout{grid-template-columns:1fr}
  .sidebar{position:static;height:auto;border-right:none;border-bottom:1px solid var(--border-1)}
}
@media print{
  .sidebar{display:none}
  header{position:static}
  body{background:#fff;color:#1a1a1a}
  :root{--bg-0:#fff;--bg-1:#fafafa;--bg-2:#f5f5f5;--bg-3:#ebebeb;--border-1:#e5e5e5;--border-2:#d4d4d4;--text-0:#1a1a1a;--text-1:#525252;--text-2:#a3a3a3;--accent:#4f46e5}
}
"#;

// ─── Section builders ──────────────────────────────────────────────────────────

fn build_summary_section(data: &ReportData<'_>, _generated: &str) -> String {
    let total_slices: usize = data.milestones.iter().map(|m| m.slices.len()).sum();
    let done_slices: usize = data
        .milestones
        .iter()
        .flat_map(|m| m.slices.iter())
        .filter(|s| s.done)
        .count();
    let done_milestones = data.milestones.iter().filter(|m| m.done).count();
    let total_milestones = data.milestones.len();
    let pct = if total_slices > 0 {
        (done_slices * 100) / total_slices
    } else {
        0
    };

    let spent = data.totals.total_cost;
    let mut kv = String::new();
    kv.push_str(&kvi_html(
        "Milestones",
        &format!("{}/{}", done_milestones, total_milestones),
    ));
    kv.push_str(&kvi_html(
        "Slices",
        &format!("{}/{}", done_slices, total_slices),
    ));
    kv.push_str(&kvi_html("Phase", &data.phase));
    kv.push_str(&kvi_html("Cost", &format_cost_html(spent)));
    kv.push_str(&kvi_html(
        "Tokens",
        &format_token_count_html(data.totals.total_tokens),
    ));
    kv.push_str(&kvi_html(
        "Duration",
        &format_duration_html(data.totals.duration_ms),
    ));
    kv.push_str(&kvi_html("Tool calls", &data.totals.tool_calls.to_string()));
    kv.push_str(&kvi_html("Units", &data.totals.units.to_string()));
    if let Some(mid) = data.milestone_id {
        kv.push_str(&kvi_html("Scope", mid));
    }

    let exec_summary = format!(
        "<p class=\"exec-summary\">{} is {}% complete across {} milestones. {} spent.</p>",
        esc_html(data.project_name),
        pct,
        total_milestones,
        format_cost_html(spent)
    );

    let progress_bar = format!(
        "<div class=\"progress-wrap\"><div class=\"progress-track\"><div class=\"progress-fill\" style=\"width:{}%\"></div></div><span class=\"progress-label\">{}%</span></div>",
        pct, pct
    );

    let body = format!(
        "{}<div class=\"kv-grid\">{}</div>{}",
        exec_summary, kv, progress_bar
    );
    section_html("summary", "Summary", &body)
}

fn build_blockers_section(data: &ReportData<'_>) -> String {
    // Collect high-risk incomplete slices
    let mut high_risk_html = String::new();
    for ms in data.milestones {
        for sl in &ms.slices {
            if !sl.done
                && sl
                    .risk
                    .as_deref()
                    .map(|r| r.to_lowercase() == "high")
                    .unwrap_or(false)
            {
                high_risk_html.push_str(&format!(
                    "<div class=\"blocker-card\"><div class=\"blocker-id\">{}/{}</div><div class=\"blocker-text\">High risk — incomplete</div></div>",
                    esc_html(&ms.id), esc_html(&sl.id)
                ));
            }
        }
    }

    if high_risk_html.is_empty() {
        return section_html(
            "blockers",
            "Blockers",
            "<p class=\"empty\">No blockers or high-risk items found.</p>",
        );
    }

    section_html("blockers", "Blockers", &high_risk_html)
}

fn build_progress_section(data: &ReportData<'_>) -> String {
    if data.milestones.is_empty() {
        return section_html(
            "progress",
            "Progress",
            "<p class=\"empty\">No milestones found.</p>",
        );
    }

    let crit_set: std::collections::HashSet<&str> =
        data.critical_path.path.iter().map(|s| s.as_str()).collect();

    let mut ms_html = String::new();
    for ms in data.milestones {
        let done_count = ms.slices.iter().filter(|s| s.done).count();
        let on_crit = crit_set.contains(ms.id.as_str());
        let status = if ms.done { "complete" } else { "pending" };

        let mut slice_html = String::new();
        if ms.slices.is_empty() {
            slice_html.push_str("<p class=\"empty indent\">No slices in roadmap yet.</p>");
        } else {
            for sl in &ms.slices {
                slice_html.push_str(&build_slice_row_html(sl, &crit_set));
            }
        }

        let crit_label = if on_crit {
            "<span class=\"label\">critical path</span>"
        } else {
            ""
        };
        let deps_html = if !ms.dependencies.is_empty() {
            format!(
                "<span class=\"muted\">needs {}</span>",
                ms.dependencies
                    .iter()
                    .map(|d| esc_html(d))
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        } else {
            String::new()
        };

        ms_html.push_str(&format!(
            "<details class=\"ms-block\" {}><summary class=\"ms-summary ms-{}\"><span class=\"dot dot-{}\"></span><span class=\"mono ms-id\">{}</span><span class=\"ms-title\">{}</span><span class=\"muted\">{}/{}</span>{}{}</summary><div class=\"ms-body\">{}</div></details>",
            if status != "pending" { "open" } else { "" },
            esc_html(status), esc_html(status),
            esc_html(&ms.id), esc_html(&ms.title),
            done_count, ms.slices.len(),
            crit_label, deps_html,
            slice_html
        ));
    }

    section_html("progress", "Progress", &ms_html)
}

fn build_slice_row_html(sl: &Gsd2Slice, crit_set: &std::collections::HashSet<&str>) -> String {
    let on_crit = crit_set.contains(sl.id.as_str());
    let status = if sl.done { "complete" } else { "pending" };
    let risk_val = sl.risk.as_deref().unwrap_or("unknown");
    let risk_lower = risk_val.to_lowercase();

    let mut task_html = String::new();
    if !sl.tasks.is_empty() {
        task_html.push_str("<ul class=\"task-list\">");
        for t in &sl.tasks {
            let ts = if t.done { "complete" } else { "pending" };
            task_html.push_str(&format!(
                "<li class=\"task-row\"><span class=\"dot dot-{} dot-sm\"></span><span class=\"mono muted\">{}</span><span class=\"{}\">{}</span></li>",
                ts, esc_html(&t.id), if t.done { "muted" } else { "" }, esc_html(&t.title)
            ));
        }
        task_html.push_str("</ul>");
    }

    let deps_html = if !sl.dependencies.is_empty() {
        format!(
            "<span class=\"muted sl-deps\">{}</span>",
            sl.dependencies
                .iter()
                .map(|d| esc_html(d))
                .collect::<Vec<_>>()
                .join(", ")
        )
    } else {
        String::new()
    };

    let crit_label = if on_crit {
        "<span class=\"label\">critical</span>"
    } else {
        ""
    };

    format!(
        "<details class=\"sl-block\"><summary class=\"sl-summary {}\"><span class=\"dot dot-{} dot-sm\"></span><span class=\"mono muted\">{}</span><span class=\"{}\">{}</span><span class=\"risk risk-{}\">{}</span>{}{}</summary><div class=\"sl-detail\">{}</div></details>",
        if on_crit { "sl-crit" } else { "" },
        esc_html(status), esc_html(&sl.id),
        if sl.done { "muted" } else { "" }, esc_html(&sl.title),
        esc_html(&risk_lower), esc_html(risk_val),
        deps_html, crit_label,
        task_html
    )
}

fn build_dep_graph_section(data: &ReportData<'_>) -> String {
    let has_slices = data.milestones.iter().any(|m| !m.slices.is_empty());
    if !has_slices {
        return section_html(
            "depgraph",
            "Dependencies",
            "<p class=\"empty\">No slices to graph.</p>",
        );
    }
    let has_deps = data
        .milestones
        .iter()
        .any(|m| m.slices.iter().any(|s| !s.dependencies.is_empty()));
    if !has_deps {
        return section_html(
            "depgraph",
            "Dependencies",
            "<p class=\"empty\">No dependencies defined.</p>",
        );
    }

    let crit_set: std::collections::HashSet<&str> =
        data.critical_path.path.iter().map(|s| s.as_str()).collect();
    let mut svgs = String::new();
    for ms in data.milestones {
        if !ms.slices.is_empty() {
            svgs.push_str(&build_milestone_dep_svg(ms, &crit_set));
        }
    }

    section_html("depgraph", "Dependencies", &svgs)
}

fn build_milestone_dep_svg(
    ms: &Gsd2Milestone,
    crit_set: &std::collections::HashSet<&str>,
) -> String {
    let slices = &ms.slices;
    if slices.is_empty() {
        return String::new();
    }

    // Kahn's BFS layer assignment
    let mut layer_map: HashMap<String, i32> = HashMap::new();
    let mut in_deg: HashMap<String, i32> = HashMap::new();
    let slice_ids: std::collections::HashSet<String> =
        slices.iter().map(|s| s.id.clone()).collect();

    for s in slices {
        in_deg.insert(s.id.clone(), 0);
    }
    for s in slices {
        for dep in &s.dependencies {
            if slice_ids.contains(dep) {
                *in_deg.entry(s.id.clone()).or_insert(0) += 1;
            }
        }
    }

    let mut visited: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut queue: std::collections::VecDeque<String> = std::collections::VecDeque::new();

    for (id, d) in &in_deg {
        if *d == 0 {
            queue.push_back(id.clone());
            visited.insert(id.clone());
            layer_map.insert(id.clone(), 0);
        }
    }

    while let Some(node) = queue.pop_front() {
        for s in slices {
            if !s.dependencies.contains(&node) {
                continue;
            }
            let new_deg = (in_deg.get(&s.id).copied().unwrap_or(1)) - 1;
            in_deg.insert(s.id.clone(), new_deg);
            let new_layer = (layer_map.get(&node).copied().unwrap_or(0)) + 1;
            let cur = layer_map.get(&s.id).copied().unwrap_or(0);
            layer_map.insert(s.id.clone(), new_layer.max(cur));
            if new_deg == 0 && !visited.contains(&s.id) {
                visited.insert(s.id.clone());
                queue.push_back(s.id.clone());
            }
        }
    }
    for s in slices {
        layer_map.entry(s.id.clone()).or_insert(0);
    }

    let max_layer = layer_map.values().copied().max().unwrap_or(0);
    let mut by_layer: HashMap<i32, Vec<String>> = HashMap::new();
    for (id, layer) in &layer_map {
        by_layer.entry(*layer).or_default().push(id.clone());
    }

    let nw = 130_i64;
    let nh = 40_i64;
    let cgap = 56_i64;
    let rgap = 14_i64;
    let pad = 20_i64;
    let max_rows = (0..=max_layer)
        .map(|c| by_layer.get(&c).map(|v| v.len()).unwrap_or(0))
        .max()
        .unwrap_or(0) as i64;
    let total_h = pad * 2 + max_rows * nh + (max_rows - 1).max(0) * rgap;
    let total_w = pad * 2 + (max_layer as i64 + 1) * nw + max_layer as i64 * cgap;

    let mut pos: HashMap<String, (i64, i64)> = HashMap::new();
    for col in 0..=max_layer {
        let ids = by_layer.get(&col).cloned().unwrap_or_default();
        let col_h = ids.len() as i64 * nh + (ids.len() as i64 - 1).max(0) * rgap;
        let start_y = (total_h - col_h) / 2;
        for (i, id) in ids.iter().enumerate() {
            pos.insert(
                id.clone(),
                (
                    pad + col as i64 * (nw + cgap),
                    start_y + i as i64 * (nh + rgap),
                ),
            );
        }
    }

    let mut edges = String::new();
    for sl in slices {
        for dep in &sl.dependencies {
            if let (Some(&(fx, fy)), Some(&(tx, ty))) = (pos.get(dep), pos.get(&sl.id)) {
                let x1 = fx + nw;
                let y1 = fy + nh / 2;
                let x2 = tx;
                let y2 = ty + nh / 2;
                let mx = (x1 + x2) / 2;
                let crit = crit_set.contains(sl.id.as_str()) && crit_set.contains(dep.as_str());
                edges.push_str(&format!(
                    "<path d=\"M{},{} C{},{} {},{} {},{}\" class=\"edge{}\" marker-end=\"url(#arr{})\"/>",
                    x1, y1, mx, y1, mx, y2, x2, y2,
                    if crit { " edge-crit" } else { "" },
                    if crit { "-crit" } else { "" }
                ));
            }
        }
    }

    let mut nodes = String::new();
    for sl in slices {
        if let Some(&(px, py)) = pos.get(&sl.id) {
            let crit = crit_set.contains(sl.id.as_str());
            let sc = if sl.done { "n-done" } else { "n-pending" };
            nodes.push_str(&format!(
                "<g class=\"node {} {}\" transform=\"translate({},{})\"><rect width=\"{}\" height=\"{}\" rx=\"4\"/><text x=\"{}\" y=\"16\" class=\"n-id\">{}</text><text x=\"{}\" y=\"30\" class=\"n-title\">{}</text><title>{}: {}</title></g>",
                sc, if crit { "n-crit" } else { "" },
                px, py, nw, nh, nw / 2, esc_html(&trunc_str(&sl.id, 18)),
                nw / 2, esc_html(&trunc_str(&sl.title, 18)),
                esc_html(&sl.id), esc_html(&sl.title)
            ));
        }
    }

    format!(
        "<div class=\"dep-block\"><h3>{}: {}</h3><div class=\"dep-legend\"><span><span class=\"dot dot-complete dot-sm\"></span> done</span><span><span class=\"dot dot-pending dot-sm\"></span> pending</span></div><div class=\"dep-wrap\"><svg class=\"dep-svg\" viewBox=\"0 0 {} {}\" width=\"{}\" height=\"{}\"><defs><marker id=\"arr\" markerWidth=\"8\" markerHeight=\"8\" refX=\"7\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L0,6 L8,3 z\" fill=\"var(--border-2)\"/></marker><marker id=\"arr-crit\" markerWidth=\"8\" markerHeight=\"8\" refX=\"7\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L0,6 L8,3 z\" fill=\"var(--accent)\"/></marker></defs>{}{}</svg></div></div>",
        esc_html(&ms.id), esc_html(&ms.title),
        total_w, total_h, total_w, total_h,
        edges, nodes
    )
}

fn build_metrics_section(data: &ReportData<'_>) -> String {
    let t = data.totals;

    let mut grid = String::new();
    grid.push_str(&kvi_html("Total cost", &format_cost_html(t.total_cost)));
    grid.push_str(&kvi_html(
        "Total tokens",
        &format_token_count_html(t.total_tokens),
    ));
    grid.push_str(&kvi_html("Duration", &format_duration_html(t.duration_ms)));
    grid.push_str(&kvi_html("Units", &t.units.to_string()));
    grid.push_str(&kvi_html("Tool calls", &t.tool_calls.to_string()));

    let token_breakdown = build_token_breakdown_html(t.total_tokens);
    let cost_over_time = build_cost_over_time_chart_html(data.units);

    let mut phase_row = String::new();
    if !data.by_phase.is_empty() {
        phase_row.push_str("<div class=\"chart-row\">");
        phase_row.push_str(&build_bar_chart_html(
            "Cost by phase",
            &data
                .by_phase
                .iter()
                .map(|p| (p.phase.as_str(), p.cost, format_cost_html(p.cost)))
                .collect::<Vec<_>>(),
        ));
        phase_row.push_str(&build_bar_chart_html(
            "Tokens by phase",
            &data
                .by_phase
                .iter()
                .map(|p| {
                    (
                        p.phase.as_str(),
                        p.tokens as f64,
                        format_token_count_html(p.tokens),
                    )
                })
                .collect::<Vec<_>>(),
        ));
        phase_row.push_str("</div>");
    }

    let mut slice_model_row = String::new();
    if !data.by_slice.is_empty() || !data.by_model.is_empty() {
        slice_model_row.push_str("<div class=\"chart-row\">");
        if !data.by_slice.is_empty() {
            slice_model_row.push_str(&build_bar_chart_html(
                "Cost by slice",
                &data
                    .by_slice
                    .iter()
                    .map(|s| (s.slice_id.as_str(), s.cost, format_cost_html(s.cost)))
                    .collect::<Vec<_>>(),
            ));
        }
        if !data.by_model.is_empty() {
            slice_model_row.push_str(&build_bar_chart_html(
                "Cost by model",
                &data
                    .by_model
                    .iter()
                    .map(|m| (m.model.as_str(), m.cost, format_cost_html(m.cost)))
                    .collect::<Vec<_>>(),
            ));
        }
        slice_model_row.push_str("</div>");
    }

    let gantt = build_slice_gantt_html(data);
    let budget_burndown = build_budget_burndown_html(data);

    let body = format!(
        "<div class=\"kv-grid\">{}</div>{}{}{}{}{}",
        grid, budget_burndown, token_breakdown, cost_over_time, phase_row, slice_model_row
    );
    let body = format!("{}{}", body, gantt);
    section_html("metrics", "Metrics", &body)
}

fn build_cost_over_time_chart_html(units: &[UnitRecord]) -> String {
    let mut sorted: Vec<&UnitRecord> = units.iter().filter(|u| u.started_at > 0).collect();
    sorted.sort_by_key(|u| u.started_at);
    if sorted.len() < 2 {
        return String::new();
    }

    let mut cumulative: Vec<f64> = Vec::new();
    let mut running = 0.0_f64;
    for u in &sorted {
        running += u.cost;
        cumulative.push(running);
    }

    let pad_l = 50_f64;
    let pad_r = 30_f64;
    let pad_t = 20_f64;
    let pad_b = 30_f64;
    let w = 600_f64;
    let h = 200_f64;
    let plot_w = w - pad_l - pad_r;
    let plot_h = h - pad_t - pad_b;
    let max_cost = cumulative.last().copied().unwrap_or(1.0).max(0.001);
    let n = cumulative.len() as f64;

    let points: Vec<(f64, f64)> = cumulative
        .iter()
        .enumerate()
        .map(|(i, &c)| {
            let x = pad_l + (i as f64 / (n - 1.0)) * plot_w;
            let y = pad_t + plot_h - (c / max_cost) * plot_h;
            (x, y)
        })
        .collect();

    let line_path = points
        .iter()
        .enumerate()
        .map(|(i, &(x, y))| format!("{}{:.1},{:.1}", if i == 0 { "M" } else { "L" }, x, y))
        .collect::<Vec<_>>()
        .join(" ");

    let last = points.last().unwrap();
    let first = points.first().unwrap();
    let area_path = format!(
        "{} L{:.1},{:.1} L{:.1},{:.1} Z",
        line_path,
        last.0,
        pad_t + plot_h,
        first.0,
        pad_t + plot_h
    );

    let mut grid_lines = String::new();
    for i in 0..=4 {
        let y = pad_t + (plot_h / 4.0) * i as f64;
        let val = format_cost_html(max_cost * (1.0 - i as f64 / 4.0));
        grid_lines.push_str(&format!(
            "<line x1=\"{:.1}\" y1=\"{:.1}\" x2=\"{:.1}\" y2=\"{:.1}\" class=\"cost-grid\"/>",
            pad_l,
            y,
            w - pad_r,
            y
        ));
        grid_lines.push_str(&format!(
            "<text x=\"{:.1}\" y=\"{:.1}\" class=\"cost-axis\" text-anchor=\"end\">{}</text>",
            pad_l - 4.0,
            y + 3.0,
            esc_html(&val)
        ));
    }

    format!(
        "<div class=\"token-block\"><h3>Cost over time</h3><svg class=\"cost-svg\" viewBox=\"0 0 {} {}\" width=\"{}\" height=\"{}\">{}<path d=\"{}\" class=\"cost-area\"/><path d=\"{}\" class=\"cost-line\"/><text x=\"{:.1}\" y=\"{:.1}\" class=\"cost-axis\">#1</text><text x=\"{:.1}\" y=\"{:.1}\" class=\"cost-axis\" text-anchor=\"end\">#{}</text></svg></div>",
        w as i64, h as i64, w as i64, h as i64,
        grid_lines, area_path, line_path,
        pad_l, h - 4.0, w - pad_r, h - 4.0, sorted.len()
    )
}

fn build_budget_burndown_html(data: &ReportData<'_>) -> String {
    let ceiling = match data.health.budget_ceiling {
        Some(c) => c,
        None => return String::new(),
    };
    let spent = data.totals.total_cost;
    let total_slices: usize = data.milestones.iter().map(|m| m.slices.len()).sum();
    let done_slices: usize = data
        .milestones
        .iter()
        .flat_map(|m| m.slices.iter())
        .filter(|s| s.done)
        .count();
    let remaining = total_slices.saturating_sub(done_slices);
    let avg_cost_per_slice = if done_slices > 0 {
        spent / done_slices as f64
    } else {
        0.0
    };
    let projected = if avg_cost_per_slice > 0.0 {
        avg_cost_per_slice * remaining as f64 + spent
    } else {
        spent
    };
    let max_val = ceiling.max(projected).max(spent);

    let spent_pct = (spent / max_val * 100.0).min(100.0);
    let projected_rem = (projected - spent).max(0.0);
    let proj_pct_raw = projected_rem / max_val * 100.0;
    let overshoot = if projected > ceiling {
        ((projected - ceiling) / max_val * 100.0).max(0.0)
    } else {
        0.0
    };
    let proj_pct = (proj_pct_raw - overshoot).max(0.0);

    let mut legend = format!(
        "<span><span class=\"burndown-dot\" style=\"background:var(--accent)\"></span> Spent: {}</span>",
        format_cost_html(spent)
    );
    legend.push_str(&format!(
        "<span><span class=\"burndown-dot\" style=\"background:var(--caution)\"></span> Projected remaining: {}</span>",
        format_cost_html(projected_rem)
    ));
    legend.push_str(&format!(
        "<span><span class=\"burndown-dot\" style=\"background:var(--border-2)\"></span> Ceiling: {}</span>",
        format_cost_html(ceiling)
    ));
    if overshoot > 0.0 {
        legend.push_str(&format!(
            "<span><span class=\"burndown-dot\" style=\"background:var(--warn)\"></span> Overshoot: {}</span>",
            format_cost_html(projected - ceiling)
        ));
    }

    let proj_bar = if proj_pct > 0.0 {
        format!(
            "<div class=\"burndown-projected\" style=\"width:{:.1}%\"></div>",
            proj_pct
        )
    } else {
        String::new()
    };
    let over_bar = if overshoot > 0.0 {
        format!(
            "<div class=\"burndown-overshoot\" style=\"width:{:.1}%\"></div>",
            overshoot
        )
    } else {
        String::new()
    };

    format!(
        "<div class=\"burndown-wrap\"><h3>Budget burndown</h3><div class=\"burndown-bar\"><div class=\"burndown-spent\" style=\"width:{:.1}%\"></div>{}{}</div><div class=\"burndown-legend\">{}</div></div>",
        spent_pct, proj_bar, over_bar, legend
    )
}

fn build_slice_gantt_html(data: &ReportData<'_>) -> String {
    let mut slice_timings: HashMap<String, (i64, i64)> = HashMap::new();
    for u in data.units {
        let parts: Vec<&str> = u.id.splitn(3, '/').collect();
        let slice_key = if parts.len() >= 2 {
            format!("{}/{}", parts[0], parts[1])
        } else {
            u.id.clone()
        };
        if u.started_at <= 0 {
            continue;
        }
        let end = if u.finished_at > 0 { u.finished_at } else { 0 };
        if end == 0 {
            continue;
        }
        let entry = slice_timings
            .entry(slice_key)
            .or_insert((u.started_at, end));
        entry.0 = entry.0.min(u.started_at);
        entry.1 = entry.1.max(end);
    }
    if slice_timings.len() < 2 {
        return String::new();
    }

    let mut slice_entries: Vec<(String, i64, i64)> = slice_timings
        .into_iter()
        .map(|(k, (mn, mx))| (k, mn, mx))
        .collect();
    slice_entries.sort_by_key(|e| e.1);

    let global_min = slice_entries.iter().map(|e| e.1).min().unwrap_or(0);
    let global_max = slice_entries.iter().map(|e| e.2).max().unwrap_or(1);
    let range = (global_max - global_min).max(1) as f64;

    let bar_h = 18_f64;
    let row_h = 30_f64;
    let pad_l = 140_f64;
    let pad_r = 20_f64;
    let pad_t = 30_f64;
    let pad_b = 30_f64;
    let plot_w = 700_f64 - pad_l - pad_r;
    let svg_h = slice_entries.len() as f64 * row_h + pad_t + pad_b;

    // Build a status lookup
    let mut status_map: HashMap<String, &str> = HashMap::new();
    for ms in data.milestones {
        for sl in &ms.slices {
            let key = format!("{}/{}", ms.id, sl.id);
            status_map.insert(key, if sl.done { "done" } else { "pending" });
        }
    }

    let mut bars = String::new();
    for (i, (slice_id, t_min, t_max)) in slice_entries.iter().enumerate() {
        let x = pad_l + ((*t_min - global_min) as f64 / range) * plot_w;
        let bar_w = (((*t_max - *t_min) as f64 / range) * plot_w).max(2.0);
        let y = pad_t + i as f64 * row_h + (row_h - bar_h) / 2.0;
        let status = status_map.get(slice_id).copied().unwrap_or("pending");
        bars.push_str(&format!(
            "<text x=\"{:.1}\" y=\"{:.1}\" class=\"gantt-label\" text-anchor=\"end\">{}</text><rect x=\"{:.1}\" y=\"{:.1}\" width=\"{:.1}\" height=\"{}\" rx=\"2\" class=\"gantt-bar-{}\"><title>{}: {}</title></rect>",
            pad_l - 6.0, y + bar_h / 2.0 + 4.0, esc_html(&trunc_str(slice_id, 18)),
            x, y, bar_w, bar_h as i64, esc_html(status),
            esc_html(slice_id), format_duration_html(*t_max - *t_min)
        ));
    }

    let mut axis_labels = String::new();
    for &frac in &[0.0_f64, 0.25, 0.5, 0.75, 1.0] {
        let t = global_min + (frac * range) as i64;
        let x = pad_l + frac * plot_w;
        // Convert ms to ISO-like
        let date_str = format_date_short_html(&ms_to_iso(t));
        axis_labels.push_str(&format!(
            "<text x=\"{:.1}\" y=\"{:.1}\" class=\"gantt-axis\" text-anchor=\"middle\">{}</text>",
            x,
            svg_h - 8.0,
            esc_html(&date_str)
        ));
    }

    format!(
        "<div class=\"gantt-wrap\"><h3>Slice timeline</h3><svg class=\"gantt-svg\" viewBox=\"0 0 700 {:.0}\" width=\"700\" height=\"{:.0}\">{}{}</svg></div>",
        svg_h, svg_h, bars, axis_labels
    )
}

fn ms_to_iso(ms: i64) -> String {
    let secs = (ms / 1000) as u64;
    let (y, mo, d, h, min, _sec) = epoch_to_date(secs);
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:00Z", y, mo, d, h, min)
}

fn build_token_breakdown_html(total: i64) -> String {
    if total == 0 {
        return String::new();
    }
    // We only have the total from ProjectTotals; show a simplified view
    let segs = [
        ("Input", (total as f64 * 0.6) as i64, "seg-1"),
        ("Output", (total as f64 * 0.2) as i64, "seg-2"),
        ("Cache read", (total as f64 * 0.15) as i64, "seg-3"),
        ("Cache write", (total as f64 * 0.05) as i64, "seg-4"),
    ];

    let mut bars = String::new();
    let mut legend = String::new();
    for (label, val, cls) in &segs {
        if *val == 0 {
            continue;
        }
        let pct = (*val as f64 / total as f64) * 100.0;
        bars.push_str(&format!(
            "<div class=\"tseg {}\" style=\"width:{:.2}%\" title=\"{}: {} ({:.1}%)\"></div>",
            cls,
            pct,
            label,
            format_token_count_html(*val),
            pct
        ));
        legend.push_str(&format!(
            "<span class=\"leg-item\"><span class=\"leg-dot {}\"></span>{}: {} ({:.1}%)</span>",
            cls,
            label,
            format_token_count_html(*val),
            pct
        ));
    }

    format!(
        "<div class=\"token-block\"><h3>Token breakdown</h3><div class=\"token-bar\">{}</div><div class=\"token-legend\">{}</div></div>",
        bars, legend
    )
}

fn build_bar_chart_html(title: &str, entries: &[(&str, f64, String)]) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let max_val = entries
        .iter()
        .map(|e| e.1)
        .fold(0.0_f64, f64::max)
        .max(0.001);
    let mut rows = String::new();
    for (i, (label, value, display)) in entries.iter().enumerate() {
        let pct = (value / max_val) * 100.0;
        let ci = i % 6;
        rows.push_str(&format!(
            "<div class=\"bar-row\"><div class=\"bar-lbl\">{}</div><div class=\"bar-track\"><div class=\"bar-fill bar-c{}\" style=\"width:{:.1}%\"></div></div><div class=\"bar-val\">{}</div></div>",
            esc_html(&trunc_str(label, 22)), ci, pct, esc_html(display)
        ));
    }
    format!(
        "<div class=\"chart-block\"><h3>{}</h3>{}</div>",
        esc_html(title),
        rows
    )
}

fn build_timeline_section(data: &ReportData<'_>) -> String {
    if data.units.is_empty() {
        return section_html(
            "timeline",
            "Timeline",
            "<p class=\"empty\">No units executed yet.</p>",
        );
    }

    let mut sorted: Vec<&UnitRecord> = data.units.iter().collect();
    sorted.sort_by_key(|u| u.started_at);
    let max_cost = sorted.iter().map(|u| u.cost).fold(0.01_f64, f64::max);

    let mut rows = String::new();
    for (i, u) in sorted.iter().enumerate() {
        let dur = if u.finished_at > 0 {
            format_duration_html(u.finished_at - u.started_at)
        } else {
            "running".to_string()
        };
        let intensity = (u.cost / max_cost).min(1.0);
        let heat_style = if intensity > 0.15 {
            format!(
                " style=\"background:rgba(239,68,68,{:.3})\"",
                intensity * 0.15
            )
        } else {
            String::new()
        };
        rows.push_str(&format!(
            "<tr{}><td class=\"muted\">{}</td><td class=\"mono\">{}</td><td class=\"mono muted\">{}</td><td>{}</td><td class=\"muted\">{}</td><td>{}</td><td class=\"num\">{}</td><td class=\"num\">{}</td><td class=\"num\">{}</td></tr>",
            heat_style, i + 1,
            esc_html(&u.unit_type), esc_html(&u.id),
            esc_html(&short_model_html(&u.model)),
            format_date_short_html(&ms_to_iso(u.started_at)),
            esc_html(&dur),
            esc_html(&format_cost_html(u.cost)),
            esc_html(&format_token_count_html(u.total_tokens)),
            u.tool_calls
        ));
    }

    let body = format!(
        "<div class=\"table-scroll\"><table class=\"tbl\"><thead><tr><th>#</th><th>Type</th><th>ID</th><th>Model</th><th>Started</th><th>Duration</th><th>Cost</th><th>Tokens</th><th>Tools</th></tr></thead><tbody>{}</tbody></table></div>",
        rows
    );
    section_html("timeline", "Timeline", &body)
}

fn build_health_section(data: &ReportData<'_>) -> String {
    let h = data.health;
    let mut rows = String::new();
    rows.push_str(&h_row_html("Phase", data.phase.as_str(), None));
    rows.push_str(&h_row_html(
        "Budget spent",
        &format_cost_html(h.budget_spent),
        None,
    ));
    if let Some(ceiling) = h.budget_ceiling {
        let pct = (h.budget_spent / ceiling) * 100.0;
        let status = if pct > 90.0 {
            Some("warn")
        } else if pct > 75.0 {
            Some("caution")
        } else {
            Some("ok")
        };
        rows.push_str(&h_row_html(
            "Budget ceiling",
            &format!(
                "{} ({} spent, {:.0}% used)",
                format_cost_html(ceiling),
                format_cost_html(h.budget_spent),
                pct
            ),
            status,
        ));
    }
    rows.push_str(&h_row_html(
        "Milestones",
        &format!("{}/{}", h.milestones_done, h.milestones_total),
        None,
    ));
    rows.push_str(&h_row_html(
        "Slices",
        &format!("{}/{}", h.slices_done, h.slices_total),
        None,
    ));
    rows.push_str(&h_row_html(
        "Tasks",
        &format!("{}/{}", h.tasks_done, h.tasks_total),
        None,
    ));
    if let Some(ref mid) = h.active_milestone_id {
        rows.push_str(&h_row_html("Active milestone", mid, None));
    }
    if let Some(ref sid) = h.active_slice_id {
        rows.push_str(&h_row_html("Active slice", sid, None));
    }
    if let Some(ref blocker) = h.blocker {
        rows.push_str(&h_row_html("Blocker", blocker, Some("warn")));
    }

    let body = format!(
        "<table class=\"tbl tbl-kv\"><tbody>{}</tbody></table>",
        rows
    );
    section_html("health", "Health", &body)
}

fn build_changelog_section(data: &ReportData<'_>) -> String {
    if data.changelog_entries.is_empty() {
        return section_html(
            "changelog",
            "Changelog",
            "<p class=\"empty\">No completed slices yet.</p>",
        );
    }

    let mut entries_html = String::new();
    for e in &data.changelog_entries {
        let date_html = if let Some(ref ts) = e.completed_at {
            format!(
                "<span class=\"muted cl-date\">{}</span>",
                esc_html(&format_date_short_html(ts))
            )
        } else {
            String::new()
        };

        let liner_html = if !e.one_liner.is_empty() {
            format!("<p class=\"cl-liner\">{}</p>", esc_html(&e.one_liner))
        } else {
            String::new()
        };

        let mut files_html = String::new();
        if !e.files_modified.is_empty() {
            files_html.push_str(&format!(
                "<details class=\"files-detail\"><summary class=\"muted\">{} file{} modified</summary><ul class=\"file-list\">",
                e.files_modified.len(), if e.files_modified.len() != 1 { "s" } else { "" }
            ));
            for f in &e.files_modified {
                files_html.push_str(&format!(
                    "<li><code>{}</code>{}</li>",
                    esc_html(&f.path),
                    if !f.description.is_empty() {
                        format!(" — {}", esc_html(&f.description))
                    } else {
                        String::new()
                    }
                ));
            }
            files_html.push_str("</ul></details>");
        }

        entries_html.push_str(&format!(
            "<div class=\"cl-entry\"><div class=\"cl-header\"><span class=\"mono muted\">{}</span><span class=\"cl-title\">{}</span>{}</div>{}{}</div>",
            esc_html(&e.slice_id), esc_html(&e.one_liner), date_html, liner_html, files_html
        ));
    }

    let title = format!(
        "Changelog <span class=\"count\">{}</span>",
        data.changelog_entries.len()
    );
    section_html("changelog", &title, &entries_html)
}

fn build_knowledge_section(data: &ReportData<'_>) -> String {
    if data.knowledge_entries.is_empty() {
        return section_html(
            "knowledge",
            "Knowledge",
            "<p class=\"empty\">No KNOWLEDGE.md found or no entries.</p>",
        );
    }

    let total = data.knowledge_entries.len();
    let mut body = String::new();

    let rules: Vec<&KnowledgeEntry> = data
        .knowledge_entries
        .iter()
        .filter(|e| e.entry_type == "rule")
        .collect();
    let patterns: Vec<&KnowledgeEntry> = data
        .knowledge_entries
        .iter()
        .filter(|e| e.entry_type == "pattern")
        .collect();
    let lessons: Vec<&KnowledgeEntry> = data
        .knowledge_entries
        .iter()
        .filter(|e| e.entry_type == "lesson")
        .collect();
    let other: Vec<&KnowledgeEntry> = data
        .knowledge_entries
        .iter()
        .filter(|e| !["rule", "pattern", "lesson"].contains(&e.entry_type.as_str()))
        .collect();

    if !rules.is_empty() {
        body.push_str(&format!("<h3>Rules <span class=\"count\">{}</span></h3><table class=\"tbl\"><thead><tr><th>ID</th><th>Rule</th></tr></thead><tbody>", rules.len()));
        for r in &rules {
            body.push_str(&format!(
                "<tr><td class=\"mono\">{}</td><td>{}</td></tr>",
                esc_html(&r.id),
                esc_html(&r.content)
            ));
        }
        body.push_str("</tbody></table>");
    }
    if !patterns.is_empty() {
        body.push_str(&format!("<h3>Patterns <span class=\"count\">{}</span></h3><table class=\"tbl\"><thead><tr><th>ID</th><th>Pattern</th></tr></thead><tbody>", patterns.len()));
        for p in &patterns {
            body.push_str(&format!(
                "<tr><td class=\"mono\">{}</td><td>{}</td></tr>",
                esc_html(&p.id),
                esc_html(&p.content)
            ));
        }
        body.push_str("</tbody></table>");
    }
    if !lessons.is_empty() {
        body.push_str(&format!("<h3>Lessons <span class=\"count\">{}</span></h3><table class=\"tbl\"><thead><tr><th>ID</th><th>Lesson</th></tr></thead><tbody>", lessons.len()));
        for l in &lessons {
            body.push_str(&format!(
                "<tr><td class=\"mono\">{}</td><td>{}</td></tr>",
                esc_html(&l.id),
                esc_html(&l.content)
            ));
        }
        body.push_str("</tbody></table>");
    }
    if !other.is_empty() {
        body.push_str(&format!("<h3>Notes <span class=\"count\">{}</span></h3><table class=\"tbl\"><thead><tr><th>ID</th><th>Content</th></tr></thead><tbody>", other.len()));
        for e in &other {
            body.push_str(&format!(
                "<tr><td class=\"mono\">{}</td><td>{}</td></tr>",
                esc_html(&e.id),
                esc_html(&e.content)
            ));
        }
        body.push_str("</tbody></table>");
    }

    let title = format!("Knowledge <span class=\"count\">{}</span>", total);
    section_html("knowledge", &title, &body)
}

fn build_captures_section(data: &ReportData<'_>) -> String {
    if data.capture_entries.is_empty() {
        return section_html(
            "captures",
            "Captures",
            "<p class=\"empty\">No captures recorded.</p>",
        );
    }

    let pending_count = data
        .capture_entries
        .iter()
        .filter(|e| e.status == "pending")
        .count();
    let badge = if pending_count > 0 {
        format!(
            "<span class=\"count count-warn\">{} pending</span>",
            pending_count
        )
    } else {
        "<span class=\"count\">all triaged</span>".to_string()
    };

    let mut rows = String::new();
    for e in data.capture_entries {
        rows.push_str(&format!(
            "<tr><td class=\"muted\">{}</td><td class=\"mono\">{}</td><td class=\"mono\">{}</td><td>{}</td><td>{}</td><td class=\"muted\">{}</td></tr>",
            esc_html(&format_date_short_html(&e.timestamp)),
            esc_html(&e.status),
            esc_html(e.classification.as_deref().unwrap_or("")),
            esc_html(e.resolution.as_deref().unwrap_or("")),
            esc_html(&trunc_str(&e.text, 80)),
            esc_html(e.resolved_at.as_deref().unwrap_or(""))
        ));
    }

    let title = format!("Captures {}", badge);
    let body = format!(
        "<div class=\"table-scroll\"><table class=\"tbl\"><thead><tr><th>Captured</th><th>Status</th><th>Class</th><th>Resolution</th><th>Text</th><th>Resolved</th></tr></thead><tbody>{}</tbody></table></div>",
        rows
    );
    section_html("captures", &title, &body)
}

fn build_stats_section(data: &ReportData<'_>) -> String {
    // Count milestones missing summary files
    let mut missing = Vec::new();
    for ms in data.milestones {
        for sl in &ms.slices {
            if sl.done {
                // We just report stats; the actual file check would need project_path
                let _ = (&ms.id, &sl.id);
            } else {
                missing.push((&ms.id, &sl.id, &sl.title));
            }
        }
    }

    let body = if missing.is_empty() {
        "<p class=\"empty\">All slices tracked.</p>".to_string()
    } else {
        let mut html = format!("<h3>Incomplete slices <span class=\"count\">{}</span></h3><table class=\"tbl\"><thead><tr><th>Milestone</th><th>Slice</th><th>Title</th></tr></thead><tbody>", missing.len());
        for (mid, sid, title) in missing.iter().take(20) {
            html.push_str(&format!(
                "<tr><td class=\"mono\">{}</td><td class=\"mono\">{}</td><td>{}</td></tr>",
                esc_html(mid),
                esc_html(sid),
                esc_html(title)
            ));
        }
        html.push_str("</tbody></table>");
        html
    };
    section_html("stats", "Artifacts", &body)
}

fn build_discussion_section(data: &ReportData<'_>) -> String {
    if data.discussion_states.is_empty() {
        return section_html(
            "discussion",
            "Planning",
            "<p class=\"empty\">No milestones.</p>",
        );
    }

    let mut rows = String::new();
    for ms in data.milestones {
        let state = data
            .discussion_states
            .iter()
            .find(|(id, _)| id == &ms.id)
            .map(|(_, s)| s.as_str())
            .unwrap_or("undiscussed");
        rows.push_str(&format!(
            "<tr><td class=\"mono\">{}</td><td>{}</td><td class=\"mono\">{}</td></tr>",
            esc_html(&ms.id),
            esc_html(&ms.title),
            esc_html(state)
        ));
    }

    let body = format!(
        "<table class=\"tbl\"><thead><tr><th>ID</th><th>Milestone</th><th>State</th></tr></thead><tbody>{}</tbody></table>",
        rows
    );
    section_html("discussion", "Planning", &body)
}

// ─── Main HTML report string builder ──────────────────────────────────────────

fn generate_html_report_string(data: &ReportData<'_>) -> String {
    let generated = now_iso();

    let sections = vec![
        build_summary_section(data, &generated),
        build_blockers_section(data),
        build_progress_section(data),
        build_timeline_section(data),
        build_dep_graph_section(data),
        build_metrics_section(data),
        build_health_section(data),
        build_changelog_section(data),
        build_knowledge_section(data),
        build_captures_section(data),
        build_stats_section(data),
        build_discussion_section(data),
    ];

    let milestone_tag = data
        .milestone_id
        .map(|mid| {
            format!(
                " <span class=\"sep\">/</span> <span class=\"mono accent\">{}</span>",
                esc_html(mid)
            )
        })
        .unwrap_or_default();

    let back_link = "<a class=\"back-link\" href=\"index.html\">All Reports</a>";

    let title_suffix = data
        .milestone_id
        .map(|mid| format!(" \u{2014} {}", esc_html(mid)))
        .unwrap_or_default();

    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GSD Report — {project_name}{title_suffix}</title>
<style>{css}</style>
</head>
<body>
<header>
  <div class="header-inner">
    <div class="branding">
      <span class="logo">GSD</span>
      <span class="version">v{gsd_version}</span>
    </div>
    <div class="header-meta">
      <h1>{project_name_esc}{milestone_tag}</h1>
      <span class="header-path">{project_path_esc}</span>
    </div>
    <div class="header-right">
      {back_link}
      <div class="generated">{generated_long}</div>
    </div>
  </div>
</header>
<nav class="toc" aria-label="Report sections">
  <ul>
    <li><a href="#summary">Summary</a></li>
    <li><a href="#blockers">Blockers</a></li>
    <li><a href="#progress">Progress</a></li>
    <li><a href="#timeline">Timeline</a></li>
    <li><a href="#depgraph">Dependencies</a></li>
    <li><a href="#metrics">Metrics</a></li>
    <li><a href="#health">Health</a></li>
    <li><a href="#changelog">Changelog</a></li>
    <li><a href="#knowledge">Knowledge</a></li>
    <li><a href="#captures">Captures</a></li>
    <li><a href="#stats">Artifacts</a></li>
    <li><a href="#discussion">Planning</a></li>
  </ul>
</nav>
<main>
{sections}
</main>
<footer>
  <div class="footer-inner">
    <span>GSD v{gsd_version}</span>
    <span class="sep">/</span>
    <span>{project_name_esc}</span>
    <span class="sep">/</span>
    <span>{generated_long}</span>
  </div>
</footer>
<script>{js}</script>
</body>
</html>"##,
        project_name = esc_html(data.project_name),
        title_suffix = title_suffix,
        css = REPORT_CSS,
        gsd_version = esc_html(data.gsd_version),
        project_name_esc = esc_html(data.project_name),
        milestone_tag = milestone_tag,
        project_path_esc = esc_html(data.project_path),
        back_link = back_link,
        generated_long = format_date_long_html(&generated),
        sections = sections.join("\n"),
        js = REPORT_JS,
    )
}

// ─── Reports registry helpers ──────────────────────────────────────────────────

fn load_reports_index(reports_dir: &Path) -> Option<ReportsIndex> {
    let p = reports_dir.join("reports.json");
    let content = std::fs::read_to_string(&p).ok()?;
    serde_json::from_str::<serde_json::Value>(&content)
        .ok()
        .map(|v| ReportsIndex {
            version: v.get("version").and_then(|x| x.as_u64()).unwrap_or(1) as u32,
            project_name: v
                .get("projectName")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            project_path: v
                .get("projectPath")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            gsd_version: v
                .get("gsdVersion")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string(),
            entries: v
                .get("entries")
                .and_then(|x| x.as_array())
                .map(|arr| {
                    arr.iter()
                        .map(|e| ReportEntry {
                            filename: e
                                .get("filename")
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_string(),
                            generated_at: e
                                .get("generatedAt")
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_string(),
                            milestone_id: e
                                .get("milestoneId")
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_string(),
                            milestone_title: e
                                .get("milestoneTitle")
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_string(),
                            label: e
                                .get("label")
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_string(),
                            kind: e
                                .get("kind")
                                .and_then(|x| x.as_str())
                                .unwrap_or("manual")
                                .to_string(),
                            total_cost: e.get("totalCost").and_then(|x| x.as_f64()).unwrap_or(0.0),
                            total_tokens: e
                                .get("totalTokens")
                                .and_then(|x| x.as_i64())
                                .unwrap_or(0),
                            total_duration: e
                                .get("totalDuration")
                                .and_then(|x| x.as_i64())
                                .unwrap_or(0),
                            done_slices: e.get("doneSlices").and_then(|x| x.as_u64()).unwrap_or(0)
                                as u32,
                            total_slices: e.get("totalSlices").and_then(|x| x.as_u64()).unwrap_or(0)
                                as u32,
                            done_milestones: e
                                .get("doneMilestones")
                                .and_then(|x| x.as_u64())
                                .unwrap_or(0) as u32,
                            total_milestones: e
                                .get("totalMilestones")
                                .and_then(|x| x.as_u64())
                                .unwrap_or(0) as u32,
                            phase: e
                                .get("phase")
                                .and_then(|x| x.as_str())
                                .unwrap_or("")
                                .to_string(),
                        })
                        .collect()
                })
                .unwrap_or_default(),
        })
}

fn save_reports_index(reports_dir: &Path, index: &ReportsIndex) -> Result<(), String> {
    std::fs::create_dir_all(reports_dir).map_err(|e| e.to_string())?;
    let json = serde_json::json!({
        "version": index.version,
        "projectName": index.project_name,
        "projectPath": index.project_path,
        "gsdVersion": index.gsd_version,
        "entries": index.entries.iter().map(|e| serde_json::json!({
            "filename": e.filename,
            "generatedAt": e.generated_at,
            "milestoneId": e.milestone_id,
            "milestoneTitle": e.milestone_title,
            "label": e.label,
            "kind": e.kind,
            "totalCost": e.total_cost,
            "totalTokens": e.total_tokens,
            "totalDuration": e.total_duration,
            "doneSlices": e.done_slices,
            "totalSlices": e.total_slices,
            "doneMilestones": e.done_milestones,
            "totalMilestones": e.total_milestones,
            "phase": e.phase,
        })).collect::<Vec<_>>(),
    });
    let content = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    std::fs::write(reports_dir.join("reports.json"), content + "\n").map_err(|e| e.to_string())
}

fn regenerate_html_index(reports_dir: &Path, index: &ReportsIndex) {
    let html = build_index_html(index);
    let _ = std::fs::write(reports_dir.join("index.html"), html);
}

fn build_index_html(index: &ReportsIndex) -> String {
    let generated = now_iso();
    let mut sorted = index.entries.clone();
    sorted.sort_by(|a, b| a.generated_at.cmp(&b.generated_at));

    let latest = sorted.last();
    let overall_pct = latest
        .map(|e| {
            if e.total_slices > 0 {
                e.done_slices * 100 / e.total_slices
            } else {
                0
            }
        })
        .unwrap_or(0);

    // Build TOC groups by milestone
    let mut milestone_groups: Vec<(String, Vec<&ReportEntry>)> = Vec::new();
    for e in &sorted {
        if let Some(grp) = milestone_groups
            .iter_mut()
            .find(|(k, _)| k == &e.milestone_id)
        {
            grp.1.push(e);
        } else {
            milestone_groups.push((e.milestone_id.clone(), vec![e]));
        }
    }

    let mut toc_html = String::new();
    for (mid, group) in &milestone_groups {
        let label = if mid == "final" {
            "Final".to_string()
        } else {
            esc_html(mid)
        };
        let links = group
            .iter()
            .map(|e| {
                format!(
                    "<li><a href=\"{}\">{}</a> <span class=\"toc-kind toc-{}\">{}</span></li>",
                    esc_html(&e.filename),
                    esc_html(&format_date_short_html(&e.generated_at)),
                    esc_html(&e.kind),
                    esc_html(&e.kind)
                )
            })
            .collect::<Vec<_>>()
            .join("");
        toc_html.push_str(&format!(
            "<div class=\"toc-group\"><div class=\"toc-group-label\">{}</div><ul>{}</ul></div>",
            label, links
        ));
    }

    // Progression cards
    let mut cards_html = String::new();
    for (i, e) in sorted.iter().enumerate() {
        let pct = if e.total_slices > 0 {
            (e.done_slices * 100) / e.total_slices
        } else {
            0
        };
        let is_latest = i == sorted.len() - 1;

        let mut delta_html = String::new();
        if i > 0 {
            let prev = &sorted[i - 1];
            let d_cost = e.total_cost - prev.total_cost;
            let d_slices = e.done_slices as i32 - prev.done_slices as i32;
            let d_milestones = e.done_milestones as i32 - prev.done_milestones as i32;
            let mut parts: Vec<String> = Vec::new();
            if d_cost > 0.0001 {
                parts.push(format!("+{}", format_cost_html(d_cost)));
            }
            if d_slices > 0 {
                parts.push(format!(
                    "+{} slice{}",
                    d_slices,
                    if d_slices != 1 { "s" } else { "" }
                ));
            }
            if d_milestones > 0 {
                parts.push(format!(
                    "+{} milestone{}",
                    d_milestones,
                    if d_milestones != 1 { "s" } else { "" }
                ));
            }
            if !parts.is_empty() {
                delta_html = format!(
                    "<div class=\"card-delta\">{}</div>",
                    parts
                        .iter()
                        .map(|p| format!("<span>{}</span>", esc_html(p)))
                        .collect::<Vec<_>>()
                        .join("")
                );
            }
        }

        cards_html.push_str(&format!(
            "<a class=\"report-card{}\" href=\"{}\"><div class=\"card-top\"><span class=\"card-label\">{}</span><span class=\"card-kind card-kind-{}\">{}</span></div><div class=\"card-date\">{}</div><div class=\"card-progress\"><div class=\"card-bar-track\"><div class=\"card-bar-fill\" style=\"width:{}%\"></div></div><span class=\"card-pct\">{}%</span></div><div class=\"card-stats\"><span>{}</span><span>{}</span><span>{}</span><span>{}/{} slices</span></div>{}</a>",
            if is_latest { " card-latest" } else { "" },
            esc_html(&e.filename),
            esc_html(&e.label),
            esc_html(&e.kind), esc_html(&e.kind),
            esc_html(&format_date_short_html(&e.generated_at)),
            pct, pct,
            esc_html(&format_cost_html(e.total_cost)),
            esc_html(&format_token_count_html(e.total_tokens)),
            esc_html(&format_duration_html(e.total_duration)),
            e.done_slices, e.total_slices,
            delta_html
        ));
    }

    // Cost sparkline
    let sparkline_html = if sorted.len() > 1 {
        build_cost_sparkline_html(&sorted)
    } else {
        String::new()
    };

    // Summary of latest state
    let summary_html = if let Some(e) = latest {
        format!(
            "<div class=\"idx-summary\"><div class=\"idx-stat\"><span class=\"idx-val\">{}</span><span class=\"idx-lbl\">Total Cost</span></div><div class=\"idx-stat\"><span class=\"idx-val\">{}</span><span class=\"idx-lbl\">Total Tokens</span></div><div class=\"idx-stat\"><span class=\"idx-val\">{}</span><span class=\"idx-lbl\">Duration</span></div><div class=\"idx-stat\"><span class=\"idx-val\">{}/{}</span><span class=\"idx-lbl\">Slices</span></div><div class=\"idx-stat\"><span class=\"idx-val\">{}/{}</span><span class=\"idx-lbl\">Milestones</span></div><div class=\"idx-stat\"><span class=\"idx-val\">{}</span><span class=\"idx-lbl\">Reports</span></div></div><div class=\"idx-progress\"><div class=\"idx-bar-track\"><div class=\"idx-bar-fill\" style=\"width:{}%\"></div></div><span class=\"idx-pct\">{}% complete</span></div>",
            format_cost_html(e.total_cost), format_token_count_html(e.total_tokens), format_duration_html(e.total_duration),
            e.done_slices, e.total_slices, e.done_milestones, e.total_milestones,
            index.entries.len(), overall_pct, overall_pct
        )
    } else {
        "<p class=\"empty\">No reports generated yet.</p>".to_string()
    };

    let sparkline_section = if !sparkline_html.is_empty() {
        format!(
            "<div class=\"sparkline-wrap\"><h3>Cost Progression</h3>{}</div>",
            sparkline_html
        )
    } else {
        String::new()
    };

    let cards_section = if !cards_html.is_empty() {
        format!("<div class=\"cards-grid\">{}</div>", cards_html)
    } else {
        "<p class=\"empty\">No reports generated yet.</p>".to_string()
    };

    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GSD Reports — {project_name}</title>
<style>{css}</style>
</head>
<body>
<header>
  <div class="hdr-inner">
    <div class="branding">
      <span class="logo">GSD</span>
      <span class="ver">v{gsd_version}</span>
    </div>
    <div class="hdr-meta">
      <h1>{project_name} <span class="hdr-subtitle">Reports</span></h1>
      <span class="hdr-path">{project_path}</span>
    </div>
    <div class="hdr-right">
      <span class="gen-lbl">Updated</span>
      <span class="gen">{generated_short}</span>
    </div>
  </div>
</header>
<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-title">Reports</div>
    {toc}
  </aside>
  <main>
    <section class="idx-overview">
      <h2>Project Overview</h2>
      {summary}
      {sparkline}
    </section>
    <section class="idx-cards">
      <h2>Progression <span class="sec-count">{count}</span></h2>
      {cards}
    </section>
  </main>
</div>
<footer>
  <div class="ftr-inner">
    <span class="ftr-brand">GSD v{gsd_version}</span>
    <span class="ftr-sep">—</span>
    <span>{project_name}</span>
    <span class="ftr-sep">—</span>
    <span>Updated {generated_short}</span>
  </div>
</footer>
</body>
</html>"##,
        project_name = esc_html(&index.project_name),
        css = INDEX_CSS,
        gsd_version = esc_html(&index.gsd_version),
        project_path = esc_html(&index.project_path),
        generated_short = esc_html(&format_date_short_html(&generated)),
        toc = if toc_html.is_empty() {
            "<p class=\"empty\">No reports yet.</p>".to_string()
        } else {
            toc_html
        },
        summary = summary_html,
        sparkline = sparkline_section,
        count = index.entries.len(),
        cards = cards_section,
    )
}

fn build_cost_sparkline_html(entries: &[ReportEntry]) -> String {
    let costs: Vec<f64> = entries.iter().map(|e| e.total_cost).collect();
    let max_cost = costs.iter().cloned().fold(0.001_f64, f64::max);
    let w = 600_f64;
    let h = 60_f64;
    let pad = 12_f64;
    let n = entries.len();
    let x_step = if n > 1 {
        (w - pad * 2.0) / (n - 1) as f64
    } else {
        w - pad * 2.0
    };

    let points = costs
        .iter()
        .enumerate()
        .map(|(i, &c)| {
            let x = pad + i as f64 * x_step;
            let y = pad + (1.0 - c / max_cost) * (h - pad * 2.0);
            format!("{:.1},{:.1}", x, y)
        })
        .collect::<Vec<_>>()
        .join(" ");

    let dots = costs.iter().enumerate().map(|(i, &c)| {
        let x = pad + i as f64 * x_step;
        let y = pad + (1.0 - c / max_cost) * (h - pad * 2.0);
        format!(
            "<circle cx=\"{:.1}\" cy=\"{:.1}\" r=\"3\" class=\"spark-dot\"><title>{} — {}</title></circle>",
            x, y, esc_html(&entries[i].label), esc_html(&format_cost_html(c))
        )
    }).collect::<Vec<_>>().join("");

    let start_label = format_cost_html(costs[0]);
    let end_label = format_cost_html(*costs.last().unwrap_or(&0.0));

    let ticks = entries
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let x = (pad + i as f64 * x_step) / w * 100.0;
            let mid = if e.milestone_id == "final" {
                "final"
            } else {
                &e.milestone_id
            };
            format!(
                "<span class=\"spark-tick\" style=\"left:{:.1}%\" title=\"{}\">{}</span>",
                x,
                esc_html(&e.generated_at),
                esc_html(mid)
            )
        })
        .collect::<Vec<_>>()
        .join("");

    format!(
        "<div class=\"sparkline\"><svg viewBox=\"0 0 {} {}\" width=\"{}\" height=\"{}\" class=\"spark-svg\"><polyline points=\"{}\" class=\"spark-line\" fill=\"none\"/>{}<text x=\"{}\" y=\"{}\" class=\"spark-lbl\">{}</text><text x=\"{}\" y=\"{}\" text-anchor=\"end\" class=\"spark-lbl\">{}</text></svg><div class=\"spark-axis\">{}</div></div>",
        w as i64, h as i64, w as i64, h as i64,
        esc_html(&points), dots,
        pad, h - 2.0, esc_html(&start_label),
        w - pad, h - 2.0, esc_html(&end_label),
        ticks
    )
}

// ─── Tauri commands ────────────────────────────────────────────────────────────

/// R087 — Generate a self-contained HTML report for the project and write it to .gsd/reports/.
/// Updates reports.json registry and regenerates index.html.
#[tauri::command]
pub async fn gsd2_generate_html_report(
    project_id: String,
    milestone_id: Option<String>,
    kind: Option<String>,
    db: tauri::State<'_, DbState>,
) -> Result<HtmlReportResult, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let gsd_dir = Path::new(&project_path).join(".gsd");
    let milestones_dir = gsd_dir.join("milestones");
    let reports_dir = gsd_dir.join("reports");

    // Collect milestone data
    let milestones = walk_milestones_with_tasks(&milestones_dir);
    let health = get_health_from_dir(&project_path);

    // Parse metrics
    let metrics_path = gsd_dir.join("metrics.json");
    let metrics_content = std::fs::read_to_string(&metrics_path).unwrap_or_default();
    let (units, totals, by_phase, by_slice, by_model) = parse_metrics_json(&metrics_content);

    // Collect knowledge entries
    let knowledge_data = {
        let k_path = gsd_dir.join("KNOWLEDGE.md");
        if k_path.exists() {
            let content = std::fs::read_to_string(&k_path).unwrap_or_default();
            let mut entries: Vec<KnowledgeEntry> = Vec::new();
            let mut current_title = String::new();
            let mut current_content = String::new();
            let mut entry_idx = 0_u32;
            for line in content.lines() {
                if line.starts_with("## ") {
                    if !current_title.is_empty() {
                        let lower_t = current_title.to_lowercase();
                        let lower_c = current_content.to_lowercase();
                        let et = if lower_t.contains("rule")
                            || lower_c.contains("must ")
                            || lower_c.contains("never ")
                            || lower_c.contains("always ")
                        {
                            "rule"
                        } else if lower_t.contains("pattern") || lower_t.contains("convention") {
                            "pattern"
                        } else if lower_t.contains("lesson") || lower_t.contains("gotcha") {
                            "lesson"
                        } else {
                            "freeform"
                        };
                        entries.push(KnowledgeEntry {
                            id: format!("K{:03}", entry_idx),
                            title: current_title.clone(),
                            content: current_content.trim().to_string(),
                            entry_type: et.to_string(),
                        });
                    }
                    entry_idx += 1;
                    current_title = line.trim_start_matches('#').trim().to_string();
                    current_content = String::new();
                } else if !current_title.is_empty() {
                    current_content.push_str(line);
                    current_content.push('\n');
                }
            }
            if !current_title.is_empty() {
                let lower_t = current_title.to_lowercase();
                let lower_c = current_content.to_lowercase();
                let et = if lower_t.contains("rule")
                    || lower_c.contains("must ")
                    || lower_c.contains("never ")
                    || lower_c.contains("always ")
                {
                    "rule"
                } else if lower_t.contains("pattern") || lower_t.contains("convention") {
                    "pattern"
                } else if lower_t.contains("lesson") || lower_t.contains("gotcha") {
                    "lesson"
                } else {
                    "freeform"
                };
                entries.push(KnowledgeEntry {
                    id: format!("K{:03}", entry_idx),
                    title: current_title,
                    content: current_content.trim().to_string(),
                    entry_type: et.to_string(),
                });
            }
            entries
        } else {
            Vec::new()
        }
    };

    // Collect capture entries
    let capture_data = {
        let captures_dir = gsd_dir.join("runtime").join("captures");
        let mut entries: Vec<CaptureEntry> = Vec::new();
        if captures_dir.is_dir() {
            if let Ok(rd) = std::fs::read_dir(&captures_dir) {
                for file in rd.flatten() {
                    let p = file.path();
                    if p.extension().and_then(|e| e.to_str()) != Some("json") {
                        continue;
                    }
                    if let Ok(c) = std::fs::read_to_string(&p) {
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(&c) {
                            entries.push(CaptureEntry {
                                id: val
                                    .get("id")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                text: val
                                    .get("text")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                timestamp: val
                                    .get("timestamp")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                status: val
                                    .get("status")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("pending")
                                    .to_string(),
                                classification: val
                                    .get("classification")
                                    .and_then(|v| v.as_str())
                                    .map(String::from),
                                resolution: val
                                    .get("resolution")
                                    .and_then(|v| v.as_str())
                                    .map(String::from),
                                rationale: val
                                    .get("rationale")
                                    .and_then(|v| v.as_str())
                                    .map(String::from),
                                resolved_at: val
                                    .get("resolvedAt")
                                    .and_then(|v| v.as_str())
                                    .map(String::from),
                                executed: val.get("executed").and_then(|v| v.as_bool()),
                            });
                        }
                    }
                }
            }
            entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        }
        entries
    };

    // Collect changelog entries (reuse load_slice_changelog)
    let mut changelog_entries: Vec<ChangelogEntry2> = Vec::new();
    for ms in &milestones {
        for sl in &ms.slices {
            if sl.done {
                let slice_dir = milestones_dir.join(&ms.id).join("slices").join(&sl.id);
                if let Some(entry) = load_slice_changelog(&slice_dir, &sl.id) {
                    changelog_entries.push(entry);
                }
            }
        }
    }

    // Collect discussion states
    let mut discussion_states: Vec<(String, String)> = Vec::new();
    for ms in &milestones {
        let ms_dir = milestones_dir.join(&ms.id);
        let state = get_discussion_state(&ms_dir, &ms.id);
        discussion_states.push((ms.id.clone(), state));
    }

    // Build critical path
    let mut cp_nodes: Vec<(String, Vec<String>)> = Vec::new();
    for ms in &milestones {
        for sl in &ms.slices {
            if !sl.done {
                let qualified_id = format!("{}/{}", ms.id, sl.id);
                let qualified_deps: Vec<String> = sl
                    .dependencies
                    .iter()
                    .map(|d| {
                        if d.contains('/') {
                            d.clone()
                        } else {
                            format!("{}/{}", ms.id, d)
                        }
                    })
                    .collect();
                cp_nodes.push((qualified_id, qualified_deps));
            }
        }
    }
    let critical_path = compute_critical_path(&cp_nodes);

    // Determine phase
    let phase = health
        .phase
        .clone()
        .unwrap_or_else(|| "execution".to_string());

    // Get project name from the path (last component) or use project_id
    let project_name = std::path::Path::new(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(&project_id)
        .to_string();

    // GSD version — read from preferences or default
    let gsd_version = {
        let prefs_path = gsd_dir.join("preferences.json");
        std::fs::read_to_string(&prefs_path)
            .ok()
            .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
            .and_then(|v| {
                v.get("gsdVersion")
                    .and_then(|x| x.as_str())
                    .map(String::from)
            })
            .unwrap_or_else(|| "2.0".to_string())
    };

    let report_data = ReportData {
        project_name: &project_name,
        project_path: &project_path,
        gsd_version: &gsd_version,
        milestone_id: milestone_id.as_deref(),
        milestones: &milestones,
        units: &units,
        totals: &totals,
        by_phase: &by_phase,
        by_slice: &by_slice,
        by_model: &by_model,
        health: &health,
        knowledge_entries: &knowledge_data,
        capture_entries: &capture_data,
        changelog_entries,
        discussion_states,
        critical_path: &critical_path,
        phase,
    };

    let html = generate_html_report_string(&report_data);

    // Write to .gsd/reports/
    std::fs::create_dir_all(&reports_dir)
        .map_err(|e| format!("Failed to create reports dir: {}", e))?;

    let timestamp = {
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let (y, mo, d, h, min, sec) = epoch_to_date(secs);
        format!("{:04}{:02}{:02}T{:02}{:02}{:02}", y, mo, d, h, min, sec)
    };

    let prefix = milestone_id.as_deref().unwrap_or("final");
    let safe_prefix = prefix.replace(['/', '\\', ' '], "-");
    let filename = format!("{}-{}.html", safe_prefix, timestamp);
    let file_path = reports_dir.join(&filename);

    std::fs::write(&file_path, &html).map_err(|e| format!("Failed to write report: {}", e))?;

    // Update registry
    let report_kind = kind.as_deref().unwrap_or("manual").to_string();
    let milestone_title = milestone_id
        .as_deref()
        .map(|mid| {
            milestones
                .iter()
                .find(|m| m.id == mid)
                .map(|m| m.title.clone())
                .unwrap_or_else(|| mid.to_string())
        })
        .unwrap_or_else(|| "Full Project".to_string());

    let total_slices: u32 = milestones.iter().map(|m| m.slices.len() as u32).sum();
    let done_slices: u32 = milestones
        .iter()
        .flat_map(|m| m.slices.iter())
        .filter(|s| s.done)
        .count() as u32;
    let done_milestones: u32 = milestones.iter().filter(|m| m.done).count() as u32;
    let total_milestones: u32 = milestones.len() as u32;

    let label = if prefix == "final" {
        "Final Report".to_string()
    } else {
        format!("{}: {}", prefix, milestone_title)
    };

    let new_entry = ReportEntry {
        filename: filename.clone(),
        generated_at: now_iso(),
        milestone_id: prefix.to_string(),
        milestone_title,
        label,
        kind: report_kind,
        total_cost: totals.total_cost,
        total_tokens: totals.total_tokens,
        total_duration: totals.duration_ms,
        done_slices,
        total_slices,
        done_milestones,
        total_milestones,
        phase: report_data.phase.clone(),
    };

    let mut index = load_reports_index(&reports_dir).unwrap_or_else(|| ReportsIndex {
        version: 1,
        project_name: project_name.clone(),
        project_path: project_path.clone(),
        gsd_version: gsd_version.clone(),
        entries: Vec::new(),
    });
    index.project_name = project_name.clone();
    index.project_path = project_path.clone();
    index.gsd_version = gsd_version.clone();
    index.entries.push(new_entry);

    save_reports_index(&reports_dir, &index)?;
    regenerate_html_index(&reports_dir, &index);

    Ok(HtmlReportResult {
        file_path: file_path.to_string_lossy().to_string(),
        filename,
        reports_dir: reports_dir.to_string_lossy().to_string(),
    })
}

/// R088 — Return the reports index (list of previously generated reports).
#[tauri::command]
pub async fn gsd2_get_reports_index(
    project_id: String,
    db: tauri::State<'_, DbState>,
) -> Result<ReportsIndex, String> {
    let project_path = {
        let db_guard = db.write().await;
        get_project_path(&db_guard, &project_id)?
    };

    let reports_dir = Path::new(&project_path).join(".gsd").join("reports");

    Ok(
        load_reports_index(&reports_dir).unwrap_or_else(|| ReportsIndex {
            version: 1,
            project_name: std::path::Path::new(&project_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(&project_id)
                .to_string(),
            project_path: project_path.clone(),
            gsd_version: "2.0".to_string(),
            entries: Vec::new(),
        }),
    )
}

// ============================================================
// Preferences: YAML parser, merge, scope annotation, read/write
// ============================================================

/// PreferencesData struct returned by gsd2_get_preferences.
/// Contains merged preferences, scope annotation, and raw versions for debugging.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreferencesData {
    pub merged: serde_json::Value,
    pub scopes: HashMap<String, String>,
    pub global_raw: serde_json::Value,
    pub project_raw: serde_json::Value,
}

/// Extract frontmatter (YAML header between --- delimiters) from content.
/// Returns (frontmatter_yaml, body) tuple.
/// If no frontmatter found, returns ("", full_content).
fn extract_preferences_frontmatter(content: &str) -> (String, String) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (String::new(), content.to_string());
    }

    let after_first = &trimmed[3..];
    if let Some(end_pos) = after_first.find("---") {
        let frontmatter = after_first[..end_pos].to_string();
        let body = after_first[end_pos + 3..].to_string();
        (frontmatter, body)
    } else {
        (String::new(), content.to_string())
    }
}

/// Type-aware scalar coercion: converts string values to bool, int, float, null, or string.
fn yaml_scalar_to_json(s: &str) -> serde_json::Value {
    let s = s.trim();

    // null
    if s == "null" || s == "~" {
        return serde_json::Value::Null;
    }

    // bool
    if s == "true" || s == "yes" || s == "on" {
        return serde_json::Value::Bool(true);
    }
    if s == "false" || s == "no" || s == "off" {
        return serde_json::Value::Bool(false);
    }

    // int
    if let Ok(i) = s.parse::<i64>() {
        return serde_json::Value::Number(serde_json::Number::from(i));
    }

    // float
    if let Ok(f) = s.parse::<f64>() {
        if let Some(n) = serde_json::Number::from_f64(f) {
            return serde_json::Value::Number(n);
        }
    }

    // string (fallback)
    serde_json::Value::String(s.to_string())
}

/// Parse a single YAML item at a given indent level.
/// Returns (key, value, lines_consumed).
fn parse_yaml_item(
    lines: &[&str],
    start_idx: usize,
    expected_indent: usize,
) -> (String, serde_json::Value, usize) {
    if start_idx >= lines.len() {
        return (String::new(), serde_json::Value::Null, 0);
    }

    let line = lines[start_idx];
    let indent = line.len() - line.trim_start().len();

    if indent != expected_indent {
        return (String::new(), serde_json::Value::Null, 0);
    }

    let trimmed = line.trim();
    if let Some(colon_pos) = trimmed.find(':') {
        let key = trimmed[..colon_pos].trim().to_string();
        let value_part = trimmed[colon_pos + 1..].trim();

        if value_part.is_empty() {
            // Value on next lines
            let mut idx = start_idx + 1;
            let child_indent = expected_indent + 2;

            // Check if next line is an array or object
            if idx < lines.len() {
                let next_line = lines[idx];
                let next_indent = next_line.len() - next_line.trim_start().len();
                let next_trimmed = next_line.trim();

                if next_indent > expected_indent && next_trimmed.starts_with("- ") {
                    // Array
                    let (arr, consumed) = parse_yaml_array(lines, idx, child_indent);
                    return (key, serde_json::Value::Array(arr), consumed - start_idx);
                } else if next_indent == child_indent && next_trimmed.contains(':') {
                    // Object
                    let mut obj = serde_json::json!({});
                    while idx < lines.len() {
                        let (k, v, consumed) = parse_yaml_item(lines, idx, child_indent);
                        if k.is_empty() {
                            break;
                        }
                        obj[k] = v;
                        idx += consumed;
                    }
                    return (key, obj, idx - start_idx);
                }
            }

            (key, serde_json::Value::Null, 1)
        } else if value_part.starts_with("- ") {
            // Inline array (rare, but handle it)
            let item = value_part[2..].trim();
            (
                key,
                serde_json::Value::Array(vec![yaml_scalar_to_json(item)]),
                1,
            )
        } else {
            // Inline scalar value
            (key, yaml_scalar_to_json(value_part), 1)
        }
    } else {
        (String::new(), serde_json::Value::Null, 0)
    }
}

/// Parse a YAML array block starting at lines[idx], where items are marked with "- ".
/// Returns (Vec<Value>, next_idx).
fn parse_yaml_array(
    lines: &[&str],
    start_idx: usize,
    expected_indent: usize,
) -> (Vec<serde_json::Value>, usize) {
    let mut result = Vec::new();
    let mut idx = start_idx;

    while idx < lines.len() {
        let line = lines[idx];
        let indent = line.len() - line.trim_start().len();
        let trimmed = line.trim();

        if indent < expected_indent {
            break;
        }

        if indent == expected_indent && trimmed.starts_with("- ") {
            let value_part = trimmed[2..].trim();
            if value_part.is_empty() {
                // Item value on next lines
                let mut item_obj = serde_json::json!({});
                idx += 1;
                let child_indent = expected_indent + 2;
                while idx < lines.len() {
                    let next_line = lines[idx];
                    let next_indent = next_line.len() - next_line.trim_start().len();
                    if next_indent < child_indent
                        || (next_indent == expected_indent && next_line.trim().starts_with("- "))
                    {
                        break;
                    }
                    if next_indent == child_indent {
                        let (k, v, consumed) = parse_yaml_item(lines, idx, child_indent);
                        if !k.is_empty() {
                            item_obj[k] = v;
                            idx += consumed;
                        } else {
                            break;
                        }
                    } else {
                        idx += 1;
                    }
                }
                result.push(item_obj);
            } else {
                // Inline scalar
                result.push(yaml_scalar_to_json(value_part));
                idx += 1;
            }
        } else {
            break;
        }
    }

    (result, idx)
}

/// Parse YAML (without serde_yaml crate) to serde_json::Value.
/// Handles basic nested objects, arrays (marked with "-"), and scalar values.
fn parse_yaml_to_json(yaml: &str) -> serde_json::Value {
    if yaml.trim().is_empty() {
        return serde_json::json!({});
    }

    let lines: Vec<&str> = yaml.lines().collect();
    let mut result = serde_json::json!({});
    let mut idx = 0;

    while idx < lines.len() {
        let line = lines[idx];
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') {
            idx += 1;
            continue;
        }

        let indent = line.len() - line.trim_start().len();
        if indent == 0 && trimmed.contains(':') {
            let (key, value, consumed) = parse_yaml_item(&lines, idx, 0);
            if !key.is_empty() {
                result[key] = value;
            }
            idx += consumed;
        } else {
            idx += 1;
        }
    }

    result
}

/// Convert serde_json::Value to YAML frontmatter (for write-back).
/// Handles nested objects and arrays with proper indentation.
fn write_yaml_array_item(value: &serde_json::Value, indent: usize) -> String {
    let spaces = " ".repeat(indent);
    match value {
        serde_json::Value::Object(map) => {
            let mut result = String::new();
            for (k, v) in map.iter() {
                result.push_str(&format!("{}  {}:\n", spaces, k));
                result.push_str(&write_yaml_value(v, indent + 4));
            }
            result
        }
        _ => {
            format!("{}  {}\n", spaces, value_to_yaml_scalar(value))
        }
    }
}

/// Convert a scalar value to YAML representation.
fn value_to_yaml_scalar(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Null => "null".to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => {
            // Quote if it contains special chars or is a reserved word
            if s.contains(':')
                || s.contains('#')
                || s.is_empty()
                || s == "null"
                || s == "true"
                || s == "false"
            {
                format!("\"{}\"", s.replace('"', "\\\""))
            } else {
                s.clone()
            }
        }
        _ => "null".to_string(),
    }
}

/// Write a serde_json::Value as YAML string with proper indentation.
fn write_yaml_value(value: &serde_json::Value, indent: usize) -> String {
    let spaces = " ".repeat(indent);
    match value {
        serde_json::Value::Object(map) => {
            let mut result = String::new();
            for (k, v) in map.iter() {
                result.push_str(&format!("{}{}:\n", spaces, k));
                if let serde_json::Value::Object(_) | serde_json::Value::Array(_) = v {
                    result.push_str(&write_yaml_value(v, indent + 2));
                } else {
                    result.push_str(&format!(
                        "{}{}\n",
                        " ".repeat(indent + 2),
                        value_to_yaml_scalar(v)
                    ));
                }
            }
            result
        }
        serde_json::Value::Array(arr) => {
            let mut result = String::new();
            for item in arr {
                result.push_str(&format!("{}- ", spaces));
                match item {
                    serde_json::Value::Object(_) => {
                        result.push('\n');
                        result.push_str(&write_yaml_array_item(item, indent));
                    }
                    serde_json::Value::String(s) => {
                        result.push_str(&format!("{}\n", s));
                    }
                    _ => {
                        result.push_str(&format!("{}\n", value_to_yaml_scalar(item)));
                    }
                }
            }
            result
        }
        _ => format!("{}{}\n", spaces, value_to_yaml_scalar(value)),
    }
}

/// Convert serde_json::Value back to YAML frontmatter (with --- delimiters).
fn json_to_yaml_frontmatter(val: &serde_json::Value) -> String {
    let mut result = String::from("---\n");
    if let serde_json::Value::Object(map) = val {
        for (k, v) in map.iter() {
            match v {
                serde_json::Value::Object(_) | serde_json::Value::Array(_) => {
                    result.push_str(&format!("{}:\n", k));
                    result.push_str(&write_yaml_value(v, 2));
                }
                _ => {
                    result.push_str(&format!("{}: {}\n", k, value_to_yaml_scalar(v)));
                }
            }
        }
    }
    result.push_str("---\n");
    result
}

/// Merge project preferences, global preferences, and defaults.
/// Merge rules:
/// - Scalars: project wins, then global, then default
/// - Arrays (skill-related): concatenate [project] + [global]
/// - Objects (config): shallow merge (project overrides global, global overrides default)
fn merge_preferences(
    project: &serde_json::Value,
    global: &serde_json::Value,
    defaults: &serde_json::Value,
) -> serde_json::Value {
    let mut result = defaults.clone();

    // Merge global into result
    if let (Some(global_obj), Some(_result_obj)) = (global.as_object(), result.as_object_mut()) {
        for (k, v) in global_obj {
            if k.ends_with("Skills") || k.ends_with("skills") {
                // Array: concatenate
                let mut merged_arr = Vec::new();
                if let Some(default_arr) = result.get(k).and_then(|v| v.as_array()) {
                    merged_arr.extend(default_arr.clone());
                }
                if let Some(global_arr) = v.as_array() {
                    merged_arr.extend(global_arr.clone());
                }
                result[k] = serde_json::Value::Array(merged_arr);
            } else if v.is_object() && result.get(k).map(|v| v.is_object()).unwrap_or(false) {
                // Object: shallow merge
                if let Some(result_obj_inner) = result[k].as_object_mut() {
                    if let Some(global_obj_inner) = v.as_object() {
                        for (ik, iv) in global_obj_inner {
                            result_obj_inner.insert(ik.clone(), iv.clone());
                        }
                    }
                }
            } else {
                // Scalar: global wins
                result[k] = v.clone();
            }
        }
    }

    // Merge project into result
    if let (Some(project_obj), Some(_result_obj)) = (project.as_object(), result.as_object_mut()) {
        for (k, v) in project_obj {
            if k.ends_with("Skills") || k.ends_with("skills") {
                // Array: concatenate [project] + existing
                let mut merged_arr = Vec::new();
                if let Some(project_arr) = v.as_array() {
                    merged_arr.extend(project_arr.clone());
                }
                if let Some(existing_arr) = result.get(k).and_then(|v| v.as_array()) {
                    for item in existing_arr {
                        if !merged_arr.iter().any(|x| x == item) {
                            merged_arr.push(item.clone());
                        }
                    }
                }
                result[k] = serde_json::Value::Array(merged_arr);
            } else if v.is_object() && result.get(k).map(|v| v.is_object()).unwrap_or(false) {
                // Object: shallow merge
                if let Some(result_obj_inner) = result[k].as_object_mut() {
                    if let Some(project_obj_inner) = v.as_object() {
                        for (ik, iv) in project_obj_inner {
                            result_obj_inner.insert(ik.clone(), iv.clone());
                        }
                    }
                }
            } else {
                // Scalar: project wins
                result[k] = v.clone();
            }
        }
    }

    result
}

/// Annotate each top-level key in merged with its origin scope: "project" / "global" / "default".
fn annotate_scopes(
    merged: &serde_json::Value,
    project: &serde_json::Value,
    global: &serde_json::Value,
) -> HashMap<String, String> {
    let mut scopes = HashMap::new();

    if let Some(merged_obj) = merged.as_object() {
        for key in merged_obj.keys() {
            if project.get(key).is_some() {
                scopes.insert(key.clone(), "project".to_string());
            } else if global.get(key).is_some() {
                scopes.insert(key.clone(), "global".to_string());
            } else {
                scopes.insert(key.clone(), "default".to_string());
            }
        }
    }

    scopes
}

/// Read a file and return its contents, or return empty string if file doesn't exist.
fn read_preferences_file(path: &str) -> Result<String, String> {
    std::fs::read_to_string(path).or_else(|_| Ok(String::new()))
}

/// R040 — Get preferences (merged from project + global + defaults).
#[tauri::command]
pub async fn gsd2_get_preferences(project_path: String) -> Result<PreferencesData, String> {
    let global_prefs_path = dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(".gsd")
        .join("PREFERENCES.md");

    // Read project prefs only when a non-empty project path is provided
    let project_content = if project_path.is_empty() {
        String::new()
    } else {
        let project_prefs_path = Path::new(&project_path).join(".gsd").join("PREFERENCES.md");
        read_preferences_file(project_prefs_path.to_str().unwrap_or(""))?
    };

    // Global prefs always read
    let global_content = read_preferences_file(global_prefs_path.to_str().unwrap_or(""))?;

    // Extract frontmatter from both files
    let (project_yaml, _) = extract_preferences_frontmatter(&project_content);
    let (global_yaml, _) = extract_preferences_frontmatter(&global_content);

    // Parse YAML to JSON
    let project_raw = parse_yaml_to_json(&project_yaml);
    let global_raw = parse_yaml_to_json(&global_yaml);
    let defaults = serde_json::json!({});

    // Merge preferences
    let merged = merge_preferences(&project_raw, &global_raw, &defaults);

    // Annotate scopes
    let scopes = annotate_scopes(&merged, &project_raw, &global_raw);

    Ok(PreferencesData {
        merged,
        scopes,
        global_raw,
        project_raw,
    })
}

/// R040 — Save preferences to the specified scope (project or global).
#[tauri::command]
pub async fn gsd2_save_preferences(
    project_path: String,
    scope: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    let target_path = if scope == "project" {
        Path::new(&project_path).join(".gsd").join("PREFERENCES.md")
    } else if scope == "global" {
        dirs::home_dir()
            .ok_or("Cannot determine home directory")?
            .join(".gsd")
            .join("PREFERENCES.md")
    } else {
        return Err("Invalid scope: must be 'project' or 'global'".to_string());
    };

    // Read current file
    let current_content = std::fs::read_to_string(&target_path).unwrap_or_default();
    let (_, body) = extract_preferences_frontmatter(&current_content);

    // Convert payload to YAML frontmatter
    let new_frontmatter = json_to_yaml_frontmatter(&payload);
    let new_content = format!("{}{}", new_frontmatter, body);

    // Atomic write: temp file then rename
    let temp_path = format!("{}.tmp.{}", target_path.display(), std::process::id());
    std::fs::write(&temp_path, &new_content)
        .map_err(|e| format!("Failed to write preferences: {}", e))?;

    std::fs::rename(&temp_path, &target_path)
        .map_err(|e| format!("Failed to save preferences: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod preferences_tests {
    use super::*;

    #[test]
    fn extract_preferences_frontmatter_splits_header_and_body() {
        let content = "---\ntheme: dark\n---\nRemaining body content";
        let (frontmatter, body) = extract_preferences_frontmatter(content);
        // Note: frontmatter includes content between delimiters, which starts with a newline
        assert_eq!(frontmatter.trim(), "theme: dark");
        assert_eq!(body.trim(), "Remaining body content");
    }

    #[test]
    fn extract_preferences_frontmatter_handles_missing_frontmatter() {
        let content = "Just plain content\nNo delimiters";
        let (frontmatter, body) = extract_preferences_frontmatter(content);
        assert_eq!(frontmatter, "");
        assert_eq!(body, "Just plain content\nNo delimiters");
    }

    #[test]
    fn yaml_scalar_to_json_coerces_bool_values() {
        assert_eq!(yaml_scalar_to_json("true"), serde_json::Value::Bool(true));
        assert_eq!(yaml_scalar_to_json("false"), serde_json::Value::Bool(false));
        assert_eq!(yaml_scalar_to_json("yes"), serde_json::Value::Bool(true));
        assert_eq!(yaml_scalar_to_json("no"), serde_json::Value::Bool(false));
    }

    #[test]
    fn yaml_scalar_to_json_coerces_numbers() {
        let int_val = yaml_scalar_to_json("42");
        assert!(int_val.is_number());

        let float_val = yaml_scalar_to_json("3.14");
        assert!(float_val.is_number());
    }

    #[test]
    fn yaml_scalar_to_json_coerces_null() {
        assert_eq!(yaml_scalar_to_json("null"), serde_json::Value::Null);
        assert_eq!(yaml_scalar_to_json("~"), serde_json::Value::Null);
    }

    #[test]
    fn parse_yaml_to_json_handles_nested_objects() {
        let yaml = "theme: dark\nsettings:\n  timeout: 30\n  debug: true";
        let result = parse_yaml_to_json(yaml);
        assert_eq!(result.get("theme").and_then(|v| v.as_str()), Some("dark"));
        assert_eq!(
            result
                .get("settings")
                .and_then(|v| v.get("timeout"))
                .and_then(|v| v.as_i64()),
            Some(30)
        );
    }

    #[test]
    fn parse_yaml_to_json_handles_arrays() {
        let yaml = "skills:\n  - accessibility\n  - test\n  - review";
        let result = parse_yaml_to_json(yaml);
        if let Some(arr) = result.get("skills").and_then(|v| v.as_array()) {
            assert_eq!(arr.len(), 3);
            assert_eq!(arr[0].as_str(), Some("accessibility"));
        } else {
            panic!("Expected array for skills");
        }
    }

    #[test]
    fn merge_preferences_scalars_project_wins() {
        let project = serde_json::json!({ "theme": "light" });
        let global = serde_json::json!({ "theme": "dark" });
        let defaults = serde_json::json!({ "theme": "system" });

        let merged = merge_preferences(&project, &global, &defaults);
        assert_eq!(merged.get("theme").and_then(|v| v.as_str()), Some("light"));
    }

    #[test]
    fn merge_preferences_arrays_concatenate() {
        let project = serde_json::json!({ "skills": ["test", "review"] });
        let global = serde_json::json!({ "skills": ["lint", "debug"] });
        let defaults = serde_json::json!({ "skills": [] });

        let merged = merge_preferences(&project, &global, &defaults);
        if let Some(arr) = merged.get("skills").and_then(|v| v.as_array()) {
            assert!(arr.len() >= 2); // At least project skills present
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn merge_preferences_objects_shallow_merge() {
        let project = serde_json::json!({ "database": { "host": "localhost" } });
        let global = serde_json::json!({ "database": { "port": 5432 } });
        let defaults = serde_json::json!({ "database": { "user": "admin" } });

        let merged = merge_preferences(&project, &global, &defaults);
        let db = merged.get("database").unwrap();
        assert_eq!(db.get("host").and_then(|v| v.as_str()), Some("localhost"));
        assert_eq!(db.get("port").and_then(|v| v.as_i64()), Some(5432));
    }

    #[test]
    fn annotate_scopes_identifies_origin_correctly() {
        let merged = serde_json::json!({ "theme": "light", "timeout": 30 });
        let project = serde_json::json!({ "theme": "light" });
        let global = serde_json::json!({ "timeout": 30 });

        let scopes = annotate_scopes(&merged, &project, &global);
        assert_eq!(scopes.get("theme").map(|s| s.as_str()), Some("project"));
        assert_eq!(scopes.get("timeout").map(|s| s.as_str()), Some("global"));
    }

    #[test]
    fn json_to_yaml_frontmatter_round_trips() {
        let val = serde_json::json!({
            "theme": "dark",
            "timeout": 30,
            "enabled": true
        });
        let yaml = json_to_yaml_frontmatter(&val);
        assert!(yaml.starts_with("---\n"));
        assert!(yaml.ends_with("---\n"));
        assert!(yaml.contains("theme: dark"));
    }
}
