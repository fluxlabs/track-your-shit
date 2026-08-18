// VCCA - React Query Hooks
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "./tauri";
import type { WorktreeInfo } from "./tauri";
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
      toast.success("Project imported");
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
      toast.success("Project created");
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
      toast.success("Project updated");
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
      toast.success("Project deleted");
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
      toast.success("Documentation indexed");
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
      toast.success("File deleted");
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
    onMutate: async (nextSettings) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings() });
      const previousSettings = queryClient.getQueryData<api.Settings>(queryKeys.settings());
      queryClient.setQueryData(queryKeys.settings(), nextSettings);
      return { previousSettings };
    },
    onSuccess: () => {
      toast.success("Settings saved");
    },
    onError: (error, _variables, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.settings(), context.previousSettings);
      }
      toast.error("Failed to update settings", { description: getErrorMessage(error) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
};

// First-launch onboarding
export const useOnboardingStatus = () =>
  useQuery({
    queryKey: queryKeys.onboardingStatus(),
    queryFn: api.onboardingGetStatus,
    staleTime: 30_000,
  });

export const useOnboardingDependencies = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.onboardingDependencies(),
    queryFn: api.onboardingDetectDependencies,
    enabled,
    staleTime: 60_000,
  });

export const useOnboardingValidateAndStoreApiKey = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, apiKey }: { provider: api.OnboardingProvider; apiKey: string }) =>
      api.onboardingValidateAndStoreApiKey(provider, apiKey),
    onSuccess: (result) => {
      if (result.valid && result.stored) {
        toast.success(`${result.provider} key saved securely`);
      } else {
        toast.error(`Failed to validate ${result.provider} key`, {
          description: result.message,
        });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus() });
    },
    onError: (error) => {
      toast.error("Failed to validate API key", { description: getErrorMessage(error) });
    },
  });
};

export const useOnboardingMarkComplete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userMode: api.OnboardingUserMode) => api.onboardingMarkComplete(userMode),
    onSuccess: () => {
      toast.success("Onboarding completed");
      void queryClient.invalidateQueries({ queryKey: queryKeys.onboardingStatus() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings() });
    },
    onError: (error) => {
      toast.error("Failed to complete onboarding", { description: getErrorMessage(error) });
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
      toast.success("Command history cleared");
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
      toast.success("Snippet created");
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
      toast.success("Snippet saved");
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
      toast.success("Snippet deleted");
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
      toast.success("Auto-command created");
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
      toast.success("Auto-command updated");
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
      toast.success("Auto-command deleted");
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
    onSuccess: (result, variables) => {
      toast.success(`Auto-command ${result.enabled ? "enabled" : "disabled"}`);
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
      toast.success("All notifications marked read");
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
      toast.success("Notifications cleared");
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
    retry: 1, // fail fast — dependency scans are slow, no point retrying 3x
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
    mutationFn: async (projectId: string) => {
      // Guard: skip sync for GSD-2 projects — they use gsd2_* commands
      const project = queryClient.getQueryData<api.Project>(['project', projectId]);
      if (project?.gsd_version === 'gsd2') {
        return { todos_synced: 0, milestones_synced: 0, plans_synced: 0, summaries_synced: 0, requirements_synced: 0, verifications_synced: 0 } as api.GsdSyncResult;
      }
      return api.gsdSyncProject(projectId);
    },
    onSuccess: (result, projectId) => {
      if (result.todos_synced === 0 && result.milestones_synced === 0 && result.plans_synced === 0 && result.summaries_synced === 0) {
        return; // Silent no-op for GSD-2 or empty sync
      }
      void queryClient.invalidateQueries({ queryKey: ['gsd', projectId] });
      toast.success(
        `GSD synced: ${result.todos_synced} todos, ${result.milestones_synced} milestones, ${result.plans_synced} plans, ${result.summaries_synced} summaries`,
      );
    },
    onError: (error) => {
      // Silently ignore GSD-2 guard errors — project version may not have been
      // in the query cache when the mutation was triggered
      const msg = getErrorMessage(error);
      if (msg.includes('Use gsd2_* commands instead')) return;
      toast.error('Failed to sync GSD data', { description: msg });
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

// Phase 12 artifact reader hooks (ARTF-01..04)
// retry:false on all — absent artifacts must not retry (D-06)
export const useGsdPhaseSpec = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseSpec(projectId, phase),
    queryFn: () => api.gsdGetPhaseSpec(projectId, phase),
    enabled: !!projectId && phase > 0,
    retry: false,
  });

export const useGsdPhaseSecurity = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseSecurity(projectId, phase),
    queryFn: () => api.gsdGetPhaseSecurity(projectId, phase),
    enabled: !!projectId && phase > 0,
    retry: false,
  });

