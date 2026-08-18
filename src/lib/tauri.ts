// VCCA - Tauri API Wrapper
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

// Types
export interface Project {
  id: string;
  name: string;
  path: string;
  description: string | null;
  tech_stack: TechStack | null;
  config: Record<string, unknown> | null;
  status: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  gsd_version: string | null;
}

export interface RoadmapProgress {
  total_phases: number;
  completed_phases: number;
  total_tasks: number;
  completed_tasks: number;
  status: string;
}

export interface ProjectWithStats {
  id: string;
  name: string;
  path: string;
  description: string | null;
  tech_stack: TechStack | null;
  config: Record<string, unknown> | null;
  status: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  total_cost: number;
  roadmap_progress: RoadmapProgress | null;
  last_activity_at: string | null;
  gsd_version: string | null;
}

export interface Gsd2Health {
  budget_spent: number;
  budget_ceiling: number | null;
  active_milestone_id: string | null;
  active_milestone_title: string | null;
  active_slice_id: string | null;
  active_slice_title: string | null;
  active_task_id: string | null;
  active_task_title: string | null;
  phase: string | null;
  blocker: string | null;
  next_action: string | null;
  milestones_done: number;
  milestones_total: number;
  slices_done: number;
  slices_total: number;
  tasks_done: number;
  tasks_total: number;
  env_error_count: number;
  env_warning_count: number;
}

export interface GitInfo {
  branch: string | null;
  is_dirty: boolean;
  has_git: boolean;
}

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatusDetail {
  has_git: boolean;
  branch: string | null;
  is_dirty: boolean;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  ahead: number;
  behind: number;
  last_commit: GitCommitInfo | null;
  stash_count: number;
}

