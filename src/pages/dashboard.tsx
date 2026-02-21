// Track Your Shit - Dashboard Page
// Rich project grid — all GSD projects at a glance
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo } from 'react';
import {
  Plus,
  FolderOpen,
  LayoutDashboard,
  Search,
  X,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { useProjectsWithStats } from '@/lib/queries';
import { queryKeys } from '@/lib/query-keys';
import * as api from '@/lib/tauri';
import type { GitInfo } from '@/lib/tauri';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProjectWizardDialog } from '@/components/projects';
import { StatusBar, ProjectCard, ProjectRow } from '@/components/dashboard';
import { PageHeader } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';
type FilterTab = 'all' | 'active' | 'archived';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

export function Dashboard() {
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const { data: projects, isLoading } = useProjectsWithStats();

  // Batch git queries for all projects
  const gitQueries = useQueries({
    queries: (projects ?? []).map((p) => ({
      queryKey: queryKeys.gitInfo(p.path),
      queryFn: () => api.getGitInfo(p.path),
      enabled: !!p.path,
      staleTime: 30000,
    })),
  });

  // Build gitMap: projectId -> GitInfo
  const gitMap = useMemo(() => {
    const map = new Map<string, GitInfo>();
    (projects ?? []).forEach((p, i) => {
      const data = gitQueries[i]?.data;
      if (data) map.set(p.id, data);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, JSON.stringify(gitQueries.map((q) => q.data))]);

  // Sort: favorites first, then by last activity descending
  const sortedProjects = useMemo(() => {
    if (!projects?.length) return [];
    return [...projects].sort((a, b) => {
      if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
      const tA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const tB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return tB - tA;
    });
  }, [projects]);

  // Filter by tab (status field)
  const tabFilteredProjects = useMemo(() => {
    if (activeFilter === 'all') return sortedProjects;
    if (activeFilter === 'archived')
      return sortedProjects.filter((p) => p.status === 'archived');
    // 'active' = anything that is not archived
    return sortedProjects.filter((p) => p.status !== 'archived');
  }, [sortedProjects, activeFilter]);

  // Filter by search query (name + description)
  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabFilteredProjects;
    return tabFilteredProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q),
    );
  }, [tabFilteredProjects, search]);

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-8 pt-6 pb-4">
        <PageHeader
          title="All Your Shit"
          description="Your GSD projects at a glance"
          icon={<LayoutDashboard className="h-6 w-6 text-muted-foreground" />}
          actions={
            <Button onClick={() => setAddProjectOpen(true)} size="sm">
              <Plus className="h-4 w-4" />
              Add Project
            </Button>
          }
        />
      </div>

      {/* Stats Bar */}
      <div className="px-8 pb-4">
        <StatusBar />
      </div>

      {/* Toolbar: search + filter tabs + view toggle */}
      <div className="px-8 pb-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="h-8 pl-8 pr-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 border rounded-md p-0.5 bg-muted/30">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                'px-3 py-1 text-xs rounded transition-colors',
                activeFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Count label */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredProjects.length}
          {search || activeFilter !== 'all'
            ? ` / ${projects?.length ?? 0}`
            : ''}{' '}
          {filteredProjects.length === 1 ? 'project' : 'projects'}
        </span>

        {/* View toggle — pushed to right */}
        <div className="flex items-center border rounded-md ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded-l-md transition-colors',
              viewMode === 'grid'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 rounded-r-md transition-colors',
              viewMode === 'list'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-auto px-8 pb-4">
        {isLoading ? (
          <SkeletonGrid />
        ) : !projects?.length ? (
          <EmptyState onAdd={() => setAddProjectOpen(true)} />
        ) : (
          <>
            {/* Empty search/filter state */}
            {filteredProjects.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search
                    ? `No projects match "${search}"`
                    : `No ${activeFilter} projects`}
                </p>
              </div>
            )}

            {/* Grid view */}
            {viewMode === 'grid' && filteredProjects.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    gitInfo={gitMap.get(project.id) ?? null}
                  />
                ))}
              </div>
            )}

            {/* List view */}
            {viewMode === 'list' && filteredProjects.length > 0 && (
              <div className="flex flex-col gap-1">
                {filteredProjects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    gitInfo={gitMap.get(project.id) ?? null}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ProjectWizardDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[400px]">
      <div className="text-center py-16">
        <div className="p-4 rounded-full bg-gradient-to-br from-brand-blue/10 to-brand-purple/10 w-fit mx-auto mb-4">
          <FolderOpen className="h-12 w-12 text-brand-blue" />
        </div>
        <h3 className="text-lg font-medium mb-2">No projects yet</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Add one to get started
        </p>
        <Button onClick={onAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card/30 p-4 space-y-3 animate-pulse"
        >
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-muted/50 rounded" />
            <div className="h-4 flex-1 bg-muted/50 rounded" />
            <div className="h-4 w-10 bg-muted/50 rounded" />
          </div>
          <div className="h-3 w-3/4 bg-muted/50 rounded" />
          <div className="flex items-center gap-2">
            <div className="h-5 w-16 bg-muted/50 rounded" />
            <div className="h-5 w-12 bg-muted/50 rounded" />
          </div>
          <div className="flex-1 h-1.5 bg-muted/50 rounded-full" />
          <div className="flex items-center gap-3">
            <div className="h-3 w-20 bg-muted/50 rounded" />
            <div className="h-3 w-16 bg-muted/50 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
