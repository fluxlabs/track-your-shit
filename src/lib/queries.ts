// Track Your Shit - React Query Hooks
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "./tauri";
import { queryKeys } from "./query-keys";
import { getErrorMessage } from "./utils";

// Projects
export const useProjects = () =>
  useQuery({
    queryKey: queryKeys.projects(),
    queryFn: api.listProjects,
  });

export const useProject = (id: string) =>
  useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => api.getProject(id),
    enabled: !!id,
  });

export const useProjectsWithStats = () =>
  useQuery({
    queryKey: queryKeys.projectsWithStats(),
    queryFn: api.getProjectsWithStats,
  });

export const useGitInfo = (path: string) =>
  useQuery({
    queryKey: queryKeys.gitInfo(path),
    queryFn: () => api.getGitInfo(path),
    enabled: !!path,
    staleTime: 30000,
    refetchInterval: 60000,
  });

export const useGitStatus = (path: string) =>
  useQuery({
    queryKey: queryKeys.gitStatus(path),
    queryFn: () => api.getGitStatus(path),
    enabled: !!path,
    staleTime: 30000,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

// Git Operations
export const useGitChangedFiles = (path: string) =>
  useQuery({
    queryKey: queryKeys.gitChangedFiles(path),
    queryFn: () => api.getGitChangedFiles(path),
    enabled: !!path,
    staleTime: 15000,
  });

export const useGitLog = (path: string, limit?: number, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gitLog(path, limit),
    queryFn: () => api.getGitLog(path, limit),
    enabled: !!path && enabled,
    staleTime: 30000,
  });

export const useGitPush = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => api.gitPush(projectPath),
    onSuccess: (result, projectPath) => {
      if (result.success) {
        toast.success('Pushed successfully');
      } else {
        toast.error('Push failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to push', { description: getErrorMessage(error) });
    },
  });
};

export const useGitPull = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => api.gitPull(projectPath),
    onSuccess: (result, projectPath) => {
      if (result.success) {
        toast.success('Pulled successfully');
      } else {
        toast.error('Pull failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to pull', { description: getErrorMessage(error) });
    },
  });
};

export const useGitFetch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => api.gitFetch(projectPath),
    onSuccess: (result, projectPath) => {
      if (result.success) {
        toast.success('Fetched successfully');
      } else {
        toast.error('Fetch failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to fetch', { description: getErrorMessage(error) });
    },
  });
};

export const useGitStageAll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => api.gitStageAll(projectPath),
    onSuccess: (result, projectPath) => {
      if (result.success) {
        toast.success('All changes staged');
      } else {
        toast.error('Stage failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to stage', { description: getErrorMessage(error) });
    },
  });
};

export const useGitCommit = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectPath, message }: { projectPath: string; message: string }) =>
      api.gitCommit(projectPath, message),
    onSuccess: (result, { projectPath }) => {
      if (result.success) {
        toast.success('Committed successfully');
      } else {
        toast.error('Commit failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to commit', { description: getErrorMessage(error) });
    },
  });
};

export const useGitStashSave = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => api.gitStashSave(projectPath),
    onSuccess: (result, projectPath) => {
      if (result.success) {
        toast.success('Changes stashed');
      } else {
        toast.error('Stash failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to stash', { description: getErrorMessage(error) });
    },
  });
};

export const useGitStashPop = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectPath: string) => api.gitStashPop(projectPath),
    onSuccess: (result, projectPath) => {
      if (result.success) {
        toast.success('Stash popped');
      } else {
        toast.error('Stash pop failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to pop stash', { description: getErrorMessage(error) });
    },
  });
};

export const useGitStageFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectPath, filePath }: { projectPath: string; filePath: string }) =>
      api.gitStageFile(projectPath, filePath),
    onSuccess: (result, { projectPath }) => {
      if (result.success) {
        toast.success('File staged');
      } else {
        toast.error('Stage failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to stage file', { description: getErrorMessage(error) });
    },
  });
};