export interface GitChangedFile {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitOperationResult {
  success: boolean;
  message: string;
}

export interface GitLogEntry {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
  files_changed: number;
  insertions: number;
  deletions: number;
}

// GitHub integration types
export interface GitHubTokenStatus {
  configured: boolean;
}

export interface GitHubLabel {
  id: number | null;
  name: string;
  color: string;
  description: string | null;
}

export interface GitHubUser {
  login: string;
  avatar_url: string | null;
  html_url: string;
}

export interface GitHubRepoInfo {
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  open_issues_count: number;
  stargazers_count: number;
  forks_count: number;
  html_url: string;
  clone_url: string;
  pushed_at: string | null;
  visibility: string;
}

export interface GitHubPR {
  number: number;
  title: string;
  state: string;
  user_login: string;
  user_avatar_url: string | null;
  body: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_ref: string;
  base_ref: string;
  draft: boolean;
  mergeable: boolean | null;
  review_decision: string | null;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
  comments: number;
  review_comments: number;
}

export interface GitHubReview {
  id: number;
  user_login: string;
  state: string;
  body: string | null;
  submitted_at: string | null;
  html_url: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  user_login: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  comments: number;
  milestone_title: string | null;
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  app_name: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  html_url: string;
  tarball_url: string;
  zipball_url: string;
  assets_count: number;
}

export interface GitHubNotification {
  id: string;
  reason: string;
  unread: boolean;
  title: string;
  type_: string;
  updated_at: string;
  html_url: string | null;
}

export interface TechStack {
  framework: string | null;
  language: string | null;
  package_manager: string | null;
  database: string | null;
  test_framework: string | null;
  has_planning: boolean;
  gsd_phase_count: number | null;
  gsd_todo_count: number | null;
  gsd_has_requirements: boolean;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: string;
}

export interface ActivityEntry {
  id: string;
  project_id: string;
  execution_id: string | null;
  event_type: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Knowledge File System Types (Phase E - KN-01, KN-02)
export interface KnowledgeFileTree {
  folders: KnowledgeFolder[];
  total_files: number;
}

export interface KnowledgeFolder {
  name: string;
  display_name: string;
  files: KnowledgeFileEntry[];
}

export interface KnowledgeFileEntry {
  relative_path: string;
  display_name: string;
  folder: string;
  size_bytes: number;
}

export interface KnowledgeSearchMatch {
  file_path: string;
  display_name: string;
  line_number: number;
  line_content: string;
  context_before: string;
  context_after: string;
}

export interface Settings {
  theme: string;
  start_on_login: boolean;
  default_cost_limit: number;
  notifications_enabled: boolean;
  notify_on_complete: boolean;
  notify_on_error: boolean;
  notify_cost_threshold: number | null;
  // Theme customization (stored in DB)
  accent_color: string;
  ui_density: string;
  font_size_scale: string;
  font_family: string;
  // Startup behavior
  auto_open_last_project: boolean;
  window_state: string;
  // Notification granularity
  notify_on_phase_complete: boolean;
  notify_on_cost_warning: boolean;
  // Advanced
  debug_logging: boolean;
  // Terminal persistence
  use_tmux: boolean;
  user_mode: string;
}

// First-launch onboarding
export type OnboardingUserMode = "guided" | "expert";
export type OnboardingProvider = "anthropic" | "openai" | "github" | "openrouter";

export interface OnboardingStatus {
  completed: boolean;
  completed_at: string | null;
  user_mode: OnboardingUserMode;
  has_api_keys: boolean;
}

export interface DependencyCheck {
  name: string;
  installed: boolean;
  version: string | null;
  message: string | null;
}

export interface DependencyDetectionResult {
  checked_at: string;
  dependencies: DependencyCheck[];
}

export interface ApiKeyValidationResult {
  provider: string;
  key_name: string;
  valid: boolean;
  stored: boolean;
  message: string;
}

export interface ProjectDocs {
  description: string | null;
  goal: string | null;
  source: string;
}

// Markdown Scanning Types
export interface MarkdownScanResult {
  total_files: number;
  total_size_bytes: number;
  folders: MarkdownFolderSummary[];
}

export interface MarkdownFolderSummary {
  relative_path: string;
  display_name: string;
  file_count: number;
}

export interface MarkdownIndexProgress {
  project_id: string;
  indexed: number;
  total: number;
  current_file: string;
}

interface ImportResult {
  project: Project;
  docs: ProjectDocs | null;
  /** PTY session ID if a conversion/generation process was started */
  pty_session_id: string | null;
  /** Import mode: "existing" (has .planning), "gsd" (converting from .planning), "bare" (generating new) */
  import_mode: string;
  /** Markdown scan results from recursive discovery during import */
  markdown_scan: MarkdownScanResult | null;
}

interface CreateProjectResult {
  project: Project;
  pty_session_id: string;
  template: string | null;
  discovery_mode: string;
  creation_mode: string;
}

// PTY Types
export interface CreatePtyOptions {
  workingDirectory: string;
  command?: string;
  cols: number;
  rows: number;
  sessionName?: string;
}

export interface CreatePtyResult {
  sessionId: string;
  tmuxName: string | null;
}

export interface TmuxSessionInfo {
  name: string;
  working_directory: string;
  created_at: string;
}

export interface PtyOutputEvent {
  session_id: string;
  data: number[];
}

export interface PtyExitEvent {
  session_id: string;
  exit_code: number | null;
}

// Global Search Types
export interface GlobalSearchResults {
  projects: ProjectSearchResult[];
  phases: PhaseSearchResult[];
  decisions: DecisionSearchResult[];
  knowledge: KnowledgeSearchResultItem[];
}

export interface ProjectSearchResult {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

export interface PhaseSearchResult {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  project_id: string;
  project_name: string;
}

export interface DecisionSearchResult {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  project_id: string;
  project_name: string;
}

export interface KnowledgeSearchResultItem {
  id: string;
  title: string;
  category: string;
  project_id: string;
  project_name: string;
}

// Project Scanner types
export interface ScannerCategory {
  name: string;
  grade: string;
  summary: string;
  score: number | null;
  issues: number | null;
  priority: string | null;
  status: string | null;
}

export interface ScannerReport {
  name: string;
  relative_path: string;
  description: string;
}

export interface ScannerSummary {
  available: boolean;
  overall_grade: string | null;
  scan_date: string | null;
  categories: ScannerCategory[];
  reports: ScannerReport[];
  total_gaps: number | null;
  total_recommendations: number | null;
  overall_score: number | null;
  analysis_mode: string | null;
  project_phase: string | null;
  high_priority_actions: string[];
  source: string | null;
}

// API Functions

// Projects
export const listProjects = () => invoke<Project[]>("list_projects");
export const getProject = (id: string) => invoke<Project>("get_project", { id });
export const importProject = (path: string) => invoke<Project>("import_project", { path });
export const updateProject = (id: string, updates: ProjectUpdate) =>
  invoke<Project>("update_project", { id, updates });
export const deleteProject = (id: string) => invoke<void>("delete_project", { id });
export const getProjectsWithStats = () => invoke<ProjectWithStats[]>("get_projects_with_stats");
export const getGitInfo = (path: string) => invoke<GitInfo>("get_git_info", { path });
export const getGitStatus = (projectPath: string) =>
  invoke<GitStatusDetail>("get_git_status", { projectPath });
export const gitPush = (projectPath: string) =>
  invoke<GitOperationResult>("git_push", { projectPath });
export const gitPull = (projectPath: string) =>
  invoke<GitOperationResult>("git_pull", { projectPath });
export const gitFetch = (projectPath: string) =>
  invoke<GitOperationResult>("git_fetch", { projectPath });
export const gitStageAll = (projectPath: string) =>
  invoke<GitOperationResult>("git_stage_all", { projectPath });
export const gitCommit = (projectPath: string, message: string) =>
  invoke<GitOperationResult>("git_commit", { projectPath, message });
export const gitStashSave = (projectPath: string) =>
  invoke<GitOperationResult>("git_stash_save", { projectPath });
export const gitStashPop = (projectPath: string) =>
  invoke<GitOperationResult>("git_stash_pop", { projectPath });
export const getGitChangedFiles = (projectPath: string) =>
  invoke<GitChangedFile[]>("git_changed_files", { projectPath });
export const getGitLog = (projectPath: string, limit?: number) =>
  invoke<GitLogEntry[]>("git_log", { projectPath, limit });
export const gitStageFile = (projectPath: string, filePath: string) =>
  invoke<GitOperationResult>("git_stage_file", { projectPath, filePath });
export const gitUnstageFile = (projectPath: string, filePath: string) =>
  invoke<GitOperationResult>("git_unstage_file", { projectPath, filePath });
export const gitDiscardFile = (projectPath: string, filePath: string) =>
  invoke<GitOperationResult>("git_discard_file", { projectPath, filePath });
export const getGitRemoteUrl = (projectPath: string) =>
  invoke<string>("git_remote_url", { projectPath });
export const getGitBranches = (projectPath: string) =>
  invoke<string[]>("git_branches", { projectPath });
export const getGitTags = (projectPath: string) =>
  invoke<string[]>("git_tags", { projectPath });
export const getScannerSummary = (path: string) =>
  invoke<ScannerSummary>("get_scanner_summary", { path });
export const toggleFavorite = (projectId: string) => invoke<boolean>("toggle_favorite", { projectId });

// GitHub
export const githubGetTokenStatus = () =>
  invoke<GitHubTokenStatus>("github_get_token_status");
export const githubGetRepoInfo = (projectPath: string) =>
  invoke<GitHubRepoInfo>("github_get_repo_info", { projectPath });
export const githubListPrs = (projectPath: string, state?: string) =>
  invoke<GitHubPR[]>("github_list_prs", { projectPath, state });
export const githubCreatePr = (
  projectPath: string,
  title: string,
  body: string,
  head: string,
  base: string,
  draft: boolean,
) =>
  invoke<GitHubPR>("github_create_pr", { projectPath, title, body, head, base, draft });
export const githubGetPrReviews = (projectPath: string, prNumber: number) =>
  invoke<GitHubReview[]>("github_get_pr_reviews", { projectPath, prNumber });
export const githubListIssues = (projectPath: string, state?: string, labels?: string) =>
  invoke<GitHubIssue[]>("github_list_issues", { projectPath, state, labels });
export const githubCreateIssue = (
  projectPath: string,
  title: string,
  body: string,
  labels: string[],
  assignees: string[],
) =>
  invoke<GitHubIssue>("github_create_issue", { projectPath, title, body, labels, assignees });
export const githubListCheckRuns = (projectPath: string, gitRef: string) =>
  invoke<GitHubCheckRun[]>("github_list_check_runs", { projectPath, gitRef });
export const githubListReleases = (projectPath: string) =>
  invoke<GitHubRelease[]>("github_list_releases", { projectPath });
export const githubListRepoNotifications = (projectPath: string) =>
  invoke<GitHubNotification[]>("github_list_repo_notifications", { projectPath });
export const githubImportGhToken = () =>
  invoke<string>("github_import_gh_token");
export const githubSaveToken = (token: string) =>
  invoke<void>("github_save_token", { token });
export const githubRemoveToken = () =>
  invoke<void>("github_remove_token");

// File System
export const detectTechStack = (path: string) => invoke<TechStack>("detect_tech_stack", { path });
export const readProjectFile = (path: string, filename: string) =>
  invoke<string>("read_project_file", { path, filename });
export const readProjectDocs = (path: string) => invoke<ProjectDocs | null>("read_project_docs", { path });
export const pickFolder = () => invoke<string | null>("pick_folder");

// Enhanced Import
export const importProjectEnhanced = (path: string, autoSyncRoadmap: boolean, ptySessionId?: string, skipConversion?: boolean) =>
  invoke<ImportResult>("import_project_enhanced", { path, autoSyncRoadmap, ptySessionId, skipConversion });

// Check Project Path Availability
export const checkProjectPath = (parentPath: string, projectName: string) =>
  invoke<boolean>("check_project_path", { parentPath, projectName });

// Create New Project
export const createNewProject = (
  parentPath: string,
  projectName: string,
  template?: string,
  discoveryMode?: string,
  ptySessionId?: string
) =>
  invoke<CreateProjectResult>("create_new_project", {
    parentPath,
    projectName,
    template,
    discoveryMode,
    ptySessionId,
  });

export const finalizeProjectCreation = (projectId: string, success: boolean) =>
  invoke<Project>("finalize_project_creation", { projectId, success });

// Activity
export const getActivityLog = (projectId?: string, limit?: number) =>
  invoke<ActivityEntry[]>("get_activity_log", { projectId, limit });

// Activity Event Listeners
export const onActivityLogged = (
  callback: (event: ActivityEntry) => void,
): Promise<UnlistenFn> =>
  listen<ActivityEntry>("activity:logged", (e) => callback(e.payload));

// ExecutionProgressEvent - REMOVED (AP-ONLY)

// Knowledge File System
export const listKnowledgeFiles = (path: string) =>
  invoke<KnowledgeFileTree>("list_knowledge_files", { path });
export const listCodeFiles = (path: string) =>
  invoke<KnowledgeFileTree>("list_code_files", { path });
export const searchKnowledgeFiles = (path: string, query: string) =>
  invoke<KnowledgeSearchMatch[]>("search_knowledge_files", { path, query });
export const writeProjectFile = (path: string, filename: string, content: string) =>
  invoke<void>("write_project_file", { path, filename, content });
export const deleteProjectFile = (path: string, filename: string) =>
  invoke<boolean>("delete_project_file", { path, filename });

// Markdown Indexing
export const indexProjectMarkdown = (projectId: string, projectPath: string) =>
  invoke<number>("index_project_markdown", { projectId, projectPath });

export const onMarkdownIndexProgress = (
  callback: (event: MarkdownIndexProgress) => void,
): Promise<UnlistenFn> =>
  listen<MarkdownIndexProgress>("knowledge:index-progress", (e) => callback(e.payload));

// Settings
export const getSettings = () => invoke<Settings>("get_settings");
export const updateSettings = (settings: Settings) =>
  invoke<Settings>("update_settings", { settings });

// First-launch onboarding
export const onboardingGetStatus = () =>
  invoke<OnboardingStatus>("onboarding_get_status");

export const onboardingDetectDependencies = () =>
  invoke<DependencyDetectionResult>("onboarding_detect_dependencies");

export const onboardingValidateAndStoreApiKey = (
  provider: OnboardingProvider,
  apiKey: string,
) =>
  invoke<ApiKeyValidationResult>("onboarding_validate_and_store_api_key", {
    provider,
    apiKey,
  });

export const onboardingMarkComplete = (userMode: OnboardingUserMode) =>
  invoke<OnboardingStatus>("onboarding_mark_complete", { userMode });

// Data Management
export interface ExportOptions {
  format: "json" | "csv";
  include_projects?: boolean;
  include_activity?: boolean;
}
export const exportData = (options: ExportOptions) =>
  invoke<string>("export_data", { options });
export const clearAllData = () => invoke<void>("clear_all_data");
export const clearSelectedData = (categories: string[]) =>
  invoke<void>("clear_selected_data", { categories });

// Settings Management
export const resetSettings = () => invoke<Settings>("reset_settings");
export const importSettings = () => invoke<Settings>("import_settings");

// Event Listeners - Execution events REMOVED (AP-ONLY)

// PTY API Functions
export const ptyCreate = (options: CreatePtyOptions) =>
  invoke<CreatePtyResult>("pty_create", { input: options });

export const ptyAttach = (
  sessionId: string,
  tmuxName: string,
  workingDir: string,
  cols: number,
  rows: number,
) => invoke<boolean>("pty_attach", { sessionId, tmuxName, workingDir, cols, rows });

export const ptyCheckTmux = () => invoke<string | null>("pty_check_tmux");

export const ptyListTmux = () => invoke<TmuxSessionInfo[]>("pty_list_tmux");

export const ptyWrite = (sessionId: string, data: Uint8Array) =>
  invoke<void>("pty_write", { sessionId, data: Array.from(data) });

export const ptyResize = (sessionId: string, cols: number, rows: number) =>
  invoke<void>("pty_resize", { sessionId, cols, rows });

export const ptyClose = (sessionId: string) =>
  invoke<number | null>("pty_close", { sessionId });

export const ptyDetach = (sessionId: string) =>
  invoke<void>("pty_detach", { sessionId });

export const ptyIsActive = (sessionId: string) =>
  invoke<boolean>("pty_is_active", { sessionId });

// PTY Event Listeners
export const onPtyOutput = (sessionId: string, callback: (event: PtyOutputEvent) => void): Promise<UnlistenFn> =>
  listen<PtyOutputEvent>(`pty:output:${sessionId}`, (e) => callback(e.payload));

export const onPtyExit = (sessionId: string, callback: (event: PtyExitEvent) => void): Promise<UnlistenFn> =>
  listen<PtyExitEvent>(`pty:exit:${sessionId}`, (e) => callback(e.payload));

// Active process info for close warnings
export interface ActiveProcessInfo {
  can_close: boolean;
  active_terminals: number;
}

// App lifecycle commands
export const canSafelyClose = () =>
  invoke<ActiveProcessInfo>("can_safely_close");

export const forceCloseAll = () =>
  invoke<void>("force_close_all");

// App Log Types
export interface AppLogEntry {
  id: string;
  level: string;
  target: string | null;
  message: string;
  source: string;
  project_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AppLogFilters {
  level?: string;
  source?: string;
  target?: string;
  project_id?: string;
  search?: string;
  limit?: number;
  before?: string;
}

export interface AppLogStats {
  total: number;
  by_level: { level: string; count: number }[];
  by_source: { source: string; count: number }[];
}

export interface AppLogEvent {
  id: string;
  level: string;
  target: string | null;
  message: string;
  source: string;
  project_id: string | null;
  created_at: string;
}

// App Log API Functions
export const getAppLogs = (filters: AppLogFilters) =>
  invoke<AppLogEntry[]>("get_app_logs", { filters });
export const getAppLogStats = () => invoke<AppLogStats>("get_app_log_stats");
export const getLogLevels = () => invoke<string[]>("get_log_levels");
export const clearAppLogs = (before?: string, level?: string) =>
  invoke<number>("clear_app_logs", { before, level });
export const logFrontendError = (error: string, projectId?: string) =>
  invoke<AppLogEntry>("log_frontend_error", { error, projectId });
export const logFrontendEvent = (
  level: string,
  message: string,
  target?: string,
  projectId?: string,
  metadata?: Record<string, unknown>
) =>
  invoke<AppLogEntry>("log_frontend_event", { level, message, target, projectId, metadata });

// App Log Event Listener
export const onLogNew = (callback: (event: AppLogEvent) => void): Promise<UnlistenFn> =>
  listen<AppLogEvent>("log:new", (e) => callback(e.payload));

// Global Search
export const globalSearch = (query: string, limit?: number) =>
  invoke<GlobalSearchResults>("global_search", { query, limit });

// ============================================================
// Terminal Power Features (Phase C)
// ============================================================

// Command History Types
export interface CommandHistoryEntry {
  id: string;
  project_id: string;
  command: string;
  source: string;
  created_at: string;
}

// Snippet Types
export interface Snippet {
  id: string;
  project_id: string | null;
  label: string;
  command: string;
  description: string | null;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface SnippetInput {
  label: string;
  command: string;
  description?: string;
  category?: string;
}

// Script Favorites Types
export interface ScriptFavorite {
  id: string;
  project_id: string;
  script_id: string;
  order_index: number;
  created_at: string;
}

// Auto-command Types
export interface AutoCommand {
  id: string;
  project_id: string;
  label: string;
  command: string;
  hook_type: string;
  enabled: boolean;
  order_index: number;
  preset: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoCommandInput {
  label: string;
  command: string;
  hook_type?: string;
  preset?: string;
}

export interface AutoCommandPreset {
  id: string;
  label: string;
  command: string;
  hook_type: string;
}

// Command History API
export const getCommandHistory = (projectId: string, limit?: number) =>
  invoke<CommandHistoryEntry[]>("get_command_history", { projectId, limit });
export const addCommandHistory = (projectId: string, command: string, source?: string) =>
  invoke<CommandHistoryEntry>("add_command_history", { projectId, command, source });
export const clearCommandHistory = (projectId: string) =>
  invoke<number>("clear_command_history", { projectId });

// Script Favorites API
export const getScriptFavorites = (projectId: string) =>
  invoke<ScriptFavorite[]>("get_script_favorites", { projectId });
export const toggleScriptFavorite = (projectId: string, scriptId: string) =>
  invoke<boolean>("toggle_script_favorite", { projectId, scriptId });
export const reorderScriptFavorites = (projectId: string, scriptIds: string[]) =>
  invoke<void>("reorder_script_favorites", { projectId, scriptIds });

// Snippets API
export const listSnippets = (projectId?: string) =>
  invoke<Snippet[]>("list_snippets", { projectId });
export const createSnippet = (projectId: string | null, input: SnippetInput) =>
  invoke<Snippet>("create_snippet", { projectId, input });
export const updateSnippet = (id: string, input: SnippetInput) =>
  invoke<Snippet>("update_snippet", { id, input });
export const deleteSnippet = (id: string) =>
  invoke<boolean>("delete_snippet", { id });

// Auto-commands API
export const listAutoCommands = (projectId: string) =>
  invoke<AutoCommand[]>("list_auto_commands", { projectId });
export const createAutoCommand = (projectId: string, input: AutoCommandInput) =>
  invoke<AutoCommand>("create_auto_command", { projectId, input });
export const updateAutoCommand = (id: string, input: AutoCommandInput) =>
  invoke<AutoCommand>("update_auto_command", { id, input });
export const deleteAutoCommand = (id: string) =>
  invoke<boolean>("delete_auto_command", { id });
export const toggleAutoCommand = (id: string) =>
  invoke<AutoCommand>("toggle_auto_command", { id });
export const getAutoCommandPresets = () =>
  invoke<AutoCommandPreset[]>("get_auto_command_presets");

// ============================================================
// Notifications (CC-03)
// ============================================================

export interface Notification {
  id: string;
  project_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface CreateNotificationInput {
  project_id?: string | null;
  notification_type: string;
  title: string;
  message: string;
  link?: string | null;
}

export const getNotifications = (limit?: number, unreadOnly?: boolean) =>
  invoke<Notification[]>('get_notifications', { limit, unreadOnly });
export const getUnreadNotificationCount = () =>
  invoke<number>('get_unread_notification_count');
export const createNotification = (input: CreateNotificationInput) =>
  invoke<Notification>('create_notification', { input });
export const markNotificationRead = (notificationId: string) =>
  invoke<Notification>('mark_notification_read', { notificationId });
export const markAllNotificationsRead = () =>
  invoke<number>('mark_all_notifications_read');
export const clearNotifications = () =>
  invoke<number>('clear_notifications');

export const onNotificationNew = (
  callback: (event: Notification) => void,
): Promise<UnlistenFn> =>
  listen<Notification>('notification:new', (e) => callback(e.payload));

// ============================================================
// Environment Info (SH-04)
// ============================================================

export interface EnvironmentInfo {
  git_branch: string | null;
  node_version: string | null;
  python_version: string | null;
  rust_version: string | null;
  working_directory: string;
}

export const getEnvironmentInfo = (workingDir: string) =>
  invoke<EnvironmentInfo>('get_environment_info', { workingDir });

// ============================================================
// Terminal Session Persistence (SH-03)
// ============================================================

export interface TerminalSession {
  id: string;
  project_id: string;
  tab_name: string;
  tab_type: string;
  working_directory: string;
  sort_order: number;
  tmux_session: string | null;
  created_at: string;
}

export interface SaveTerminalSessionInput {
  project_id: string;
  tab_name: string;
  tab_type: string;
  working_directory: string;
  sort_order: number;
  tmux_session?: string;
}

export const saveTerminalSessions = (sessions: SaveTerminalSessionInput[]) =>
  invoke<number>('save_terminal_sessions', { sessions });
export const restoreTerminalSessions = () =>
  invoke<TerminalSession[]>('restore_terminal_sessions');

// ============================================================
// Phase G Types
// ============================================================

// ExecutionBookmark - REMOVED (AP-ONLY)

export interface KnowledgeBookmark {
  id: string;
  project_id: string;
  file_path: string;
  heading: string;
  heading_level: number;
  note: string | null;
  created_at: string;
}

export interface DependencyStatus {
  package_manager: string;
  outdated_count: number;
  vulnerable_count: number;
  details: Record<string, unknown> | null;
  checked_at: string;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  file_path: string;
  node_type: string;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  label: string | null;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

// ============================================================
// Phase G API Functions
// ============================================================

// Knowledge Bookmarks
export const createKnowledgeBookmark = (projectId: string, filePath: string, heading: string, headingLevel: number, note?: string) =>
  invoke<KnowledgeBookmark>("create_knowledge_bookmark", { projectId, filePath, heading, headingLevel, note });
export const listKnowledgeBookmarks = (projectId: string) =>
  invoke<KnowledgeBookmark[]>("list_knowledge_bookmarks", { projectId });
export const deleteKnowledgeBookmark = (bookmarkId: string) =>
  invoke<boolean>("delete_knowledge_bookmark", { bookmarkId });

// Dependency Status
export const getDependencyStatus = (projectId: string, projectPath: string) =>
  invoke<DependencyStatus>("get_dependency_status", { projectId, projectPath });
export const invalidateDependencyCache = (projectId: string) =>
  invoke<boolean>("invalidate_dependency_cache", { projectId });

// Knowledge Graph
export const buildKnowledgeGraph = (projectPath: string) =>
  invoke<KnowledgeGraph>("build_knowledge_graph", { projectPath });

// File Watcher
export const watchProjectFiles = (projectPath: string) =>
  invoke<boolean>("watch_project_files", { projectPath });
export const unwatchProjectFiles = (projectPath: string) =>
  invoke<boolean>("unwatch_project_files", { projectPath });

// ============================================================
// GSD (Get Stuff Done) Integration
// ============================================================

export interface GsdProjectInfo {
  vision: string | null;
  milestone: string | null;
  version: string | null;
  core_value: string | null;
  current_focus: string | null;
  raw_content: string;
}

export interface GsdCurrentPosition {
  milestone: string | null;
  phase: string | null;
  plan: string | null;
  status: string | null;
  last_activity: string | null;
  progress: string | null;
}

export interface GsdState {
  current_position: GsdCurrentPosition | null;
  decisions: string[];
  pending_todos: string[];
  session_continuity: string | null;
  velocity: GsdVelocity | null;
  blockers: string[];
}

export interface GsdConfig {
  workflow_mode: string | null;
  model_profile: string | null;
  raw_json: Record<string, unknown> | null;
  depth: string | null;
  parallelization: boolean | null;
  commit_docs: boolean | null;
  workflow_research: boolean | null;
  workflow_inspection: boolean | null;
  workflow_plan_verification: boolean | null;
}

export interface GsdRequirement {
  req_id: string;
  description: string;
  category: string | null;
  priority: string | null;
  status: string | null;
  phase: string | null;
}

export interface GsdMilestone {
  name: string;
  version: string | null;
  phase_start: number | null;
  phase_end: number | null;
  status: string | null;
  completed_at: string | null;
}

export interface GsdTodo {
  id: string;
  title: string;
  description: string | null;
  area: string | null;
  phase: string | null;
  priority: string | null;
  is_blocker: boolean;
  files: string[] | null;
  status: string;
  source_file: string | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface GsdTodoInput {
  title: string;
  description?: string | null;
  area?: string | null;
  phase?: string | null;
  priority?: string | null;
  is_blocker?: boolean;
  files?: string[] | null;
}

export interface GsdDebugSession {
  id: string;
  title: string;
  error_type: string | null;
  status: string;
  summary: string | null;
  resolution: string | null;
  source_file: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

export interface GsdResearchDoc {
  filename: string;
  title: string | null;
  category: string | null;
  content: string;
  source_file: string;
}

export interface GsdVerification {
  phase_number: number;
  checks_total: number;
  checks_passed: number;
  result: string | null;
  gaps: string[];
  raw_content: string;
}

export interface GsdPhaseContext {
  decisions: string[];
  deferred_ideas: string[];
  raw_content: string;
}

export interface GsdSyncResult {
  todos_synced: number;
  milestones_synced: number;
  requirements_synced: number;
  verifications_synced: number;
  plans_synced: number;
  summaries_synced: number;
  phase_research_synced: number;
  uat_synced: number;
}

export interface GsdPlan {
  phase_number: number;
  plan_number: number;
  plan_type: string | null;
  group_number: number | null;
  autonomous: boolean;
  objective: string | null;
  task_count: number;
  tasks: GsdPlanTask[];
  files_modified: string[];
  source_file: string;
}

export interface GsdPlanTask {
  name: string;
  task_type: string | null;
  files: string[];
}

export interface GsdSummary {
  phase_number: number;
  plan_number: number;
  subsystem: string | null;
  tags: string[];
  duration: string | null;
  completed: string | null;
  accomplishments: string[];
  decisions: GsdSummaryDecision[];
  files_created: string[];
  files_modified: string[];
  deviations: string | null;
  self_check: string | null;
  source_file: string;
}

export interface GsdSummaryDecision {
  decision: string;
  rationale: string | null;
}

export interface GsdPhaseResearch {
  phase_number: number;
  domain: string | null;
  confidence: string | null;
  summary: string | null;
  anti_patterns: string[];
  pitfalls: string[];
  raw_content: string;
  source_file: string;
}

// ============================================================
// Phase 12 Artifact Reader Interfaces (ARTF-01..04)
// ============================================================

/** One markdown artifact for a phase (SPEC, AI-SPEC, UI-SPEC, SECURITY, VALIDATION, REVIEW). */
export interface GsdPhaseDoc {
  doc_type: string;
  present: boolean;
  raw_content: string | null;
  source_file: string | null;
}

/** Wraps a phase's grouped spec/design docs (SPEC + AI-SPEC + UI-SPEC) in one round-trip (ARTF-01). */
export interface GsdPhaseDocSet {
  phase_number: number;
  docs: GsdPhaseDoc[];
}

/** A project-level process doc (discussion-log, retrospective, discovery, etc.) (ARTF-04). */
export interface GsdProcessDoc {
  doc_type: string;
  present: boolean;
  raw_content: string | null;
  source_file: string | null;
}

export interface GsdVelocity {
  total_plans: number | null;
  avg_duration: string | null;
  total_time: string | null;
  by_phase: GsdPhaseVelocity[];
}

export interface GsdPhaseVelocity {
  phase: string;
  plans: number;
  duration: string;
  avg_per_plan: string;
}

export interface GsdMilestoneAudit {
  version: string | null;
  status: string | null;
  req_score: string | null;
  phase_score: string | null;
  integration_score: string | null;
  gaps: string[];
  tech_debt: string[];
  raw_content: string;
  source_file: string;
}

// ============================================================
// GSD Validation (VALIDATION.md per phase)
// ============================================================

export interface TaskVerification {
  task_id: string;
  requirement: string | null;
  test_type: string; // "automated" | "manual"
  status: string; // "pending" | "pass" | "fail"
}

export interface WaveTracking {
  wave_number: number;
  task_ids: string[];
  status: string | null;
  tests_passed: string | null;
  issues: string | null;
}

export interface GsdValidation {
  id: string;
  project_id: string;
  phase_number: string;
  test_framework: string | null;
  quick_run_cmd: string | null;
  full_run_cmd: string | null;
  nyquist_rate: string | null;
  task_map: TaskVerification[];
  manual_checks: string[];
  wave_tracking: WaveTracking[];
  raw_content: string | null;
  source_file: string | null;
}

// GSD invoke wrappers
export const gsdGetProjectInfo = (projectId: string) =>
  invoke<GsdProjectInfo>("gsd_get_project_info", { projectId });
export const gsdGetState = (projectId: string) =>
  invoke<GsdState>("gsd_get_state", { projectId });
export const gsdGetConfig = (projectId: string) =>
  invoke<GsdConfig>("gsd_get_config", { projectId });
export const gsdListRequirements = (projectId: string) =>
  invoke<GsdRequirement[]>("gsd_list_requirements", { projectId });
export const gsdListMilestones = (projectId: string) =>
  invoke<GsdMilestone[]>("gsd_list_milestones", { projectId });
export const gsdListTodos = (projectId: string, statusFilter?: string) =>
  invoke<GsdTodo[]>("gsd_list_todos", { projectId, statusFilter });
export const gsdCreateTodo = (projectId: string, input: GsdTodoInput) =>
  invoke<GsdTodo>("gsd_create_todo", { projectId, input });
export const gsdUpdateTodo = (projectId: string, todoId: string, input: GsdTodoInput) =>
  invoke<GsdTodo>("gsd_update_todo", { projectId, todoId, input });
export const gsdCompleteTodo = (projectId: string, todoId: string) =>
  invoke<GsdTodo>("gsd_complete_todo", { projectId, todoId });
export const gsdDeleteTodo = (projectId: string, todoId: string) =>
  invoke<void>("gsd_delete_todo", { projectId, todoId });
export const gsdListDebugSessions = (projectId: string, includeResolved?: boolean) =>
  invoke<GsdDebugSession[]>("gsd_list_debug_sessions", { projectId, includeResolved });
export const gsdGetDebugSession = (projectId: string, sessionId: string) =>
  invoke<GsdDebugSession>("gsd_get_debug_session", { projectId, sessionId });
export const gsdListResearch = (projectId: string) =>
  invoke<GsdResearchDoc[]>("gsd_list_research", { projectId });
export const gsdGetVerification = (projectId: string, phaseNumber: number) =>
  invoke<GsdVerification>("gsd_get_verification", { projectId, phaseNumber });
export const gsdGetPhaseContext = (projectId: string, phaseNumber: number) =>
  invoke<GsdPhaseContext>("gsd_get_phase_context", { projectId, phaseNumber });
export const gsdListPlans = (projectId: string) =>
  invoke<GsdPlan[]>("gsd_list_plans", { projectId });
export const gsdGetPhasePlans = (projectId: string, phaseNumber: number) =>
  invoke<GsdPlan[]>("gsd_get_phase_plans", { projectId, phaseNumber });
export const gsdListSummaries = (projectId: string) =>
  invoke<GsdSummary[]>("gsd_list_summaries", { projectId });
export const gsdGetPhaseSummaries = (projectId: string, phaseNumber: number) =>
  invoke<GsdSummary[]>("gsd_get_phase_summaries", { projectId, phaseNumber });
export const gsdListPhaseResearch = (projectId: string) =>
  invoke<GsdPhaseResearch[]>("gsd_list_phase_research", { projectId });
export const gsdGetPhaseResearch = (projectId: string, phaseNumber: number) =>
  invoke<GsdPhaseResearch>("gsd_get_phase_research", { projectId, phaseNumber });
// Phase 12 artifact reader wrappers (ARTF-01..04)
export const gsdGetPhaseSpec = (projectId: string, phaseNumber: number) =>
  invoke<GsdPhaseDocSet>("gsd_get_phase_spec", { projectId, phaseNumber });
export const gsdGetPhaseSecurity = (projectId: string, phaseNumber: number) =>
  invoke<GsdPhaseDoc>("gsd_get_phase_security", { projectId, phaseNumber });
export const gsdGetPhaseValidationDoc = (projectId: string, phaseNumber: number) =>
  invoke<GsdPhaseDoc>("gsd_get_phase_validation_doc", { projectId, phaseNumber });
export const gsdGetPhaseReview = (projectId: string, phaseNumber: number) =>
  invoke<GsdPhaseDoc>("gsd_get_phase_review", { projectId, phaseNumber });
export const gsdGetCodebaseDocs = (projectId: string) =>
  invoke<GsdResearchDoc[]>("gsd_get_codebase_docs", { projectId });
export const gsdGetProcessDocs = (projectId: string) =>
  invoke<GsdProcessDoc[]>("gsd_get_process_docs", { projectId });

export const gsdListMilestoneAudits = (projectId: string) =>
  invoke<GsdMilestoneAudit[]>("gsd_list_milestone_audits", { projectId });
export const gsdSyncProject = (projectId: string) =>
  invoke<GsdSyncResult>("gsd_sync_project", { projectId });
export const gsdListValidations = (projectId: string): Promise<GsdValidation[]> =>
  invoke('gsd_list_validations', { projectId });
export const gsdGetValidationByPhase = (
  projectId: string,
  phaseNumber: string,
): Promise<GsdValidation | null> =>
  invoke('gsd_get_validation_by_phase', { projectId, phaseNumber });

export interface GsdTodoWithProject {
  id: string;
  title: string;
  description: string | null;
  area: string | null;
  phase: string | null;
  priority: string | null;
  is_blocker: boolean;
  files: string[] | null;
  status: string;
  source_file: string | null;
  created_at: string | null;
  completed_at: string | null;
  project_id: string;
  project_name: string;
}

export const gsdListAllTodos = (): Promise<GsdTodoWithProject[]> =>
  invoke('gsd_list_all_todos');

// ============================================================
// GSD Roadmap Progress
// ============================================================

export interface GsdRoadmapPhaseProgress {
  name: string;
  number: number | null;
  total: number;
  completed: number;
  percent: number;
  status: 'complete' | 'in_progress' | 'pending';
}

export interface GsdRoadmapProgress {
  phases: GsdRoadmapPhaseProgress[];
  total_tasks: number;
  completed_tasks: number;
  percent: number;
  current_phase: string | null;
}

export const gsdGetRoadmapProgress = (projectId: string): Promise<GsdRoadmapProgress | null> =>
  invoke('gsd_get_roadmap_progress', { projectId });

// ============================================================
// Secrets / OS Keychain (Phase 3.4)
// ============================================================

/** Default keychain service name */
export const KEYCHAIN_SERVICE = "net.fluxlabs.vcca";

/** Store a secret in the OS keychain */
export const setSecret = (service: string, key: string, value: string) =>
  invoke<void>("set_secret", { service, key, value });

/** Retrieve a secret from the OS keychain (returns null if not found) */
export const getSecret = (service: string, key: string) =>
  invoke<string | null>("get_secret", { service, key });

/** Delete a secret from the OS keychain */
export const deleteSecret = (service: string, key: string) =>
  invoke<void>("delete_secret", { service, key });

/** List all stored secret key names (not values) */
export const listSecretKeys = (service: string) =>
  invoke<string[]>("list_secret_keys", { service });

/** Get well-known/predefined secret key names */
export const getPredefinedSecretKeys = () =>
  invoke<string[]>("get_predefined_secret_keys");

/** Check if a secret exists without retrieving its value */
export const hasSecret = (service: string, key: string) =>
  invoke<boolean>("has_secret", { service, key });

// ============================================================
// GSD UAT (XX-UAT.md per phase, generated by /gsd:verify-work)
// ============================================================

export interface UatTestResult {
  number: number;
  test: string;
  expected: string;
  result: string; // "pass" | "issue" | "pending" | "skipped"
  notes: string | null;
}

export interface UatIssue {
  severity: string; // "blocker" | "major" | "minor" | "cosmetic"
  description: string;
}

export interface GsdUatResult {
  id: string;
  project_id: string;
  phase_number: string;
  session_number: number;
  status: string; // "testing" | "complete" | "diagnosed"
  tests: UatTestResult[];
  issues: UatIssue[];
  gaps: string[];
  diagnosis: string | null;
  raw_content: string | null;
  source_file: string | null;
  // computed
  pass_count: number;
  issue_count: number;
  pending_count: number;
}

export const gsdListUatResults = (projectId: string) =>
  invoke<GsdUatResult[]>('gsd_list_uat_results', { projectId });

export const gsdGetUatByPhase = (projectId: string, phaseNumber: string) =>
  invoke<GsdUatResult | null>('gsd_get_uat_by_phase', { projectId, phaseNumber });

// GSD-2
export const gsd2GetHealth = (projectId: string) =>
  invoke<Gsd2Health>('gsd2_get_health', { projectId });

export interface Gsd2ModelEntry {
  provider: string;
  id: string;
  name: string;
}

export interface Gsd2PlanPreviewSlice {
  id: string;
  title: string;
  goal: string;
  risk: string | null;
  depends_on: string[];
}

export interface Gsd2PlanPreviewMilestone {
  title: string;
  summary: string;
  slices: Gsd2PlanPreviewSlice[];
}

export interface Gsd2PlanPreview {
  intent: string;
  milestone: Gsd2PlanPreviewMilestone;
}

export const gsd2ListModels = (search?: string) =>
  invoke<Gsd2ModelEntry[]>('gsd2_list_models', { search });

export const gsd2GeneratePlanPreview = (intent: string) =>
  invoke<Gsd2PlanPreview>('gsd2_generate_plan_preview', { intent });

export interface WorktreeInfo {
  name: string;
  branch: string;
  path: string;
  exists: boolean;
  added_count: number;
  modified_count: number;
  removed_count: number;
}

export interface WorktreeDiff {
  added: string[];
  modified: string[];
  removed: string[];
  added_count: number;
  modified_count: number;
  removed_count: number;
}

export const gsd2ListWorktrees = (projectId: string) =>
  invoke<WorktreeInfo[]>('gsd2_list_worktrees', { projectId });

export const gsd2RemoveWorktree = (projectId: string, worktreeName: string) =>
  invoke<void>('gsd2_remove_worktree', { projectId, worktreeName });

export const gsd2GetWorktreeDiff = (projectId: string, worktreeName: string) =>
  invoke<WorktreeDiff>('gsd2_get_worktree_diff', { projectId, worktreeName });

// Headless session types (Phase 4)
export interface HeadlessSnapshot {
  state: string;
  next: string | null;
  cost: number;
}

// Visualizer types (Phase 4 + expanded VisualizerData2 for R085)

// Backward-compatible node types (used by gsd2-visualizer-tab.tsx)
export interface VisualizerNode {
  id: string;
  title: string;
  status: 'done' | 'active' | 'pending';
  children: VisualizerNode[];
}

export interface CostByKey {
  key: string;
  cost: number;
}

export interface TimelineEntry {
  id: string;
  title: string;
  entry_type: string;
  completed_at: string | null;
  cost: number;
}

// Rich task node
export interface VisualizerTask2 {
  id: string;
  title: string;
  done: boolean;
  status: 'done' | 'active' | 'pending';
  estimate: string | null;
  on_critical_path: boolean;
  slack: number;
}

// Rich slice node
export interface SliceVerification2 {
  slice_id: string;
  verification_text: string;
}

export interface FileModified2 {
  path: string;
  description: string;
}

export interface ChangelogEntry2 {
  slice_id: string;
  one_liner: string;
  completed_at: string | null;
  files_modified: FileModified2[];
}

export interface VisualizerSlice2 {
  id: string;
  title: string;
  done: boolean;
  status: 'done' | 'active' | 'pending';
  risk: string | null;
  dependencies: string[];
  tasks: VisualizerTask2[];
  verification: SliceVerification2 | null;
  changelog: ChangelogEntry2[];
}

// Rich milestone node
export interface VisualizerMilestone2 {
  id: string;
  title: string;
  done: boolean;
  status: 'done' | 'active' | 'pending';
  dependencies: string[];
  slices: VisualizerSlice2[];
  discussion_state: 'discussed' | 'draft' | 'undiscussed';
  cost: number;
}

// Critical path
export interface SlackEntry {
  id: string;
  slack: number;
}

export interface CriticalPathInfo {
  path: string[];
  slack_map: SlackEntry[];
}

// Agent activity
export interface CurrentUnit {
  unit_type: string;
  unit_id: string;
  started_at: string | null;
  elapsed_ms: number;
}

export interface AgentActivityInfo {
  is_active: boolean;
  pid: number | null;
  current_unit: CurrentUnit | null;
  completed_units: number;
  total_slices: number;
}

// Knowledge / Captures / Health / Stats
export interface KnowledgeInfo2 {
  exists: boolean;
  entry_count: number;
}

export interface CapturesInfo2 {
  exists: boolean;
  pending_count: number;
}

export interface HealthInfo2 {
  active_milestone_id: string | null;
  active_slice_id: string | null;
  active_task_id: string | null;
  milestones_done: number;
  milestones_total: number;
  slices_done: number;
  slices_total: number;
  tasks_done: number;
  tasks_total: number;
}

export interface VisualizerStats2 {
  milestones_missing_summary: number;
  slices_missing_summary: number;
  recent_changelog: ChangelogEntry2[];
}

/// Full VisualizerData — the expanded shape returned by gsd2_get_visualizer_data (R085).
/// Includes backward-compatible fields (tree, cost_by_milestone, cost_by_model, timeline)
/// alongside new expanded fields.
export interface VisualizerData {
  // Rich milestone tree (new)
  milestones: VisualizerMilestone2[];

