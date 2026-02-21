// Control Tower - File System Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{
    DocsAvailable, KnowledgeFileEntry, KnowledgeFileTree, KnowledgeFolder, KnowledgeGraph,
    KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeInput, KnowledgeSearchMatch,
    MarkdownFolderSummary, MarkdownIndexProgress, MarkdownScanResult, ProjectDocs, ScannerCategory,
    ScannerReport, ScannerSummary, TechStack,
};
use crate::security::safe_join;
use rusqlite::params;
use std::path::Path;
use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

type DbState = Arc<crate::db::DbPool>;

// ============================================================
// Markdown Discovery Constants & Types
// ============================================================

const EXCLUDED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    "__pycache__",
    ".next",
    ".cache",
    "vendor",
    ".venv",
    ".tox",
    "coverage",
    ".nyc_output",
    ".parcel-cache",
    ".turbo",
    ".svelte-kit",
    ".nuxt",
    ".output",
    ".expo",
    ".gradle",
    "Pods",
];
const MAX_FILES: usize = 2000;
const MAX_DEPTH: usize = 10;
const MAX_FILE_SIZE: u64 = 512 * 1024; // 512KB for content indexing
const CODE_EXTENSIONS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "yaml", "yml", "toml", "rs", "py",
    "go", "java", "kt", "kts", "swift", "cpp", "cc", "c", "h", "hpp", "cs", "rb",
    "php", "sh", "sql", "graphql", "gql", "html", "css", "scss", "sass", "less",
    "mdx", "vue", "svelte", "lua", "pl", "r", "dart", "gradle", "xml", "ini", "conf",
    "properties", "lock",
];
const CODE_FILENAMES: &[&str] = &[
    "Makefile",
    "Dockerfile",
    "CMakeLists.txt",
    "Vagrantfile",
    "Gemfile",
    "Rakefile",
    "Procfile",
    "Justfile",
];

/// A discovered markdown file with metadata
#[derive(Debug, Clone)]
pub(crate) struct DiscoveredMarkdownFile {
    pub relative_path: String,
    pub display_name: String,
    pub folder: String,
    pub folder_display: String,
    pub size_bytes: u64,
}

/// A discovered code/config file with metadata
#[derive(Debug, Clone)]
pub(crate) struct DiscoveredCodeFile {
    pub relative_path: String,
    pub display_name: String,
    pub folder: String,
    pub folder_display: String,
    pub size_bytes: u64,
}

/// Recursively discover all .md files under base_path, skipping excluded dirs
pub(crate) fn discover_markdown_files(
    base_path: &Path,
) -> Result<Vec<DiscoveredMarkdownFile>, String> {
    let mut files = Vec::new();
    walk_dir_recursive(base_path, base_path, 0, &mut files)?;

    // Sort: .planning first, then root, then alphabetical
    files.sort_by(|a, b| {
        let priority = |f: &DiscoveredMarkdownFile| -> u8 {
            if f.folder.starts_with(".planning") {
                0
            } else if f.folder == "root" {
                1
            } else {
                2
            }
        };
        let pa = priority(a);
        let pb = priority(b);
        if pa != pb {
            pa.cmp(&pb)
        } else if a.folder != b.folder {
            a.folder.cmp(&b.folder)
        } else {
            a.display_name.cmp(&b.display_name)
        }
    });

    Ok(files)
}

