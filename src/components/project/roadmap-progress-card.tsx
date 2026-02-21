// Track Your Shit - GSD Roadmap Progress Card
// Displays ROADMAP.md phase completion data for GSD projects
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Map, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useGsdRoadmapProgress } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { GsdRoadmapPhaseProgress } from '@/lib/tauri';

interface RoadmapProgressCardProps {
  projectId: string;
}

export function RoadmapProgressCard({ projectId }: RoadmapProgressCardProps) {
  const { data: roadmap, isLoading } = useGsdRoadmapProgress(projectId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Map className="h-4 w-4 text-brand-purple" />
            Roadmap Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!roadmap || roadmap.phases.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Map className="h-4 w-4 text-brand-purple" />
            Roadmap Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No ROADMAP.md found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Map className="h-4 w-4 text-brand-purple" />
          Roadmap Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {roadmap.completed_tasks} / {roadmap.total_tasks} tasks
            </span>
            <span className="font-semibold text-foreground">{roadmap.percent}%</span>
          </div>
          <Progress value={roadmap.percent} className="h-2" />
        </div>

        {/* Current phase badge */}
        {roadmap.current_phase && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Current phase:</span>
            <Badge variant="secondary" className="text-xs font-medium">
              {roadmap.current_phase}
            </Badge>
          </div>
        )}

        {/* Phase list */}
        <div className="space-y-2">
          {roadmap.phases.map((phase, idx) => (
            <PhaseRow
              key={idx}
              phase={phase}
              isCurrent={roadmap.current_phase === phase.name}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseRow({
  phase,
  isCurrent,
}: {
  phase: GsdRoadmapPhaseProgress;
  isCurrent: boolean;
}) {
  const statusColor = {
    complete: 'text-status-success',
    in_progress: 'text-brand-purple',
    pending: 'text-muted-foreground',
  }[phase.status];

  const barColor = {
    complete: 'bg-status-success',
    in_progress: 'bg-brand-purple',
    pending: 'bg-muted',
  }[phase.status];

  const truncatedName =
    phase.name.length > 32 ? phase.name.slice(0, 30) + '...' : phase.name;

  return (
    <div
      className={cn(
        'space-y-1 rounded-md px-2 py-1.5 transition-colors',
        isCurrent && 'bg-brand-purple/8 ring-1 ring-brand-purple/20',
      )}
    >
      <div className="flex items-center gap-2">
        {phase.status === 'complete' ? (
          <CheckCircle2 className={cn('h-3.5 w-3.5 shrink-0', statusColor)} />
        ) : (
          <Circle className={cn('h-3.5 w-3.5 shrink-0', statusColor)} />
        )}
        <span
          className={cn(
            'text-xs flex-1 truncate',
            isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
          title={phase.name}
        >
          {truncatedName}
        </span>
        <span className={cn('text-[10px] font-medium shrink-0', statusColor)}>
          {phase.percent}%
        </span>
      </div>

      {/* Mini progress bar */}
      <div className="ml-5 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${phase.percent}%` }}
        />
      </div>
    </div>
  );
}
