// Track Your Shit - GSD File Watcher Hook
// Listens for gsd:file-changed events and triggers targeted query invalidation
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface GsdFileChangedPayload {
  project_path: string;
  file_path: string;
  change_type: string;
}

/**
 * Listens for `gsd:file-changed` events from the backend file watcher
 * and triggers targeted query invalidation based on change_type.
 *
 * Debounces rapid multi-file changes with a 500ms trailing timeout.
 */
export function useGsdFileWatcher(
  projectId: string,
  projectPath: string,
  enabled: boolean,
  onSyncRoadmap?: () => void,
) {
  const queryClient = useQueryClient();
  const pendingTypesRef = useRef<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || !projectPath) return;

    let unlisten: (() => void) | undefined;

    const invalidateForTypes = (types: Set<string>) => {
      let shouldSyncRoadmap = false;

      for (const changeType of types) {
        switch (changeType) {
          case 'gsd_state':
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdState(projectId) });
            shouldSyncRoadmap = true;
            break;
          case 'gsd_todo':
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdTodos(projectId) });
            break;
          case 'gsd_phase':
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdPlans(projectId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdSummaries(projectId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdPhaseResearchList(projectId) });
            shouldSyncRoadmap = true;
            break;
          case 'gsd_requirements':
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdRequirements(projectId) });
            break;
          case 'gsd_config':
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdConfig(projectId) });
            break;
          case 'gsd_roadmap':
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdMilestones(projectId) });
            break;
          case 'gsd_project':
            void queryClient.invalidateQueries({ queryKey: queryKeys.gsdProjectInfo(projectId) });
            break;
          default:
            // gsd_other or unknown — invalidate all GSD queries
            void queryClient.invalidateQueries({ queryKey: queryKeys.allGsd(projectId) });
            break;
        }
      }

      // Always invalidate activity on any GSD change
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity(projectId) });

      if (shouldSyncRoadmap && onSyncRoadmap) {
        onSyncRoadmap();
      }
    };

    const flushPending = () => {
      if (pendingTypesRef.current.size > 0) {
        invalidateForTypes(pendingTypesRef.current);
        pendingTypesRef.current = new Set();
      }
    };

    listen<GsdFileChangedPayload>('gsd:file-changed', (event) => {
      if (event.payload.project_path !== projectPath) return;

      pendingTypesRef.current.add(event.payload.change_type);

      // Debounce: batch rapid changes into a single invalidation pass
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(flushPending, 500);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [projectId, projectPath, enabled, queryClient, onSyncRoadmap]);
}
