// Track Your Shit - GSD Phase Context Tab
// Shows CONTEXT.md decisions and deferred ideas per phase
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { Lock, Clock, FileText, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGsdPlans, useGsdPhaseContext } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface GsdContextTabProps {
  projectId: string;
}

export function GsdContextTab({ projectId }: GsdContextTabProps) {
  const { data: plans, isLoading: plansLoading } = useGsdPlans(projectId);

  // Derive the unique sorted phase numbers from the plans list.
  // This lets us know which phases exist without a separate API call.
  const phaseNumbers: number[] = Array.from(
    new Set((plans ?? []).map((p) => p.phase_number)),
  ).sort((a, b) => a - b);

  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);

  // Once plans load, default to the first phase
  const resolvedPhase =
    selectedPhase ?? (phaseNumbers.length > 0 ? phaseNumbers[0] : null);

  if (plansLoading) {
    return (
      <div className="space-y-4">
        {/* Skeleton phase pills */}
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-8 w-20 rounded-md bg-muted animate-pulse"
            />
          ))}
        </div>
        {/* Skeleton cards */}
        <div className="h-32 rounded-lg bg-muted animate-pulse" />
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (phaseNumbers.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No CONTEXT.md files found.</p>
          <p className="text-xs mt-1">
            Run /gsd:discuss-phase to capture decisions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Phase selector pills */}
      <div className="flex gap-2 flex-wrap">
        {phaseNumbers.map((phase) => (
          <Button
            key={phase}
            variant={resolvedPhase === phase ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setSelectedPhase(phase)}
          >
            Phase {phase}
          </Button>
        ))}
      </div>

      {/* Context panel for selected phase */}
      {resolvedPhase != null && (
        <PhaseContextPanel projectId={projectId} phase={resolvedPhase} />
      )}
    </div>
  );
}

// Inner panel — fetches context for a single phase
function PhaseContextPanel({
  projectId,
  phase,
}: {
  projectId: string;
  phase: number;
}) {
  const { data: context, isLoading } = useGsdPhaseContext(projectId, phase);
  const [rawOpen, setRawOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-28 rounded-lg bg-muted animate-pulse" />
        <div className="h-20 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!context) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          No CONTEXT.md found for Phase {phase}.
          <p className="text-xs mt-1">Run /gsd:discuss-phase to generate one.</p>
        </CardContent>
      </Card>
    );
  }

  const hasDecisions = context.decisions.length > 0;
  const hasDeferred = context.deferred_ideas.length > 0;
  const hasContent = context.raw_content.trim().length > 0;

  if (!hasDecisions && !hasDeferred && !hasContent) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          CONTEXT.md for Phase {phase} is empty.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Decisions */}
      {hasDecisions && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-brand-purple" />
              Decisions
              <Badge variant="secondary" className="text-xs ml-auto">
                {context.decisions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {context.decisions.map((decision, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-sm"
              >
                <Lock
                  className={cn(
                    'h-3.5 w-3.5 mt-0.5 shrink-0',
                    'text-brand-purple opacity-70',
                  )}
                />
                <span className="text-foreground">{decision}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Deferred Ideas */}
      {hasDeferred && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-status-warning" />
              Deferred Ideas
              <Badge variant="secondary" className="text-xs ml-auto">
                {context.deferred_ideas.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {context.deferred_ideas.map((idea, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Clock
                  className="h-3.5 w-3.5 mt-0.5 shrink-0 text-status-warning opacity-70"
                />
                <span className="text-muted-foreground">{idea}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Raw CONTEXT.md — collapsible */}
      {hasContent && (
        <Card>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-accent/50 transition-colors rounded-lg text-left"
            onClick={() => setRawOpen(!rawOpen)}
          >
            {rawOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <FileText className="h-4 w-4 text-muted-foreground" />
            View full CONTEXT.md
          </button>
          {rawOpen && (
            <CardContent className="pt-0 px-4 pb-4">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded-md p-3 overflow-x-auto max-h-96 overflow-y-auto">
                {context.raw_content}
              </pre>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