fn walk_dir_recursive(
    base_path: &Path,
    current: &Path,
    depth: usize,
    files: &mut Vec<DiscoveredMarkdownFile>,
) -> Result<(), String> {
    if depth > MAX_DEPTH || files.len() >= MAX_FILES {
        return Ok(());
    }

    let entries = std::fs::read_dir(current).map_err(|e| e.to_string())?;

    let mut entries_vec: Vec<_> = entries.flatten().collect();
    entries_vec.sort_by_key(|e| e.file_name());

    for entry in entries_vec {
        if files.len() >= MAX_FILES {
            break;
        }

        let entry_path = entry.path();

        // Skip symlinks
        if entry_path
            .symlink_metadata()
            .map(|m| m.is_symlink())
            .unwrap_or(false)
        {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();

        if entry_path.is_dir() {
            // Skip excluded directories
            if EXCLUDED_DIRS.contains(&file_name.as_str()) {
                continue;
            }
            // Hide dot-prefixed folders from listings
            if file_name.starts_with('.') {
                continue;
            }
            // Skip .planning/phases — per-phase ROUTE/PLAN
            // files are shown in the Roadmap tab, not Knowledge
            if file_name == "phases" {
                if let Ok(rel) = entry_path.strip_prefix(base_path) {
                    let parent = rel
                        .parent()
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();
                    if parent == ".planning" {
                        continue;
                    }
                }
            }
            walk_dir_recursive(base_path, &entry_path, depth + 1, files)?;
        } else if entry_path.is_file() {
            if file_name.starts_with('.') {
                continue;
            }
            if let Some(ext) = entry_path.extension() {
                if ext == "md" {
                    let relative = entry_path
                        .strip_prefix(base_path)
                        .map_err(|e| e.to_string())?;
                    let relative_path = relative.to_string_lossy().to_string();

                    let display_name = file_name
                        .trim_end_matches(".md")
                        .replace('_', " ")
                        .replace('-', " ");

                    let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

                    // Determine folder
                    let (folder, folder_display) = if let Some(parent) = relative.parent() {
                        let parent_str = parent.to_string_lossy().to_string();
                        if parent_str.is_empty() {
                            ("root".to_string(), "Project Root".to_string())
                        } else {
                            let display = folder_display_name(&parent_str);
                            (parent_str, display)
                        }
                    } else {
                        ("root".to_string(), "Project Root".to_string())
                    };

                    files.push(DiscoveredMarkdownFile {
                        relative_path,
                        display_name,
                        folder,
                        folder_display,
                        size_bytes,
                    });
                }
            }
        }
    }

    Ok(())
}

/// Recursively discover code/config files under base_path, skipping excluded dirs
pub(crate) fn discover_code_files(base_path: &Path) -> Result<Vec<DiscoveredCodeFile>, String> {
    let mut files = Vec::new();
    walk_code_recursive(base_path, base_path, 0, &mut files)?;

    files.sort_by(|a, b| {
        if a.folder != b.folder {
            a.folder.cmp(&b.folder)
        } else {
            a.display_name.cmp(&b.display_name)
        }
    });

    Ok(files)
}

fn walk_code_recursive(
    base_path: &Path,
    current: &Path,
    depth: usize,
    files: &mut Vec<DiscoveredCodeFile>,
) -> Result<(), String> {
    if depth > MAX_DEPTH || files.len() >= MAX_FILES {
        return Ok(());
    }

    let entries = std::fs::read_dir(current).map_err(|e| e.to_string())?;
    let mut entries_vec: Vec<_> = entries.flatten().collect();
    entries_vec.sort_by_key(|e| e.file_name());

    for entry in entries_vec {
        if files.len() >= MAX_FILES {
            break;
        }

        let entry_path = entry.path();
        if entry_path
            .symlink_metadata()
            .map(|m| m.is_symlink())
            .unwrap_or(false)
        {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();

        if entry_path.is_dir() {
            if EXCLUDED_DIRS.contains(&file_name.as_str()) {
                continue;
            }
            if file_name.starts_with('.') {
                continue;
            }
            walk_code_recursive(base_path, &entry_path, depth + 1, files)?;
        } else if entry_path.is_file() {
            if file_name.starts_with('.') {
                continue;
            }
            let ext = entry_path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "md" {
                continue;
            }

            let is_code_extension = !ext.is_empty() && CODE_EXTENSIONS.contains(&ext);
            let is_code_filename = CODE_FILENAMES.contains(&file_name.as_str());
            if !is_code_extension && !is_code_filename {
                continue;
            }

            let relative = entry_path
                .strip_prefix(base_path)
                .map_err(|e| e.to_string())?;
            let relative_path = relative.to_string_lossy().to_string();
            let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

            let display_name = file_name.replace('_', " ").replace('-', " ");

            let (folder, folder_display) = if let Some(parent) = relative.parent() {
                let parent_str = parent.to_string_lossy().to_string();
                if parent_str.is_empty() {
                    ("root".to_string(), "Project Root".to_string())
                } else {
                    let display = folder_display_name(&parent_str);
                    (parent_str, display)
                }
            } else {
                ("root".to_string(), "Project Root".to_string())
            };

            files.push(DiscoveredCodeFile {
                relative_path,
                display_name,
                folder,
                folder_display,
                size_bytes,
            });
        }
    }

    Ok(())
}

/// Generate a human-readable folder display name
fn folder_display_name(folder_path: &str) -> String {
    match folder_path {
        ".planning" => "Planning".to_string(),
        _ => {
            // Use the last component, title-cased
            let last = folder_path.rsplit('/').next().unwrap_or(folder_path);
            let cleaned = last
                .trim_start_matches('.')
                .replace('_', " ")
                .replace('-', " ");
            // Title case first letter
            let mut chars = cleaned.chars();
            match chars.next() {
                Some(c) => c.to_uppercase().to_string() + chars.as_str(),
                None => cleaned,
            }
        }
    }
}

/// Scan markdown metadata (file counts, folder summaries) without reading content
pub(crate) fn scan_markdown_metadata(base_path: &Path) -> Result<MarkdownScanResult, String> {
    let files = discover_markdown_files(base_path)?;

    let total_files = files.len();
    let total_size_bytes: u64 = files.iter().map(|f| f.size_bytes).sum();

    // Collect warnings for large files
    let mut warnings = Vec::new();
    let large_files: Vec<_> = files.iter().filter(|f| f.size_bytes > MAX_FILE_SIZE).collect();
    if !large_files.is_empty() {
        warnings.push(format!(
            "{} file(s) exceed {}KB and will be skipped during indexing: {}",
            large_files.len(),
            MAX_FILE_SIZE / 1024,
            large_files.iter().map(|f| f.display_name.as_str()).take(3).collect::<Vec<_>>().join(", ")
        ));
    }

    // Group by folder
    let mut folder_map: std::collections::BTreeMap<String, (String, usize)> =
        std::collections::BTreeMap::new();
    for f in &files {
        let entry = folder_map
            .entry(f.folder.clone())
            .or_insert_with(|| (f.folder_display.clone(), 0));
        entry.1 += 1;
    }

    let folders: Vec<MarkdownFolderSummary> = folder_map
        .into_iter()
        .map(|(path, (display, count))| MarkdownFolderSummary {
            relative_path: path,
            display_name: display,
            file_count: count,
        })
        .collect();

    Ok(MarkdownScanResult {
        total_files,
        total_size_bytes,
        folders,
        warnings,
    })
}

#[tauri::command]
pub async fn detect_tech_stack(path: String) -> Result<TechStack, String> {
    detect_tech_stack_internal(&path)
}

pub fn detect_tech_stack_internal(path: &str) -> Result<TechStack, String> {
    let path = Path::new(path);

    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }

    let mut tech_stack = TechStack {
        framework: None,
        language: None,
        package_manager: None,
        database: None,
        test_framework: None,
        has_planning: false,
        gsd_phase_count: None,
        gsd_todo_count: None,
        gsd_has_requirements: false,
        gsd_conversion_incomplete: false,
        gsd_conversion_issues: None,
    };

    // Check for .planning directory
    tech_stack.has_planning = path.join(".planning").exists();

    // Populate GSD metadata when .planning/ exists
    if tech_stack.has_planning {
        // Count phase directories in .planning/phases/
        let phases_dir = path.join(".planning/phases");
        if phases_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&phases_dir) {
                let count = entries.flatten().filter(|e| e.path().is_dir()).count();
                tech_stack.gsd_phase_count = Some(count as i32);
            }
        }

        // Count pending .md files in .planning/todos/pending/
        let pending_dir = path.join(".planning/todos/pending");
        if pending_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&pending_dir) {
                let count = entries
                    .flatten()
                    .filter(|e| e.path().extension().map_or(false, |ext| ext == "md"))
                    .count();
                tech_stack.gsd_todo_count = Some(count as i32);
            }
        }

        // Check if .planning/REQUIREMENTS.md exists
        tech_stack.gsd_has_requirements = path.join(".planning/REQUIREMENTS.md").exists();
    }

    // Check for package.json (Node.js/JavaScript)
    let package_json_path = path.join("package.json");
    if package_json_path.exists() {
        tech_stack.language = Some("TypeScript/JavaScript".to_string());

        if let Ok(content) = std::fs::read_to_string(&package_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                // Detect framework
                if let Some(deps) = json.get("dependencies") {
                    if deps.get("next").is_some() {
                        tech_stack.framework = Some("Next.js".to_string());
                    } else if deps.get("react").is_some() {
                        tech_stack.framework = Some("React".to_string());
                    } else if deps.get("vue").is_some() {
                        tech_stack.framework = Some("Vue".to_string());
                    } else if deps.get("svelte").is_some() {
                        tech_stack.framework = Some("Svelte".to_string());
                    } else if deps.get("express").is_some() {
                        tech_stack.framework = Some("Express".to_string());
                    } else if deps.get("fastify").is_some() {
                        tech_stack.framework = Some("Fastify".to_string());
                    } else if deps.get("@tauri-apps/api").is_some() {
                        tech_stack.framework = Some("Tauri".to_string());
                    }

                    // Detect database
                    if deps.get("prisma").is_some() || deps.get("@prisma/client").is_some() {
                        tech_stack.database = Some("Prisma".to_string());
                    } else if deps.get("drizzle-orm").is_some() {
                        tech_stack.database = Some("Drizzle".to_string());
                    } else if deps.get("pg").is_some() {
                        tech_stack.database = Some("PostgreSQL".to_string());
                    } else if deps.get("better-sqlite3").is_some() || deps.get("sqlite3").is_some()
                    {
                        tech_stack.database = Some("SQLite".to_string());
                    } else if deps.get("mongoose").is_some() {
                        tech_stack.database = Some("MongoDB".to_string());
                    }
                }

                // Detect test framework
                if let Some(dev_deps) = json.get("devDependencies") {
                    if dev_deps.get("vitest").is_some() {
                        tech_stack.test_framework = Some("Vitest".to_string());
                    } else if dev_deps.get("jest").is_some() {
                        tech_stack.test_framework = Some("Jest".to_string());
                    } else if dev_deps.get("mocha").is_some() {
                        tech_stack.test_framework = Some("Mocha".to_string());
                    }
                }
            }
        }

        // Detect package manager
        if path.join("pnpm-lock.yaml").exists() {
            tech_stack.package_manager = Some("pnpm".to_string());
        } else if path.join("yarn.lock").exists() {
            tech_stack.package_manager = Some("yarn".to_string());
        } else if path.join("bun.lockb").exists() {
            tech_stack.package_manager = Some("bun".to_string());
        } else if path.join("package-lock.json").exists() {
            tech_stack.package_manager = Some("npm".to_string());
        }
    }

    // Check for Python
    if path.join("pyproject.toml").exists() || path.join("requirements.txt").exists() {
        tech_stack.language = Some("Python".to_string());

        if path.join("pyproject.toml").exists() {
            if let Ok(content) = std::fs::read_to_string(path.join("pyproject.toml")) {
                if content.contains("fastapi") {
                    tech_stack.framework = Some("FastAPI".to_string());
                } else if content.contains("django") {
                    tech_stack.framework = Some("Django".to_string());
                } else if content.contains("flask") {
                    tech_stack.framework = Some("Flask".to_string());
                }

                if content.contains("pytest") {
                    tech_stack.test_framework = Some("pytest".to_string());
                }
            }
        }

        if path.join("poetry.lock").exists() {
            tech_stack.package_manager = Some("poetry".to_string());
        } else if path.join("Pipfile.lock").exists() {
            tech_stack.package_manager = Some("pipenv".to_string());
        } else if path.join("uv.lock").exists() {
            tech_stack.package_manager = Some("uv".to_string());
        }
    }

    // Check for Rust
    if path.join("Cargo.toml").exists() {
        tech_stack.language = Some("Rust".to_string());
        tech_stack.package_manager = Some("cargo".to_string());

        if let Ok(content) = std::fs::read_to_string(path.join("Cargo.toml")) {
            if content.contains("tauri") {
                tech_stack.framework = Some("Tauri".to_string());
            } else if content.contains("actix") {
                tech_stack.framework = Some("Actix".to_string());
            } else if content.contains("axum") {
                tech_stack.framework = Some("Axum".to_string());
            }
        }
    }

    // Check for Go
    if path.join("go.mod").exists() {
        tech_stack.language = Some("Go".to_string());
        tech_stack.package_manager = Some("go modules".to_string());
    }

    Ok(tech_stack)
}

