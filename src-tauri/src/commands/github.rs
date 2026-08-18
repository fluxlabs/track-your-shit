// VCCA - GitHub API Commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use keyring::Entry;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::time::Duration;

/// Default service name for keychain access
const DEFAULT_SERVICE: &str = "net.fluxlabs.vcca";

// ============================================================
// Data structures for GitHub API responses
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubTokenStatus {
    pub configured: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepoInfo {
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub private: bool,
    pub default_branch: String,
    pub open_issues_count: u32,
    pub stargazers_count: u32,
    pub forks_count: u32,
    pub html_url: String,
    pub clone_url: String,
    pub pushed_at: Option<String>,
    pub visibility: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPR {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub user_login: String,
    pub user_avatar_url: Option<String>,
    pub body: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub html_url: String,
    pub head_ref: String,
    pub base_ref: String,
    pub draft: bool,
    pub mergeable: Option<bool>,
    pub review_decision: Option<String>,
    pub labels: Vec<GitHubLabel>,
    pub assignees: Vec<GitHubUser>,
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
    pub changed_files: Option<u32>,
    pub comments: u32,
    pub review_comments: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubReview {
    pub id: u64,
    pub user_login: String,
    pub state: String,
    pub body: Option<String>,
    pub submitted_at: Option<String>,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub user_login: String,
    pub body: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub closed_at: Option<String>,
    pub html_url: String,
    pub labels: Vec<GitHubLabel>,
    pub assignees: Vec<GitHubUser>,
    pub comments: u32,
    pub milestone_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubCheckRun {
    pub id: u64,
    pub name: String,
    pub status: String,
    pub conclusion: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub html_url: String,
    pub app_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub id: u64,
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub draft: bool,
    pub prerelease: bool,
    pub created_at: String,
    pub published_at: Option<String>,
    pub html_url: String,
    pub tarball_url: String,
    pub zipball_url: String,
    pub assets_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubNotification {
    pub id: String,
    pub reason: String,
    pub unread: bool,
    pub title: String,
    pub type_: String,
    pub updated_at: String,
    pub html_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubLabel {
    pub id: Option<u64>,
    pub name: String,
    pub color: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub avatar_url: Option<String>,
    pub html_url: String,
}

// ============================================================
// Helper functions
// ============================================================

/// Get GitHub token from keychain or environment variable
fn github_token() -> Option<String> {
    // Try keychain first
    if let Ok(entry) = Entry::new(DEFAULT_SERVICE, "GITHUB_TOKEN") {
        if let Ok(token) = entry.get_password() {
            return Some(token);
        }
    }

    // Fall back to environment variable
    std::env::var("GITHUB_TOKEN").ok()
}

/// Parse GitHub owner/repo from git remote URL
fn parse_github_owner_repo(project_path: &str) -> Result<(String, String), String> {
    let output = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to get git remote URL: {}", e))?;

    if !output.status.success() {
        return Err("No git remote found".to_string());
    }

    let url_lossy = String::from_utf8_lossy(&output.stdout);
    let url = url_lossy.trim();

    // Parse https://github.com/owner/repo or git@github.com:owner/repo
    let (owner, repo) = if url.starts_with("https://github.com/") {
        let path = url.strip_prefix("https://github.com/").unwrap();
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() < 2 {
            return Err("Invalid GitHub URL format".to_string());
        }
        let repo_name = parts[1].strip_suffix(".git").unwrap_or(parts[1]);
        (parts[0].to_string(), repo_name.to_string())
    } else if url.starts_with("git@github.com:") {
        let path = url.strip_prefix("git@github.com:").unwrap();
        let parts: Vec<&str> = path.split('/').collect();
        if parts.len() < 2 {
            return Err("Invalid GitHub SSH URL format".to_string());
        }
        let repo_name = parts[1].strip_suffix(".git").unwrap_or(parts[1]);
        (parts[0].to_string(), repo_name.to_string())
    } else {
        return Err("No GitHub remote found".to_string());
    };

    Ok((owner, repo))
}

/// Create a configured GitHub API request builder
fn github_request(token: Option<&str>, url: &str) -> Result<reqwest::RequestBuilder, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("gsd-vibe/1.0"));
    headers.insert(
        "Accept",
        HeaderValue::from_static("application/vnd.github.v3+json"),
    );

    if let Some(token) = token {
        let auth_value = format!("Bearer {}", token);
        headers.insert(
            "Authorization",
            HeaderValue::from_str(&auth_value)
                .map_err(|e| format!("Invalid token format: {}", e))?,
        );
    }

    Ok(client.get(url).headers(headers))
}

// ============================================================
// Tauri commands
// ============================================================

/// Check if GitHub token is configured
#[tauri::command]
pub async fn github_get_token_status() -> Result<GitHubTokenStatus, String> {
    let configured = github_token().is_some();
    Ok(GitHubTokenStatus { configured })
}

/// Get repository information from GitHub API
#[tauri::command]
pub async fn github_get_repo_info(project_path: String) -> Result<GitHubRepoInfo, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token();

    let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    let resp = github_request(token.as_deref(), &url)?
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    Ok(GitHubRepoInfo {
        name: data["name"].as_str().unwrap_or("").to_string(),
        full_name: data["full_name"].as_str().unwrap_or("").to_string(),
        description: data["description"].as_str().map(|s| s.to_string()),
        private: data["private"].as_bool().unwrap_or(false),
        default_branch: data["default_branch"]
            .as_str()
            .unwrap_or("main")
            .to_string(),
        open_issues_count: data["open_issues_count"].as_u64().unwrap_or(0) as u32,
        stargazers_count: data["stargazers_count"].as_u64().unwrap_or(0) as u32,
        forks_count: data["forks_count"].as_u64().unwrap_or(0) as u32,
        html_url: data["html_url"].as_str().unwrap_or("").to_string(),
        clone_url: data["clone_url"].as_str().unwrap_or("").to_string(),
        pushed_at: data["pushed_at"].as_str().map(|s| s.to_string()),
        visibility: data["visibility"].as_str().unwrap_or("public").to_string(),
    })
}

/// List pull requests for a repository
#[tauri::command]
pub async fn github_list_prs(
    project_path: String,
    state: Option<String>,
) -> Result<Vec<GitHubPR>, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token();
    let pr_state = state.unwrap_or_else(|| "open".to_string());

    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls?state={}&per_page=50",
        owner, repo, pr_state
    );

    let resp = github_request(token.as_deref(), &url)?
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    let empty_vec = vec![];
    let prs = data.as_array().unwrap_or(&empty_vec);
    let mut result = Vec::new();

    for pr in prs {
        let labels = pr["labels"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|l| GitHubLabel {
                id: l["id"].as_u64(),
                name: l["name"].as_str().unwrap_or("").to_string(),
                color: l["color"].as_str().unwrap_or("").to_string(),
                description: l["description"].as_str().map(|s| s.to_string()),
            })
            .collect();

        let assignees = pr["assignees"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|a| GitHubUser {
                login: a["login"].as_str().unwrap_or("").to_string(),
                avatar_url: a["avatar_url"].as_str().map(|s| s.to_string()),
                html_url: a["html_url"].as_str().unwrap_or("").to_string(),
            })
            .collect();

        result.push(GitHubPR {
            number: pr["number"].as_u64().unwrap_or(0),
            title: pr["title"].as_str().unwrap_or("").to_string(),
            state: pr["state"].as_str().unwrap_or("").to_string(),
            user_login: pr["user"]["login"].as_str().unwrap_or("").to_string(),
            user_avatar_url: pr["user"]["avatar_url"].as_str().map(|s| s.to_string()),
            body: pr["body"].as_str().map(|s| s.to_string()),
            created_at: pr["created_at"].as_str().unwrap_or("").to_string(),
            updated_at: pr["updated_at"].as_str().unwrap_or("").to_string(),
            html_url: pr["html_url"].as_str().unwrap_or("").to_string(),
            head_ref: pr["head"]["ref"].as_str().unwrap_or("").to_string(),
            base_ref: pr["base"]["ref"].as_str().unwrap_or("").to_string(),
            draft: pr["draft"].as_bool().unwrap_or(false),
            mergeable: pr["mergeable"].as_bool(),
            review_decision: pr["review_decision"].as_str().map(|s| s.to_string()),
            labels,
            assignees,
            additions: pr["additions"].as_u64().map(|n| n as u32),
            deletions: pr["deletions"].as_u64().map(|n| n as u32),
            changed_files: pr["changed_files"].as_u64().map(|n| n as u32),
            comments: pr["comments"].as_u64().unwrap_or(0) as u32,
            review_comments: pr["review_comments"].as_u64().unwrap_or(0) as u32,
        });
    }

    Ok(result)
}

/// Create a new pull request
#[tauri::command]
pub async fn github_create_pr(
    project_path: String,
    title: String,
    body: String,
    head: String,
    base: String,
    draft: bool,
) -> Result<GitHubPR, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token().ok_or("GitHub token required")?;

    let url = format!("https://api.github.com/repos/{}/{}/pulls", owner, repo);

    let mut payload = HashMap::new();
    payload.insert("title", serde_json::Value::String(title));
    payload.insert("body", serde_json::Value::String(body));
    payload.insert("head", serde_json::Value::String(head));
    payload.insert("base", serde_json::Value::String(base));
    payload.insert("draft", serde_json::Value::Bool(draft));

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("gsd-vibe/1.0"));
    headers.insert(
        "Accept",
        HeaderValue::from_static("application/vnd.github.v3+json"),
    );
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", token))
            .map_err(|e| format!("Invalid token format: {}", e))?,
    );
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));

    let resp = client
        .post(&url)
        .headers(headers)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let error_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("GitHub API error: {}", error_text));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    // Parse the created PR response (same structure as list_prs)
    let labels = data["labels"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|l| GitHubLabel {
            id: l["id"].as_u64(),
            name: l["name"].as_str().unwrap_or("").to_string(),
            color: l["color"].as_str().unwrap_or("").to_string(),
            description: l["description"].as_str().map(|s| s.to_string()),
        })
        .collect();

    let assignees = data["assignees"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|a| GitHubUser {
            login: a["login"].as_str().unwrap_or("").to_string(),
            avatar_url: a["avatar_url"].as_str().map(|s| s.to_string()),
            html_url: a["html_url"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(GitHubPR {
        number: data["number"].as_u64().unwrap_or(0),
        title: data["title"].as_str().unwrap_or("").to_string(),
        state: data["state"].as_str().unwrap_or("").to_string(),
        user_login: data["user"]["login"].as_str().unwrap_or("").to_string(),
        user_avatar_url: data["user"]["avatar_url"].as_str().map(|s| s.to_string()),
        body: data["body"].as_str().map(|s| s.to_string()),
        created_at: data["created_at"].as_str().unwrap_or("").to_string(),
        updated_at: data["updated_at"].as_str().unwrap_or("").to_string(),
        html_url: data["html_url"].as_str().unwrap_or("").to_string(),
        head_ref: data["head"]["ref"].as_str().unwrap_or("").to_string(),
        base_ref: data["base"]["ref"].as_str().unwrap_or("").to_string(),
        draft: data["draft"].as_bool().unwrap_or(false),
        mergeable: data["mergeable"].as_bool(),
        review_decision: data["review_decision"].as_str().map(|s| s.to_string()),
        labels,
        assignees,
        additions: data["additions"].as_u64().map(|n| n as u32),
        deletions: data["deletions"].as_u64().map(|n| n as u32),
        changed_files: data["changed_files"].as_u64().map(|n| n as u32),
        comments: data["comments"].as_u64().unwrap_or(0) as u32,
        review_comments: data["review_comments"].as_u64().unwrap_or(0) as u32,
    })
}

/// Get reviews for a pull request
#[tauri::command]
pub async fn github_get_pr_reviews(
    project_path: String,
    pr_number: u64,
) -> Result<Vec<GitHubReview>, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token();

    let url = format!(
        "https://api.github.com/repos/{}/{}/pulls/{}/reviews",
        owner, repo, pr_number
    );

    let resp = github_request(token.as_deref(), &url)?
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    let empty_vec = vec![];
    let reviews = data.as_array().unwrap_or(&empty_vec);
    let mut result = Vec::new();

    for review in reviews {
        result.push(GitHubReview {
            id: review["id"].as_u64().unwrap_or(0),
            user_login: review["user"]["login"].as_str().unwrap_or("").to_string(),
            state: review["state"].as_str().unwrap_or("").to_string(),
            body: review["body"].as_str().map(|s| s.to_string()),
            submitted_at: review["submitted_at"].as_str().map(|s| s.to_string()),
            html_url: review["html_url"].as_str().unwrap_or("").to_string(),
        });
    }

    Ok(result)
}

/// List issues for a repository (excludes PRs)
#[tauri::command]
pub async fn github_list_issues(
    project_path: String,
    state: Option<String>,
    labels: Option<String>,
) -> Result<Vec<GitHubIssue>, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token();
    let issue_state = state.unwrap_or_else(|| "open".to_string());

    let mut url = format!(
        "https://api.github.com/repos/{}/{}/issues?state={}&per_page=50",
        owner, repo, issue_state
    );

    if let Some(label_filter) = labels {
        url.push_str(&format!("&labels={}", label_filter));
    }

    let resp = github_request(token.as_deref(), &url)?
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    let empty_vec = vec![];
    let issues = data.as_array().unwrap_or(&empty_vec);
    let mut result = Vec::new();

    for issue in issues {
        // Skip PRs (issues endpoint returns both issues and PRs)
        if issue["pull_request"].is_object() {
            continue;
        }

        let issue_labels = issue["labels"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|l| GitHubLabel {
                id: l["id"].as_u64(),
                name: l["name"].as_str().unwrap_or("").to_string(),
                color: l["color"].as_str().unwrap_or("").to_string(),
                description: l["description"].as_str().map(|s| s.to_string()),
            })
            .collect();

        let issue_assignees = issue["assignees"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .map(|a| GitHubUser {
                login: a["login"].as_str().unwrap_or("").to_string(),
                avatar_url: a["avatar_url"].as_str().map(|s| s.to_string()),
                html_url: a["html_url"].as_str().unwrap_or("").to_string(),
            })
            .collect();

        result.push(GitHubIssue {
            number: issue["number"].as_u64().unwrap_or(0),
            title: issue["title"].as_str().unwrap_or("").to_string(),
            state: issue["state"].as_str().unwrap_or("").to_string(),
            user_login: issue["user"]["login"].as_str().unwrap_or("").to_string(),
            body: issue["body"].as_str().map(|s| s.to_string()),
            created_at: issue["created_at"].as_str().unwrap_or("").to_string(),
            updated_at: issue["updated_at"].as_str().unwrap_or("").to_string(),
            closed_at: issue["closed_at"].as_str().map(|s| s.to_string()),
            html_url: issue["html_url"].as_str().unwrap_or("").to_string(),
            labels: issue_labels,
            assignees: issue_assignees,
            comments: issue["comments"].as_u64().unwrap_or(0) as u32,
            milestone_title: issue["milestone"]["title"].as_str().map(|s| s.to_string()),
        });
    }

    Ok(result)
}

/// Create a new issue
#[tauri::command]
pub async fn github_create_issue(
    project_path: String,
    title: String,
    body: String,
    labels: Vec<String>,
    assignees: Vec<String>,
) -> Result<GitHubIssue, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token().ok_or("GitHub token required")?;

    let url = format!("https://api.github.com/repos/{}/{}/issues", owner, repo);

    let mut payload = HashMap::new();
    payload.insert("title", serde_json::Value::String(title));
    payload.insert("body", serde_json::Value::String(body));

    if !labels.is_empty() {
        payload.insert(
            "labels",
            serde_json::Value::Array(labels.into_iter().map(serde_json::Value::String).collect()),
        );
    }

    if !assignees.is_empty() {
        payload.insert(
            "assignees",
            serde_json::Value::Array(
                assignees
                    .into_iter()
                    .map(serde_json::Value::String)
                    .collect(),
            ),
        );
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, HeaderValue::from_static("gsd-vibe/1.0"));
    headers.insert(
        "Accept",
        HeaderValue::from_static("application/vnd.github.v3+json"),
    );
    headers.insert(
        "Authorization",
        HeaderValue::from_str(&format!("Bearer {}", token))
            .map_err(|e| format!("Invalid token format: {}", e))?,
    );
    headers.insert("Content-Type", HeaderValue::from_static("application/json"));

    let resp = client
        .post(&url)
        .headers(headers)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        let error_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("GitHub API error: {}", error_text));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    // Parse the created issue response
    let issue_labels = data["labels"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|l| GitHubLabel {
            id: l["id"].as_u64(),
            name: l["name"].as_str().unwrap_or("").to_string(),
            color: l["color"].as_str().unwrap_or("").to_string(),
            description: l["description"].as_str().map(|s| s.to_string()),
        })
        .collect();

    let issue_assignees = data["assignees"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|a| GitHubUser {
            login: a["login"].as_str().unwrap_or("").to_string(),
            avatar_url: a["avatar_url"].as_str().map(|s| s.to_string()),
            html_url: a["html_url"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(GitHubIssue {
        number: data["number"].as_u64().unwrap_or(0),
        title: data["title"].as_str().unwrap_or("").to_string(),
        state: data["state"].as_str().unwrap_or("").to_string(),
        user_login: data["user"]["login"].as_str().unwrap_or("").to_string(),
        body: data["body"].as_str().map(|s| s.to_string()),
        created_at: data["created_at"].as_str().unwrap_or("").to_string(),
        updated_at: data["updated_at"].as_str().unwrap_or("").to_string(),
        closed_at: data["closed_at"].as_str().map(|s| s.to_string()),
        html_url: data["html_url"].as_str().unwrap_or("").to_string(),
        labels: issue_labels,
        assignees: issue_assignees,
        comments: data["comments"].as_u64().unwrap_or(0) as u32,
        milestone_title: data["milestone"]["title"].as_str().map(|s| s.to_string()),
    })
}

/// List check runs for a git reference (commit/branch/tag)
#[tauri::command]
pub async fn github_list_check_runs(
    project_path: String,
    git_ref: String,
) -> Result<Vec<GitHubCheckRun>, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token();

    let url = format!(
        "https://api.github.com/repos/{}/{}/commits/{}/check-runs",
        owner, repo, git_ref
    );

    let resp = github_request(token.as_deref(), &url)?
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    let empty_vec = vec![];
    let check_runs = data["check_runs"].as_array().unwrap_or(&empty_vec);
    let mut result = Vec::new();

    for check in check_runs {
        result.push(GitHubCheckRun {
            id: check["id"].as_u64().unwrap_or(0),
            name: check["name"].as_str().unwrap_or("").to_string(),
            status: check["status"].as_str().unwrap_or("").to_string(),
            conclusion: check["conclusion"].as_str().map(|s| s.to_string()),
            started_at: check["started_at"].as_str().map(|s| s.to_string()),
            completed_at: check["completed_at"].as_str().map(|s| s.to_string()),
            html_url: check["html_url"].as_str().unwrap_or("").to_string(),
            app_name: check["app"]["name"].as_str().unwrap_or("").to_string(),
        });
    }

    Ok(result)
}

/// List releases for a repository
#[tauri::command]
pub async fn github_list_releases(project_path: String) -> Result<Vec<GitHubRelease>, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = github_token();

    let url = format!(
        "https://api.github.com/repos/{}/{}/releases?per_page=20",
        owner, repo
    );

    let resp = github_request(token.as_deref(), &url)?
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    let empty_vec = vec![];
    let releases = data.as_array().unwrap_or(&empty_vec);
    let mut result = Vec::new();

    for release in releases {
        let assets_count = release["assets"]
            .as_array()
            .map(|arr| arr.len())
            .unwrap_or(0);

        result.push(GitHubRelease {
            id: release["id"].as_u64().unwrap_or(0),
            tag_name: release["tag_name"].as_str().unwrap_or("").to_string(),
            name: release["name"].as_str().map(|s| s.to_string()),
            body: release["body"].as_str().map(|s| s.to_string()),
            draft: release["draft"].as_bool().unwrap_or(false),
            prerelease: release["prerelease"].as_bool().unwrap_or(false),
            created_at: release["created_at"].as_str().unwrap_or("").to_string(),
            published_at: release["published_at"].as_str().map(|s| s.to_string()),
            html_url: release["html_url"].as_str().unwrap_or("").to_string(),
            tarball_url: release["tarball_url"].as_str().unwrap_or("").to_string(),
            zipball_url: release["zipball_url"].as_str().unwrap_or("").to_string(),
            assets_count,
        });
    }

    Ok(result)
}