export const useGitUnstageFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectPath, filePath }: { projectPath: string; filePath: string }) =>
      api.gitUnstageFile(projectPath, filePath),
    onSuccess: (result, { projectPath }) => {
      if (result.success) {
        toast.success('File unstaged');
      } else {
        toast.error('Unstage failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to unstage file', { description: getErrorMessage(error) });
    },
  });
};

export const useGitDiscardFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectPath, filePath }: { projectPath: string; filePath: string }) =>
      api.gitDiscardFile(projectPath, filePath),
    onSuccess: (result, { projectPath }) => {
      if (result.success) {
        toast.success('Changes discarded');
      } else {
        toast.error('Discard failed', { description: result.message });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to discard file', { description: getErrorMessage(error) });
    },
  });
};

export const useGitRemoteUrl = (path: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gitRemoteUrl(path),
    queryFn: () => api.getGitRemoteUrl(path),
    enabled: !!path && enabled,
    staleTime: 120000,
  });

export const useGitBranches = (path: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gitBranches(path),
    queryFn: () => api.getGitBranches(path),
    enabled: !!path && enabled,
    staleTime: 30000,
  });

export const useGitTags = (path: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gitTags(path),
    queryFn: () => api.getGitTags(path),
    enabled: !!path && enabled,
    staleTime: 60000,
  });

export const useScannerSummary = (projectPath: string) =>
  useQuery({
    queryKey: queryKeys.scannerSummary(projectPath),
    queryFn: () => api.getScannerSummary(projectPath),
    enabled: !!projectPath,
    staleTime: 5 * 60 * 1000,
  });

export const useToggleFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.toggleFavorite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithStats() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
    onError: (error) => {
      toast.error("Failed to toggle favorite", { description: getErrorMessage(error) });
    },
  });
};

export const useImportProjectEnhanced = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, autoSyncRoadmap, ptySessionId, skipConversion }: { path: string; autoSyncRoadmap: boolean; ptySessionId?: string; skipConversion?: boolean }) =>
      api.importProjectEnhanced(path, autoSyncRoadmap, ptySessionId, skipConversion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
    onError: (error) => {
      toast.error("Failed to import project", { description: getErrorMessage(error) });
    },
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      parentPath: string;
      projectName: string;
      template?: string;
      discoveryMode?: string;
      ptySessionId?: string;
    }) =>
      api.createNewProject(
        params.parentPath,
        params.projectName,
        params.template,
        params.discoveryMode,
        params.ptySessionId
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
    onError: (error) => {
      toast.error("Failed to create project", { description: getErrorMessage(error) });
    },
  });
};

export const useFinalizeProjectCreation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, success }: { projectId: string; success: boolean }) =>
      api.finalizeProjectCreation(projectId, success),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) });
    },
    onError: (error) => {
      toast.error("Failed to finalize project", { description: getErrorMessage(error) });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: api.ProjectUpdate }) =>
      api.updateProject(id, updates),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithStats() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.project(project.id) });
    },
    onError: (error) => {
      toast.error("Failed to update project", { description: getErrorMessage(error) });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectsWithStats() });
    },
    onError: (error) => {
      toast.error("Failed to delete project", { description: getErrorMessage(error) });
    },
  });
};

// Activity
export const useActivityLog = (projectId?: string, limit?: number, refetchInterval?: number | false) =>
  useQuery({
    queryKey: queryKeys.activity(projectId, limit),
    queryFn: () => api.getActivityLog(projectId, limit),
    refetchInterval,
  });

// Markdown Indexing
export const useIndexProjectMarkdown = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, projectPath }: { projectId: string; projectPath: string }) =>
      api.indexProjectMarkdown(projectId, projectPath),
    onSuccess: (_count, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeFiles(variables.projectPath),
      });
    },
    onError: (error) => {
      toast.error("Failed to index docs", { description: getErrorMessage(error) });
    },
  });
};

// Knowledge Files
export const useKnowledgeFiles = (projectPath: string) =>
  useQuery({
    queryKey: queryKeys.knowledgeFiles(projectPath),
    queryFn: () => api.listKnowledgeFiles(projectPath),
    enabled: !!projectPath,
  });

