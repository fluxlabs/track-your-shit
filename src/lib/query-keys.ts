// VCCA - Query Key Factory
// Centralized query key management for TanStack Query
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import type { AppLogFilters } from "./tauri";

export const queryKeys = {
  // Projects
  projects: () => ["projects"] as const,
  projectsWithStats: () => ["projects", "with-stats"] as const,
  project: (id: string) => ["project", id] as const,
  gitInfo: (path: string) => ["git-info", path] as const,
  gitStatus: (path: string) => ["git-status", path] as const,
  gitChangedFiles: (path: string) => ["git-changed-files", path] as const,
  gitLog: (path: string, limit?: number) => ["git-log", path, limit] as const,
  gitRemoteUrl: (path: string) => ["git-remote-url", path] as const,
  gitBranches: (path: string) => ["git-branches", path] as const,
  gitTags: (path: string) => ["git-tags", path] as const,

  // GitHub
  github: {
    all: () => ["github"] as const,
    tokenStatus: () => ["github", "token-status"] as const,
    repoInfo: (projectPath: string) => ["github", "repo-info", projectPath] as const,
    prs: (projectPath: string, state?: string) => ["github", "prs", projectPath, state] as const,
    issues: (projectPath: string, state?: string, labels?: string) => ["github", "issues", projectPath, state, labels] as const,
    checkRuns: (projectPath: string, gitRef: string) => ["github", "check-runs", projectPath, gitRef] as const,
    releases: (projectPath: string) => ["github", "releases", projectPath] as const,
    notifications: (projectPath: string) => ["github", "notifications", projectPath] as const,
  },

  // Activity
  activity: (projectId?: string, limit?: number) => ["activity", projectId, limit] as const,
  allActivity: () => ["activity"] as const,

  // Knowledge Files
  knowledgeFiles: (path: string) => ["knowledge", "files", path] as const,
  codeFiles: (path: string) => ["code", "files", path] as const,
  knowledgeFile: (projectId: string, filePath: string) => ["knowledge", "file", projectId, filePath] as const,
  knowledgeSearch: (path: string, query: string) => ["knowledge", "search", path, query] as const,

  // Settings
  settings: () => ["settings"] as const,

  // First-launch onboarding
  onboardingStatus: () => ["onboarding", "status"] as const,
  onboardingDependencies: () => ["onboarding", "dependencies"] as const,

  // App Logs
  appLogs: (filters: AppLogFilters) => ["app-logs", filters] as const,
  allAppLogs: () => ["app-logs"] as const,
  appLogStats: () => ["app-logs", "stats"] as const,
  logLevels: () => ["app-logs", "levels"] as const,

  // Global Search
  globalSearch: (query: string) => ['search', 'global', query] as const,

  // Command History
  commandHistory: (projectId: string) => ["command-history", projectId] as const,

  // Snippets
  snippets: (projectId?: string) => ["snippets", projectId] as const,
  allSnippets: () => ["snippets"] as const,

  // Script Favorites
  scriptFavorites: (projectId: string) => ["script-favorites", projectId] as const,

  // Auto-commands
  autoCommands: (projectId: string) => ["auto-commands", projectId] as const,
  autoCommandPresets: () => ["auto-commands", "presets"] as const,

  // Notifications
  notifications: (limit?: number) => ['notifications', limit] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,
  allNotifications: () => ['notifications'] as const,

  // Environment Info
  environmentInfo: (dir: string) => ['environment-info', dir] as const,

  // Knowledge Bookmarks
  knowledgeBookmarks: (projectId: string) => ["knowledge-bookmarks", projectId] as const,

  // Dependency Status
  dependencyStatus: (projectId: string) => ["dependency-status", projectId] as const,

  // Knowledge Graph
  knowledgeGraph: (projectPath: string) => ["knowledge-graph", projectPath] as const,

  // Project Scanner
  scannerSummary: (projectPath: string) => ["scanner-summary", projectPath] as const,

  // GSD (Get Stuff Done)
  gsdProjectInfo: (projectId: string) => ["gsd", "project-info", projectId] as const,
  gsdState: (projectId: string) => ["gsd", "state", projectId] as const,
  gsdConfig: (projectId: string) => ["gsd", "config", projectId] as const,
  gsdTodos: (projectId: string, status?: string) => ["gsd", "todos", projectId, status] as const,
  gsdDebugSessions: (projectId: string) => ["gsd", "debug-sessions", projectId] as const,
  gsdMilestones: (projectId: string) => ["gsd", "milestones", projectId] as const,
  gsdRequirements: (projectId: string) => ["gsd", "requirements", projectId] as const,
  gsdVerification: (projectId: string, phase: number) => ["gsd", "verification", projectId, phase] as const,
  gsdResearch: (projectId: string) => ["gsd", "research", projectId] as const,
  gsdPlans: (projectId: string) => ["gsd", "plans", projectId] as const,
  gsdPhasePlans: (projectId: string, phase: number) => ["gsd", "plans", projectId, phase] as const,
  gsdSummaries: (projectId: string) => ["gsd", "summaries", projectId] as const,
  gsdPhaseSummaries: (projectId: string, phase: number) => ["gsd", "summaries", projectId, phase] as const,
  gsdPhaseResearchList: (projectId: string) => ["gsd", "phase-research", projectId] as const,
  gsdPhaseResearchItem: (projectId: string, phase: number) => ["gsd", "phase-research", projectId, phase] as const,
  gsdMilestoneAudits: (projectId: string) => ["gsd", "milestone-audits", projectId] as const,
  allGsd: (projectId: string) => ["gsd", projectId] as const,
  gsdRoadmapProgress: (projectId: string) => ['gsd', projectId, 'roadmap-progress'] as const,
  allTodos: () => ['gsd', 'all-todos'] as const,
  gsdPhaseContext: (projectId: string, phase: number) => ["gsd", "phase-context", projectId, phase] as const,
  // Phase 12 artifact reader keys (ARTF-01..04)
  gsdPhaseSpec: (projectId: string, phase: number) => ["gsd", "phase-spec", projectId, phase] as const,
  gsdPhaseSecurity: (projectId: string, phase: number) => ["gsd", "phase-security", projectId, phase] as const,
  gsdPhaseValidationDoc: (projectId: string, phase: number) => ["gsd", "phase-validation-doc", projectId, phase] as const,
  gsdPhaseReview: (projectId: string, phase: number) => ["gsd", "phase-review", projectId, phase] as const,
  gsdCodebaseDocs: (projectId: string) => ["gsd", "codebase-docs", projectId] as const,
  gsdProcessDocs: (projectId: string) => ["gsd", "process-docs", projectId] as const,
  gsdValidations: (projectId: string) => ['gsd', projectId, 'validations'] as const,
  gsdValidationByPhase: (projectId: string, phase: string) => ['gsd', projectId, 'validation', phase] as const,
  gsdUatResults: (projectId: string) => ['gsd', projectId, 'uat-results'] as const,
  gsdUatByPhase: (projectId: string, phase: string) => ['gsd', projectId, 'uat-results', phase] as const,

  // GSD-2
  gsd2Health: (projectId: string) => ['gsd2', 'health', projectId] as const,
  gsd2Models: (search?: string) => ['gsd2', 'models', search ?? ''] as const,
  gsd2PlanPreview: (intent: string) => ['gsd2', 'plan-preview', intent] as const,
  gsd2Worktrees: (projectId: string) => ['gsd2', 'worktrees', projectId] as const,
  gsd2WorktreeDiff: (projectId: string, name: string) => ['gsd2', 'worktree-diff', projectId, name] as const,
  gsd2HeadlessQuery: (projectId: string) => ['gsd2', 'headless', 'query', projectId] as const,
  gsd2VisualizerData: (projectId: string) => ['gsd2', 'visualizer', projectId] as const,
  gsd2Milestones: (projectId: string) => ['gsd2', 'milestones', projectId] as const,
  gsd2Milestone: (projectId: string, milestoneId: string) => ['gsd2', 'milestone', projectId, milestoneId] as const,
  gsd2Slice: (projectId: string, milestoneId: string, sliceId: string) => ['gsd2', 'slice', projectId, milestoneId, sliceId] as const,
  gsd2DerivedState: (projectId: string) => ['gsd2', 'derived-state', projectId] as const,
  gsd2DoctorReport: (projectId: string) => ['gsd2', 'doctor', projectId] as const,
  gsd2ForensicsReport: (projectId: string) => ['gsd2', 'forensics', projectId] as const,
  gsd2SkillHealth: (projectId: string) => ['gsd2', 'skill-health', projectId] as const,
  gsd2KnowledgeData: (projectId: string) => ['gsd2', 'knowledge', projectId] as const,
  gsd2CapturesData: (projectId: string) => ['gsd2', 'captures', projectId] as const,
  gsd2Inspect: (projectId: string) => ['gsd2', 'inspect', projectId] as const,
  gsd2SteerContent: (projectId: string) => ['gsd2', 'steer', projectId] as const,
  gsd2UndoInfo: (projectId: string) => ['gsd2', 'undo', projectId] as const,
  gsd2RecoveryInfo: (projectId: string) => ['gsd2', 'recovery', projectId] as const,
  gsd2History: (projectId: string) => ['gsd2', 'history', projectId] as const,
  gsd2Hooks: (projectId: string) => ['gsd2', 'hooks', projectId] as const,
  gsd2GitSummary: (projectId: string) => ['gsd2', 'git-summary', projectId] as const,
  gsd2Export: (projectId: string) => ['gsd2', 'export', projectId] as const,
  gsd2ReportsIndex: (projectId: string) => ['gsd2', 'reports-index', projectId] as const,
  gsd2Preferences: (path?: string) => ['gsd2', 'preferences', path] as const,
  gsd2Sessions: (projectId: string) => ['gsd2', 'sessions', projectId] as const,
  tmuxSessions: () => ['tmux', 'sessions'] as const,
  projectDocs: (path: string) => ['project-docs', path] as const,
  projectWorkflows: (path: string) => ['project-workflows', path] as const,
};