export const useGsdPhaseValidationDoc = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseValidationDoc(projectId, phase),
    queryFn: () => api.gsdGetPhaseValidationDoc(projectId, phase),
    enabled: !!projectId && phase > 0,
    retry: false,
  });

export const useGsdPhaseReview = (projectId: string, phase: number) =>
  useQuery({
    queryKey: queryKeys.gsdPhaseReview(projectId, phase),
    queryFn: () => api.gsdGetPhaseReview(projectId, phase),
    enabled: !!projectId && phase > 0,
    retry: false,
  });

export const useGsdCodebaseDocs = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdCodebaseDocs(projectId),
    queryFn: () => api.gsdGetCodebaseDocs(projectId),
    enabled: !!projectId,
    retry: false,
  });

export const useGsdProcessDocs = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsdProcessDocs(projectId),
    queryFn: () => api.gsdGetProcessDocs(projectId),
    enabled: !!projectId,
    retry: false,
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

// Codebase docs (.planning/codebase/)
export const useCodebaseDoc = (projectPath: string, filename: string) =>
  useQuery({
    queryKey: ['codebase-doc', projectPath, filename],
    queryFn: () => api.readProjectFile(projectPath, `.planning/codebase/${filename}`),
    enabled: !!projectPath && !!filename,
    retry: false,
  });

// GSD-2 Health
export const useGsd2Health = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gsd2Health(projectId),
    queryFn: () => api.gsd2GetHealth(projectId),
    enabled: !!projectId && enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

export const useGsd2Models = (search?: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gsd2Models(search),
    queryFn: () => api.gsd2ListModels(search),
    enabled,
    staleTime: 60_000,
  });

export const useGsd2GeneratePlanPreview = () =>
  useMutation({
    mutationFn: (intent: string) => api.gsd2GeneratePlanPreview(intent),
    onError: (error) => {
      toast.error('Failed to generate plan preview', { description: getErrorMessage(error) });
    },
  });

// GSD-2 Worktrees
export const useGsd2Worktrees = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2Worktrees(projectId),
    queryFn: () => api.gsd2ListWorktrees(projectId),
    enabled: !!projectId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

export const useGsd2WorktreeDiff = (projectId: string, worktreeName: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.gsd2WorktreeDiff(projectId, worktreeName),
    queryFn: () => api.gsd2GetWorktreeDiff(projectId, worktreeName),
    enabled: !!projectId && !!worktreeName && enabled,
    staleTime: 30_000,
  });

export const useGsd2RemoveWorktree = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, worktreeName }: { projectId: string; worktreeName: string }) =>
      api.gsd2RemoveWorktree(projectId, worktreeName),
    onMutate: async ({ projectId, worktreeName }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.gsd2Worktrees(projectId) });
      const previous = queryClient.getQueryData<WorktreeInfo[]>(queryKeys.gsd2Worktrees(projectId));
      queryClient.setQueryData<WorktreeInfo[]>(
        queryKeys.gsd2Worktrees(projectId),
        (old) => old?.filter((w) => w.name !== worktreeName) ?? []
      );
      return { previous };
    },
    onError: (_err, { projectId }, context) => {
      queryClient.setQueryData(queryKeys.gsd2Worktrees(projectId), context?.previous);
      toast.error(`Failed to remove worktree — ${_err}`);
    },
    onSettled: (_data, _err, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2Worktrees(projectId) });
    },
  });
};

// GSD-2 Headless
export const useGsd2HeadlessQuery = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gsd2HeadlessQuery(projectId),
    queryFn: () => api.gsd2HeadlessQuery(projectId),
    enabled: !!projectId && enabled,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

