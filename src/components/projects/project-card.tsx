// Track Your Shit - Shared Project Card Component
// Enriched card with stats, git info, progress, costs, and favorites
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Link, useNavigate } from 'react-router-dom';
import {
  Star,
  Terminal,
  Map,
  GitBranch,
  DollarSign,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useGitInfo, useToggleFavorite } from '@/lib/queries';
import { formatCost, formatRelativeTime, truncatePath, cn } from '@/lib/utils';
import {
  getStatusClasses,
  getProjectType,
  projectTypeConfig,
  type Status,
} from '@/lib/design-tokens';
import type { ProjectWithStats } from '@/lib/tauri';

interface ProjectCardProps {
  project: ProjectWithStats;
  showDescription?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function ProjectCard({ project, showDescription, selected, onToggleSelect }: ProjectCardProps) {
  const navigate = useNavigate();
  const { data: gitInfo } = useGitInfo(project.path);
  const toggleFavorite = useToggleFavorite();

  const handleQuickAction = (
    e: React.MouseEvent,
    action: 'shell' | 'plan'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (action === 'shell') {
      void navigate(`/projects/${project.id}?tab=shell`);
    } else {
      void navigate(`/projects/${project.id}?tab=gsd`);
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate(project.id);
  };

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleSelect?.();
  };

  const projectType = getProjectType(project.tech_stack);
  const typeConfig = projectTypeConfig[projectType];

  const progressPct =
    project.roadmap_progress && project.roadmap_progress.total_tasks > 0
      ? Math.round(
          (project.roadmap_progress.completed_tasks /
            project.roadmap_progress.total_tasks) *
            100
        )
      : 0;

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block p-4 rounded-lg border bg-gradient-to-r from-card to-card/80 hover:from-card hover:to-accent/20 hover:border-brand-blue/30 hover:shadow-md transition-all duration-200 group"
    >
      {/* Row 1: Name + Running indicator */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Checkbox for selection */}
          {onToggleSelect && (
            <div onClick={handleCheckboxChange} className="shrink-0">
              <Checkbox checked={selected} aria-label="Select project" />
            </div>
          )}

          {/* Favorite star */}
          <Button
            variant="ghost"
            size="icon-xs"
            className={cn(
              'h-6 w-6 shrink-0',
              project.is_favorite
                ? 'text-brand-yellow hover:text-brand-yellow/80'
                : 'text-muted-foreground/40 hover:text-brand-yellow opacity-0 group-hover:opacity-100'
            )}
            onClick={handleToggleFavorite}
            aria-label={
              project.is_favorite ? 'Remove from favorites' : 'Add to favorites'
            }
          >
            <Star
              className={cn('h-3.5 w-3.5', project.is_favorite && 'fill-current')}
            />
          </Button>

          <h3 className="font-semibold truncate group-hover:text-brand-blue transition-colors">
            {project.name}
          </h3>

          {false && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-status-success" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Execution running</TooltipContent>
            </Tooltip>
          )}

          {/* Project type badge */}
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

        {/* Quick Actions + Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 rounded-md hover:bg-brand-blue/10 hover:text-brand-blue"
              onClick={(e) => handleQuickAction(e, 'shell')}
              title="Open Shell"
              aria-label="Open Shell"
            >
              <Terminal className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="h-7 w-7 rounded-md hover:bg-brand-purple/10 hover:text-brand-purple"
              onClick={(e) => handleQuickAction(e, 'plan')}
              title="View Plan"
              aria-label="View Plan"
            >
              <Map className="h-3.5 w-3.5" />
            </Button>
          </div>

          <span
            className={cn(
              'text-xs px-2 py-1 rounded-full',
              getStatusClasses(project.status as Status).combined
            )}
          >
            {project.status}
          </span>
        </div>
      </div>

      {/* Row 2: Path */}
      <p className="text-sm text-muted-foreground truncate mt-1 ml-8">
        {truncatePath(project.path)}
      </p>

      {/* Row 3: Description (optional) */}
      {showDescription && project.description && (
        <p className="text-sm text-muted-foreground/80 truncate mt-1 ml-8">
          {project.description}
        </p>
      )}

      {/* Row 4: Tech stack badges + Git branch */}
      <div className="flex items-center gap-2 mt-2 ml-8 flex-wrap">
        {project.tech_stack?.framework && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded">
            {project.tech_stack.framework}
          </span>
        )}
        {project.tech_stack?.language && (
          <span className="text-xs bg-muted px-2 py-0.5 rounded">
            {project.tech_stack.language}
          </span>
        )}
        {gitInfo?.has_git && gitInfo.branch && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded inline-flex items-center gap-1',
                  gitInfo.is_dirty
                    ? 'bg-status-warning/10 text-status-warning border border-status-warning/20'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <GitBranch className="h-3 w-3" />
                {gitInfo.branch}
                {gitInfo.is_dirty && ' *'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {gitInfo.is_dirty
                ? 'Uncommitted changes'
                : `On branch ${gitInfo.branch}`}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Row 5: Progress bar + Cost + Last activity */}
      <div className="flex items-center gap-3 mt-2.5 ml-8">
        {/* Roadmap progress */}
        {project.roadmap_progress &&
          project.roadmap_progress.total_tasks > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Progress
                value={progressPct}
                variant="brand"
                size="sm"
                className="flex-1 max-w-[140px]"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {project.roadmap_progress.completed_tasks}/
                {project.roadmap_progress.total_tasks} tasks
              </span>
            </div>
          )}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Cost badge */}
          {project.total_cost > 0 && (
            <Badge variant="subtle-cyan" size="sm">
              <DollarSign className="h-3 w-3 mr-0.5" />
              {formatCost(project.total_cost)}
            </Badge>
          )}

          {/* Last activity */}
          {project.last_activity_at && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(project.last_activity_at)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
