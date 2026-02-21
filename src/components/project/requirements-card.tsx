// Track Your Shit - Requirements Coverage Card
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGsdRequirements } from '@/lib/queries';
import { ClipboardList, ExternalLink } from 'lucide-react';

interface RequirementsCardProps {
  projectId: string;
}

const priorityColors: Record<string, string> = {
  must: 'bg-status-error',
  should: 'bg-orange-500',
  could: 'bg-brand-blue',
  wont: 'bg-muted-foreground/50',
};

export function RequirementsCard({ projectId }: RequirementsCardProps) {
  const { data: requirements, isLoading } = useGsdRequirements(projectId);

  if (isLoading || !requirements || requirements.length === 0) {
    return null;
  }

  const total = requirements.length;
  const byPriority = requirements.reduce<Record<string, number>>((acc, r) => {
    const p = r.priority ?? 'unknown';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Requirements
          </span>
          <Link to={`/projects/${projectId}?tab=gsd`} className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <span className="text-sm font-medium">{total} requirements</span>

        {/* Stacked bar */}
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          {(['must', 'should', 'could', 'wont'] as const).map((priority) => {
            const count = byPriority[priority] ?? 0;
            if (count === 0) return null;
            const pct = (count / total) * 100;
            return (
              <div
                key={priority}
                className={priorityColors[priority]}
                style={{ width: `${pct}%` }}
                title={`${priority}: ${count}`}
              />
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          {(['must', 'should', 'could', 'wont'] as const).map((priority) => {
            const count = byPriority[priority] ?? 0;
            if (count === 0) return null;
            return (
              <span key={priority} className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${priorityColors[priority]}`} />
                {priority} ({count})
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