export const useGsd2HeadlessStart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.gsd2HeadlessStart(projectId),
    onError: (error) => {
      toast.error('Failed to start headless session', { description: getErrorMessage(error) });
    },
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2HeadlessQuery(projectId) });
    },
  });
};

export const useGsd2HeadlessStartWithModel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, model }: { projectId: string; model: string }) =>
      api.gsd2HeadlessStartWithModel(projectId, model),
    onError: (error) => {
      toast.error('Failed to start headless session with model', { description: getErrorMessage(error) });
    },
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2HeadlessQuery(projectId) });
    },
  });
};

export const useGsd2HeadlessStop = () => {
  return useMutation({
    mutationFn: (sessionId: string) => api.gsd2HeadlessStop(sessionId),
    onError: (error) => {
      toast.error('Failed to stop headless session', { description: getErrorMessage(error) });
    },
  });
};

// GSD-2 Visualizer
export const useGsd2VisualizerData = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gsd2VisualizerData(projectId),
    queryFn: () => api.gsd2GetVisualizerData(projectId),
    enabled: !!projectId && enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

// GSD-2 Milestones / Slices / Tasks (Phase 5)
export const useGsd2Milestones = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2Milestones(projectId),
    queryFn: () => api.gsd2ListMilestones(projectId),
    enabled: !!projectId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

export const useGsd2Milestone = (projectId: string, milestoneId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.gsd2Milestone(projectId, milestoneId),
    queryFn: () => api.gsd2GetMilestone(projectId, milestoneId),
    enabled: !!projectId && !!milestoneId && enabled,
    staleTime: 15_000,
  });

export const useGsd2Slice = (projectId: string, milestoneId: string, sliceId: string, enabled: boolean) =>
  useQuery({
    queryKey: queryKeys.gsd2Slice(projectId, milestoneId, sliceId),
    queryFn: () => api.gsd2GetSlice(projectId, milestoneId, sliceId),
    enabled: !!projectId && !!milestoneId && !!sliceId && enabled,
    staleTime: 15_000,
  });

export const useGsd2DerivedState = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2DerivedState(projectId),
    queryFn: () => api.gsd2DeriveState(projectId),
    enabled: !!projectId,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

// GSD-2 Diagnostics — Doctor, Forensics, Skill Health
export const useGsd2DoctorReport = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2DoctorReport(projectId),
    queryFn: () => api.gsd2GetDoctorReport(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

export const useGsd2ForensicsReport = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2ForensicsReport(projectId),
    queryFn: () => api.gsd2GetForensicsReport(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

export const useGsd2SkillHealth = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2SkillHealth(projectId),
    queryFn: () => api.gsd2GetSkillHealth(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  });

export const useGsd2ApplyDoctorFixes = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => api.gsd2ApplyDoctorFixes(projectId),
    onSuccess: (_data, projectId) => {
      toast.success("Doctor fixes applied");
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2DoctorReport(projectId) });
    },
    onError: (error) => {
      toast.error('Failed to apply doctor fixes', { description: getErrorMessage(error) });
    },
  });
};

export const useGsd2KnowledgeData = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2KnowledgeData(projectId),
    queryFn: () => api.gsd2GetKnowledge(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

export const useGsd2CapturesData = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2CapturesData(projectId),
    queryFn: () => api.gsd2GetCaptures(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

export const useGsd2ResolveCapture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      captureId,
      classification,
      resolution,
      rationale,
    }: {
      projectId: string;
      captureId: string;
      classification: string;
      resolution: string;
      rationale: string;
    }) =>
      api.gsd2ResolveCapture(projectId, captureId, classification, resolution, rationale),
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2CapturesData(projectId) });
    },
    onError: (error) => {
      toast.error('Failed to resolve capture', { description: getErrorMessage(error) });
    },
  });
};

// ---- Inspect (R079) ----
export const useGsd2Inspect = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2Inspect(projectId),
    queryFn: () => api.gsd2GetInspect(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

// ---- Steer (R080) ----
export const useGsd2SteerContent = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2SteerContent(projectId),
    queryFn: () => api.gsd2GetSteerContent(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

export const useGsd2SetSteerContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, content }: { projectId: string; content: string }) =>
      api.gsd2SetSteerContent(projectId, content),
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2SteerContent(projectId) });
    },
    onError: (error) => {
      toast.error('Failed to save steer content', { description: getErrorMessage(error) });
    },
  });
};