  // Backward-compatible aliases
  tree: VisualizerNode[];
  cost_by_milestone: CostByKey[];
  cost_by_model: CostByKey[];
  timeline: TimelineEntry[];

  // Critical path
  critical_path: CriticalPathInfo;

  // Agent activity
  agent_activity: AgentActivityInfo;

  // Cost aggregations (reuse T02 types)
  by_phase: PhaseAggregate[];
  by_slice: { slice_id: string; units: number; cost: number; tokens: number; duration_ms: number }[];
  by_model: { model: string; units: number; cost: number; tokens: number }[];
  units: {
    unit_type: string; id: string; model: string; started_at: number; finished_at: number;
    cost: number; input_tokens: number; output_tokens: number; cache_read_tokens: number;
    cache_write_tokens: number; total_tokens: number; tool_calls: number;
    tier: string | null; model_downgraded: boolean;
  }[];
  totals: { units: number; total_cost: number; total_tokens: number; duration_ms: number; tool_calls: number };

  // Knowledge / Captures
  knowledge: KnowledgeInfo2;
  captures: CapturesInfo2;

  // Health summary
  health: HealthInfo2;

  // Stats
  stats: VisualizerStats2;
}

// GSD-2 Headless
export const gsd2HeadlessQuery = (projectId: string) =>
  invoke<HeadlessSnapshot>('gsd2_headless_query', { projectId });

export const gsd2HeadlessGetSession = (projectId: string) =>
  invoke<string | null>('gsd2_headless_get_session', { projectId });

export const gsd2HeadlessUnregister = (sessionId: string) =>
  invoke<void>('gsd2_headless_unregister', { sessionId });

export const gsd2HeadlessStart = (projectId: string) =>
  invoke<string>('gsd2_headless_start', { projectId });

export const gsd2HeadlessStartWithModel = (projectId: string, model: string) =>
  invoke<string>('gsd2_headless_start_with_model', { projectId, model });

export const gsd2HeadlessStop = (sessionId: string) =>
  invoke<void>('gsd2_headless_stop', { sessionId });

// GSD-2 Visualizer
export const gsd2GetVisualizerData = (projectId: string) =>
  invoke<VisualizerData>('gsd2_get_visualizer_data', { projectId });

// GSD-2 Milestones / Slices / Tasks (Phase 5)
export interface Gsd2MilestoneListItem {
  id: string;
  title: string;
  dir_name: string;
  done: boolean;
  slices: Gsd2SliceSummary[];
  dependencies: string[];
}

export interface Gsd2SliceSummary {
  id: string;
  title: string;
  done: boolean;
  risk: string | null;
  dependencies: string[];
  tasks: Gsd2TaskItem[];
}

export interface Gsd2TaskItem {
  id: string;
  title: string;
  done: boolean;
  estimate: string | null;
  files: string[];
  verify: string | null;
}

export interface Gsd2DerivedState {
  active_milestone_id: string | null;
  active_slice_id: string | null;
  active_task_id: string | null;
  phase: string | null;
  milestones_done: number;
  milestones_total: number;
  slices_done: number;
  slices_total: number;
  tasks_done: number;
  tasks_total: number;
}

export const gsd2ListMilestones = (projectId: string) =>
  invoke<Gsd2MilestoneListItem[]>('gsd2_list_milestones', { projectId });

export const gsd2GetMilestone = (projectId: string, milestoneId: string) =>
  invoke<Gsd2MilestoneListItem>('gsd2_get_milestone', { projectId, milestoneId });

export const gsd2GetSlice = (projectId: string, milestoneId: string, sliceId: string) =>
  invoke<Gsd2SliceSummary>('gsd2_get_slice', { projectId, milestoneId, sliceId });

export const gsd2DeriveState = (projectId: string) =>
  invoke<Gsd2DerivedState>('gsd2_derive_state', { projectId });

// GSD-2 Diagnostics — Doctor, Forensics, Skill Health
export interface DoctorIssue {
  severity: string;
  code: string;
  scope: string;
  unit_id: string;
  message: string;
  file?: string;
  fixable: boolean;
}

export interface DoctorCodeCount {
  code: string;
  count: number;
}

export interface DoctorSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  fixable: number;
  by_code: DoctorCodeCount[];
}

export interface DoctorReport {
  ok: boolean;
  issues: DoctorIssue[];
  fixes_applied: string[];
  summary: DoctorSummary;
}

export interface DoctorFixResult {
  ok: boolean;
  fixes_applied: string[];
}

export interface ForensicAnomaly {
  type_name: string;
  severity: string;
  unit_type?: string;
  unit_id?: string;
  summary: string;
  details: string;
}

export interface ForensicRecentUnit {
  type_name: string;
  id: string;
  cost: number;
  duration: number;
  model: string;
  finished_at: number;
}

export interface ForensicCrashLock {
  pid: number;
  started_at: string;
  unit_type: string;
  unit_id: string;
  unit_started_at: string;
  completed_units: number;
  session_file?: string;
}

export interface ForensicMetricsSummary {
  total_units: number;
  total_cost: number;
  total_duration: number;
}

export interface ForensicReport {
  gsd_version: string;
  timestamp: string;
  base_path: string;
  active_milestone: string | null;
  active_slice: string | null;
  anomalies: ForensicAnomaly[];
  recent_units: ForensicRecentUnit[];
  crash_lock: ForensicCrashLock | null;
  doctor_issue_count: number;
  unit_trace_count: number;
  completed_key_count: number;
  metrics: ForensicMetricsSummary | null;
}

export interface SkillHealthEntry {
  name: string;
  total_uses: number;
  success_rate: number;
  avg_tokens: number;
  token_trend: string;
  last_used: number;
  stale_days: number;
  avg_cost: number;
  flagged: boolean;
  flag_reason?: string;
}

export interface SkillHealthSuggestion {
  skill_name: string;
  trigger: string;
  message: string;
  severity: string;
}

export interface SkillHealthReport {
  generated_at: string;
  total_units_with_skills: number;
  skills: SkillHealthEntry[];
  stale_skills: string[];
  declining_skills: string[];
  suggestions: SkillHealthSuggestion[];
}

export const gsd2GetDoctorReport = (projectId: string) =>
  invoke<DoctorReport>('gsd2_get_doctor_report', { projectId });

export const gsd2ApplyDoctorFixes = (projectId: string) =>
  invoke<DoctorFixResult>('gsd2_apply_doctor_fixes', { projectId });

export const gsd2GetForensicsReport = (projectId: string) =>
  invoke<ForensicReport>('gsd2_get_forensics_report', { projectId });

export const gsd2GetSkillHealth = (projectId: string) =>
  invoke<SkillHealthReport>('gsd2_get_skill_health', { projectId });

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  type: string; // 'rule' | 'pattern' | 'lesson' | 'freeform'
}

export interface KnowledgeData {
  entries: KnowledgeEntry[];
  file_path: string;
  last_modified: string | null;
}

export interface CaptureEntry {
  id: string;
  text: string;
  timestamp: string;
  status: string;
  classification?: string;
  resolution?: string;
  rationale?: string;
  resolved_at?: string;
  executed?: boolean;
}

export interface CapturesData {
  entries: CaptureEntry[];
  pending_count: number;
  actionable_count: number;
}

export interface CaptureResolveResult {
  ok: boolean;
  capture_id: string;
  error?: string;
}

export const gsd2GetKnowledge = (projectId: string) =>
  invoke<KnowledgeData>('gsd2_get_knowledge', { projectId });

export const gsd2GetCaptures = (projectId: string) =>
  invoke<CapturesData>('gsd2_get_captures', { projectId });

export const gsd2ResolveCapture = (
  projectId: string,
  captureId: string,
  classification: string,
  resolution: string,
  rationale: string
) =>
  invoke<CaptureResolveResult>('gsd2_resolve_capture', {
    projectId,
    captureId,
    classification,
    resolution,
    rationale,
  });

// ---- Inspect (R079) ----
export interface InspectData {
  schema_version: string | null;
  decision_count: number;
  requirement_count: number;
  recent_decisions: string[];
  recent_requirements: string[];
  decisions_file_exists: boolean;
  requirements_file_exists: boolean;
}

// ---- Steer (R080) ----
export interface SteerData {
  content: string;
  exists: boolean;
}

// ---- Undo (R081) ----
export interface UndoInfo {
  last_unit_type: string | null;
  last_unit_id: string | null;
  last_unit_cost: number;
  completed_units_count: number;
  file_exists: boolean;
}

// ---- Recovery (R084) ----
export interface RecoveryInfo {
  lock_exists: boolean;
  pid: number | null;
  started_at: string | null;
  unit_type: string | null;
  unit_id: string | null;
  unit_started_at: string | null;
  is_process_alive: boolean;
  suggested_action: string;
  session_file: string | null;
}

export const gsd2GetInspect = (projectId: string) =>
  invoke<InspectData>('gsd2_get_inspect', { projectId });

export const gsd2GetSteerContent = (projectId: string) =>
  invoke<SteerData>('gsd2_get_steer_content', { projectId });

export const gsd2SetSteerContent = (projectId: string, content: string) =>
  invoke<void>('gsd2_set_steer_content', { projectId, content });

export const gsd2GetUndoInfo = (projectId: string) =>
  invoke<UndoInfo>('gsd2_get_undo_info', { projectId });

export const gsd2GetRecoveryInfo = (projectId: string) =>
  invoke<RecoveryInfo>('gsd2_get_recovery_info', { projectId });

// ---- History / Metrics (R078) ----
export interface UnitRecord {
  unit_type: string;
  id: string;
  model: string;
  started_at: number;
  finished_at: number;
  cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_tokens: number;
  tool_calls: number;
  tier: string | null;
  model_downgraded: boolean;
}

export interface ProjectTotals {
  units: number;
  total_cost: number;
  total_tokens: number;
  duration_ms: number;
  tool_calls: number;
}

export interface PhaseAggregate {
  phase: string;
  units: number;
  cost: number;
  tokens: number;
  duration_ms: number;
}

export interface SliceAggregate {
  slice_id: string;
  units: number;
  cost: number;
  tokens: number;
  duration_ms: number;
}

export interface ModelAggregate {
  model: string;
  units: number;
  cost: number;
  tokens: number;
}

export interface HistoryData {
  units: UnitRecord[];
  totals: ProjectTotals;
  by_phase: PhaseAggregate[];
  by_slice: SliceAggregate[];
  by_model: ModelAggregate[];
}

export const gsd2GetHistory = (projectId: string) =>
  invoke<HistoryData>('gsd2_get_history', { projectId });

// ---- Hooks (R082) ----
export interface HookEntry {
  name: string;
  hook_type: string;
  triggers: string[];
  action: string | null;
  artifact: string | null;
  max_cycles: number | null;
}

export interface HooksData {
  hooks: HookEntry[];
  preferences_exists: boolean;
}

export const gsd2GetHooks = (projectId: string) =>
  invoke<HooksData>('gsd2_get_hooks', { projectId });

// ---- Git Summary (R083) ----
export interface GitCommitEntry {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitSummaryData {
  branch: string | null;
  is_dirty: boolean;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  recent_commits: GitCommitEntry[];
  ahead: number;
  behind: number;
  has_git: boolean;
}

export const gsd2GetGitSummary = (projectId: string) =>
  invoke<GitSummaryData>('gsd2_get_git_summary', { projectId });

// ---- Export (R086) ----
export interface ExportData {
  content: string;
  format: string;
}

export const gsd2ExportProgress = (projectId: string) =>
  invoke<ExportData>('gsd2_export_progress', { projectId });

// ---- HTML Reports (R087, R088) ----
export interface ReportEntry {
  filename: string;
  generated_at: string;
  milestone_id: string;
  milestone_title: string;
  label: string;
  kind: string;
  total_cost: number;
  total_tokens: number;
  total_duration: number;
  done_slices: number;
  total_slices: number;
  done_milestones: number;
  total_milestones: number;
  phase: string;
}

export interface ReportsIndex {
  version: number;
  project_name: string;
  project_path: string;
  gsd_version: string;
  entries: ReportEntry[];
}

export interface HtmlReportResult {
  file_path: string;
  filename: string;
  reports_dir: string;
}

export const gsd2GenerateHtmlReport = (projectId: string) =>
  invoke<HtmlReportResult>('gsd2_generate_html_report', { projectId });

export const gsd2GetReportsIndex = (projectId: string) =>
  invoke<ReportsIndex>('gsd2_get_reports_index', { projectId });

// ---- Preferences (M011) ----
export interface PreferencesHookEntry {
  name: string;
  action: string;
  event: string;
  prompt?: string;
  prepend?: string;
  append?: string;
  enabled: boolean;
}

export interface PreferencesData {
  merged: Record<string, unknown>;
  scopes: Record<string, string>;
  global_raw: Record<string, unknown>;
  project_raw: Record<string, unknown>;
}

export const gsd2GetPreferences = (projectPath: string) =>
  invoke<PreferencesData>('gsd2_get_preferences', { projectPath });

export const gsd2SavePreferences = (projectPath: string, scope: string, payload: Record<string, unknown>) =>
  invoke<void>('gsd2_save_preferences', { projectPath, scope, payload });

// ============================================================
// Project Template Types + Invoke Wrappers (S03 - New Project Wizard)
// ============================================================

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  category: string;
  archetype: string;
  tags: string[];
}

export interface GsdPlanningTemplate {
  id: string;
  name: string;
  description: string;
  archetype: string;
}

export interface ScaffoldOptions {
  templateId: string;
  projectName: string;
  parentDirectory: string;
  gsdPlanningTemplate?: string;
  gitInit: boolean;
}

export interface ScaffoldResult {
  projectPath: string;
  projectName: string;
  templateId: string;
  filesCreated: string[];
  gsdSeeded: boolean;
  gitInitialized: boolean;
}

export const listProjectTemplates = () =>
  invoke<ProjectTemplate[]>('list_project_templates');

export const listGsdPlanningTemplates = () =>
  invoke<GsdPlanningTemplate[]>('list_gsd_planning_templates');

export const scaffoldProject = (options: ScaffoldOptions) =>
  invoke<ScaffoldResult>('scaffold_project', { options });

// ─── Session types ─────────────────────────────────────────────────────────────
// Backend returns raw lines from `gsd sessions` output; parsing is done client-side.
export interface GsdSessionEntry {
  raw: string;
  filename: string;
  timestamp: string;
  name: string | null;
  first_message: string | null;
  message_count: number;
  user_message_count: number;
  assistant_message_count: number;
}

/**
 * Parsed/normalized session entry — now returned directly by the backend.
 * Alias for GsdSessionEntry for backwards compatibility.
 */
export type ParsedSessionEntry = GsdSessionEntry;

export interface GsdSessionMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface GsdSessionDetail {
  filename: string;
  name: string | null;
  messages: GsdSessionMessage[];
  timestamp: string;
}

export const gsd2ListSessions = (projectId: string) =>
  invoke<GsdSessionEntry[]>('gsd2_list_sessions', { projectId });
