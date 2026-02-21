// Track Your Shit - GSD Milestones Tab
// Visual milestone timeline for GSD projects
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import {
  Flag,
  CheckCircle2,
  Clock,
  Circle,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useGsdMilestones, useGsdState } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface GsdMilestonesTabProps {
  projectId: string;
}

function milestoneStatusIcon(status: string | null) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-status-success" />;
    case 'in_progress':
      return <Clock className="h-5 w-5 text-status-info animate-pulse" />;
    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

function milestoneStatusVariant(status: string | null) {
  switch (status) {
    case 'completed':
      return 'success' as const;
    case 'in_progress':
      return 'info' as const;
    default:
      return 'secondary' as const;
  }
}

export function GsdMilestonesTab({ projectId }: GsdMilestonesTabProps) {
  const { data: milestones, isLoading } = useGsdMilestones(projectId);
  const { data: state } = useGsdState(projectId);

  const currentMilestone = state?.current_position?.milestone;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading milestones...
      </div>
    );
  }

  if ((milestones ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Flag className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No milestones found</p>
          <p className="text-xs mt-1">
            Milestones are defined in your GSD ROADMAP.md
          </p>
        </CardContent>
      </Card>
    );
  }

  const completedCount = (milestones ?? []).filter(
    (m) => m.status === 'completed'
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <Badge variant="info">
          {milestones?.length ?? 0} milestone{(milestones?.length ?? 0) !== 1 ? 's' : ''}
        </Badge>
        <Badge variant="success">
          {completedCount} completed
        </Badge>
        {currentMilestone && (
          <Badge variant="subtle-purple">
            Current: {currentMilestone}
          </Badge>
        )}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[18px] top-4 bottom-4 w-px bg-border" />

        <div className="space-y-3">
          {(milestones ?? []).map((milestone, index) => {
            const isCurrent =
              currentMilestone &&
              milestone.name
                .toLowerCase()
                .includes(currentMilestone.toLowerCase());

            return (
              <div key={index} className="relative flex gap-4">
                {/* Status icon */}
                <div className="relative z-10 flex-shrink-0 bg-background p-0.5">
                  {milestoneStatusIcon(milestone.status)}
                </div>

                {/* Content card */}
                <Card
                  className={cn(
                    'flex-1',
                    isCurrent && 'ring-1 ring-brand-purple/40'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">
                            {milestone.name}
                          </h3>
                          {isCurrent && (
                            <Badge variant="subtle-purple" size="sm">
                              current
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {milestone.version && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Tag className="h-3 w-3" />
                              {milestone.version}
                            </span>
                          )}
                          {milestone.phase_start != null &&
                            milestone.phase_end != null && (
                              <span className="text-xs text-muted-foreground">
                                Phases {milestone.phase_start}&ndash;
                                {milestone.phase_end}
                              </span>
                            )}
                        </div>
                      </div>

                      <Badge
                        variant={milestoneStatusVariant(milestone.status)}
                        size="sm"
                      >
                        {milestone.status ?? 'planned'}
                      </Badge>
                    </div>

                    {milestone.completed_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Completed{' '}
                        {new Date(milestone.completed_at).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
