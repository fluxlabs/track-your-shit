// Track Your Shit - Terminal Page (Unified)
// Interactive shell with PTY access + execution output viewer
// Supports both full mode (/terminal route) and compact mode (persistent bottom panel)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useMemo, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useProject, useProjects } from '@/lib/queries';
import { ProjectSelector } from '@/components/shared/project-selector';
import { TerminalTabs } from '@/components/terminal';
import { Card } from '@/components/ui/card';
import { useTerminalContext } from '@/contexts/terminal-context';
import { cn } from '@/lib/utils';
import {
  Terminal,
  SquareTerminal,
  Loader2,
  FolderOpen,
  ChevronDown,
  Play,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

type TerminalMode = 'shell' | 'output';

export function ShellPage() {
  const location = useLocation();
  const isTerminalRoute = location.pathname.startsWith('/terminal');
  const [mode, setMode] = useState<TerminalMode>('shell');
  const { shellProjectId, shellProjectPath, setShellProject } =
    useTerminalContext();

  // Derive URL project ID when on terminal route
  const urlProjectId = useMemo(() => {
    if (isTerminalRoute) {
      const match = location.pathname.match(/^\/terminal\/(.+)/);
      return match?.[1];
    }
    return undefined;
  }, [location.pathname, isTerminalRoute]);

  // Resolve project ID: prefer URL when on terminal route, otherwise use context
  const projectId = isTerminalRoute
    ? urlProjectId
    : (shellProjectId ?? undefined);

  const { data: project, isLoading: projectLoading } = useProject(
    projectId || ''
  );
  const { data: projects } = useProjects();

  // Sync selected project to context for persistence across navigation
  useEffect(() => {
    if (project) {
      setShellProject(project.id, project.path);
    }
  }, [project, setShellProject]);

  // Derive last valid project so TerminalTabs stays mounted across
  // project deselection and page navigation
  const activeProject = useMemo(() => {
    if (project) {
      return { id: project.id, path: project.path, name: project.name };
    }
    if (shellProjectId && shellProjectPath) {
      return { id: shellProjectId, path: shellProjectPath, name: '' };
    }
    return null;
  }, [project, shellProjectId, shellProjectPath]);
  const isTerminalActive = !!projectId && !!project;

  // Handle compact project selection (no URL navigation)
  const handleCompactProjectSelect = (selectedProjectId: string) => {
    const selectedProject = projects?.find((p) => p.id === selectedProjectId);
    if (selectedProject) {
      setShellProject(selectedProject.id, selectedProject.path);
    }
  };

  return (
    <div className={cn('h-full flex flex-col', isTerminalRoute && 'p-8')}>
      {/* Full mode header — hidden in compact mode */}
      <div className={isTerminalRoute ? undefined : 'hidden'}>
        <PageHeader
          title="Terminal"
          description="Interactive shell and execution output viewer"
          icon={<Terminal className="h-6 w-6 text-muted-foreground" />}
          actions={
            <div className="flex items-center bg-muted rounded-lg p-1">
              <button
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  mode === 'shell'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setMode('shell')}
              >
                <SquareTerminal className="h-4 w-4" />
                Interactive Shell
              </button>
              <button
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  mode === 'output'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setMode('output')}
              >
                <Play className="h-4 w-4" />
                Execution Output
              </button>
            </div>
          }
        />
        <div className="mb-6 max-w-md">
          <ProjectSelector
            selectedProjectId={projectId}
            basePath="/terminal"
            placeholder="Select a project..."
          />
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 min-h-0 relative">
        {/* Full mode state overlays */}
        {isTerminalRoute && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            {!projectId && (
              <Card className="h-full flex items-center justify-center pointer-events-auto">
                <div className="text-center text-muted-foreground">
                  <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a project to open a terminal</p>
                  <p className="text-sm mt-1">
                    You can run shell commands or view execution output
                  </p>
                </div>
              </Card>
            )}
            {projectId && projectLoading && (
              <Card className="h-full flex items-center justify-center pointer-events-auto">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </Card>
            )}
            {projectId && !projectLoading && !project && (
              <Card className="h-full flex items-center justify-center pointer-events-auto">
                <div className="text-center text-destructive">
                  Project not found
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Content based on mode */}
        {activeProject ? (
          <div
            className={cn(
              'h-full',
              isTerminalRoute && !isTerminalActive && 'invisible',
              isTerminalRoute &&
                mode === 'shell' &&
                'rounded-xl border bg-card text-card-foreground shadow overflow-hidden'
            )}
          >
            {/* Shell mode or compact mode (bottom panel always shows shell) */}
            {mode === 'shell' || !isTerminalRoute ? (
              <TerminalTabs
                projectId={activeProject.id}
                workingDirectory={activeProject.path}
                className="h-full"
                headerSlot={
                  !isTerminalRoute ? (
                    <CompactProjectSelector
                      projectId={activeProject.id}
                      projects={projects ?? []}
                      onSelect={handleCompactProjectSelect}
                    />
                  ) : undefined
                }
              />
            ) : null}
          </div>
        ) : !isTerminalRoute ? (
          <div className="h-full flex items-center justify-center gap-4 bg-[#0a0a0a]/50">
            <SquareTerminal className="h-5 w-5 text-muted-foreground/50" />
            <CompactProjectSelector
              projects={projects ?? []}
              onSelect={handleCompactProjectSelect}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Compact inline project selector for the bottom panel
function CompactProjectSelector({
  projectId,
  projects,
  onSelect,
}: {
  projectId?: string;
  projects: Array<{ id: string; name: string; path: string }>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative flex items-center gap-1.5">
      <FolderOpen className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <select
        value={projectId || ''}
        onChange={(e) => {
          if (e.target.value) {
            onSelect(e.target.value);
          }
        }}
        className="text-xs bg-transparent border-none outline-none cursor-pointer text-muted-foreground hover:text-foreground appearance-none pr-4 max-w-[140px] truncate"
      >
        <option value="">Select project...</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0 -ml-3 pointer-events-none" />
    </div>
  );
}