#[tauri::command]
pub async fn read_project_file(path: String, filename: String) -> Result<String, String> {
    let file_path = safe_join(&path, &filename)?;

    if !file_path.exists() {
        return Err(format!("File not found: {}", file_path.display()));
    }

    std::fs::read_to_string(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri_plugin_dialog::FilePath;

    let (tx, rx) = mpsc::channel();

    app.dialog().file().pick_folder(move |path| {
        let _ = tx.send(path);
    });

    // Wait for the dialog result
    match rx.recv() {
        Ok(Some(file_path)) => {
            let path_str = match file_path {
                FilePath::Path(p) => p.to_string_lossy().to_string(),
                FilePath::Url(u) => u.to_string(),
            };
            Ok(Some(path_str))
        }
        Ok(None) => Ok(None),
        Err(_) => Err("Dialog was cancelled".to_string()),
    }
}

#[tauri::command]
pub async fn detect_docs_available(path: String) -> Result<DocsAvailable, String> {
    let base_path = Path::new(&path);

    if !base_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let mut docs = DocsAvailable::default();

    // Check for .planning/PROJECT.md
    let project_md_path = base_path.join(".planning/PROJECT.md");
    docs.has_project_md = project_md_path.exists() || docs.has_project_md;

    // Check for .planning/PROJECT.md (GSD format)
    let project_md_planning = base_path.join(".planning/PROJECT.md");
    if project_md_planning.exists() {
        docs.has_project_md = true;
        docs.project_md_path = Some(project_md_planning.to_string_lossy().to_string());
    }

    // Check for .planning/ROADMAP.md
    let roadmap_path = base_path.join(".planning/ROADMAP.md");
    docs.has_roadmap_md = roadmap_path.exists();

    // Check for README.md in root
    docs.has_readme = base_path.join("README.md").exists();

    Ok(docs)
}

fn empty_scanner_summary() -> ScannerSummary {
    ScannerSummary {
        available: false,
        overall_grade: None,
        scan_date: None,
        categories: Vec::new(),
        reports: Vec::new(),
        total_gaps: None,
        total_recommendations: None,
        overall_score: None,
        analysis_mode: None,
        project_phase: None,
        high_priority_actions: Vec::new(),
        source: None,
    }
}

fn score_to_grade(score: u32) -> String {
    match score {
        90..=100 => "A".to_string(),
        80..=89 => "B".to_string(),
        70..=79 => "C".to_string(),
        60..=69 => "D".to_string(),
        _ => "F".to_string(),
    }
}

fn expand_category_abbrev(abbrev: &str) -> String {
    match abbrev {
        "DEPS" => "Dependencies".to_string(),
        "SEC" => "Security".to_string(),
        "DEBT" => "Tech Debt".to_string(),
        "COV" => "Coverage".to_string(),
        "PERF" => "Performance".to_string(),
        "A11Y" => "Accessibility".to_string(),
        "RISK" => "Risk".to_string(),
        other => other.to_string(),
    }
}

fn parse_scan_report(content: &str) -> ScannerSummary {
    use regex::Regex;

    let mut scan_date = None;
    let mut overall_score = None;
    let mut analysis_mode = None;
    let mut project_phase = None;
    let mut categories: Vec<ScannerCategory> = Vec::new();
    let mut high_priority_actions: Vec<String> = Vec::new();

    // Parse YAML frontmatter
    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() >= 3 {
        let frontmatter = parts[1];
        for line in frontmatter.lines() {
            let line = line.trim();
            if let Some((key, val)) = line.split_once(':') {
                let key = key.trim();
                let val = val.trim().trim_matches('"');
                match key {
                    "generated_at" | "scanned_at" => scan_date = Some(val.to_string()),
                    "overall_score" => {
                        if let Ok(n) = val.parse::<u32>() {
                            overall_score = Some(n);
                        }
                    }
                    "analysis_mode" => analysis_mode = Some(val.to_string()),
                    "project_phase" => {
                        if val != "null" && !val.is_empty() {
                            project_phase = Some(val.to_string());
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    // Parse progress bars: DEPS [||||||||||||||||||||....] 82%   [OK]
    let bar_re = Regex::new(r"^(\w+)\s+\[[|.]+\]\s+(\d+)%\s+\[(OK|!!|--)\]").unwrap();
    for line in content.lines() {
        let line = line.trim();
        if let Some(caps) = bar_re.captures(line) {
            let abbrev = caps.get(1).unwrap().as_str();
            let score: u32 = caps.get(2).unwrap().as_str().parse().unwrap_or(0);
            let status = caps.get(3).unwrap().as_str();

            categories.push(ScannerCategory {
                name: expand_category_abbrev(abbrev),
                grade: score_to_grade(score),
                summary: String::new(),
                score: Some(score),
                issues: None,
                priority: None,
                status: Some(status.to_string()),
            });
        }
    }

    // Parse summary table to fill in issues and priority
    // | Category | Score | Issues | Priority |
    let lines: Vec<&str> = content.lines().collect();
    for line in &lines {
        let line = line.trim();
        if line.starts_with('|') && !line.contains("---") {
            let cols: Vec<&str> = line.split('|').map(|s| s.trim()).collect();
            if cols.len() >= 5 {
                let cat_name = cols[1].trim();
                let issues_str = cols[3].trim();
                let priority_str = cols[4].trim();

                // Skip header rows
                if cat_name == "Category" || cat_name.is_empty() {
                    continue;
                }

                // Find matching category and update
                if let Ok(issues) = issues_str.parse::<u32>() {
                    if let Some(cat) = categories.iter_mut().find(|c| c.name == cat_name) {
                        cat.issues = Some(issues);
                        if !priority_str.is_empty() {
                            cat.priority = Some(priority_str.to_string());
                        }
                    }
                }
            }
        }
    }

    // Parse high priority actions
    let mut in_actions = false;
    let action_re = Regex::new(r"^\d+\.\s+(.+)$").unwrap();
    for line in &lines {
        let line = line.trim();
        if line.contains("High Priority Actions") {
            in_actions = true;
            continue;
        }
        if in_actions {
            if line.starts_with('#') || (line.is_empty() && !high_priority_actions.is_empty()) {
                // Next section or blank after items — stop
                if line.starts_with('#') {
                    break;
                }
                continue;
            }
            if let Some(caps) = action_re.captures(line) {
                high_priority_actions.push(caps.get(1).unwrap().as_str().to_string());
            }
        }
    }

    let overall_grade = overall_score.map(score_to_grade);

    ScannerSummary {
        available: true,
        overall_grade,
        scan_date,
        categories,
        reports: Vec::new(),
        total_gaps: None,
        total_recommendations: None,
        overall_score,
        analysis_mode,
        project_phase,
        high_priority_actions,
        source: Some("scan-report".to_string()),
    }
}

fn parse_legacy_summary(content: &str, base_path: &Path) -> ScannerSummary {
    let mut overall_grade = None;
    let mut scan_date = None;
    let mut categories = Vec::new();
    let mut reports = Vec::new();
    let mut total_gaps = None;
    let mut total_recommendations = None;

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();

        // Parse table rows: | Col1 | Col2 | Col3 |
        if line.starts_with('|') && line.contains('|') {
            let cols: Vec<&str> = line.split('|').map(|s| s.trim()).collect();
            if cols.len() >= 3 {
                let col1 = cols[1].replace("**", "");
                let col2 = cols[2].trim();

                // Skip header/separator rows
                if col1.is_empty() || col1.contains("---") || col2.contains("---") {
                    i += 1;
                    continue;
                }

                // Metadata table rows (2-column: | **Metric** | Value |)
                if col1 == "Scan Date" {
                    scan_date = Some(col2.to_string());
                } else if col1 == "Total Gaps Identified" {
                    if let Ok(n) = col2.parse::<u32>() {
                        total_gaps = Some(n);
                    }
                } else if col1 == "Total Recommendations" {
                    if let Ok(n) = col2.parse::<u32>() {
                        total_recommendations = Some(n);
                    }
                }

                // Scorecard rows (3-column: | Category | Grade | Summary |)
                if cols.len() >= 4 && col1 != "Category" && col1 != "Metric" && col2 != "Grade" {
                    let grade_check = col2.trim_end_matches('+').trim_end_matches('-');
                    let summary = cols[3].trim();
                    if grade_check.len() == 1
                        && "ABCDF".contains(grade_check)
                        && !summary.is_empty()
                    {
                        categories.push(ScannerCategory {
                            name: col1.clone(),
                            grade: col2.to_string(),
                            summary: summary.to_string(),
                            score: None,
                            issues: None,
                            priority: None,
                            status: None,
                        });
                    }
                }
            }
        }

        // Parse overall grade: **Overall Grade: X**
        if line.contains("Overall Grade:") {
            if let Some(start) = line.find("Overall Grade:") {
                let after = &line[start + 14..];
                let grade_str = after
                    .trim()
                    .trim_end_matches("**")
                    .trim_end_matches('*')
                    .trim()
                    .trim_start_matches("--")
                    .trim();
                if !grade_str.is_empty() {
                    overall_grade = Some(grade_str.to_string());
                }
            }
        }

        // Parse report table rows: | Report | Path | Description |
        if line.starts_with('|') && line.contains('|') {
            let cols: Vec<&str> = line.split('|').map(|s| s.trim()).collect();
            if cols.len() >= 4 {
                let name_raw = cols[1].trim().to_string();
                let path_raw = cols[2]
                    .trim()
                    .trim_start_matches('`')
                    .trim_end_matches('`')
                    .to_string();
                let desc_raw = cols[3].trim().to_string();

                // Report rows have paths starting with .planning/reports/
                if path_raw.starts_with(".planning/reports/")
                    && name_raw != "Executive Summary"
                {
                    // Verify the file exists
                    let full_path = base_path.join(&path_raw);
                    if full_path.exists() {
                        reports.push(ScannerReport {
                            name: name_raw,
                            relative_path: path_raw,
                            description: desc_raw,
                        });
                    }
                }
            }
        }

        i += 1;
    }

    ScannerSummary {
        available: true,
        overall_grade,
        scan_date,
        categories,
        reports,
        total_gaps,
        total_recommendations,
        overall_score: None,
        analysis_mode: None,
        project_phase: None,
        high_priority_actions: Vec::new(),
        source: Some("summary".to_string()),
    }
}

#[tauri::command]
pub async fn get_scanner_summary(path: String) -> Result<ScannerSummary, String> {
    let base_path = Path::new(&path);

    // Try scan-report.md first (percentage-based format)
    let scan_report_path = base_path.join(".planning/reports/scan-report.md");
    if scan_report_path.exists() {
        let content = std::fs::read_to_string(&scan_report_path)
            .map_err(|e| format!("Failed to read scan-report.md: {}", e))?;
        return Ok(parse_scan_report(&content));
    }

    // Fall back to legacy SUMMARY.md (grade-based format)
    let summary_path = base_path.join(".planning/reports/SUMMARY.md");
    if summary_path.exists() {
        let content = std::fs::read_to_string(&summary_path)
            .map_err(|e| format!("Failed to read SUMMARY.md: {}", e))?;
        return Ok(parse_legacy_summary(&content, base_path));
    }

    Ok(empty_scanner_summary())
}

#[tauri::command]
pub async fn read_project_docs(path: String) -> Result<Option<ProjectDocs>, String> {
    let base_path = Path::new(&path);

    if !base_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Priority chain for documentation
    // 1. .planning/PROJECT.md
    let project_md_path = base_path.join(".planning/PROJECT.md");
    if project_md_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&project_md_path) {
            if let Some(docs) = parse_project_md(&content) {
                return Ok(Some(docs));
            }
        }
    }

    // 3. README.md - first paragraph as description
    let readme_path = base_path.join("README.md");
    if readme_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&readme_path) {
            if let Some(docs) = parse_readme(&content) {
                return Ok(Some(docs));
            }
        }
    }

    // 4. package.json - description field
    let package_json_path = base_path.join("package.json");
    if package_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&package_json_path) {
            if let Some(docs) = parse_package_json(&content) {
                return Ok(Some(docs));
            }
        }
    }

    Ok(None)
}