/// List notifications for a repository
#[tauri::command]
pub async fn github_list_repo_notifications(
    project_path: String,
) -> Result<Vec<GitHubNotification>, String> {
    let (owner, repo) = parse_github_owner_repo(&project_path)?;
    let token = match github_token() {
        Some(t) => t,
        None => return Ok(vec![]), // Return empty if no token configured
    };

    let full_name = format!("{}/{}", owner, repo);
    let url = format!(
        "https://api.github.com/notifications?repository={}",
        full_name.replace("/", "%2F")
    );

    let resp = github_request(Some(&token), &url)?
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API error: {}", resp.status()));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    let empty_vec = vec![];
    let notifications = data.as_array().unwrap_or(&empty_vec);
    let mut result = Vec::new();

    for notification in notifications {
        result.push(GitHubNotification {
            id: notification["id"].as_str().unwrap_or("").to_string(),
            reason: notification["reason"].as_str().unwrap_or("").to_string(),
            unread: notification["unread"].as_bool().unwrap_or(false),
            title: notification["subject"]["title"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            type_: notification["subject"]["type"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            updated_at: notification["updated_at"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            html_url: notification["subject"]["url"].as_str().map(|s| {
                // Convert API URL to web URL
                s.replace("api.github.com/repos", "github.com")
                    .replace("/pulls/", "/pull/")
                    .replace("/issues/", "/issues/")
            }),
        });
    }

    Ok(result)
}
/// Import the GitHub token from the `gh` CLI (`gh auth token`).
/// Stores it in the OS keychain as GITHUB_TOKEN.
#[tauri::command]
pub async fn github_import_gh_token() -> Result<String, String> {
    let output = std::process::Command::new("gh")
        .args(["auth", "token"])
        .output()
        .map_err(|_| {
            "gh CLI not found — install GitHub CLI (brew install gh) and run `gh auth login`"
                .to_string()
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "gh auth token failed: {}. Run `gh auth login` first.",
            stderr.trim()
        ));
    }

    let token = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if token.is_empty() {
        return Err("gh returned an empty token. Run `gh auth login` to authenticate.".to_string());
    }

    // Store in keychain
    use keyring::Entry;
    let entry = Entry::new("net.fluxlabs.vcca", "GITHUB_TOKEN")
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
    entry
        .set_password(&token)
        .map_err(|e| format!("Failed to store token in keychain: {}", e))?;

    // Update the key index (same pattern as secrets.rs)
    let index_entry = Entry::new("net.fluxlabs.vcca", "__vcca_key_index__")
        .map_err(|e| format!("Failed to access key index: {}", e))?;

    let mut keys: Vec<String> = match index_entry.get_password() {
        Ok(json) => serde_json::from_str::<serde_json::Value>(&json)
            .ok()
            .and_then(|v| {
                v["keys"].as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|k| k.as_str().map(|s| s.to_string()))
                        .collect()
                })
            })
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    if !keys.iter().any(|k| k == "GITHUB_TOKEN") {
        keys.push("GITHUB_TOKEN".to_string());
        let updated = serde_json::json!({ "keys": keys });
        let _ = index_entry.set_password(&updated.to_string());
    }

    tracing::info!("Imported GitHub token from gh CLI into keychain");
    Ok("GitHub token imported successfully".to_string())
}