// ---- Undo (R081) ----
export const useGsd2UndoInfo = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2UndoInfo(projectId),
    queryFn: () => api.gsd2GetUndoInfo(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

// ---- Recovery (R084) ----
export const useGsd2RecoveryInfo = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2RecoveryInfo(projectId),
    queryFn: () => api.gsd2GetRecoveryInfo(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

// ---- History / Metrics (R078) ----
export const useGsd2History = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2History(projectId),
    queryFn: () => api.gsd2GetHistory(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

// ---- Hooks (R082) ----
export const useGsd2Hooks = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2Hooks(projectId),
    queryFn: () => api.gsd2GetHooks(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

// ---- Git Summary (R083) ----
export const useGsd2GitSummary = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2GitSummary(projectId),
    queryFn: () => api.gsd2GetGitSummary(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

// ---- Export (R086) ----
export const useGsd2ExportProgress = () =>
  useMutation({
    mutationFn: ({ projectId }: { projectId: string }) =>
      api.gsd2ExportProgress(projectId),
    onError: (error) => {
      toast.error('Failed to export progress', { description: getErrorMessage(error) });
    },
  });

// ---- HTML Reports (R087, R088) ----
export const useGsd2ReportsIndex = (projectId: string) =>
  useQuery({
    queryKey: queryKeys.gsd2ReportsIndex(projectId),
    queryFn: () => api.gsd2GetReportsIndex(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });

export const useGsd2GenerateHtmlReport = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.gsd2GenerateHtmlReport(projectId),
    onSuccess: (result) => {
      toast.success('Report generated', { description: result.filename });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2ReportsIndex(projectId) });
    },
    onError: (error) => {
      toast.error('Failed to generate report', { description: getErrorMessage(error) });
    },
  });
};

// ============================================================
// Project Template Hooks (S03 - New Project Wizard)
// staleTime: Infinity — templates are compiled into the binary, never change at runtime
// ============================================================

export const useProjectTemplates = () =>
  useQuery({
    queryKey: ['projectTemplates'],
    queryFn: () => api.listProjectTemplates(),
    staleTime: Infinity,
  });

export const useGsdPlanningTemplates = () =>
  useQuery({
    queryKey: ['gsdPlanningTemplates'],
    queryFn: () => api.listGsdPlanningTemplates(),
    staleTime: Infinity,
  });

// GitHub
export const useGithubTokenStatus = () =>
  useQuery({
    queryKey: queryKeys.github.tokenStatus(),
    queryFn: api.githubGetTokenStatus,
  });

export const useGithubRepoInfo = (projectPath: string) =>
  useQuery({
    queryKey: queryKeys.github.repoInfo(projectPath),
    queryFn: () => api.githubGetRepoInfo(projectPath),
    enabled: !!projectPath,
    staleTime: 60_000,
  });

export const useGithubPrs = (projectPath: string, state = 'open', enabled = true) =>
  useQuery({
    queryKey: queryKeys.github.prs(projectPath, state),
    queryFn: () => api.githubListPrs(projectPath, state),
    enabled: !!projectPath && enabled,
    staleTime: 30_000,
  });

export const useGithubIssues = (projectPath: string, state = 'open', enabled = true, labels?: string) =>
  useQuery({
    queryKey: queryKeys.github.issues(projectPath, state, labels),
    queryFn: () => api.githubListIssues(projectPath, state, labels),
    enabled: !!projectPath && enabled,
    staleTime: 30_000,
  });

export const useGithubCheckRuns = (projectPath: string, gitRef: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.github.checkRuns(projectPath, gitRef),
    queryFn: () => api.githubListCheckRuns(projectPath, gitRef),
    enabled: !!projectPath && !!gitRef && enabled,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

export const useGithubReleases = (projectPath: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.github.releases(projectPath),
    queryFn: () => api.githubListReleases(projectPath),
    enabled: !!projectPath && enabled,
    staleTime: 120_000,
  });

export const useGithubNotifications = (projectPath: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.github.notifications(projectPath),
    queryFn: () => api.githubListRepoNotifications(projectPath),
    enabled: !!projectPath && enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const useGithubCreatePr = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectPath,
      title,
      body,
      head,
      base,
      draft,
    }: {
      projectPath: string;
      title: string;
      body: string;
      head: string;
      base: string;
      draft: boolean;
    }) => api.githubCreatePr(projectPath, title, body, head, base, draft),
    onSuccess: (_, { projectPath }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.prs(projectPath) });
    },
  });
};

