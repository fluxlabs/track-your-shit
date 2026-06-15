// VCCA - Project Template Registry and Scaffold Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use crate::models::{GsdPlanningTemplate, ProjectTemplate, ScaffoldOptions, ScaffoldResult};
use std::fs;
use std::path::Path;
use std::process::Command;

// ============================================================
// Template File Content (embedded at compile time)
// ============================================================

// react-vite-ts
const REACT_VITE_TS_PACKAGE_JSON: &str = include_str!("../templates/react-vite-ts/package.json");
const REACT_VITE_TS_TSCONFIG: &str = include_str!("../templates/react-vite-ts/tsconfig.json");
const REACT_VITE_TS_VITE_CONFIG: &str = include_str!("../templates/react-vite-ts/vite.config.ts");
const REACT_VITE_TS_INDEX_HTML: &str = include_str!("../templates/react-vite-ts/index.html");
const REACT_VITE_TS_MAIN_TSX: &str = include_str!("../templates/react-vite-ts/src/main.tsx");
const REACT_VITE_TS_APP_TSX: &str = include_str!("../templates/react-vite-ts/src/App.tsx");
const REACT_VITE_TS_INDEX_CSS: &str = include_str!("../templates/react-vite-ts/src/index.css");
const REACT_VITE_TS_GITIGNORE: &str = include_str!("../templates/react-vite-ts/.gitignore");
const REACT_VITE_TS_README: &str = include_str!("../templates/react-vite-ts/README.md");

// nextjs
const NEXTJS_PACKAGE_JSON: &str = include_str!("../templates/nextjs/package.json");
const NEXTJS_TSCONFIG: &str = include_str!("../templates/nextjs/tsconfig.json");
const NEXTJS_CONFIG: &str = include_str!("../templates/nextjs/next.config.js");
const NEXTJS_LAYOUT: &str = include_str!("../templates/nextjs/src/app/layout.tsx");
const NEXTJS_PAGE: &str = include_str!("../templates/nextjs/src/app/page.tsx");
const NEXTJS_GITIGNORE: &str = include_str!("../templates/nextjs/.gitignore");
const NEXTJS_README: &str = include_str!("../templates/nextjs/README.md");

// svelte
const SVELTE_PACKAGE_JSON: &str = include_str!("../templates/svelte/package.json");
const SVELTE_PAGE: &str = include_str!("../templates/svelte/src/routes/+page.svelte");
const SVELTE_GITIGNORE: &str = include_str!("../templates/svelte/.gitignore");
const SVELTE_README: &str = include_str!("../templates/svelte/README.md");

// express-api
const EXPRESS_PACKAGE_JSON: &str = include_str!("../templates/express-api/package.json");
const EXPRESS_TSCONFIG: &str = include_str!("../templates/express-api/tsconfig.json");
const EXPRESS_INDEX_TS: &str = include_str!("../templates/express-api/src/index.ts");
const EXPRESS_GITIGNORE: &str = include_str!("../templates/express-api/.gitignore");
const EXPRESS_README: &str = include_str!("../templates/express-api/README.md");

// rust-cli
const RUST_CLI_CARGO_TOML: &str = include_str!("../templates/rust-cli/Cargo.toml");
const RUST_CLI_MAIN_RS: &str = include_str!("../templates/rust-cli/src/main.rs");
const RUST_CLI_GITIGNORE: &str = include_str!("../templates/rust-cli/.gitignore");
const RUST_CLI_README: &str = include_str!("../templates/rust-cli/README.md");

// rust-axum
const RUST_AXUM_CARGO_TOML: &str = include_str!("../templates/rust-axum/Cargo.toml");
const RUST_AXUM_MAIN_RS: &str = include_str!("../templates/rust-axum/src/main.rs");
const RUST_AXUM_GITIGNORE: &str = include_str!("../templates/rust-axum/.gitignore");
const RUST_AXUM_README: &str = include_str!("../templates/rust-axum/README.md");