/// Save a GitHub Personal Access Token directly into the OS keychain.
#[tauri::command]
pub async fn github_save_token(token: String) -> Result<(), String> {
    if token.trim().is_empty() {
        return Err("Token cannot be empty".to_string());
    }
    let clean = token.trim().to_string();

    use keyring::Entry;
    let entry = Entry::new("net.fluxlabs.vcca", "GITHUB_TOKEN")
        .map_err(|e| format!("Failed to create keychain entry: {}", e))?;
    entry
        .set_password(&clean)
        .map_err(|e| format!("Failed to store token in keychain: {}", e))?;

    // Update key index
    let index_entry = Entry::new("net.fluxlabs.vcca", "__vcca_key_index__")
        .map_err(|e| format!("Failed to access key index: {}", e))?;

    let mut keys: Vec<String> = match index_entry.get_password() {
        Ok(json) => serde_json::from_str::<serde_json::Value>(&json)
            .ok()
            .and_then(|v| {
                v["keys"].as_array().map(|arr| {
                    arr.iter()
                        .filter_map(|k| k.as_str().map(|s| s.to_string()))
                        .collect()
                })
            })
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    if !keys.iter().any(|k| k == "GITHUB_TOKEN") {
        keys.push("GITHUB_TOKEN".to_string());
        let updated = serde_json::json!({ "keys": keys });
        let _ = index_entry.set_password(&updated.to_string());
    }

    tracing::info!("Saved GitHub PAT to keychain");
    Ok(())
}

/// Remove the stored GitHub token from the OS keychain.
#[tauri::command]
pub async fn github_remove_token() -> Result<(), String> {
    use keyring::Entry;
    let entry = Entry::new("net.fluxlabs.vcca", "GITHUB_TOKEN")
        .map_err(|e| format!("Keychain error: {}", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(format!("Failed to remove token: {}", e)),
    }
    tracing::info!("Removed GitHub token from keychain");
    Ok(())
}