export const useKnowledgeFileContent = (projectId: string, projectPath: string, filePath: string) =>
  useQuery({
    queryKey: queryKeys.knowledgeFile(projectId, filePath),
    queryFn: () => api.readProjectFile(projectPath, filePath),
    enabled: !!projectPath && !!filePath,
  });

export const useKnowledgeSearch = (projectPath: string, query: string) =>
  useQuery({
    queryKey: queryKeys.knowledgeSearch(projectPath, query),
    queryFn: () => api.searchKnowledgeFiles(projectPath, query),
    enabled: !!projectPath && query.length >= 2,
  });

export const useDeleteProjectFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectPath, filePath }: { projectId: string; projectPath: string; filePath: string }) =>
      api.deleteProjectFile(projectPath, filePath),
    onSuccess: (_deleted, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeFiles(variables.projectPath) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeFile(variables.projectId, variables.filePath) });
    },
    onError: (error) => {
      toast.error("Failed to delete file", { description: getErrorMessage(error) });
    },
  });
};

// Settings
export const useSettings = () =>
  useQuery({
    queryKey: queryKeys.settings(),
    queryFn: api.getSettings,
  });

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
    onError: (error) => {
      toast.error("Failed to update settings", { description: getErrorMessage(error) });
    },
  });
};

// Data Management
export const useExportData = () => {
  return useMutation({
    mutationFn: api.exportData,
    onError: (error) => {
      toast.error("Failed to export data", { description: getErrorMessage(error) });
    },
  });
};

export const useClearAllData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clearAllData,
    onSuccess: () => {
      // Clear all data requires full invalidation
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error("Failed to clear data", { description: getErrorMessage(error) });
    },
  });
};

export const useClearSelectedData = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clearSelectedData,
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast.success('Selected data cleared');
    },
    onError: (error) => {
      toast.error('Failed to clear data', { description: getErrorMessage(error) });
    },
  });
};

export const useResetSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.resetSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
      toast.success('Settings reset to defaults');
    },
    onError: (error) => {
      toast.error('Failed to reset settings', { description: getErrorMessage(error) });
    },
  });
};

export const useImportSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.importSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
      toast.success('Settings imported successfully');
    },
    onError: (error) => {
      toast.error('Failed to import settings', { description: getErrorMessage(error) });
    },
  });
};

// App Logs
export const useAppLogs = (filters: api.AppLogFilters) =>
  useQuery({
    queryKey: queryKeys.appLogs(filters),
    queryFn: () => api.getAppLogs(filters),
  });

export const useAppLogStats = () =>
  useQuery({
    queryKey: queryKeys.appLogStats(),
    queryFn: api.getAppLogStats,
  });

export const useLogLevels = () =>
  useQuery({
    queryKey: queryKeys.logLevels(),
    queryFn: api.getLogLevels,
  });

export const useClearAppLogs = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params?: { before?: string; level?: string }) =>
      api.clearAppLogs(params?.before, params?.level),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allAppLogs() });
    },
    onError: (error) => {
      toast.error("Failed to clear logs", { description: getErrorMessage(error) });
    },
  });
};

// Global Search
export const useGlobalSearch = (query: string) =>
  useQuery({
    queryKey: queryKeys.globalSearch(query),
    queryFn: () => api.globalSearch(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

// Command History
export const useCommandHistory = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.commandHistory(projectId),
    queryFn: () => api.getCommandHistory(projectId),
    enabled: !!projectId,
  });

export const useAddCommandHistory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, command, source }: { projectId: string; command: string; source?: string }) =>
      api.addCommandHistory(projectId, command, source),
    onSuccess: (entry) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.commandHistory(entry.project_id) });
    },
    onError: (error) => {
      toast.error("Failed to record command", { description: getErrorMessage(error) });
    },
  });
};

export const useClearCommandHistory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.clearCommandHistory(projectId),
    onSuccess: (_, projectId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.commandHistory(projectId) });
    },
    onError: (error) => {
      toast.error("Failed to clear history", { description: getErrorMessage(error) });
    },
  });
};