// python-fastapi
const PYTHON_FASTAPI_PYPROJECT: &str = include_str!("../templates/python-fastapi/pyproject.toml");
const PYTHON_FASTAPI_MAIN_PY: &str = include_str!("../templates/python-fastapi/src/main.py");
const PYTHON_FASTAPI_RUN_PY: &str = include_str!("../templates/python-fastapi/run.py");
const PYTHON_FASTAPI_GITIGNORE: &str = include_str!("../templates/python-fastapi/.gitignore");
const PYTHON_FASTAPI_README: &str = include_str!("../templates/python-fastapi/README.md");

// python-cli
const PYTHON_CLI_PYPROJECT: &str = include_str!("../templates/python-cli/pyproject.toml");
const PYTHON_CLI_CLI_PY: &str = include_str!("../templates/python-cli/src/cli.py");
const PYTHON_CLI_GITIGNORE: &str = include_str!("../templates/python-cli/.gitignore");
const PYTHON_CLI_README: &str = include_str!("../templates/python-cli/README.md");

// go
const GO_MOD: &str = include_str!("../templates/go/go.mod");
const GO_MAIN: &str = include_str!("../templates/go/main.go");
const GO_GITIGNORE: &str = include_str!("../templates/go/.gitignore");
const GO_README: &str = include_str!("../templates/go/README.md");

// tauri-app
const TAURI_APP_PACKAGE_JSON: &str = include_str!("../templates/tauri-app/package.json");
const TAURI_APP_SRC_APP_TSX: &str = include_str!("../templates/tauri-app/src/App.tsx");
const TAURI_APP_GITIGNORE: &str = include_str!("../templates/tauri-app/.gitignore");
const TAURI_APP_README: &str = include_str!("../templates/tauri-app/README.md");
const TAURI_APP_CARGO_TOML: &str = include_str!("../templates/tauri-app/src-tauri/Cargo.toml");
const TAURI_APP_MAIN_RS: &str = include_str!("../templates/tauri-app/src-tauri/src/main.rs");
const TAURI_APP_LIB_RS: &str = include_str!("../templates/tauri-app/src-tauri/src/lib.rs");

// blank
const BLANK_README: &str = include_str!("../templates/blank/README.md");
const BLANK_GITIGNORE: &str = include_str!("../templates/blank/.gitignore");

// GSD planning templates
const GSD_PLANNING_WEB_APP: &str = include_str!("../templates/gsd-planning/web-app.md");
const GSD_PLANNING_CLI_TOOL: &str = include_str!("../templates/gsd-planning/cli-tool.md");
const GSD_PLANNING_API: &str = include_str!("../templates/gsd-planning/api.md");
const GSD_PLANNING_LIBRARY: &str = include_str!("../templates/gsd-planning/library.md");

// ============================================================
// Template Registry
// ============================================================

