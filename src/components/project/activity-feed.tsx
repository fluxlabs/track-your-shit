// Track Your Shit - Activity Feed Component
// Real-time activity timeline for project and execution events
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useActivityLog } from '@/lib/queries';
import { onActivityLogged } from '@/lib/tauri';
import type { ActivityEntry } from '@/lib/tauri';
import { queryKeys } from '@/lib/query-keys';
import { formatRelativeTime, cn } from '@/lib/utils';
import {
  Flag,
  CheckSquare,
  AlertTriangle,
  Activity,
  FileText,
  Settings2,
  Zap,
  Bug,
  DollarSign,
} from 'lucide-react';

interface ActivityFeedProps {
  projectId: string;
  limit?: number;
  className?: string;
}

const eventTypeIcons: Record<string, typeof Activity> = {
  phase_started: Flag,
  phase_completed: Flag,
  task_started: FileText,
  task_completed: CheckSquare,
  context_warning: AlertTriangle,
  cost_warning: DollarSign,
  decision_made: Settings2,
  debug_started: Bug,
  debug_resolved: Bug,
  error: AlertTriangle,
};

const eventTypeColors: Record<string, string> = {
  phase_started: 'text-brand-purple',
  phase_completed: 'text-status-success',
  task_started: 'text-muted-foreground',
  task_completed: 'text-status-success',
  context_warning: 'text-status-warning',
  cost_warning: 'text-status-warning',
  decision_made: 'text-brand-blue',
  debug_started: 'text-status-warning',
  debug_resolved: 'text-status-success',
  error: 'text-status-error',
};

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const Icon = eventTypeIcons[entry.event_type] ?? Zap;
  const colorClass = eventTypeColors[entry.event_type] ?? 'text-muted-foreground';

  const cost = entry.metadata?.cost as number | undefined;

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className={cn('mt-0.5 shrink-0', colorClass)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-snug truncate">
          {entry.message ?? entry.event_type.replace(/_/g, ' ')}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">
            {formatRelativeTime(entry.created_at)}
          </span>
          {cost != null && cost > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              ${cost.toFixed(4)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({
  projectId,
  limit = 15,
  className,
}: ActivityFeedProps) {
  const queryClient = useQueryClient();

  const { data: projectActivity } = useActivityLog(projectId, limit);

  const activities = projectActivity;

  // Listen for real-time activity events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    onActivityLogged((entry: ActivityEntry) => {
      if (entry.project_id !== projectId) return;

      void queryClient.invalidateQueries({
        queryKey: queryKeys.activity(projectId),
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [projectId, queryClient]);

  if (!activities || activities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground py-4 text-center">
            No activity recorded yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4" />
          Activity
          {activities.length > 0 && (
            <span className="text-[10px] font-normal text-muted-foreground ml-auto">
              {activities.length} events
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[280px] overflow-y-auto -mx-1 px-1 divide-y divide-border/50">
          {activities.map((entry) => (
            <ActivityItem key={entry.id} entry={entry} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
