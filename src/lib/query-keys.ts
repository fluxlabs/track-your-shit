// Track Your Shit - Query Key Factory
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
  gsdValidations: (projectId: string) => ['gsd', projectId, 'validations'] as const,
  gsdValidationByPhase: (projectId: string, phase: string) => ['gsd', projectId, 'validation', phase] as const,
  gsdUatResults: (projectId: string) => ['gsd', projectId, 'uat-results'] as const,
  gsdUatByPhase: (projectId: string, phase: string) => ['gsd', projectId, 'uat-results', phase] as const,
};
