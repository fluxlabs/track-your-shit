// Track Your Shit - Project Card (dashboard grid item)
// Enhanced with live GSD todo/blocker/phase data
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import React from 'react';
import { Link } from 'react-router-dom';
import { Star, GitBranch, Clock, AlertTriangle, CheckSquare } from 'lucide-react';
import { useToggleFavorite, useGsdTodos } from '@/lib/queries';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  getProjectType,
  projectTypeConfig,
} from '@/lib/design-tokens';
import type { ProjectWithStats, GitInfo } from '@/lib/tauri';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectCardProps {
  project: ProjectWithStats;
  gitInfo: GitInfo | null;
}

export const ProjectCard = React.memo(function ProjectCard({
  project,
  gitInfo,
}: ProjectCardProps) {
  const toggleFavorite = useToggleFavorite();
  const hasGsd = !!project.tech_stack?.has_planning;

  // Only fetch GSD todos for GSD projects — no-op for bare projects
  const { data: todos } = useGsdTodos(hasGsd ? project.id : '', 'pending');

  const handleStar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate(project.id);
  };

  const projectType = getProjectType(project.tech_stack);
  const typeConfig = projectTypeConfig[projectType];

  const fp = project.roadmap_progress;
  const progressPct =
    fp && fp.total_tasks > 0
      ? Math.round((fp.completed_tasks / fp.total_tasks) * 100)
      : null;

  // Derive GSD live stats from todos query (pending only)
  const pendingTodos = todos ?? [];
  const blockerTodos = pendingTodos.filter((t) => t.is_blocker);
  const todoCount = pendingTodos.length;
  const blockerCount = blockerTodos.length;

  return (
    <Link to={`/projects/${project.id}`} className="block">
      <Card variant="elevated" interactive className="h-full">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 pb-0">
          <button
            onClick={handleStar}
            className={cn(
              'p-0.5 rounded shrink-0',
              project.is_favorite
                ? 'text-brand-yellow'
                : 'text-muted-foreground/30 hover:text-brand-yellow'
            )}
            aria-label={
              project.is_favorite
                ? 'Remove from favorites'
                : 'Add to favorites'
            }
          >
            <Star
              className={cn(
                'h-4 w-4',
                project.is_favorite && 'fill-current'
              )}
            />
          </button>
          <h3 className="font-semibold text-foreground truncate flex-1 text-sm">
            {project.name}
          </h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
                  typeConfig.classes
                )}
              >
                {typeConfig.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>{typeConfig.tooltip}</TooltipContent>
          </Tooltip>
        </div>

        <CardContent className="p-4 pt-3 space-y-3">
          {/* Description */}
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}

          {/* GSD live stats row — only for GSD projects */}
          {hasGsd && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Phase count badge */}
              {project.tech_stack?.gsd_phase_count != null && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-purple bg-brand-purple/10 border border-brand-purple/20 rounded px-1.5 py-0.5">
                  {project.tech_stack.gsd_phase_count}{' '}
                  {project.tech_stack.gsd_phase_count === 1 ? 'phase' : 'phases'}
                </span>
              )}

              {/* Blocker chip — high priority, shown before todo count */}
              {blockerCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-error bg-status-error/10 border border-status-error/20 rounded px-1.5 py-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {blockerCount} {blockerCount === 1 ? 'blocker' : 'blockers'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {blockerCount} blocking {blockerCount === 1 ? 'todo' : 'todos'} need attention
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Todo count chip */}
              {todoCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/60 border border-border/50 rounded px-1.5 py-0.5">
                  <CheckSquare className="h-2.5 w-2.5" />
                  {todoCount} {todoCount === 1 ? 'todo' : 'todos'}
                </span>
              )}

              {/* No todos: clean state */}
              {todoCount === 0 && blockerCount === 0 && (
                <span className="text-[10px] text-muted-foreground/60">
                  No open todos
                </span>
              )}
            </div>
          )}

          {/* Progress row */}
          <div className="flex items-center gap-3">
            {progressPct !== null && fp ? (
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-blue rounded-full transition-all"
                    style={{ width: `${Math.min(progressPct, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                  {fp.completed_tasks}/{fp.total_tasks}
                </span>
              </div>
            ) : (
              !hasGsd && (
                <span className="text-xs text-muted-foreground flex-1">
                  No roadmap
                </span>
              )
            )}
          </div>

          {/* Info row: git, activity */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {/* Git */}
            {gitInfo?.has_git && gitInfo.branch ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 truncate max-w-[120px]',
                  gitInfo.is_dirty && 'text-status-warning'
                )}
              >
                <GitBranch className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {gitInfo.branch}
                  {gitInfo.is_dirty ? ' *' : ''}
                </span>
              </span>
            ) : null}

            {/* Last activity */}
            {project.last_activity_at && (
              <span className="inline-flex items-center gap-1 ml-auto">
                <Clock className="h-3 w-3 shrink-0" />
                {formatRelativeTime(project.last_activity_at)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
