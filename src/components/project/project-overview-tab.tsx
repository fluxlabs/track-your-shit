// Track Your Shit - Project Overview Tab Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityFeed } from '@/components/project';
import { QuickActionsBar } from './quick-actions-bar';
import { GitStatusWidget } from './git-status-widget';
import { DependencyAlertsCard } from './dependency-alerts-card';
import { RequirementsCard } from './requirements-card';
import { VisionCard } from './vision-card';
import { RoadmapProgressCard } from './roadmap-progress-card';
import type { Project } from '@/lib/tauri';
import { useGsdState, useGsdTodos, useGsdConfig, useGsdSync } from '@/lib/queries';
import {
  CheckSquare,
  AlertTriangle,
  Crosshair,
  Settings2,
  Gauge,
  Timer,
  GitBranch,
} from 'lucide-react';

interface ProjectOverviewTabProps {
  project: Project;
  onOpenShell: () => void;
}

export function ProjectOverviewTab({
  project,
  onOpenShell,
}: ProjectOverviewTabProps) {
  const gsdSync = useGsdSync();
  const hasPlanning = project.tech_stack?.has_planning ?? false;

  return (
    <div className="space-y-4 pb-4">
      {/* Quick Actions */}
      <QuickActionsBar
        onOpenShell={onOpenShell}
        onSyncGsd={hasPlanning ? () => gsdSync.mutate(project.id) : undefined}
        isSyncingGsd={gsdSync.isPending}
        hasPlanning={hasPlanning}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GSD State — primary card for GSD projects */}
        {hasPlanning && <GsdStateCard projectId={project.id} />}

        {/* Roadmap Progress — phase completion from ROADMAP.md */}
        {hasPlanning && <RoadmapProgressCard projectId={project.id} />}

        {/* Vision (PROJECT.md) */}
        {hasPlanning && <VisionCard projectPath={project.path} />}

        {/* Requirements Coverage (REQUIREMENTS.md) */}
        {hasPlanning && <RequirementsCard projectId={project.id} />}

        {/* Git Status */}
        <GitStatusWidget projectPath={project.path} />

        {/* Dependency Alerts */}
        <DependencyAlertsCard projectId={project.id} projectPath={project.path} />

        {/* Activity Feed */}
        <ActivityFeed projectId={project.id} limit={15} />

        {/* Project Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-medium capitalize">{project.status}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Framework</p>
                <p className="font-medium">{project.tech_stack?.framework || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Language</p>
                <p className="font-medium">{project.tech_stack?.language || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Package Manager</p>
                <p className="font-medium">{project.tech_stack?.package_manager || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Database</p>
                <p className="font-medium">{project.tech_stack?.database || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Test Framework</p>
                <p className="font-medium">{project.tech_stack?.test_framework || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">GSD Planning</p>
                <p className="font-medium">{project.tech_stack?.has_planning ? 'Yes' : 'No'}</p>
              </div>
            </div>
            {project.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{project.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- GSD State Card ---

function GsdStateCard({ projectId }: { projectId: string }) {
  const { data: state } = useGsdState(projectId);
  const { data: todos } = useGsdTodos(projectId);
  const { data: config } = useGsdConfig(projectId);

  const pendingCount = (todos ?? []).filter((t) => t.status === 'pending').length;
  const blockerCount = (todos ?? []).filter((t) => t.is_blocker && t.status === 'pending').length;
  const pos = state?.current_position;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Crosshair className="h-4 w-4 text-brand-purple" />
          GSD State
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pos && (
          <div className="space-y-1.5">
            {pos.milestone && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Milestone</span>
                <span className="font-medium">{pos.milestone}</span>
              </div>
            )}
            {pos.phase && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Phase</span>
                <span className="font-medium">{pos.phase}</span>
              </div>
            )}
            {pos.status && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{pos.status}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckSquare className="h-3 w-3" />
            {pendingCount} pending todos
          </span>
          {blockerCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-status-error">
              <AlertTriangle className="h-3 w-3" />
              {blockerCount} blocker{blockerCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {state?.velocity && (
          <div className="border-t pt-2 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Gauge className="h-3 w-3 text-brand-purple" />
              Velocity
            </div>
            <div className="flex items-center gap-3">
              {state.velocity.total_plans != null && (
                <span className="text-xs text-muted-foreground">{state.velocity.total_plans} plans</span>
              )}
              {state.velocity.avg_duration && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  avg {state.velocity.avg_duration}
                </span>
              )}
              {state.velocity.total_time && (
                <span className="text-xs text-muted-foreground">total {state.velocity.total_time}</span>
              )}
            </div>
          </div>
        )}

        {(state?.blockers?.length ?? 0) > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center gap-1.5 text-xs text-status-error">
              <AlertTriangle className="h-3 w-3" />
              {state!.blockers.length} blocker{state!.blockers.length > 1 ? 's' : ''}
            </div>
            <div className="mt-1 space-y-0.5">
              {state!.blockers.map((b, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-4">- {b}</p>
              ))}
            </div>
          </div>
        )}

        {(state?.decisions?.length ?? 0) > 0 && (
          <div className="border-t pt-2">
            <div className="flex items-center gap-1.5 text-xs font-medium mb-1">
              <GitBranch className="h-3 w-3 text-brand-purple" />
              Decisions
            </div>
            <div className="space-y-0.5">
              {state!.decisions.slice(0, 5).map((d, i) => (
                <p key={i} className="text-xs text-muted-foreground pl-4">- {d}</p>
              ))}
              {state!.decisions.length > 5 && (
                <p className="text-xs text-muted-foreground/60 pl-4">
                  +{state!.decisions.length - 5} more — see GSD &gt; Context tab
                </p>
              )}
            </div>
          </div>
        )}

        {config && (config.workflow_mode || config.model_profile) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
            <Settings2 className="h-3 w-3" />
            {config.workflow_mode && <span>{config.workflow_mode}</span>}
            {config.model_profile && <span>/ {config.model_profile}</span>}
          </div>
        )}

        {config && (config.depth || config.parallelization != null || config.workflow_research != null) && (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {config.depth && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">depth: {config.depth}</span>
            )}
            {config.parallelization != null && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                parallel: {config.parallelization ? 'on' : 'off'}
              </span>
            )}
            {config.workflow_research != null && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                research: {config.workflow_research ? 'on' : 'off'}
              </span>
            )}
            {config.workflow_inspection != null && (
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                inspect: {config.workflow_inspection ? 'on' : 'off'}
              </span>
            )}
          </div>
        )}

        {!pos && !config && (
          <p className="text-xs text-muted-foreground">No GSD state found. Run /gsd:progress to update.</p>
        )}
      </CardContent>
    </Card>
  );
}