/// Parse PROJECT.md for goal/description
fn parse_project_md(content: &str) -> Option<ProjectDocs> {
    let mut description = None;
    let mut goal = None;

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();

        // Look for various heading formats
        if line.starts_with("## Goal") || line.starts_with("## Project Goal") {
            let mut goal_lines = Vec::new();
            i += 1;
            while i < lines.len() && !lines[i].trim().starts_with("##") {
                let l = lines[i].trim();
                if !l.is_empty() {
                    goal_lines.push(l);
                }
                i += 1;
            }
            if !goal_lines.is_empty() {
                goal = Some(goal_lines.join(" "));
            }
            continue;
        }

        if line.starts_with("## Description")
            || line.starts_with("## Overview")
            || line.starts_with("## Summary")
        {
            let mut desc_lines = Vec::new();
            i += 1;
            while i < lines.len() && !lines[i].trim().starts_with("##") {
                let l = lines[i].trim();
                if !l.is_empty() {
                    desc_lines.push(l);
                }
                i += 1;
            }
            if !desc_lines.is_empty() {
                description = Some(desc_lines.join(" "));
            }
            continue;
        }

        i += 1;
    }

    if description.is_some() || goal.is_some() {
        return Some(ProjectDocs {
            description,
            goal,
            source: "PROJECT.md".to_string(),
        });
    }

    None
}

