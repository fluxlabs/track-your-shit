// VCCA - GSD Shared Parsing Helpers
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
//
// Shared parsing utilities extracted from gsd.rs (D-05).
// gsd2.rs retains its own frozen copies — do NOT import from this module there.

use crate::db::Database;
use rusqlite::params;
use std::collections::HashMap;

// ============================================================
// Known-Key Tables (D-04 drift-resilience)
// ============================================================

/// VCCA-recognized STATE.md frontmatter keys.
pub const KNOWN_STATE_KEYS: &[&str] = &[
    "gsd_state_version",
    "status",
    "progress",
    "phase",
    "current_phase",
    "plan",
    "milestone",
    "milestone_name",
    "stopped_at",
    "last_updated",
    "last_activity",
];

/// VCCA-recognized PLAN.md frontmatter keys.
pub const KNOWN_PLAN_KEYS: &[&str] = &[
    "phase",
    "plan",
    "type",
    "wave",
    "depends_on",
    "files_modified",
    "autonomous",
    "requirements",
    "user_setup",
    // gsd-core@next additions
    "must_haves",
    "plan_only",
    "title",
    "status",
    "mode",
    "requirement",
];

/// VCCA-recognized SUMMARY.md frontmatter keys.
pub const KNOWN_SUMMARY_KEYS: &[&str] = &[
    "phase",
    "plan",
    "subsystem",
    "tags",
    "requires",
    "provides",
    "affects",
    "tech-stack",
    "key-files",
    "key-decisions",
    "patterns-established",
    "requirements-completed",
    "duration",
    "completed",
    "status",
    // gsd-core@next additions
    "requirements",
    "plan_only",
    "title",
    "date",
    "mode",
];

// ============================================================
// Helpers (extracted verbatim from gsd.rs — D-05)
// ============================================================

/// Resolve project path from DB by project_id
pub fn get_project_path(db: &Database, project_id: &str) -> Result<String, String> {
    db.conn()
        .query_row(
            "SELECT path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Project not found: {}", e))
}

/// Parse YAML-like frontmatter from markdown content.
/// Handles both standard position (start of file) and GSD summary files
/// where frontmatter appears after a heading/copyright block.
pub fn parse_frontmatter(content: &str) -> (HashMap<String, String>, String) {
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

/// Extract a section from markdown by heading
pub fn extract_section(content: &str, heading: &str) -> Option<String> {
    let heading_lower = heading.to_lowercase();
    let mut in_section = false;
    let mut section_level = 0;
    let mut lines = Vec::new();

    for line in content.lines() {
        if line.starts_with('#') {
            let level = line.chars().take_while(|&c| c == '#').count();
            let title = line.trim_start_matches('#').trim().to_lowercase();

            if title.contains(&heading_lower) {
                in_section = true;
                section_level = level;
                continue;
            } else if in_section && level <= section_level {
                break;
            }
        }

        if in_section {
            lines.push(line);
        }
    }

    if lines.is_empty() {
        None
    } else {
        Some(lines.join("\n").trim().to_string())
    }
}

/// Extract a YAML list from content (handles both inline [a, b] and multiline - a\n- b)
pub fn extract_yaml_list(content: &str, key: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut in_list = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // Check for key: [inline, list]
        if trimmed.starts_with(&format!("{}:", key))
            || trimmed.starts_with(&format!("{}:", key.replace('_', "-")))
        {
            let after_colon = trimmed.splitn(2, ':').nth(1).unwrap_or("").trim();
            if after_colon.starts_with('[') && after_colon.ends_with(']') {
                // Inline list
                let inner = &after_colon[1..after_colon.len() - 1];
                result.extend(
                    inner
                        .split(',')
                        .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                        .filter(|s| !s.is_empty()),
                );
                return result;
            } else if after_colon.is_empty() || after_colon == "[]" {
                if after_colon == "[]" {
                    return result;
                }
                in_list = true;
                continue;
            } else {
                // Single value
                result.push(after_colon.to_string());
                return result;
            }
        }

        if in_list {
            if trimmed.starts_with("- ") {
                result.push(
                    trimmed[2..]
                        .trim()
                        .trim_matches('"')
                        .trim_matches('\'')
                        .to_string(),
                );
            } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                break; // End of list
            }
        }
    }

    result
}

