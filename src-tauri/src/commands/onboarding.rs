// VCCA - First-Launch Onboarding Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::process::Command;
use tokio::time::{timeout, Duration};

const ONBOARDING_COMPLETED_KEY: &str = "onboarding_completed";
const ONBOARDING_COMPLETED_AT_KEY: &str = "onboarding_completed_at";
const USER_MODE_KEY: &str = "user_mode";

const PROVIDER_ANTHROPIC: &str = "anthropic";
const PROVIDER_OPENAI: &str = "openai";
const PROVIDER_GITHUB: &str = "github";
const PROVIDER_OPENROUTER: &str = "openrouter";

type DbState = Arc<crate::db::DbPool>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnboardingStatus {
    pub completed: bool,
    pub completed_at: Option<String>,
    pub user_mode: String,
    pub has_api_keys: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyDetectionResult {
    pub checked_at: String,
    pub dependencies: Vec<DependencyCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyCheck {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyValidationResult {
    pub provider: String,
    pub key_name: String,
    pub valid: bool,
    pub stored: bool,
    pub message: String,
}

#[tauri::command]
pub async fn onboarding_get_status(
    db: tauri::State<'_, DbState>,
) -> Result<OnboardingStatus, String> {
    let (completed, completed_at, user_mode) = {
        let db = db.write().await;
        let conn = db.conn();

        let mut completed = false;
        let mut completed_at: Option<String> = None;
        let mut user_mode = "expert".to_string();

        let mut stmt = conn
            .prepare("SELECT key, value FROM settings WHERE key IN (?1, ?2, ?3)")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(
                params![
                    ONBOARDING_COMPLETED_KEY,
                    ONBOARDING_COMPLETED_AT_KEY,
                    USER_MODE_KEY
                ],
                |row| {
                    let key: String = row.get(0)?;
                    let value: String = row.get(1)?;
                    Ok((key, value))
                },
            )
            .map_err(|e| e.to_string())?;

        for row in rows {
            let (key, value) = row.map_err(|e| e.to_string())?;
            match key.as_str() {
                ONBOARDING_COMPLETED_KEY => completed = value == "true",
                ONBOARDING_COMPLETED_AT_KEY => completed_at = Some(value),
                USER_MODE_KEY => user_mode = value,
                _ => {}
            }
        }

        (completed, completed_at, user_mode)
    };

    let stored_keys = super::secrets::list_secret_keys(String::new()).await?;
    let has_api_keys = stored_keys.iter().any(|k| {
        matches!(
            k.as_str(),
            "ANTHROPIC_API_KEY" | "OPENAI_API_KEY" | "GITHUB_TOKEN" | "OPENROUTER_API_KEY"
        )
    });

    Ok(OnboardingStatus {
        completed,
        completed_at,
        user_mode,
        has_api_keys,
    })
}

#[tauri::command]
pub async fn onboarding_detect_dependencies() -> Result<DependencyDetectionResult, String> {
    let (git, node, pnpm, npm, python3, cargo, rustc, tmux) = tokio::join!(
        detect_dependency("git", &["--version"]),
        detect_dependency("node", &["--version"]),
        detect_dependency("pnpm", &["--version"]),
        detect_dependency("npm", &["--version"]),
        detect_dependency("python3", &["--version"]),
        detect_dependency("cargo", &["--version"]),
        detect_dependency("rustc", &["--version"]),
        detect_dependency("tmux", &["-V"]),
    );

    let checked_at = chrono::Utc::now().to_rfc3339();

    Ok(DependencyDetectionResult {
        checked_at,
        dependencies: vec![git, node, pnpm, npm, python3, cargo, rustc, tmux],
    })
}

#[tauri::command]
pub async fn onboarding_validate_and_store_api_key(
    provider: String,
    api_key: String,
) -> Result<ApiKeyValidationResult, String> {
    if api_key.trim().is_empty() {
        return Ok(ApiKeyValidationResult {
            provider,
            key_name: String::new(),
            valid: false,
            stored: false,
            message: "API key cannot be empty".to_string(),
        });
    }

    let normalized_provider = provider.trim().to_lowercase();
    let key_name = provider_to_key_name(&normalized_provider)?.to_string();

    validate_api_key_shape(&normalized_provider, &api_key)?;

    // Do not log or return raw key content.
    let validation = validate_api_key_with_provider(&normalized_provider, &api_key).await;
    if let Err(err) = validation {
        tracing::warn!(
            provider = %normalized_provider,
            "Onboarding API key validation failed: {}",
            err
        );

        return Ok(ApiKeyValidationResult {
            provider: normalized_provider,
            key_name,
            valid: false,
            stored: false,
            message: err,
        });
    }

    super::secrets::set_secret(String::new(), key_name.clone(), api_key).await?;

    Ok(ApiKeyValidationResult {
        provider: normalized_provider,
        key_name,
        valid: true,
        stored: true,
        message: "API key validated and stored securely".to_string(),
    })
}

#[tauri::command]
pub async fn onboarding_mark_complete(
    db: tauri::State<'_, DbState>,
    user_mode: String,
) -> Result<OnboardingStatus, String> {
    let normalized_mode = match user_mode.trim() {
        "guided" => "guided",
        "expert" => "expert",
        _ => return Err("user_mode must be either 'guided' or 'expert'".to_string()),
    };

    let completed_at = chrono::Utc::now().to_rfc3339();

    {
        let db = db.write().await;
        let conn = db.conn();

        upsert_setting(conn, ONBOARDING_COMPLETED_KEY, "true")?;
        upsert_setting(conn, ONBOARDING_COMPLETED_AT_KEY, &completed_at)?;
        upsert_setting(conn, USER_MODE_KEY, normalized_mode)?;
    }

    onboarding_get_status(db).await
}

fn upsert_setting(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

async fn detect_dependency(binary: &str, version_args: &[&str]) -> DependencyCheck {
    let output = timeout(
        Duration::from_secs(4),
        Command::new(binary).args(version_args).output(),
    )
    .await;

    match output {
        Ok(Ok(result)) if result.status.success() => {
            let stdout = String::from_utf8_lossy(&result.stdout);
            let stderr = String::from_utf8_lossy(&result.stderr);
            let raw = if stdout.trim().is_empty() {
                stderr.trim().to_string()
            } else {
                stdout.trim().to_string()
            };
            let version = raw.lines().next().map(|line| line.to_string());

            DependencyCheck {
                name: binary.to_string(),
                installed: true,
                version,
                message: None,
            }
        }
        Ok(Ok(result)) => {
            let stderr = String::from_utf8_lossy(&result.stderr);
            DependencyCheck {
                name: binary.to_string(),
                installed: false,
                version: None,
                message: Some(if stderr.trim().is_empty() {
                    "Command returned non-zero exit status".to_string()
                } else {
                    stderr.trim().to_string()
                }),
            }
        }
        Ok(Err(err)) => DependencyCheck {
            name: binary.to_string(),
            installed: false,
            version: None,
            message: Some(err.to_string()),
        },
        Err(_) => DependencyCheck {
            name: binary.to_string(),
            installed: false,
            version: None,
            message: Some("Dependency check timed out".to_string()),
        },
    }
}

fn provider_to_key_name(provider: &str) -> Result<&'static str, String> {
    match provider {
        PROVIDER_ANTHROPIC => Ok("ANTHROPIC_API_KEY"),
        PROVIDER_OPENAI => Ok("OPENAI_API_KEY"),
        PROVIDER_GITHUB => Ok("GITHUB_TOKEN"),
        PROVIDER_OPENROUTER => Ok("OPENROUTER_API_KEY"),
        _ => Err(format!(
            "Unsupported provider '{}'. Expected one of: anthropic, openai, github, openrouter",
            provider
        )),
    }
}

fn validate_api_key_shape(provider: &str, api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();

    if trimmed.len() < 16 {
        return Err("API key appears too short".to_string());
    }

    let looks_valid = match provider {
        PROVIDER_ANTHROPIC => trimmed.starts_with("sk-ant-"),
        PROVIDER_OPENAI => trimmed.starts_with("sk-"),
        PROVIDER_GITHUB => {
            trimmed.starts_with("ghp_")
                || trimmed.starts_with("github_pat_")
                || trimmed.starts_with("gho_")
                || trimmed.starts_with("ghu_")
                || trimmed.starts_with("ghs_")
                || trimmed.starts_with("ghr_")
        }
        PROVIDER_OPENROUTER => trimmed.starts_with("sk-or-v1-") || trimmed.starts_with("sk-"),
        _ => false,
    };

    if !looks_valid {
        return Err(format!(
            "API key format does not match expected pattern for '{}'",
            provider
        ));
    }

    Ok(())
}

async fn validate_api_key_with_provider(provider: &str, api_key: &str) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

    let mut headers = HeaderMap::new();

    match provider {
        PROVIDER_ANTHROPIC => {
            headers.insert(
                "x-api-key",
                HeaderValue::from_str(api_key)
                    .map_err(|_| "Invalid API key header value".to_string())?,
            );
            headers.insert("anthropic-version", HeaderValue::from_static("2023-06-01"));

            let response = client
                .get("https://api.anthropic.com/v1/models")
                .headers(headers)
                .send()
                .await
                .map_err(|e| format!("Anthropic validation request failed: {}", e))?;

            validate_http_status("Anthropic", response.status())
        }
        PROVIDER_OPENAI => {
            let bearer = format!("Bearer {}", api_key);
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&bearer)
                    .map_err(|_| "Invalid API key header value".to_string())?,
            );

            let response = client
                .get("https://api.openai.com/v1/models")
                .headers(headers)
                .send()
                .await
                .map_err(|e| format!("OpenAI validation request failed: {}", e))?;

            validate_http_status("OpenAI", response.status())
        }
        PROVIDER_GITHUB => {
            let bearer = format!("Bearer {}", api_key);
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&bearer)
                    .map_err(|_| "Invalid API key header value".to_string())?,
            );
            headers.insert(USER_AGENT, HeaderValue::from_static("vcca-onboarding"));

            let response = client
                .get("https://api.github.com/user")
                .headers(headers)
                .send()
                .await
                .map_err(|e| format!("GitHub validation request failed: {}", e))?;

            validate_http_status("GitHub", response.status())
        }
        PROVIDER_OPENROUTER => {
            let bearer = format!("Bearer {}", api_key);
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&bearer)
                    .map_err(|_| "Invalid API key header value".to_string())?,
            );

            let response = client
                .get("https://openrouter.ai/api/v1/models")
                .headers(headers)
                .send()
                .await
                .map_err(|e| format!("OpenRouter validation request failed: {}", e))?;

            validate_http_status("OpenRouter", response.status())
        }
        _ => Err(format!("Unsupported provider '{}'", provider)),
    }
}

fn validate_http_status(provider: &str, status: reqwest::StatusCode) -> Result<(), String> {
    if status.is_success() {
        return Ok(());
    }

    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(format!("{} rejected the API key", provider));
    }

    Err(format!(
        "{} validation returned unexpected status: {}",
        provider, status
    ))
}

#[cfg(test)]
mod tests {
    use super::validate_api_key_shape;

    #[test]
    fn validates_anthropic_key_shape() {
        assert!(validate_api_key_shape("anthropic", "sk-ant-1234567890abcdef").is_ok());
        assert!(validate_api_key_shape("anthropic", "sk-1234567890abcdef").is_err());
    }

    #[test]
    fn validates_openai_key_shape() {
        assert!(validate_api_key_shape("openai", "sk-1234567890abcdef").is_ok());
        assert!(validate_api_key_shape("openai", "bad-key").is_err());
    }

    #[test]
    fn validates_github_key_shape() {
        assert!(validate_api_key_shape("github", "ghp_1234567890abcdef").is_ok());
        assert!(validate_api_key_shape("github", "github_pat_1234567890abcdef").is_ok());
        assert!(validate_api_key_shape("github", "sk-ant-1234567890abcdef").is_err());
    }
}