// Script Favorites
export const useScriptFavorites = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.scriptFavorites(projectId),
    queryFn: () => api.getScriptFavorites(projectId),
    enabled: !!projectId,
  });

export const useToggleScriptFavorite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, scriptId }: { projectId: string; scriptId: string }) =>
      api.toggleScriptFavorite(projectId, scriptId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scriptFavorites(variables.projectId) });
    },
    onError: (error) => {
      toast.error("Failed to toggle favorite", { description: getErrorMessage(error) });
    },
  });
};

// Snippets
export const useSnippets = (projectId?: string) =>
  useQuery({
    queryKey: queryKeys.snippets(projectId),
    queryFn: () => api.listSnippets(projectId),
  });

export const useCreateSnippet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string | null; input: api.SnippetInput }) =>
      api.createSnippet(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allSnippets() });
    },
    onError: (error) => {
      toast.error("Failed to create snippet", { description: getErrorMessage(error) });
    },
  });
};

export const useUpdateSnippet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: api.SnippetInput }) =>
      api.updateSnippet(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allSnippets() });
    },
    onError: (error) => {
      toast.error("Failed to update snippet", { description: getErrorMessage(error) });
    },
  });
};

export const useDeleteSnippet = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSnippet(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allSnippets() });
    },
    onError: (error) => {
      toast.error("Failed to delete snippet", { description: getErrorMessage(error) });
    },
  });
};

// Auto-commands
export const useAutoCommands = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.autoCommands(projectId),
    queryFn: () => api.listAutoCommands(projectId),
    enabled: !!projectId,
  });

export const useAutoCommandPresets = () =>
  useQuery({
    queryKey: queryKeys.autoCommandPresets(),
    queryFn: api.getAutoCommandPresets,
    staleTime: Infinity,
  });

export const useCreateAutoCommand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: api.AutoCommandInput }) =>
      api.createAutoCommand(projectId, input),
    onSuccess: (cmd) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.autoCommands(cmd.project_id) });
    },
    onError: (error) => {
      toast.error("Failed to create auto-command", { description: getErrorMessage(error) });
    },
  });
};

export const useUpdateAutoCommand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; input: api.AutoCommandInput; projectId: string }) =>
      api.updateAutoCommand(vars.id, vars.input),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.autoCommands(variables.projectId) });
    },
    onError: (error) => {
      toast.error("Failed to update auto-command", { description: getErrorMessage(error) });
    },
  });
};

export const useDeleteAutoCommand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      api.deleteAutoCommand(vars.id),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.autoCommands(variables.projectId) });
    },
    onError: (error) => {
      toast.error("Failed to delete auto-command", { description: getErrorMessage(error) });
    },
  });
};

export const useToggleAutoCommand = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; projectId: string }) =>
      api.toggleAutoCommand(vars.id),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.autoCommands(variables.projectId) });
    },
    onError: (error) => {
      toast.error("Failed to toggle auto-command", { description: getErrorMessage(error) });
    },
  });
};

// Notifications (CC-03)
export const useNotifications = (limit?: number) =>
  useQuery({
    queryKey: queryKeys.notifications(limit),
    queryFn: () => api.getNotifications(limit),
  });

export const useUnreadNotificationCount = () =>
  useQuery({
    queryKey: queryKeys.unreadCount(),
    queryFn: api.getUnreadNotificationCount,
    refetchInterval: 30000,
  });

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allNotifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    },
    onError: (error) => {
      toast.error('Failed to mark notification read', { description: getErrorMessage(error) });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allNotifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    },
    onError: (error) => {
      toast.error('Failed to mark all read', { description: getErrorMessage(error) });
    },
  });
};

export const useClearNotifications = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.clearNotifications,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.allNotifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount() });
    },
    onError: (error) => {
      toast.error('Failed to clear notifications', { description: getErrorMessage(error) });
    },
  });
};

// Environment Info (SH-04)
export const useEnvironmentInfo = (workingDir: string) =>
  useQuery({
    queryKey: queryKeys.environmentInfo(workingDir),
    queryFn: () => api.getEnvironmentInfo(workingDir),
    enabled: !!workingDir,
    staleTime: 60000,
    refetchInterval: 60000,
  });