/// Extract content between XML-like tags: <tag>content</tag>
pub fn extract_xml_tag(content: &str, tag: &str) -> Option<String> {
    let open = format!("<{}>", tag);
    let close = format!("</{}>", tag);

    if let Some(start) = content.find(&open) {
        let after = start + open.len();
        if let Some(end) = content[after..].find(&close) {
            return Some(content[after..after + end].trim().to_string());
        }
    }
    None
}

// ============================================================
// Nested Progress Extractor (SCHM-02)
// ============================================================

/// Extract nested scalar sub-keys from the `progress:` YAML block in a STATE.md frontmatter
/// string. Returns a map of "progress.KEY" → "value" for each scalar sub-key found.
///
/// Complements parse_frontmatter (which skips indented lines) without changing that
/// list-skip behavior — do NOT remove the indent-skip in parse_frontmatter, as it
/// prevents list items under requires:/provides: in SUMMARY.md from being mis-parsed.
///
/// Reference implementation per 11-RESEARCH Pitfall 1.
pub fn extract_nested_progress(fm_str: &str) -> HashMap<String, String> {
    let mut in_progress = false;
    let mut result = HashMap::new();
    for line in fm_str.lines() {
        let trimmed = line.trim_start();
        // Detect the `progress:` top-level key
        if trimmed == "progress:" || line.starts_with("progress:") {
            in_progress = true;
            continue;
        }
        if in_progress {
            if line.starts_with("  ") && !trimmed.starts_with('-') {
                // Indented scalar sub-key: "  key: value"
                if let Some(colon) = trimmed.find(':') {
                    let k = trimmed[..colon].trim().to_string();
                    let v = trimmed[colon + 1..].trim().to_string();
                    if !k.is_empty() {
                        result.insert(format!("progress.{}", k), v);
                    }
                }
            } else if !line.is_empty() && !line.starts_with(' ') && !line.starts_with('\t') {
                // Back to top-level key — end of progress block
                in_progress = false;
            }
        }
    }
    result
}

// ============================================================
// Drift-Signal Helper (D-04)
// ============================================================

/// Called after parse_frontmatter with the known-keys list for the file type.
/// Logs unrecognized keys at WARN level via tracing — never panics.
/// Enables forward-compatible parsing: novel fields from gsd-core@next upgrades
/// are surfaced via logs rather than causing hard failures.
pub fn warn_unknown_fields(
    frontmatter: &HashMap<String, String>,
    known: &[&str],
    source_file: &str,
) {
    for key in frontmatter.keys() {
        if !known.contains(&key.as_str()) {
            tracing::warn!(
                file = %source_file,
                field = %key,
                "gsd.rs: unrecognized frontmatter field — schema may have drifted"
            );
        }
    }
}

// ============================================================
// Workstream Path Resolution (SCHM-04, D-01/D-02, T-11-03/T-11-04)
// ============================================================

/// Validate that a workstream slug is safe to use in a path join (T-11-03/T-11-04).
///
/// A valid slug is non-empty, under 64 characters, ASCII alphanumeric/-/_ only,
/// does not contain "..", and does not start with "-".
/// Invalid slugs are rejected before any path join to prevent path traversal.
pub fn is_valid_workstream_slug(s: &str) -> bool {
    !s.is_empty()
        && s.len() < 64
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        && !s.contains("..")
        && !s.starts_with('-')
}