/// Returns the catalog of all bundled project templates.
#[tauri::command]
pub fn list_project_templates() -> Vec<ProjectTemplate> {
    vec![
        ProjectTemplate {
            id: "react-vite-ts".into(),
            name: "React + Vite + TypeScript".into(),
            description: "Modern React app with Vite bundler and TypeScript. Fast HMR, minimal setup.".into(),
            language: "TypeScript".into(),
            category: "web".into(),
            archetype: "web-app".into(),
            tags: vec!["react".into(), "vite".into(), "typescript".into(), "frontend".into()],
        },
        ProjectTemplate {
            id: "nextjs".into(),
            name: "Next.js".into(),
            description: "Full-stack React framework with SSR, routing, and API routes.".into(),
            language: "TypeScript".into(),
            category: "web".into(),
            archetype: "web-app".into(),
            tags: vec!["next".into(), "react".into(), "typescript".into(), "fullstack".into()],
        },
        ProjectTemplate {
            id: "svelte".into(),
            name: "SvelteKit".into(),
            description: "Fast, compiler-first web framework. Zero-overhead reactivity.".into(),
            language: "TypeScript".into(),
            category: "web".into(),
            archetype: "web-app".into(),
            tags: vec!["svelte".into(), "sveltekit".into(), "typescript".into()],
        },
        ProjectTemplate {
            id: "express-api".into(),
            name: "Express REST API".into(),
            description: "Node.js REST API with Express, TypeScript, CORS, and Helmet security.".into(),
            language: "TypeScript".into(),
            category: "api".into(),
            archetype: "api".into(),
            tags: vec!["express".into(), "nodejs".into(), "typescript".into(), "rest".into()],
        },
        ProjectTemplate {
            id: "rust-cli".into(),
            name: "Rust CLI".into(),
            description: "Command-line tool built with Rust and Clap. Fast, reliable, ships as a single binary.".into(),
            language: "Rust".into(),
            category: "cli".into(),
            archetype: "cli-tool".into(),
            tags: vec!["rust".into(), "clap".into(), "cli".into()],
        },
        ProjectTemplate {
            id: "rust-axum".into(),
            name: "Rust Axum API".into(),
            description: "High-performance async web API with Axum, Tokio, and Tracing.".into(),
            language: "Rust".into(),
            category: "api".into(),
            archetype: "api".into(),
            tags: vec!["rust".into(), "axum".into(), "tokio".into(), "rest".into()],
        },
        ProjectTemplate {
            id: "python-fastapi".into(),
            name: "Python FastAPI".into(),
            description: "Modern async Python API with FastAPI, Pydantic validation, and auto-docs.".into(),
            language: "Python".into(),
            category: "api".into(),
            archetype: "api".into(),
            tags: vec!["python".into(), "fastapi".into(), "pydantic".into(), "rest".into()],
        },
        ProjectTemplate {
            id: "python-cli".into(),
            name: "Python CLI".into(),
            description: "Python CLI tool with Click and Rich for beautiful terminal output.".into(),
            language: "Python".into(),
            category: "cli".into(),
            archetype: "cli-tool".into(),
            tags: vec!["python".into(), "click".into(), "cli".into(), "rich".into()],
        },
        ProjectTemplate {
            id: "go".into(),
            name: "Go Web API".into(),
            description: "Fast Go web API with Gin framework. Simple, statically compiled.".into(),
            language: "Go".into(),
            category: "api".into(),
            archetype: "api".into(),
            tags: vec!["go".into(), "gin".into(), "rest".into()],
        },
        ProjectTemplate {
            id: "tauri-app".into(),
            name: "Tauri Desktop App".into(),
            description: "Cross-platform desktop app with Tauri 2, React, and TypeScript.".into(),
            language: "Rust + TypeScript".into(),
            category: "desktop".into(),
            archetype: "web-app".into(),
            tags: vec!["tauri".into(), "react".into(), "rust".into(), "desktop".into()],
        },
        ProjectTemplate {
            id: "blank".into(),
            name: "Blank Project".into(),
            description: "Empty project with just a README and .gitignore. Start from scratch.".into(),
            language: "Any".into(),
            category: "other".into(),
            archetype: "library".into(),
            tags: vec!["blank".into(), "empty".into()],
        },
    ]
}

/// Returns the catalog of GSD planning archetypes.
#[tauri::command]
pub fn list_gsd_planning_templates() -> Vec<GsdPlanningTemplate> {
    vec![
        GsdPlanningTemplate {
            id: "web-app".into(),
            name: "Web Application".into(),
            description: "User auth, CRUD operations, responsive UI. Suited for web apps and SPAs."
                .into(),
            archetype: "web-app".into(),
        },
        GsdPlanningTemplate {
            id: "cli-tool".into(),
            name: "CLI Tool".into(),
            description: "Commands, flags, config files, exit codes. Suited for developer tooling."
                .into(),
            archetype: "cli-tool".into(),
        },
        GsdPlanningTemplate {
            id: "api".into(),
            name: "API / Backend".into(),
            description: "REST endpoints, auth, validation, docs. Suited for backend services."
                .into(),
            archetype: "api".into(),
        },
        GsdPlanningTemplate {
            id: "library".into(),
            name: "Library / Package".into(),
            description: "Public API, tests, docs, versioning. Suited for reusable packages."
                .into(),
            archetype: "library".into(),
        },
    ]
}