/// Parse README.md - extract first non-heading paragraph as description
fn parse_readme(content: &str) -> Option<ProjectDocs> {
    let lines: Vec<&str> = content.lines().collect();
    let mut description_lines = Vec::new();
    let mut in_paragraph = false;

    for line in lines {
        let trimmed = line.trim();

        // Skip empty lines before first paragraph
        if trimmed.is_empty() {
            if in_paragraph {
                // End of first paragraph
                break;
            }
            continue;
        }

        // Skip headings
        if trimmed.starts_with('#') {
            if in_paragraph {
                break;
            }
            continue;
        }

        // Skip badges and links at top of README
        if trimmed.starts_with('[') || trimmed.starts_with('!') {
            continue;
        }

        // Start collecting paragraph
        in_paragraph = true;
        description_lines.push(trimmed);
    }

    if !description_lines.is_empty() {
        let description = description_lines.join(" ");
        // Limit to reasonable length
        let truncated = if description.len() > 500 {
            format!("{}...", &description[..497])
        } else {
            description
        };

        return Some(ProjectDocs {
            description: Some(truncated),
            goal: None,
            source: "README.md".to_string(),
        });
    }

    None
}

/// Parse package.json for description field
fn parse_package_json(content: &str) -> Option<ProjectDocs> {
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(description) = json.get("description").and_then(|v| v.as_str()) {
            if !description.is_empty() {
                return Some(ProjectDocs {
                    description: Some(description.to_string()),
                    goal: None,
                    source: "package.json".to_string(),
                });
            }
        }
    }

    None
}