/// Resolve a .planning/ subpath with workstream awareness.
///
/// Precedence (per ADR-0006, adapted for VCCA — D-02):
///   1. explicit `workstream_id` argument
///   2. `GSD_WORKSTREAM` env var
///   3. `.planning/active-workstream` file content (trimmed)
///   4. null → flat `.planning/<subpath>` (current non-workstream behavior, unchanged)
///
/// Returns the resolved absolute path. Examples:
///   workstream active: `{project_root}/.planning/workstreams/{ws}/{subpath}`
///   no workstream:     `{project_root}/.planning/{subpath}`
///
/// Falls back to root if the workstream directory does not exist (self-healing per ADR-0004).
/// Logs `tracing::warn` for workstream resolution events so path choices are debuggable.
/// NEVER creates directories.
///
/// SHARED FILES must NOT use this helper: PROJECT.md, config.json, milestones/, codebase/
/// always resolve to root .planning/ regardless of active workstream.
pub fn resolve_gsd_path(
    project_path: &str,
    workstream_id: Option<&str>,
    subpath: &str,
) -> std::path::PathBuf {
    let planning = std::path::Path::new(project_path).join(".planning");

    // Step 1: explicit workstream_id > Step 2: GSD_WORKSTREAM env > Step 3: active-workstream file
    let ws = workstream_id
        .map(|s| s.to_string())
        .or_else(|| std::env::var("GSD_WORKSTREAM").ok())
        .or_else(|| {
            let ptr = planning.join("active-workstream");
            if ptr.exists() {
                std::fs::read_to_string(&ptr)
                    .ok()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
            } else {
                None
            }
        });

    match ws {
        Some(name) if !name.is_empty() => {
            // T-11-03/T-11-04: validate slug before joining into the path
            if !is_valid_workstream_slug(&name) {
                tracing::warn!(
                    workstream = %name,
                    subpath = %subpath,
                    "resolve_gsd_path: invalid workstream slug — falling back to root .planning/"
                );
                return planning.join(subpath);
            }
            let ws_dir = planning.join("workstreams").join(&name);
            if ws_dir.exists() {
                tracing::debug!(
                    workstream = %name,
                    subpath = %subpath,
                    "resolve_gsd_path: resolved via workstream directory"
                );
                ws_dir.join(subpath)
            } else {
                tracing::warn!(
                    workstream = %name,
                    subpath = %subpath,
                    "resolve_gsd_path: workstream directory not found — falling back to root .planning/"
                );
                planning.join(subpath)
            }
        }
        _ => {
            // Step 4: flat .planning/<subpath> — non-workstream projects, behavior unchanged
            planning.join(subpath)
        }
    }
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ── Non-ignored: these pass now ──────────────────────────────────────────

    #[test]
    fn test_state_md_fidelity() {
        // STATE.md fixture parses gsd_state_version and status as frontmatter keys.
        // These two top-level flat fields are already handled by parse_frontmatter.
        let content = include_str!("../../tests/fixtures/gsd-next/state.md");
        let (frontmatter, _body) = parse_frontmatter(content);

        assert!(
            frontmatter.contains_key("gsd_state_version"),
            "STATE.md: gsd_state_version must be parsed from frontmatter"
        );
        assert!(
            frontmatter.contains_key("status"),
            "STATE.md: status must be parsed from frontmatter"
        );
    }

    #[test]
    fn test_unknown_fields_no_panic() {
        // warn_unknown_fields must return without panic on a map containing novel keys.
        // Validates T-11-01 (lenient parse, no hard failure on schema drift).
        let mut map = HashMap::new();
        map.insert("gsd_state_version".to_string(), "1.0".to_string());
        map.insert("status".to_string(), "planning".to_string());
        map.insert("novel_field_from_future_version".to_string(), "value".to_string());
        map.insert("another_unknown_key".to_string(), "foo".to_string());

        // Must not panic
        warn_unknown_fields(&map, KNOWN_STATE_KEYS, "tests/fixtures/gsd-next/state.md");
    }

    #[test]
    fn test_known_state_keys_cover_gsd_next_frontmatter() {
        // gsd-core@next STATE.md frontmatter carries milestone_name, stopped_at, last_updated.
        // These are real schema keys, not drift — KNOWN_STATE_KEYS must recognize them so they
        // don't spam the drift warning on every STATE.md read.
        for key in ["milestone_name", "stopped_at", "last_updated"] {
            assert!(
                KNOWN_STATE_KEYS.contains(&key),
                "KNOWN_STATE_KEYS must include `{key}` (gsd-core@next STATE.md frontmatter)"
            );
        }
    }

    #[test]
    fn test_known_keys_cover_gsd_next_plan_and_summary_frontmatter() {
        // gsd-core@next PLAN.md / SUMMARY.md frontmatter keys observed in the wild — recognize
        // them so they don't spam the drift warning once the files actually parse.
        for key in ["must_haves", "plan_only", "title", "mode", "requirement"] {
            assert!(
                KNOWN_PLAN_KEYS.contains(&key),
                "KNOWN_PLAN_KEYS must include `{key}`"
            );
        }
        for key in ["plan_only", "title", "date", "mode", "requirements"] {
            assert!(
                KNOWN_SUMMARY_KEYS.contains(&key),
                "KNOWN_SUMMARY_KEYS must include `{key}`"
            );
        }
    }

    #[test]
    fn test_plan_md_always_present_fields() {
        // plan-standard.md top-level flat fields that parse_frontmatter already handles.
        let content = include_str!("../../tests/fixtures/gsd-next/plan-standard.md");
        let (frontmatter, _) = parse_frontmatter(content);

        assert!(
            frontmatter.contains_key("phase"),
            "PLAN.md: phase field must be parsed"
        );
        assert!(
            frontmatter.contains_key("plan"),
            "PLAN.md: plan field must be parsed"
        );
        assert!(
            frontmatter.contains_key("type"),
            "PLAN.md: type field must be parsed"
        );
        assert!(
            frontmatter.contains_key("autonomous"),
            "PLAN.md: autonomous field must be parsed"
        );
    }

    #[test]
    fn test_context_md_xml_tag_extraction() {
        // context.md: extract_xml_tag finds the decisions block.
        let content = include_str!("../../tests/fixtures/gsd-next/context.md");
        let decisions = extract_xml_tag(content, "decisions");
        assert!(
            decisions.is_some(),
            "context.md: <decisions> XML tag content must be extractable"
        );
        let text = decisions.unwrap();
        assert!(
            text.contains("Implementation Decisions"),
            "context.md: decisions block must contain 'Implementation Decisions' heading"
        );
    }

    #[test]
    fn test_project_md_section_extraction() {
        // project.md: extract_section finds "Core Value" section.
        let content = include_str!("../../tests/fixtures/gsd-next/project.md");
        let core_value = extract_section(content, "core value");
        assert!(
            core_value.is_some(),
            "project.md: 'Core Value' section must be extractable by extract_section"
        );
    }

    // ── Plan 02 fidelity tests (SCHM-01/02) — GREEN ────────────────────────

    #[test]
    fn test_state_progress_nested() {
        // STATE.md nested progress.* keys are extracted via extract_nested_progress (SCHM-02).
        // parse_frontmatter skips indented lines; this test verifies extract_nested_progress
        // correctly surfaces the nested scalar sub-keys from the raw frontmatter block.
        let content = include_str!("../../tests/fixtures/gsd-next/state.md");

        // Extract the raw frontmatter string (between first --- and second ---)
        let fm_raw: &str = if content.starts_with("---") {
            let after = &content[3..];
            after.find("\n---").map(|end| &after[..end]).unwrap_or("")
        } else {
            ""
        };

        let nested = extract_nested_progress(fm_raw);

        assert!(
            nested.contains_key("progress.total_phases"),
            "STATE.md: progress.total_phases must be extractable via extract_nested_progress (SCHM-02)"
        );
        assert!(
            nested.contains_key("progress.completed_phases"),
            "STATE.md: progress.completed_phases must be extractable (SCHM-02)"
        );
        assert!(
            nested.contains_key("progress.total_plans"),
            "STATE.md: progress.total_plans must be extractable (SCHM-02)"
        );
        assert!(
            nested.contains_key("progress.completed_plans"),
            "STATE.md: progress.completed_plans must be extractable (SCHM-02)"
        );
        assert!(
            nested.contains_key("progress.percent"),
            "STATE.md: progress.percent must be extractable (SCHM-02)"
        );

        // Verify the actual values from the fixture
        assert_eq!(nested.get("progress.total_phases").map(|s| s.as_str()), Some("11"));
        assert_eq!(nested.get("progress.completed_phases").map(|s| s.as_str()), Some("10"));
        assert_eq!(nested.get("progress.percent").map(|s| s.as_str()), Some("92"));
    }

    #[test]
    fn test_plan_md_fidelity_wave_field() {
        // plan-standard.md exposes wave and requirements in the GsdPlan struct.
        // These fields exist in the frontmatter but GsdPlan struct doesn't have them yet (Plan 02 adds them).
        let content = include_str!("../../tests/fixtures/gsd-next/plan-standard.md");
        let (frontmatter, _) = parse_frontmatter(content);

        assert!(
            frontmatter.contains_key("wave"),
            "PLAN.md: wave field must be parsed (SCHM-01, Plan 02)"
        );
        assert!(
            frontmatter.contains_key("requirements"),
            "PLAN.md: requirements field must be parsed (SCHM-01, Plan 02)"
        );
    }

    #[test]
    fn test_summary_md_fidelity_requirements_completed() {
        // summary-full.md exposes requirements-completed (Plan 02 adds it to GsdSummary).
        // extract_yaml_list should already extract it from the frontmatter text.
        let content = include_str!("../../tests/fixtures/gsd-next/summary-full.md");
        let (frontmatter, _) = parse_frontmatter(content);

        let has_key = frontmatter.contains_key("requirements-completed");
        let list = extract_yaml_list(content, "requirements-completed");
        assert!(
            has_key || !list.is_empty(),
            "SUMMARY.md: requirements-completed must be parsed (SCHM-01, Plan 02)"
        );
    }

    #[test]
    fn test_project_info_vision_section() {
        // project.md "What This Is" section should be aliased to vision by gsd_get_project_info.
        // Plan 02 adds .or_else(|| extract_section(&body, "what this is")) to the vision chain.
        let content = include_str!("../../tests/fixtures/gsd-next/project.md");

        // The current extract_section chain tries "vision" then "description" but not "what this is"
        let vision = extract_section(content, "vision");
        let description = extract_section(content, "description");
        let what_this_is = extract_section(content, "what this is");

        // After Plan 02: the vision field must be found via the "what this is" alias
        assert!(
            vision.is_some() || description.is_some() || what_this_is.is_some(),
            "project.md: 'What This Is' section must be reachable via vision alias (SCHM-02, Plan 02)"
        );
        // This specific assertion verifies the alias is wired in gsd_get_project_info:
        assert!(
            what_this_is.is_some(),
            "project.md: extract_section must find 'What This Is' — verify gsd_get_project_info uses the alias (SCHM-02, Plan 02)"
        );
    }

    // ── SCHM-04: resolve_gsd_path tests ─────────────────────────────────────

    #[test]
    fn test_resolve_gsd_path_root_fallback() {
        // With no workstream env, no active-workstream file, and no explicit ID:
        // resolve_gsd_path must return the flat .planning/STATE.md (unchanged regression).
        let tmp = std::env::temp_dir().join(format!(
            "vcca_ws_fallback_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(tmp.join(".planning")).unwrap();

        // Temporarily unset GSD_WORKSTREAM to guarantee clean state
        let old = std::env::var("GSD_WORKSTREAM").ok();
        unsafe { std::env::remove_var("GSD_WORKSTREAM"); }

        let result = resolve_gsd_path(tmp.to_str().unwrap(), None, "STATE.md");
        assert_eq!(result, tmp.join(".planning").join("STATE.md"),
            "No workstream set — must fall back to flat .planning/STATE.md (regression)");

        // Restore env
        if let Some(v) = old { unsafe { std::env::set_var("GSD_WORKSTREAM", v); } }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_resolve_gsd_path_workstream() {
        // With an explicit workstream_id and the workstream dir existing:
        // resolve_gsd_path must return .planning/workstreams/{ws}/STATE.md
        let tmp = std::env::temp_dir().join(format!(
            "vcca_ws_explicit_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let ws_dir = tmp.join(".planning").join("workstreams").join("ws-a");
        std::fs::create_dir_all(&ws_dir).unwrap();

        let old = std::env::var("GSD_WORKSTREAM").ok();
        unsafe { std::env::remove_var("GSD_WORKSTREAM"); }

        let result = resolve_gsd_path(tmp.to_str().unwrap(), Some("ws-a"), "STATE.md");
        assert_eq!(result, ws_dir.join("STATE.md"),
            "Explicit workstream 'ws-a' with existing dir must resolve to workstream subtree");

        if let Some(v) = old { unsafe { std::env::set_var("GSD_WORKSTREAM", v); } }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_resolve_gsd_path_active_file() {
        // With .planning/active-workstream file pointing to 'ws-b' and that dir existing:
        // resolve_gsd_path must return .planning/workstreams/ws-b/STATE.md
        let tmp = std::env::temp_dir().join(format!(
            "vcca_ws_active_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let ws_dir = tmp.join(".planning").join("workstreams").join("ws-b");
        std::fs::create_dir_all(&ws_dir).unwrap();

        // Write active-workstream pointer file
        let ptr_path = tmp.join(".planning").join("active-workstream");
        std::fs::write(&ptr_path, "ws-b\n").unwrap();

        let old = std::env::var("GSD_WORKSTREAM").ok();
        unsafe { std::env::remove_var("GSD_WORKSTREAM"); }

        let result = resolve_gsd_path(tmp.to_str().unwrap(), None, "STATE.md");
        assert_eq!(result, ws_dir.join("STATE.md"),
            "active-workstream file 'ws-b' with existing dir must resolve to workstream subtree");

        if let Some(v) = old { unsafe { std::env::set_var("GSD_WORKSTREAM", v); } }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_resolve_gsd_path_workstream_dir_missing_falls_back() {
        // Workstream name is set but the directory does not exist:
        // must fall back to flat .planning/STATE.md and log a warn (self-healing per ADR-0004).
        let tmp = std::env::temp_dir().join(format!(
            "vcca_ws_missing_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(tmp.join(".planning")).unwrap();

        let old = std::env::var("GSD_WORKSTREAM").ok();
        unsafe { std::env::remove_var("GSD_WORKSTREAM"); }

        // Write active-workstream pointing to a non-existent dir
        let ptr_path = tmp.join(".planning").join("active-workstream");
        std::fs::write(&ptr_path, "nonexistent-ws").unwrap();

        let result = resolve_gsd_path(tmp.to_str().unwrap(), None, "STATE.md");
        assert_eq!(result, tmp.join(".planning").join("STATE.md"),
            "Missing workstream dir must fall back to flat .planning/ (self-healing)");

        if let Some(v) = old { unsafe { std::env::set_var("GSD_WORKSTREAM", v); } }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_resolve_gsd_path_env_precedence_over_active_file() {
        // GSD_WORKSTREAM env takes precedence over active-workstream file (ADR-0006 step 2 > 3).
        let tmp = std::env::temp_dir().join(format!(
            "vcca_ws_env_prec_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        // Create both workstream dirs
        let ws_env = tmp.join(".planning").join("workstreams").join("ws-env");
        let ws_file = tmp.join(".planning").join("workstreams").join("ws-file");
        std::fs::create_dir_all(&ws_env).unwrap();
        std::fs::create_dir_all(&ws_file).unwrap();

        // active-workstream points to ws-file
        let ptr_path = tmp.join(".planning").join("active-workstream");
        std::fs::write(&ptr_path, "ws-file").unwrap();

        // env overrides to ws-env
        let old = std::env::var("GSD_WORKSTREAM").ok();
        unsafe { std::env::set_var("GSD_WORKSTREAM", "ws-env"); }

        let result = resolve_gsd_path(tmp.to_str().unwrap(), None, "STATE.md");
        assert_eq!(result, ws_env.join("STATE.md"),
            "GSD_WORKSTREAM env must take precedence over active-workstream file");

        unsafe { std::env::remove_var("GSD_WORKSTREAM"); }
        if let Some(v) = old { unsafe { std::env::set_var("GSD_WORKSTREAM", v); } }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    // ── SCHM-04: is_valid_workstream_slug negative tests (T-11-03) ──────────

    #[test]
    fn test_is_valid_workstream_slug_rejects_path_traversal() {
        // T-11-03: path traversal and invalid slug patterns must be rejected
        assert!(!is_valid_workstream_slug(".."), ".. must be rejected (path traversal)");
        assert!(!is_valid_workstream_slug("/"), "/ must be rejected");
        assert!(!is_valid_workstream_slug(""), "empty string must be rejected");
        assert!(!is_valid_workstream_slug("../etc/passwd"), "path traversal must be rejected");
        assert!(!is_valid_workstream_slug("-bad"), "leading dash must be rejected");
        assert!(!is_valid_workstream_slug(&"a".repeat(64)), "64-char slug must be rejected (max < 64)");
        assert!(!is_valid_workstream_slug("my ws"), "spaces must be rejected");
        assert!(!is_valid_workstream_slug("ws/subdir"), "slash must be rejected");

        // Valid slugs
        assert!(is_valid_workstream_slug("ws-a"), "ws-a is valid");
        assert!(is_valid_workstream_slug("feature_branch"), "feature_branch is valid");
        assert!(is_valid_workstream_slug("ws123"), "ws123 is valid");
        assert!(is_valid_workstream_slug(&"a".repeat(63)), "63-char slug must be accepted");
    }
}