export const useGithubCreateIssue = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectPath,
      title,
      body,
      labels,
      assignees,
    }: {
      projectPath: string;
      title: string;
      body: string;
      labels: string[];
      assignees: string[];
    }) => api.githubCreateIssue(projectPath, title, body, labels, assignees),
    onSuccess: (_, { projectPath }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.issues(projectPath) });
    },
  });
};

export const useGithubImportGhToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.githubImportGhToken,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.tokenStatus() });
    },
  });
};

export const useGithubSaveToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.githubSaveToken(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.tokenStatus() });
    },
  });
};

export const useGithubRemoveToken = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.githubRemoveToken,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.github.tokenStatus() });
    },
  });
};

// ============================================================
// GSD-2 Sessions (M013 / S02)
// ============================================================

export const useGsd2Sessions = (projectId: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gsd2Sessions(projectId),
    queryFn: () => api.gsd2ListSessions(projectId),
    enabled: !!projectId && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

// ============================================================
// GSD-2 Preferences (M013 / S02)
// ============================================================

export const useGsd2Preferences = (projectPath: string | undefined, enabled = true) =>
  useQuery({
    queryKey: queryKeys.gsd2Preferences(projectPath ?? ''),
    queryFn: () => api.gsd2GetPreferences(projectPath ?? ''),
    enabled,
    staleTime: 60_000,
  });

export const useGsd2SavePreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectPath,
      scope,
      payload,
    }: {
      projectPath: string;
      scope: string;
      payload: Record<string, unknown>;
    }) => api.gsd2SavePreferences(projectPath, scope, payload),
    onSuccess: (_data, { projectPath }) => {
      toast.success('Preferences saved');
      void queryClient.invalidateQueries({ queryKey: queryKeys.gsd2Preferences(projectPath) });
    },
    onError: (error) => {
      toast.error('Failed to save preferences', { description: getErrorMessage(error) });
    },
  });
};

// ── Terminal & Utility hooks ───────────────────────────────────────────────

export const useTmuxSessions = () =>
  useQuery({
    queryKey: queryKeys.tmuxSessions(),
    queryFn: () => api.ptyListTmux(),
    staleTime: 30_000,
    retry: false,
  });

export const useProjectDocs = (path: string) =>
  useQuery({
    queryKey: queryKeys.projectDocs(path),
    queryFn: () => api.readProjectDocs(path),
    enabled: !!path,
    staleTime: 5 * 60 * 1000,
  });

// AI Tools Detected — consumed by AiToolsDetectedCard in project-overview-tab.
// STUB: the backend AI-tool scanner and the `agent-editor` view this card links to
// were never built (the card UI was committed ahead of its data layer). This returns
// an empty result so the card no-ops cleanly and the build stays green. Wire to a real
// invoke wrapper when the detection command lands (tracked for v1.3+).
export interface AiToolDetection {
  tool: string;
  label: string;
  files: { scope: string }[];
}

export interface ProjectWorkflowsInfo {
  has_any_ai_config: boolean;
  tools: AiToolDetection[];
  tool_count: number;
  file_count: number;
}

export const useProjectWorkflows = (path: string) =>
  useQuery({
    queryKey: queryKeys.projectWorkflows(path),
    queryFn: async (): Promise<ProjectWorkflowsInfo> => ({
      has_any_ai_config: false,
      tools: [],
      tool_count: 0,
      file_count: 0,
    }),
    enabled: !!path,
  });

export const useDetectTechStack = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api.detectTechStack(path),
    onSuccess: () => {
      toast.success('Tech stack refreshed');
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
    onError: (error) => {
      toast.error('Failed to detect tech stack', { description: getErrorMessage(error) });
    },
  });
};

export const useReorderScriptFavorites = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, scriptIds }: { projectId: string; scriptIds: string[] }) =>
      api.reorderScriptFavorites(projectId, scriptIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
  });
};