// ============================================================
// Knowledge File System Commands (Phase E - KN-01, KN-02, KN-03)
// ============================================================

/// List all knowledge files organized as a file tree (KN-02)
/// Uses recursive markdown discovery to find .md files across the entire project
#[tauri::command]
pub async fn list_knowledge_files(path: String) -> Result<KnowledgeFileTree, String> {
    let base_path = Path::new(&path);
    if !base_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let discovered = discover_markdown_files(base_path)?;

    // Group discovered files into KnowledgeFolder structs
    let mut folder_map: std::collections::BTreeMap<String, (String, Vec<KnowledgeFileEntry>)> =
        std::collections::BTreeMap::new();

    for f in &discovered {
        let entry = folder_map
            .entry(f.folder.clone())
            .or_insert_with(|| (f.folder_display.clone(), Vec::new()));
        entry.1.push(KnowledgeFileEntry {
            relative_path: f.relative_path.clone(),
            display_name: f.display_name.clone(),
            folder: f.folder.clone(),
            size_bytes: f.size_bytes,
        });
    }

    let total_files = discovered.len();

    // Build sorted folder list preserving discovery order priority
    let priority_order = |name: &str| -> u8 {
        if name.starts_with(".planning/codebase") {
            0
        } else if name.starts_with(".planning") {
            1
        } else if name.starts_with(".planning") {
            2
        } else if name == "root" {
            3
        } else {
            4
        }
    };

    let mut folders: Vec<KnowledgeFolder> = folder_map
        .into_iter()
        .map(|(name, (display_name, files))| KnowledgeFolder {
            name,
            display_name,
            files,
        })
        .collect();

    folders.sort_by(|a, b| {
        let pa = priority_order(&a.name);
        let pb = priority_order(&b.name);
        if pa != pb {
            pa.cmp(&pb)
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(KnowledgeFileTree {
        folders,
        total_files,
    })
}

/// List all code/config files organized as a file tree
#[tauri::command]
pub async fn list_code_files(path: String) -> Result<KnowledgeFileTree, String> {
    let base_path = Path::new(&path);
    if !base_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let discovered = discover_code_files(base_path)?;

    let mut folder_map: std::collections::BTreeMap<String, (String, Vec<KnowledgeFileEntry>)> =
        std::collections::BTreeMap::new();

    for f in &discovered {
        let entry = folder_map
            .entry(f.folder.clone())
            .or_insert_with(|| (f.folder_display.clone(), Vec::new()));
        entry.1.push(KnowledgeFileEntry {
            relative_path: f.relative_path.clone(),
            display_name: f.display_name.clone(),
            folder: f.folder.clone(),
            size_bytes: f.size_bytes,
        });
    }

    let total_files = discovered.len();

    let mut folders: Vec<KnowledgeFolder> = folder_map
        .into_iter()
        .map(|(name, (display_name, files))| KnowledgeFolder {
            name,
            display_name,
            files,
        })
        .collect();

    folders.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(KnowledgeFileTree {
        folders,
        total_files,
    })
}

/// Search knowledge files for text matches (KN-01)
/// Uses recursive markdown discovery to search across all project .md files
#[tauri::command]
pub async fn search_knowledge_files(
    path: String,
    query: String,
) -> Result<Vec<KnowledgeSearchMatch>, String> {
    let base_path = Path::new(&path);
    if !base_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let query_lower = query.to_lowercase();
    let mut matches: Vec<KnowledgeSearchMatch> = Vec::new();
    let max_results = 100;

    let discovered = discover_markdown_files(base_path)?;

    // Search each file
    for file in discovered {
        if matches.len() >= max_results {
            break;
        }

        let full_path = base_path.join(&file.relative_path);
        let content = match std::fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let lines: Vec<&str> = content.lines().collect();

        for (i, line) in lines.iter().enumerate() {
            if matches.len() >= max_results {
                break;
            }

            if line.to_lowercase().contains(&query_lower) {
                let context_before = if i > 0 {
                    lines[i - 1].to_string()
                } else {
                    String::new()
                };
                let context_after = if i + 1 < lines.len() {
                    lines[i + 1].to_string()
                } else {
                    String::new()
                };

                matches.push(KnowledgeSearchMatch {
                    file_path: file.relative_path.clone(),
                    display_name: file.display_name.clone(),
                    line_number: i + 1,
                    line_content: line.to_string(),
                    context_before,
                    context_after,
                });
            }
        }
    }

    Ok(matches)
}

/// Build a knowledge graph from markdown files by scanning links
/// Parses [text](path) and [[wikilinks]] from .md files
/// Uses recursive markdown discovery to find files across the entire project
#[tauri::command]
pub async fn build_knowledge_graph(project_path: String) -> Result<KnowledgeGraph, String> {
    let base_path = Path::new(&project_path);
    if !base_path.exists() {
        return Err(format!("Path does not exist: {}", project_path));
    }

    let discovered = discover_markdown_files(base_path)?;

    let mut nodes: Vec<KnowledgeGraphNode> = Vec::new();
    let mut edges: Vec<KnowledgeGraphEdge> = Vec::new();
    let mut file_to_node: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    // Create nodes for each file
    for file in &discovered {
        let node_id = format!("{:016x}", rand::random::<u64>());
        let label = file
            .relative_path
            .rsplit('/')
            .next()
            .unwrap_or(&file.relative_path)
            .trim_end_matches(".md")
            .replace('-', " ")
            .replace('_', " ");

        let node_type = if file.folder.starts_with(".planning/codebase") {
            "codebase"
        } else if file.folder.starts_with(".planning") {
            "planning"
        } else if file.folder.starts_with(".planning") {
            "planning"
        } else if file.folder == "root" {
            "root"
        } else {
            "docs"
        };

        file_to_node.insert(file.relative_path.clone(), node_id.clone());

        nodes.push(KnowledgeGraphNode {
            id: node_id,
            label,
            file_path: file.relative_path.clone(),
            node_type: node_type.to_string(),
        });
    }

    // Parse links from each file
    let link_re = regex::Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap();
    let wikilink_re = regex::Regex::new(r"\[\[([^\]]+)\]\]").unwrap();

    for file in &discovered {
        let absolute_path = base_path.join(&file.relative_path);
        let content = match std::fs::read_to_string(&absolute_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let source_node = match file_to_node.get(&file.relative_path) {
            Some(id) => id.clone(),
            None => continue,
        };

        // Parse markdown links
        for caps in link_re.captures_iter(&content) {
            if let (Some(label), Some(target_path)) = (caps.get(1), caps.get(2)) {
                let target = target_path.as_str();
                // Only process relative .md links
                if target.ends_with(".md") && !target.starts_with("http") {
                    // Resolve relative path
                    let source_dir = file
                        .relative_path
                        .rsplit_once('/')
                        .map(|(d, _)| d)
                        .unwrap_or("");
                    let resolved = if target.starts_with("../") || target.starts_with("./") {
                        let base = Path::new(source_dir);
                        let joined = base.join(target);
                        joined.to_string_lossy().to_string()
                    } else {
                        format!("{}/{}", source_dir, target).replace("//", "/")
                    };

                    if let Some(target_node) = file_to_node.get(&resolved) {
                        edges.push(KnowledgeGraphEdge {
                            source: source_node.clone(),
                            target: target_node.clone(),
                            label: Some(label.as_str().to_string()),
                        });
                    }
                }
            }
        }

        // Parse wikilinks
        for caps in wikilink_re.captures_iter(&content) {
            if let Some(target_name) = caps.get(1) {
                let target_str = target_name.as_str();
                let target_file = format!("{}.md", target_str.to_lowercase().replace(' ', "-"));
                for (path, node_id) in &file_to_node {
                    if path.ends_with(&target_file) && *node_id != source_node {
                        edges.push(KnowledgeGraphEdge {
                            source: source_node.clone(),
                            target: node_id.clone(),
                            label: Some(target_str.to_string()),
                        });
                        break;
                    }
                }
            }
        }
    }

    Ok(KnowledgeGraph { nodes, edges })
}

/// Index all markdown files in a project into the knowledge database
/// Reads file content and bulk-inserts as knowledge entries with source "scan://..."
/// Emits progress events for frontend tracking
#[tauri::command]
pub async fn index_project_markdown(
    app: tauri::AppHandle,
    db: tauri::State<'_, DbState>,
    project_id: String,
    project_path: String,
) -> Result<i32, String> {
    let base_path = Path::new(&project_path);
    if !base_path.exists() {
        return Err(format!("Path does not exist: {}", project_path));
    }

    let discovered = discover_markdown_files(base_path)?;
    let total = discovered.len();

    if total == 0 {
        return Ok(0);
    }

    // Delete previous scan entries so re-import doesn't create duplicates
    {
        let db_guard = db.write().await;
        let conn = db_guard.conn();
        conn.execute(
            "DELETE FROM knowledge WHERE project_id = ?1 AND source LIKE 'scan://%'",
            params![project_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut indexed = 0;
    let mut batch: Vec<KnowledgeInput> = Vec::new();
    let batch_size = 50;

    for (i, file) in discovered.iter().enumerate() {
        // Skip files over MAX_FILE_SIZE (likely auto-generated)
        if file.size_bytes > MAX_FILE_SIZE {
            continue;
        }

        let full_path = base_path.join(&file.relative_path);
        let content = match std::fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(_) => continue, // Skip non-UTF8 gracefully
        };

        if content.trim().is_empty() {
            continue;
        }

        let metadata = serde_json::json!({
            "size_bytes": file.size_bytes,
            "indexed_from": "import_scan",
            "folder": file.folder,
        });

        batch.push(KnowledgeInput {
            title: file.display_name.clone(),
            content,
            category: Some("reference".to_string()),
            source: Some(format!("scan://{}", file.relative_path)),
            metadata: Some(metadata),
        });

        // Emit progress every 10 files
        if (i + 1) % 10 == 0 || i + 1 == total {
            let _ = app.emit(
                "knowledge:index-progress",
                MarkdownIndexProgress {
                    project_id: project_id.clone(),
                    indexed: indexed + batch.len(),
                    total,
                    current_file: file.relative_path.clone(),
                },
            );
        }

        // Flush batch when full
        if batch.len() >= batch_size {
            let count = flush_knowledge_batch(&db, &project_id, &mut batch).await?;
            indexed += count;
        }
    }

    // Flush remaining
    if !batch.is_empty() {
        let count = flush_knowledge_batch(&db, &project_id, &mut batch).await?;
        indexed += count;
    }

    // Final progress event
    let _ = app.emit(
        "knowledge:index-progress",
        MarkdownIndexProgress {
            project_id: project_id.clone(),
            indexed,
            total,
            current_file: String::new(),
        },
    );

    Ok(indexed as i32)
}

/// Helper to flush a batch of KnowledgeInput entries into the DB
async fn flush_knowledge_batch(
    db: &tauri::State<'_, DbState>,
    project_id: &str,
    batch: &mut Vec<KnowledgeInput>,
) -> Result<usize, String> {
    let db_guard = db.write().await;
    let conn = db_guard.conn();
    let mut count = 0;

    for input in batch.drain(..) {
        let knowledge_id = format!("{:032x}", rand::random::<u128>());
        let category = input.category.unwrap_or_else(|| "reference".to_string());
        let metadata_str = input
            .metadata
            .as_ref()
            .map(|m| serde_json::to_string(m).unwrap_or_default());

        let result = conn.execute(
            "INSERT INTO knowledge (id, project_id, title, content, category, source, metadata)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                knowledge_id,
                project_id,
                input.title,
                input.content,
                category,
                input.source,
                metadata_str,
            ],
        );

        if result.is_ok() {
            count += 1;
        }
    }

    Ok(count)
}

/// Write a project file (KN-03 prep - backend only, no UI yet)
#[tauri::command]
pub async fn write_project_file(
    path: String,
    filename: String,
    content: String,
) -> Result<(), String> {
    // Validate filename for allowed paths
    let allowed_prefixes = [".planning/"];
    let is_root_md = !filename.contains('/') && filename.ends_with(".md");
    let is_allowed_dir = allowed_prefixes.iter().any(|p| filename.starts_with(p));

    if !is_root_md && !is_allowed_dir {
        return Err(
            "Only .planning/ directories and root .md files are allowed".to_string(),
        );
    }

    let file_path = safe_join(&path, &filename)?;

    // Create parent directories if needed
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// Delete a project markdown file
#[tauri::command]
pub async fn delete_project_file(path: String, filename: String) -> Result<bool, String> {
    if !filename.ends_with(".md") {
        return Err("Only .md files can be deleted".to_string());
    }

    let file_path = safe_join(&path, &filename)?;

    if !file_path.exists() {
        return Ok(false);
    }

    if file_path.is_dir() {
        return Err("Path is a directory".to_string());
    }

    std::fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    Ok(true)
}
