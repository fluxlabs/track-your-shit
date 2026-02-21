// Track Your Shit - Project Row (dashboard list item)
// Compact single-row layout with live GSD stats
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import React from 'react';
import { Link } from 'react-router-dom';
import { Star, GitBranch, Clock, AlertTriangle, CheckSquare } from 'lucide-react';
import { useToggleFavorite, useGsdTodos } from '@/lib/queries';
import { formatRelativeTime, cn } from '@/lib/utils';
import { getProjectType, projectTypeConfig } from '@/lib/design-tokens';
import type { ProjectWithStats, GitInfo } from '@/lib/tauri';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectRowProps {
  project: ProjectWithStats;
  gitInfo: GitInfo | null;
}

export const ProjectRow = React.memo(function ProjectRow({
  project,
  gitInfo,
}: ProjectRowProps) {
  const toggleFavorite = useToggleFavorite();
  const hasGsd = !!project.tech_stack?.has_planning;

  // Only fetch GSD todos for GSD projects
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

  // Live GSD stats
  const pendingTodos = todos ?? [];
  const blockerCount = pendingTodos.filter((t) => t.is_blocker).length;
  const todoCount = pendingTodos.length;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card/50 hover:bg-card/80 hover:border-border/80 transition-colors group"
    >
      {/* Star */}
      <button
        onClick={handleStar}
        className={cn(
          'p-0.5 rounded shrink-0',
          project.is_favorite
            ? 'text-brand-yellow'
            : 'text-muted-foreground/30 hover:text-brand-yellow'
        )}
        aria-label={
          project.is_favorite ? 'Remove from favorites' : 'Add to favorites'
        }
      >
        <Star
          className={cn(
            'h-3.5 w-3.5',
            project.is_favorite && 'fill-current'
          )}
        />
      </button>

      {/* Name */}
      <div className="flex items-center gap-2 min-w-0 w-[200px] shrink-0">
        <span className="font-medium text-sm text-foreground truncate">
          {project.name}
        </span>
      </div>

      {/* Type badge */}
      <span
        className={cn(
          'text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0',
          typeConfig.classes
        )}
      >
        {typeConfig.label}
      </span>

      {/* GSD stats — blocker + todo count */}
      {hasGsd && (
        <div className="flex items-center gap-1.5 shrink-0">
          {blockerCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-status-error bg-status-error/10 border border-status-error/20 rounded px-1.5 py-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {blockerCount}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {blockerCount} blocking {blockerCount === 1 ? 'todo' : 'todos'}
              </TooltipContent>
            </Tooltip>
          )}
          {todoCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground bg-muted/60 border border-border/50 rounded px-1.5 py-0.5">
              <CheckSquare className="h-2.5 w-2.5" />
              {todoCount}
            </span>
          )}
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-2 w-[130px] shrink-0">
        {progressPct !== null && fp ? (
          <>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-blue rounded-full transition-all"
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
              {fp.completed_tasks}/{fp.total_tasks}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            {hasGsd ? '' : 'No roadmap'}
          </span>
        )}
      </div>

      {/* Git */}
      <div className="w-[100px] shrink-0 truncate">
        {gitInfo?.has_git && gitInfo.branch ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs truncate',
              gitInfo.is_dirty
                ? 'text-status-warning'
                : 'text-muted-foreground'
            )}
          >
            <GitBranch className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {gitInfo.branch}
              {gitInfo.is_dirty ? ' *' : ''}
            </span>
          </span>
        ) : null}
      </div>

      {/* Last activity */}
      <div className="ml-auto shrink-0">
        {project.last_activity_at && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <Clock className="h-3 w-3 shrink-0" />
            {formatRelativeTime(project.last_activity_at)}
          </span>
        )}
      </div>
    </Link>
  );
});
