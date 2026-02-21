// Track Your Shit - Data Models
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub tech_stack: Option<TechStack>,
    pub config: Option<serde_json::Value>,
    pub status: String,
    #[serde(default)]
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TechStack {
    pub framework: Option<String>,
    pub language: Option<String>,
    pub package_manager: Option<String>,
    pub database: Option<String>,
    pub test_framework: Option<String>,
    pub has_planning: bool,
    /// Count of phase directories in .planning/phases/
    #[serde(default)]
    pub gsd_phase_count: Option<i32>,
    /// Count of pending .md files in .planning/todos/pending/
    #[serde(default)]
    pub gsd_todo_count: Option<i32>,
    /// Whether .planning/REQUIREMENTS.md exists
    #[serde(default)]
    pub gsd_has_requirements: bool,
    /// When conversion needs to be re-run
    #[serde(default)]
    pub gsd_conversion_incomplete: bool,
    /// Details about why GSD conversion is incomplete
    #[serde(default)]
    pub gsd_conversion_issues: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectUpdate {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityEntry {
    pub id: String,
    pub project_id: String,
    pub execution_id: Option<String>,
    pub event_type: String,
    pub message: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Decision {
    pub id: String,
    pub project_id: String,
    pub execution_id: Option<String>,
    pub phase: Option<String>,
    pub category: Option<String>,
    pub question: String,
    pub answer: String,
    pub reasoning: Option<String>,
    pub tags: Option<String>,
    pub impact_status: Option<String>,
    pub impact_reason: Option<String>,
    pub impact_updated_at: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub start_on_login: bool,
    pub default_cost_limit: f64,
    pub notifications_enabled: bool,
    pub notify_on_complete: bool,
    pub notify_on_error: bool,
    pub notify_cost_threshold: Option<f64>,
    // Cost threshold system
    pub cost_thresholds_enabled: bool,
    pub warn_cost: f64,
    pub alert_cost: f64,
    pub stop_cost: f64,
    // Theme/appearance
    pub accent_color: String,
    pub ui_density: String,
    pub font_size_scale: f64,
    pub font_family: String,
    // Startup behavior
    pub auto_open_last_project: bool,
    pub window_state: String,
    // Notification granularity
    pub notify_on_phase_complete: bool,
    pub notify_on_cost_warning: bool,
    // Advanced
    pub debug_logging: bool,
    // Terminal persistence
    pub use_tmux: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            start_on_login: false,
            default_cost_limit: 50.0,
            notifications_enabled: true,
            notify_on_complete: true,
            notify_on_error: true,
            notify_cost_threshold: Some(25.0),
            // Cost threshold defaults
            cost_thresholds_enabled: true,
            warn_cost: 10.0,
            alert_cost: 25.0,
            stop_cost: 50.0,
            // Theme/appearance defaults
            accent_color: "default".to_string(),
            ui_density: "normal".to_string(),
            font_size_scale: 1.0,
            font_family: "system".to_string(),
            // Startup behavior defaults
            auto_open_last_project: false,
            window_state: "normal".to_string(),
            // Notification granularity defaults
            notify_on_phase_complete: true,
            notify_on_cost_warning: true,
            // Advanced defaults
            debug_logging: false,
            // Terminal persistence defaults
            use_tmux: true,
        }
    }
}

// Project Scanner structs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerCategory {
    pub name: String,
    pub grade: String,
    pub summary: String,
    pub score: Option<u32>,
    pub issues: Option<u32>,
    pub priority: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerReport {
    pub name: String,
    pub relative_path: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerSummary {
    pub available: bool,
    pub overall_grade: Option<String>,
    pub scan_date: Option<String>,
    pub categories: Vec<ScannerCategory>,
    pub reports: Vec<ScannerReport>,
    pub total_gaps: Option<u32>,
    pub total_recommendations: Option<u32>,
    pub overall_score: Option<u32>,
    pub analysis_mode: Option<String>,
    pub project_phase: Option<String>,
    #[serde(default)]
    pub high_priority_actions: Vec<String>,
    pub source: Option<String>,
}

// Documentation detection structs
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DocsAvailable {
    pub has_project_md: bool,
    pub has_roadmap_md: bool,
    pub has_readme: bool,
    pub project_md_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDocs {
    pub description: Option<String>,
    pub goal: Option<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub project: Project,
    pub docs: Option<ProjectDocs>,
    pub roadmap_synced: bool,
    /// PTY session ID if a conversion/generation process was started
    pub pty_session_id: Option<String>,
    /// Import mode: "gsd" (converting from .planning), "bare" (generating new)
    pub import_mode: String,
    /// Markdown scan results from recursive discovery during import
    pub markdown_scan: Option<MarkdownScanResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectResult {
    pub project: Project,
    pub pty_session_id: String,
    pub template: Option<String>,
    pub discovery_mode: String,
    pub creation_mode: String,
}

// Claude CLI status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub path: Option<String>,
}

// ============================================================
// Knowledge System Models (PRD FR-9)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Knowledge {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub source: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeInput {
    pub title: String,
    pub content: String,
    pub category: Option<String>,
    pub source: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSearchResult {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub category: String,
    pub relevance_score: Option<f64>,
    pub created_at: String,
}

// ============================================================
// Application Logging Models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppLogEntry {
    pub id: String,
    pub level: String,
    pub target: Option<String>,
    pub message: String,
    pub source: String,
    pub project_id: Option<String>,
    pub metadata: Option<serde_json::Value>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppLogFilters {
    pub level: Option<String>,
    pub source: Option<String>,
    pub target: Option<String>,
    pub project_id: Option<String>,
    pub search: Option<String>,
    pub limit: Option<i32>,
    pub before: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppLogStats {
    pub total: i32,
    pub by_level: Vec<LevelCount>,
    pub by_source: Vec<SourceCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelCount {
    pub level: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceCount {
    pub source: String,
    pub count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppLogEvent {
    pub id: String,
    pub level: String,
    pub target: Option<String>,
    pub message: String,
    pub source: String,
    pub project_id: Option<String>,
    pub created_at: String,
}

// ============================================================
// Global Search Models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalSearchResults {
    pub projects: Vec<ProjectSearchResult>,
    pub phases: Vec<PhaseSearchResult>,
    pub decisions: Vec<DecisionSearchResult>,
    pub knowledge: Vec<KnowledgeSearchResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSearchResult {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseSearchResult {
    pub id: String,
    pub name: String,
    pub goal: Option<String>,
    pub status: String,
    pub project_id: String,
    pub project_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionSearchResult {
    pub id: String,
    pub question: String,
    pub answer: String,
    pub category: Option<String>,
    pub project_id: String,
    pub project_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSearchResultItem {
    pub id: String,
    pub title: String,
    pub category: String,
    pub project_id: String,
    pub project_name: String,
}

// ============================================================
// Enriched Project Card Models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoadmapProgress {
    pub total_phases: i32,
    pub completed_phases: i32,
    pub total_tasks: i32,
    pub completed_tasks: i32,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectWithStats {
    pub id: String,
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    pub tech_stack: Option<TechStack>,
    pub config: Option<serde_json::Value>,
    pub status: String,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub total_cost: f64,
    pub roadmap_progress: Option<RoadmapProgress>,
    pub last_activity_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitInfo {
    pub branch: Option<String>,
    pub is_dirty: bool,
    pub has_git: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatusDetail {
    pub has_git: bool,
    pub branch: Option<String>,
    pub is_dirty: bool,
    pub staged_count: u32,
    pub unstaged_count: u32,
    pub untracked_count: u32,
    pub ahead: u32,
    pub behind: u32,
    pub last_commit: Option<GitCommitInfo>,
    pub stash_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitChangedFile {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitOperationResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitLogEntry {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
    pub files_changed: u32,
    pub insertions: u32,
    pub deletions: u32,
}

// ============================================================
// Terminal Power Features Models (Phase C)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandHistoryEntry {
    pub id: String,
    pub project_id: String,
    pub command: String,
    pub source: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub project_id: Option<String>,
    pub label: String,
    pub command: String,
    pub description: Option<String>,
    pub category: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnippetInput {
    pub label: String,
    pub command: String,
    pub description: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptFavorite {
    pub id: String,
    pub project_id: String,
    pub script_id: String,
    pub order_index: i32,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCommand {
    pub id: String,
    pub project_id: String,
    pub label: String,
    pub command: String,
    pub hook_type: String,
    pub enabled: bool,
    pub order_index: i32,
    pub preset: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCommandInput {
    pub label: String,
    pub command: String,
    pub hook_type: Option<String>,
    pub preset: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCommandPreset {
    pub id: String,
    pub label: String,
    pub command: String,
    pub hook_type: String,
}

// ============================================================
// Markdown Scanning & Indexing Models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkdownScanResult {
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub folders: Vec<MarkdownFolderSummary>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkdownFolderSummary {
    pub relative_path: String,
    pub display_name: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkdownIndexProgress {
    pub project_id: String,
    pub indexed: usize,
    pub total: usize,
    pub current_file: String,
}

// ============================================================
// Knowledge File System Models (Phase E - KN-01, KN-02)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeFileTree {
    pub folders: Vec<KnowledgeFolder>,
    pub total_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeFolder {
    pub name: String,
    pub display_name: String,
    pub files: Vec<KnowledgeFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeFileEntry {
    pub relative_path: String,
    pub display_name: String,
    pub folder: String,
    pub size_bytes: u64,
}

// ============================================================
// Notification Models (CC-03)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub project_id: Option<String>,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub link: Option<String>,
    pub read: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNotificationInput {
    pub project_id: Option<String>,
    pub notification_type: String,
    pub title: String,
    pub message: String,
    pub link: Option<String>,
}

// ============================================================
// Environment Info Models (SH-04)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentInfo {
    pub git_branch: Option<String>,
    pub node_version: Option<String>,
    pub python_version: Option<String>,
    pub rust_version: Option<String>,
    pub working_directory: String,
}

// ============================================================
// Terminal Session Persistence Models (SH-03)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub project_id: String,
    pub tab_name: String,
    pub tab_type: String,
    pub working_directory: String,
    pub sort_order: i32,
    pub tmux_session: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveTerminalSessionInput {
    pub project_id: String,
    pub tab_name: String,
    pub tab_type: String,
    pub working_directory: String,
    pub sort_order: i32,
    pub tmux_session: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeSearchMatch {
    pub file_path: String,
    pub display_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub context_before: String,
    pub context_after: String,
}

// ============================================================
// Knowledge & Decision Models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeBookmark {
    pub id: String,
    pub project_id: String,
    pub file_path: String,
    pub heading: String,
    pub heading_level: i32,
    pub note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub package_manager: String,
    pub outdated_count: i32,
    pub vulnerable_count: i32,
    pub details: Option<serde_json::Value>,
    pub checked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeGraphNode {
    pub id: String,
    pub label: String,
    pub file_path: String,
    pub node_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeGraphEdge {
    pub source: String,
    pub target: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeGraph {
    pub nodes: Vec<KnowledgeGraphNode>,
    pub edges: Vec<KnowledgeGraphEdge>,
}

// ============================================================
// GSD (Get Stuff Done) Integration Models
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdProjectInfo {
    pub vision: Option<String>,
    pub milestone: Option<String>,
    pub version: Option<String>,
    pub core_value: Option<String>,
    pub current_focus: Option<String>,
    pub raw_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdState {
    pub current_position: Option<GsdCurrentPosition>,
    pub decisions: Vec<String>,
    pub pending_todos: Vec<String>,
    pub session_continuity: Option<String>,
    pub velocity: Option<GsdVelocity>,
    pub blockers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdCurrentPosition {
    pub milestone: Option<String>,
    pub phase: Option<String>,
    pub plan: Option<String>,
    pub status: Option<String>,
    pub last_activity: Option<String>,
    pub progress: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdConfig {
    pub workflow_mode: Option<String>,
    pub model_profile: Option<String>,
    pub raw_json: Option<serde_json::Value>,
    pub depth: Option<String>,
    pub parallelization: Option<bool>,
    pub commit_docs: Option<bool>,
    pub workflow_research: Option<bool>,
    pub workflow_inspection: Option<bool>,
    pub workflow_plan_verification: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdRequirement {
    pub req_id: String,
    pub description: String,
    pub category: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub phase: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdMilestone {
    pub name: String,
    pub version: Option<String>,
    pub phase_start: Option<i32>,
    pub phase_end: Option<i32>,
    pub status: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdTodo {
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdTodoInput {
    pub title: String,
    pub description: Option<String>,
    pub area: Option<String>,
    pub phase: Option<String>,
    pub priority: Option<String>,
    pub is_blocker: Option<bool>,
    pub files: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdDebugSession {
    pub id: String,
    pub title: String,
    pub error_type: Option<String>,
    pub status: String,
    pub summary: Option<String>,
    pub resolution: Option<String>,
    pub source_file: Option<String>,
    pub created_at: Option<String>,
    pub resolved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdResearchDoc {
    pub filename: String,
    pub title: Option<String>,
    pub category: Option<String>,
    pub content: String,
    pub source_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdVerification {
    pub phase_number: i32,
    pub checks_total: i32,
    pub checks_passed: i32,
    pub result: Option<String>,
    pub gaps: Vec<String>,
    pub raw_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdPhaseContext {
    pub decisions: Vec<String>,
    pub deferred_ideas: Vec<String>,
    pub raw_content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdSyncResult {
    pub todos_synced: i32,
    pub milestones_synced: i32,
    pub requirements_synced: i32,
    pub verifications_synced: i32,
    pub plans_synced: i32,
    pub summaries_synced: i32,
    pub phase_research_synced: i32,
    pub uat_synced: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdPlan {
    pub phase_number: i32,
    pub plan_number: i32,
    pub plan_type: Option<String>,
    pub group_number: Option<i32>,
    pub autonomous: bool,
    pub objective: Option<String>,
    pub task_count: i32,
    pub tasks: Vec<GsdPlanTask>,
    pub files_modified: Vec<String>,
    pub source_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdPlanTask {
    pub name: String,
    pub task_type: Option<String>,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdSummary {
    pub phase_number: i32,
    pub plan_number: i32,
    pub subsystem: Option<String>,
    pub tags: Vec<String>,
    pub duration: Option<String>,
    pub completed: Option<String>,
    pub accomplishments: Vec<String>,
    pub decisions: Vec<GsdSummaryDecision>,
    pub files_created: Vec<String>,
    pub files_modified: Vec<String>,
    pub deviations: Option<String>,
    pub self_check: Option<String>,
    pub source_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdSummaryDecision {
    pub decision: String,
    pub rationale: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdPhaseResearch {
    pub phase_number: i32,
    pub domain: Option<String>,
    pub confidence: Option<String>,
    pub summary: Option<String>,
    pub anti_patterns: Vec<String>,
    pub pitfalls: Vec<String>,
    pub raw_content: String,
    pub source_file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdVelocity {
    pub total_plans: Option<i32>,
    pub avg_duration: Option<String>,
    pub total_time: Option<String>,
    pub by_phase: Vec<GsdPhaseVelocity>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdPhaseVelocity {
    pub phase: String,
    pub plans: i32,
    pub duration: String,
    pub avg_per_plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdMilestoneAudit {
    pub version: Option<String>,
    pub status: Option<String>,
    pub req_score: Option<String>,
    pub phase_score: Option<String>,
    pub integration_score: Option<String>,
    pub gaps: Vec<String>,
    pub tech_debt: Vec<String>,
    pub raw_content: String,
    pub source_file: String,
}

// ============================================================
// GSD Validation (VALIDATION.md per phase)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskVerification {
    pub task_id: String,
    pub requirement: Option<String>,
    pub test_type: String,   // "automated" | "manual"
    pub status: String,      // "pending" | "pass" | "fail"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WaveTracking {
    pub wave_number: i32,
    pub task_ids: Vec<String>,
    pub status: Option<String>,
    pub tests_passed: Option<String>,
    pub issues: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdValidation {
    pub id: String,
    pub project_id: String,
    pub phase_number: String,
    pub test_framework: Option<String>,
    pub quick_run_cmd: Option<String>,
    pub full_run_cmd: Option<String>,
    pub nyquist_rate: Option<String>,
    pub task_map: Vec<TaskVerification>,
    pub manual_checks: Vec<String>,
    pub wave_tracking: Vec<WaveTracking>,
    pub raw_content: Option<String>,
    pub source_file: Option<String>,
}

// ============================================================
// GSD UAT (XX-UAT.md per phase, generated by /gsd:verify-work)
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UatTestResult {
    pub number: i32,
    pub test: String,
    pub expected: String,
    pub result: String,   // "pass" | "issue" | "pending" | "skipped"
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UatIssue {
    pub severity: String,  // "blocker" | "major" | "minor" | "cosmetic"
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GsdUatResult {
    pub id: String,
    pub project_id: String,
    pub phase_number: String,
    pub session_number: i32,
    pub status: String,
    pub tests: Vec<UatTestResult>,
    pub issues: Vec<UatIssue>,
    pub gaps: Vec<String>,
    pub diagnosis: Option<String>,
    pub raw_content: Option<String>,
    pub source_file: Option<String>,
    // computed
    pub pass_count: i32,
    pub issue_count: i32,
    pub pending_count: i32,
}
