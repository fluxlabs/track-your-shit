// Track Your Shit - Security Utilities
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use std::path::{Component, Path, PathBuf};

/// Escape a path for safe embedding in single-quoted shell strings.
/// Replaces `'` with `'\''` (end quote, escaped quote, start quote).
pub fn shell_escape_path(path: &str) -> String {
    path.replace('\'', "'\\''")
}

/// Safely join a base directory with a relative filename.
/// Rejects filenames with `..` components, absolute paths, and paths
/// that resolve outside the base directory.
pub fn safe_join(base: &str, filename: &str) -> Result<PathBuf, String> {
    let rel = Path::new(filename);

    // Reject absolute paths
    if rel.is_absolute() {
        return Err("Filename must be relative".to_string());
    }

    // Reject any component that is `..`
    for component in rel.components() {
        if matches!(component, Component::ParentDir) {
            return Err("Path traversal ('..') is not allowed".to_string());
        }
    }

    let base_path = Path::new(base);
    let joined = base_path.join(rel);

    // Canonicalize base (must exist) and verify joined path stays within it.
    // We canonicalize what exists of the joined path by checking its parent.
    let canonical_base = base_path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve base path: {}", e))?;

    // The file itself may not exist yet, so canonicalize the parent directory
    if let Some(parent) = joined.parent() {
        if parent.exists() {
            let canonical_parent = parent
                .canonicalize()
                .map_err(|e| format!("Cannot resolve parent path: {}", e))?;
            if !canonical_parent.starts_with(&canonical_base) {
                return Err("Resolved path escapes base directory".to_string());
            }
        }
    }

    Ok(joined)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shell_escape_no_special_chars() {
        assert_eq!(shell_escape_path("/tmp/my project"), "/tmp/my project");
    }

    #[test]
    fn shell_escape_single_quotes() {
        assert_eq!(
            shell_escape_path("/tmp/it's a test"),
            "/tmp/it'\\''s a test"
        );
    }

    #[test]
    fn shell_escape_multiple_quotes() {
        assert_eq!(shell_escape_path("a'b'c"), "a'\\''b'\\''c");
    }

    #[test]
    fn safe_join_normal_filename() {
        let base = env!("CARGO_MANIFEST_DIR");
        let result = safe_join(base, "Cargo.toml");
        assert!(result.is_ok());
    }

    #[test]
    fn safe_join_nested_path() {
        let base = env!("CARGO_MANIFEST_DIR");
        let result = safe_join(base, "src/lib.rs");
        assert!(result.is_ok());
    }

    #[test]
    fn safe_join_rejects_dotdot() {
        let base = env!("CARGO_MANIFEST_DIR");
        let result = safe_join(base, "../../.env");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path traversal"));
    }

    #[test]
    fn safe_join_rejects_mid_dotdot() {
        let base = env!("CARGO_MANIFEST_DIR");
        let result = safe_join(base, "src/../../.env");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Path traversal"));
    }

    #[test]
    fn safe_join_rejects_absolute() {
        let base = env!("CARGO_MANIFEST_DIR");
        let result = safe_join(base, "/etc/passwd");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("relative"));
    }
}