// Knowledge Bookmarks
export const useKnowledgeBookmarks = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.knowledgeBookmarks(projectId),
    queryFn: () => api.listKnowledgeBookmarks(projectId),
    enabled: !!projectId,
  });

export const useCreateKnowledgeBookmark = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, filePath, heading, headingLevel, note }: { projectId: string; filePath: string; heading: string; headingLevel: number; note?: string }) =>
      api.createKnowledgeBookmark(projectId, filePath, heading, headingLevel, note),
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBookmarks(projectId) });
    },
    onError: (error) => {
      toast.error("Failed to create bookmark", { description: getErrorMessage(error) });
    },
  });
};

export const useDeleteKnowledgeBookmark = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteKnowledgeBookmark,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-bookmarks"] });
    },
    onError: (error) => {
      toast.error("Failed to delete bookmark", { description: getErrorMessage(error) });
    },
  });
};

// Dependency Status
export const useDependencyStatus = (projectId: string, projectPath: string) =>
  useQuery({
    queryKey: queryKeys.dependencyStatus(projectId),
    queryFn: () => api.getDependencyStatus(projectId, projectPath),
    enabled: !!projectId && !!projectPath,
    staleTime: 60 * 60 * 1000, // 1 hour data freshness
    refetchInterval: 15 * 60 * 1000, // Auto-poll every 15 minutes
    refetchOnWindowFocus: true,
  });

// Knowledge Graph
export const useKnowledgeGraph = (projectPath: string) =>
  useQuery({
    queryKey: queryKeys.knowledgeGraph(projectPath),
    queryFn: () => api.buildKnowledgeGraph(projectPath),
    enabled: !!projectPath,
    staleTime: 60000,
  });

// ============================================================
// GSD (Get Stuff Done) Integration
// ============================================================

export const useGsdProjectInfo = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdProjectInfo(projectId),
    queryFn: () => api.gsdGetProjectInfo(projectId),
    enabled: !!projectId,
  });

export const useGsdState = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdState(projectId),
    queryFn: () => api.gsdGetState(projectId),
    enabled: !!projectId,
  });

export const useGsdConfig = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdConfig(projectId),
    queryFn: () => api.gsdGetConfig(projectId),
    enabled: !!projectId,
  });

export const useGsdTodos = (projectId: string, status?: string) =>
  useQuery({
    queryKey: queryKeys.gsdTodos(projectId, status),
    queryFn: () => api.gsdListTodos(projectId, status),
    enabled: !!projectId,
  });

export const useGsdDebugSessions = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdDebugSessions(projectId),
    queryFn: () => api.gsdListDebugSessions(projectId),
    enabled: !!projectId,
  });

export const useGsdMilestones = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdMilestones(projectId),
    queryFn: () => api.gsdListMilestones(projectId),
    enabled: !!projectId,
  });

export const useGsdRequirements = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdRequirements(projectId),
    queryFn: () => api.gsdListRequirements(projectId),
    enabled: !!projectId,
  });

export const useGsdVerification = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdVerification(projectId, phase),
    queryFn: () => api.gsdGetVerification(projectId, phase),
    enabled: !!projectId && phase > 0,
  });

export const useGsdResearch = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdResearch(projectId),
    queryFn: () => api.gsdListResearch(projectId),
    enabled: !!projectId,
  });

export const useGsdCreateTodo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, input }: { projectId: string; input: api.GsdTodoInput }) =>
      api.gsdCreateTodo(projectId, input),
    onSuccess: (_result, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsdTodos(projectId) });
      toast.success('Todo created');
    },
    onError: (error) => {
      toast.error('Failed to create todo', { description: getErrorMessage(error) });
    },
  });
};

export const useGsdUpdateTodo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      todoId,
      input,
    }: {
      projectId: string;
      todoId: string;
      input: api.GsdTodoInput;
    }) => api.gsdUpdateTodo(projectId, todoId, input),
    onSuccess: (_result, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsdTodos(projectId) });
      toast.success('Todo updated');
    },
    onError: (error) => {
      toast.error('Failed to update todo', { description: getErrorMessage(error) });
    },
  });
};