// ============================================================
// Scaffold Logic
// ============================================================

fn apply_substitution(content: &str, project_name: &str) -> String {
    // Replace {{project_name}} and also handle Cargo.toml package names
    // (Cargo requires hyphens instead of underscores in package names, but
    // binary names use hyphens too — keep consistent with what the user typed)
    content.replace("{{project_name}}", project_name)
}

fn write_file(
    base: &Path,
    rel_path: &str,
    content: &str,
    project_name: &str,
    files_created: &mut Vec<String>,
) -> Result<(), String> {
    let target = base.join(rel_path);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {e}", parent.display()))?;
    }
    let rendered = apply_substitution(content, project_name);
    fs::write(&target, rendered)
        .map_err(|e| format!("Failed to write {}: {e}", target.display()))?;
    files_created.push(rel_path.to_string());
    Ok(())
}

fn scaffold_template(
    template_id: &str,
    base: &Path,
    project_name: &str,
) -> Result<Vec<String>, String> {
    let mut files = Vec::new();

    match template_id {
        "react-vite-ts" => {
            write_file(
                base,
                "package.json",
                REACT_VITE_TS_PACKAGE_JSON,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "tsconfig.json",
                REACT_VITE_TS_TSCONFIG,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "vite.config.ts",
                REACT_VITE_TS_VITE_CONFIG,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "index.html",
                REACT_VITE_TS_INDEX_HTML,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                REACT_VITE_TS_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "README.md",
                REACT_VITE_TS_README,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/main.tsx",
                REACT_VITE_TS_MAIN_TSX,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/App.tsx",
                REACT_VITE_TS_APP_TSX,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/index.css",
                REACT_VITE_TS_INDEX_CSS,
                project_name,
                &mut files,
            )?;
        }
        "nextjs" => {
            write_file(
                base,
                "package.json",
                NEXTJS_PACKAGE_JSON,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "tsconfig.json",
                NEXTJS_TSCONFIG,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "next.config.js",
                NEXTJS_CONFIG,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                NEXTJS_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(base, "README.md", NEXTJS_README, project_name, &mut files)?;
            write_file(
                base,
                "src/app/layout.tsx",
                NEXTJS_LAYOUT,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/app/page.tsx",
                NEXTJS_PAGE,
                project_name,
                &mut files,
            )?;
        }
        "svelte" => {
            write_file(
                base,
                "package.json",
                SVELTE_PACKAGE_JSON,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                SVELTE_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(base, "README.md", SVELTE_README, project_name, &mut files)?;
            write_file(
                base,
                "src/routes/+page.svelte",
                SVELTE_PAGE,
                project_name,
                &mut files,
            )?;
        }
        "express-api" => {
            write_file(
                base,
                "package.json",
                EXPRESS_PACKAGE_JSON,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "tsconfig.json",
                EXPRESS_TSCONFIG,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                EXPRESS_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(base, "README.md", EXPRESS_README, project_name, &mut files)?;
            write_file(
                base,
                "src/index.ts",
                EXPRESS_INDEX_TS,
                project_name,
                &mut files,
            )?;
        }
        "rust-cli" => {
            write_file(
                base,
                "Cargo.toml",
                RUST_CLI_CARGO_TOML,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                RUST_CLI_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(base, "README.md", RUST_CLI_README, project_name, &mut files)?;
            write_file(
                base,
                "src/main.rs",
                RUST_CLI_MAIN_RS,
                project_name,
                &mut files,
            )?;
        }
        "rust-axum" => {
            write_file(
                base,
                "Cargo.toml",
                RUST_AXUM_CARGO_TOML,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                RUST_AXUM_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "README.md",
                RUST_AXUM_README,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/main.rs",
                RUST_AXUM_MAIN_RS,
                project_name,
                &mut files,
            )?;
        }
        "python-fastapi" => {
            write_file(
                base,
                "pyproject.toml",
                PYTHON_FASTAPI_PYPROJECT,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "run.py",
                PYTHON_FASTAPI_RUN_PY,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                PYTHON_FASTAPI_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "README.md",
                PYTHON_FASTAPI_README,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/main.py",
                PYTHON_FASTAPI_MAIN_PY,
                project_name,
                &mut files,
            )?;
        }
        "python-cli" => {
            write_file(
                base,
                "pyproject.toml",
                PYTHON_CLI_PYPROJECT,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                PYTHON_CLI_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "README.md",
                PYTHON_CLI_README,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/cli.py",
                PYTHON_CLI_CLI_PY,
                project_name,
                &mut files,
            )?;
        }
        "go" => {
            write_file(base, "go.mod", GO_MOD, project_name, &mut files)?;
            write_file(base, "main.go", GO_MAIN, project_name, &mut files)?;
            write_file(base, ".gitignore", GO_GITIGNORE, project_name, &mut files)?;
            write_file(base, "README.md", GO_README, project_name, &mut files)?;
        }
        "tauri-app" => {
            write_file(
                base,
                "package.json",
                TAURI_APP_PACKAGE_JSON,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                ".gitignore",
                TAURI_APP_GITIGNORE,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "README.md",
                TAURI_APP_README,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src/App.tsx",
                TAURI_APP_SRC_APP_TSX,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src-tauri/Cargo.toml",
                TAURI_APP_CARGO_TOML,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src-tauri/src/main.rs",
                TAURI_APP_MAIN_RS,
                project_name,
                &mut files,
            )?;
            write_file(
                base,
                "src-tauri/src/lib.rs",
                TAURI_APP_LIB_RS,
                project_name,
                &mut files,
            )?;
        }
        "blank" | _ => {
            write_file(base, "README.md", BLANK_README, project_name, &mut files)?;
            write_file(
                base,
                ".gitignore",
                BLANK_GITIGNORE,
                project_name,
                &mut files,
            )?;
        }
    }

    Ok(files)
}

fn seed_gsd_planning(base: &Path, archetype: &str, project_name: &str) -> Result<(), String> {
    let gsd_dir = base.join(".gsd");
    fs::create_dir_all(&gsd_dir).map_err(|e| format!("Failed to create .gsd directory: {e}"))?;

    let content = match archetype {
        "web-app" => GSD_PLANNING_WEB_APP,
        "cli-tool" => GSD_PLANNING_CLI_TOOL,
        "api" => GSD_PLANNING_API,
        "library" => GSD_PLANNING_LIBRARY,
        _ => return Ok(()),
    };

    let rendered = apply_substitution(content, project_name);
    let roadmap_path = gsd_dir.join("ROADMAP.md");
    fs::write(&roadmap_path, rendered)
        .map_err(|e| format!("Failed to write GSD ROADMAP.md: {e}"))?;

    Ok(())
}

fn run_git_init(base: &Path) -> bool {
    let result = Command::new("git").arg("init").current_dir(base).output();

    match result {
        Ok(output) if output.status.success() => {
            // Also do an initial commit if git init succeeded
            let _ = Command::new("git")
                .args(["add", "-A"])
                .current_dir(base)
                .output();
            let _ = Command::new("git")
                .args(["commit", "-m", "chore: initial scaffold"])
                .env("GIT_AUTHOR_NAME", "VCCA")
                .env("GIT_AUTHOR_EMAIL", "vibeflow@local")
                .env("GIT_COMMITTER_NAME", "VCCA")
                .env("GIT_COMMITTER_EMAIL", "vibeflow@local")
                .current_dir(base)
                .output();
            true
        }
        _ => false,
    }
}

/// Scaffold a new project from a template.
///
/// Creates the project directory, writes all template files with
/// `{{project_name}}` substitution, optionally seeds a `.gsd/` planning
/// structure, and optionally runs `git init` + initial commit.
#[tauri::command]
pub fn scaffold_project(options: ScaffoldOptions) -> Result<ScaffoldResult, String> {
    let project_name = options.project_name.trim().to_string();
    if project_name.is_empty() {
        return Err("project_name cannot be empty".into());
    }

    let parent = Path::new(&options.parent_directory);
    if !parent.exists() {
        return Err(format!(
            "Parent directory does not exist: {}",
            parent.display()
        ));
    }

    let project_path = parent.join(&project_name);
    if project_path.exists() {
        return Err(format!(
            "Directory already exists: {}",
            project_path.display()
        ));
    }

    fs::create_dir_all(&project_path)
        .map_err(|e| format!("Failed to create project directory: {e}"))?;

    // Scaffold template files
    let files_created = scaffold_template(&options.template_id, &project_path, &project_name)?;

    // Optionally seed GSD planning
    let gsd_seeded = if let Some(ref archetype) = options.gsd_planning_template {
        if !archetype.is_empty() {
            seed_gsd_planning(&project_path, archetype, &project_name)?;
            true
        } else {
            false
        }
    } else {
        false
    };

    // Optionally run git init
    let git_initialized = if options.git_init {
        run_git_init(&project_path)
    } else {
        false
    };

    tracing::info!(
        template = options.template_id,
        project = project_name,
        path = %project_path.display(),
        files = files_created.len(),
        gsd_seeded,
        git_initialized,
        "project scaffolded"
    );

    Ok(ScaffoldResult {
        project_path: project_path.to_string_lossy().to_string(),
        project_name,
        template_id: options.template_id,
        files_created,
        gsd_seeded,
        git_initialized,
    })
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    /// Create a unique temp directory for a test, cleaned up when the test ends.
    /// Uses uuid to avoid collisions between parallel test runs.
    fn make_test_dir(label: &str) -> std::path::PathBuf {
        let base = std::env::temp_dir().join("vibeflow_template_tests");
        let unique = format!("{label}_{}", uuid::Uuid::new_v4());
        let dir = base.join(unique);
        fs::create_dir_all(&dir).expect("failed to create test temp dir");
        dir
    }

    #[test]
    fn test_list_project_templates_returns_11() {
        let templates = list_project_templates();
        assert_eq!(templates.len(), 11, "expected 11 bundled templates");
    }

    #[test]
    fn test_template_ids_are_unique() {
        let templates = list_project_templates();
        let mut ids: Vec<&str> = templates.iter().map(|t| t.id.as_str()).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), templates.len(), "template IDs must be unique");
    }

    #[test]
    fn test_list_gsd_planning_templates_returns_4() {
        let templates = list_gsd_planning_templates();
        assert_eq!(templates.len(), 4, "expected 4 GSD planning archetypes");
    }

    #[test]
    fn test_scaffold_react_vite_ts() {
        let dir = make_test_dir("react_vite_ts");
        let result = scaffold_project(ScaffoldOptions {
            template_id: "react-vite-ts".into(),
            project_name: "my-app".into(),
            parent_directory: dir.to_string_lossy().into(),
            gsd_planning_template: None,
            git_init: false,
        });
        assert!(result.is_ok(), "scaffold failed: {:?}", result.err());
        let r = result.unwrap();
        assert_eq!(r.project_name, "my-app");
        let project_path = std::path::Path::new(&r.project_path);
        assert!(project_path.join("package.json").exists());
        assert!(project_path.join("tsconfig.json").exists());
        assert!(project_path.join("src/App.tsx").exists());
        // Verify substitution happened
        let pkg = fs::read_to_string(project_path.join("package.json")).unwrap();
        assert!(
            pkg.contains("my-app"),
            "package.json should contain project name"
        );
        assert!(
            !pkg.contains("{{project_name}}"),
            "placeholder should be replaced"
        );
    }

    #[test]
    fn test_scaffold_rust_cli() {
        let dir = make_test_dir("rust_cli");
        let result = scaffold_project(ScaffoldOptions {
            template_id: "rust-cli".into(),
            project_name: "my-cli".into(),
            parent_directory: dir.to_string_lossy().into(),
            gsd_planning_template: None,
            git_init: false,
        });
        assert!(result.is_ok(), "scaffold failed: {:?}", result.err());
        let r = result.unwrap();
        let project_path = std::path::Path::new(&r.project_path);
        assert!(project_path.join("Cargo.toml").exists());
        assert!(project_path.join("src/main.rs").exists());
        let cargo_toml = fs::read_to_string(project_path.join("Cargo.toml")).unwrap();
        assert!(cargo_toml.contains("my-cli"));
    }

    #[test]
    fn test_scaffold_blank() {
        let dir = make_test_dir("blank");
        let result = scaffold_project(ScaffoldOptions {
            template_id: "blank".into(),
            project_name: "my-project".into(),
            parent_directory: dir.to_string_lossy().into(),
            gsd_planning_template: None,
            git_init: false,
        });
        assert!(result.is_ok(), "scaffold failed: {:?}", result.err());
        let r = result.unwrap();
        let project_path = std::path::Path::new(&r.project_path);
        assert!(project_path.join("README.md").exists());
    }

    #[test]
    fn test_scaffold_with_gsd_planning() {
        let dir = make_test_dir("express_gsd");
        let result = scaffold_project(ScaffoldOptions {
            template_id: "express-api".into(),
            project_name: "my-api".into(),
            parent_directory: dir.to_string_lossy().into(),
            gsd_planning_template: Some("api".into()),
            git_init: false,
        });
        assert!(result.is_ok(), "scaffold failed: {:?}", result.err());
        let r = result.unwrap();
        assert!(r.gsd_seeded, "GSD should have been seeded");
        let project_path = std::path::Path::new(&r.project_path);
        let roadmap = project_path.join(".gsd/ROADMAP.md");
        assert!(roadmap.exists(), ".gsd/ROADMAP.md should exist");
        let content = fs::read_to_string(roadmap).unwrap();
        assert!(
            content.contains("my-api"),
            "ROADMAP.md should contain project name"
        );
    }

    #[test]
    fn test_scaffold_rejects_existing_directory() {
        let dir = make_test_dir("reject_existing");
        let project_path = dir.join("existing");
        fs::create_dir_all(&project_path).unwrap();
        let result = scaffold_project(ScaffoldOptions {
            template_id: "blank".into(),
            project_name: "existing".into(),
            parent_directory: dir.to_string_lossy().into(),
            gsd_planning_template: None,
            git_init: false,
        });
        assert!(result.is_err(), "should reject existing directory");
        assert!(result.unwrap_err().contains("already exists"));
    }

    #[test]
    fn test_scaffold_rejects_empty_name() {
        let dir = make_test_dir("reject_empty");
        let result = scaffold_project(ScaffoldOptions {
            template_id: "blank".into(),
            project_name: "  ".into(),
            parent_directory: dir.to_string_lossy().into(),
            gsd_planning_template: None,
            git_init: false,
        });
        assert!(result.is_err(), "should reject empty name");
    }

    #[test]
    fn test_apply_substitution() {
        let input = "name = \"{{project_name}}\"\nbin = \"{{project_name}}\"";
        let output = apply_substitution(input, "my-tool");
        assert_eq!(output, "name = \"my-tool\"\nbin = \"my-tool\"");
    }
}