export const useGsdCompleteTodo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, todoId }: { projectId: string; todoId: string }) =>
      api.gsdCompleteTodo(projectId, todoId),
    onSuccess: (_result, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsdTodos(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.allTodos() });
      toast.success('Todo completed');
    },
    onError: (error) => {
      toast.error('Failed to complete todo', { description: getErrorMessage(error) });
    },
  });
};

export const useGsdDeleteTodo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, todoId }: { projectId: string; todoId: string }) =>
      api.gsdDeleteTodo(projectId, todoId),
    onSuccess: (_result, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsdTodos(projectId) });
      toast.success('Todo deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete todo', { description: getErrorMessage(error) });
    },
  });
};

export const useGsdPlans = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdPlans(projectId),
    queryFn: () => api.gsdListPlans(projectId),
    enabled: !!projectId,
  });

export const useGsdPhasePlans = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhasePlans(projectId, phase),
    queryFn: () => api.gsdGetPhasePlans(projectId, phase),
    enabled: !!projectId && phase > 0,
  });

export const useGsdSummaries = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdSummaries(projectId),
    queryFn: () => api.gsdListSummaries(projectId),
    enabled: !!projectId,
  });

export const useGsdPhaseSummaries = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseSummaries(projectId, phase),
    queryFn: () => api.gsdGetPhaseSummaries(projectId, phase),
    enabled: !!projectId && phase > 0,
  });

export const useGsdPhaseResearchList = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseResearchList(projectId),
    queryFn: () => api.gsdListPhaseResearch(projectId),
    enabled: !!projectId,
  });

export const useGsdPhaseResearch = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseResearchItem(projectId, phase),
    queryFn: () => api.gsdGetPhaseResearch(projectId, phase),
    enabled: !!projectId && phase > 0,
  });

export const useGsdMilestoneAudits = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdMilestoneAudits(projectId),
    queryFn: () => api.gsdListMilestoneAudits(projectId),
    enabled: !!projectId,
  });

export const useGsdRoadmapProgress = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdRoadmapProgress(projectId),
    queryFn: () => api.gsdGetRoadmapProgress(projectId),
    enabled: !!projectId,
  });

export const useGsdSync = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.gsdSyncProject(projectId),
    onSuccess: (result, projectId) => {
      void queryClient.invalidateQueries({ queryKey: ['gsd', projectId] });
      toast.success(
        `GSD synced: ${result.todos_synced} todos, ${result.milestones_synced} milestones, ${result.plans_synced} plans, ${result.summaries_synced} summaries`,
      );
    },
    onError: (error) => {
      toast.error('Failed to sync GSD data', { description: getErrorMessage(error) });
    },
  });
};

export const useAllGsdTodos = () =>
  useQuery({
    queryKey: queryKeys.allTodos(),
    queryFn: api.gsdListAllTodos,
  });

export const useGsdPhaseContext = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseContext(projectId, phase),
    queryFn: () => api.gsdGetPhaseContext(projectId, phase),
    enabled: !!projectId && phase > 0,
  });

export const useGsdValidations = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdValidations(projectId),
    queryFn: () => api.gsdListValidations(projectId),
    enabled: !!projectId,
  });

export const useGsdValidationByPhase = (projectId: string, phaseNumber: string) =>
  useQuery({
    queryKey: queryKeys.gsdValidationByPhase(projectId, phaseNumber),
    queryFn: () => api.gsdGetValidationByPhase(projectId, phaseNumber),
    enabled: !!projectId && !!phaseNumber,
  });

export const useGsdUatResults = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdUatResults(projectId),
    queryFn: () => api.gsdListUatResults(projectId),
    enabled: !!projectId,
  });

export const useGsdUatByPhase = (projectId: string, phaseNumber: string) =>
  useQuery({
    queryKey: queryKeys.gsdUatByPhase(projectId, phaseNumber),
    queryFn: () => api.gsdGetUatByPhase(projectId, phaseNumber),
    enabled: !!projectId && !!phaseNumber,
  });

