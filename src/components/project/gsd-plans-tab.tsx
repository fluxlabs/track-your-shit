// Track Your Shit - GSD Plans & Execution Tab
// Plan files grouped by phase with summary integration and split-view
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  Zap,
  Search,
  ListChecks,
  Beaker,
  Columns2,
  AlignLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGsdPlans, useGsdSummaries, useGsdPhaseResearchList } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { GsdPlan, GsdSummary, GsdPhaseResearch, GsdSummaryDecision } from '@/lib/tauri';

interface GsdPlansTabProps {
  projectId: string;
}

export function GsdPlansTab({ projectId }: GsdPlansTabProps) {
  const { data: plans, isLoading: plansLoading } = useGsdPlans(projectId);
  const { data: summaries } = useGsdSummaries(projectId);
  const { data: researchDocs } = useGsdPhaseResearchList(projectId);

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading plans...
      </div>
    );
  }

  if ((plans ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No plan files found.</p>
          <p className="text-xs mt-1">
            Run /gsd:plan-phase to create execution plans.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Build a map of summaries by phase-plan key
  const summaryMap = new Map<string, GsdSummary>();
  for (const s of summaries ?? []) {
    summaryMap.set(`${s.phase_number}-${s.plan_number}`, s);
  }

  // Build research map by phase number
  const researchMap = new Map<number, GsdPhaseResearch>();
  for (const r of researchDocs ?? []) {
    researchMap.set(r.phase_number, r);
  }

  // Group plans by phase
  const phaseGroups = new Map<number, GsdPlan[]>();
  for (const plan of plans ?? []) {
    const existing = phaseGroups.get(plan.phase_number) ?? [];
    existing.push(plan);
    phaseGroups.set(plan.phase_number, existing);
  }

  const totalPlans = (plans ?? []).length;
  const completedPlans = (plans ?? []).filter((p) =>
    summaryMap.has(`${p.phase_number}-${p.plan_number}`),
  ).length;

  // Compute average duration from summaries that have duration
  const durations = (summaries ?? [])
    .map((s) => s.duration)
    .filter((d): d is string => !!d);

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-brand-purple" />
          <span className="font-medium">{totalPlans}</span> plans
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-status-success" />
          <span className="font-medium">{completedPlans}</span> completed
        </span>
        {durations.length > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {durations.length} with timing data
          </span>
        )}
      </div>

      {/* Phase Groups */}
      {Array.from(phaseGroups.entries())
        .sort(([a], [b]) => a - b)
        .map(([phaseNum, phasePlans]) => (
          <PhaseGroup
            key={phaseNum}
            phaseNumber={phaseNum}
            plans={phasePlans}
            summaryMap={summaryMap}
            research={researchMap.get(phaseNum)}
          />
        ))}
    </div>
  );
}

function PhaseGroup({
  phaseNumber,
  plans,
  summaryMap,
  research,
}: {
  phaseNumber: number;
  plans: GsdPlan[];
  summaryMap: Map<string, GsdSummary>;
  research: GsdPhaseResearch | undefined;
}) {
  const [open, setOpen] = useState(true);

  const completed = plans.filter((p) =>
    summaryMap.has(`${p.phase_number}-${p.plan_number}`),
  ).length;

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium text-sm">Phase {phaseNumber}</span>
        <Badge variant="secondary" className="text-xs">
          {completed}/{plans.length} done
        </Badge>
        {research && (
          <Badge variant="outline" className="text-xs gap-1">
            <Search className="h-3 w-3" />
            {research.domain ?? 'Research'}
            {research.confidence && (
              <span className="text-muted-foreground">({research.confidence})</span>
            )}
          </Badge>
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-2 pl-4">
          {plans
            .sort((a, b) => a.plan_number - b.plan_number)
            .map((plan) => (
              <PlanCard
                key={`${plan.phase_number}-${plan.plan_number}`}
                plan={plan}
                summary={summaryMap.get(`${plan.phase_number}-${plan.plan_number}`)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  summary,
}: {
  plan: GsdPlan;
  summary: GsdSummary | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const hasSummary = !!summary;

  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  const handleToggleSplit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!expanded) setExpanded(true);
    setSplitView(!splitView);
  };

  return (
    <Card
      className={cn(
        'transition-colors cursor-pointer',
        hasSummary ? 'border-status-success/30' : 'border-border',
      )}
      onClick={handleToggleExpand}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          {hasSummary ? (
            <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <CardTitle className="text-sm font-medium">
            Plan {plan.phase_number}-{String(plan.plan_number).padStart(2, '0')}
          </CardTitle>

          {/* Type badge — hidden once executed (has summary) */}
          {plan.plan_type && !hasSummary && (
            <Badge
              variant={plan.plan_type === 'execute' ? 'default' : 'secondary'}
              className="text-xs gap-1"
            >
              {plan.plan_type === 'execute' ? (
                <Zap className="h-3 w-3" />
              ) : (
                <Beaker className="h-3 w-3" />
              )}
              {plan.plan_type}
            </Badge>
          )}

          {/* Group indicator */}
          {plan.group_number != null && plan.group_number > 1 && (
            <Badge variant="outline" className="text-xs">
              group {plan.group_number}
            </Badge>
          )}

          {/* Task count */}
          <Badge variant="outline" className="text-xs gap-1 ml-auto">
            <ListChecks className="h-3 w-3" />
            {plan.task_count} task{plan.task_count !== 1 ? 's' : ''}
          </Badge>

          {/* Duration from summary */}
          {summary?.duration && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Clock className="h-3 w-3" />
              {summary.duration}
            </Badge>
          )}

          {/* Split view toggle — only when summary exists */}
          {hasSummary && (
            <Button
              variant={splitView ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              title={splitView ? 'Switch to single view' : 'Split: Plan / What Was Built'}
              onClick={handleToggleSplit}
            >
              {splitView ? (
                <AlignLeft className="h-3 w-3" />
              ) : (
                <Columns2 className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>

        {/* Objective (truncated) */}
        {plan.objective && (
          <p
            className={cn(
              'text-xs text-muted-foreground mt-1.5',
              !expanded && 'line-clamp-2',
            )}
          >
            {plan.objective}
          </p>
        )}
      </CardHeader>

      {/* Summary inline (when exists, collapsed view) */}
      {hasSummary && summary.accomplishments.length > 0 && !expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          <div className="text-xs text-muted-foreground space-y-0.5">
            {summary.accomplishments.slice(0, 3).map((a, i) => (
              <p key={i} className="flex items-start gap-1">
                <span className="text-status-success mt-0.5">-</span>
                <span className="line-clamp-1">{a}</span>
              </p>
            ))}
            {summary.accomplishments.length > 3 && (
              <p className="text-muted-foreground/60">
                +{summary.accomplishments.length - 3} more...
              </p>
            )}
          </div>
        </CardContent>
      )}

      {/* Expanded details */}
      {expanded && (
        <CardContent className="pt-0 pb-3 px-4">
          {splitView && hasSummary ? (
            /* Split view: Plan on left, Summary ("What Was Built") on right */
            <div className="grid grid-cols-2 gap-4 divide-x divide-border">
              <div className="space-y-3 pr-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Plan
                </p>
                <PlanDetailContent plan={plan} />
              </div>
              <div className="space-y-3 pl-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  What Was Built
                </p>
                <SummaryDetailContent summary={summary} />
              </div>
            </div>
          ) : (
            /* Single-column view */
            <div className="space-y-3">
              <PlanDetailContent plan={plan} />
              {hasSummary && <SummaryDetailContent summary={summary} />}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PlanDetailContent({ plan }: { plan: GsdPlan }) {
  return (
    <>
      {plan.tasks.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1">Tasks</p>
          <div className="space-y-1">
            {plan.tasks.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                <span>{t.name}</span>
                {t.task_type && (
                  <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                    {t.task_type}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.files_modified.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1">Files Modified</p>
          <div className="flex flex-wrap gap-1">
            {plan.files_modified.map((f, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-mono">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SummaryDetailContent({ summary }: { summary: GsdSummary }) {
  return (
    <>
      {summary.accomplishments.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1">Accomplishments</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {summary.accomplishments.map((a, i) => (
              <p key={i} className="flex items-start gap-1">
                <span className="text-status-success mt-0.5">-</span>
                <span>{a}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {(summary.files_created.length > 0 || summary.files_modified.length > 0) && (
        <div>
          <p className="text-xs font-medium mb-1">Files</p>
          <div className="flex flex-wrap gap-1">
            {summary.files_created.map((f, i) => (
              <Badge key={`c-${i}`} variant="outline" className="text-[10px] font-mono text-status-success">
                +{f}
              </Badge>
            ))}
            {summary.files_modified.map((f, i) => (
              <Badge key={`m-${i}`} variant="outline" className="text-[10px] font-mono">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {summary.decisions.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1">Decisions</p>
          <div className="text-xs text-muted-foreground space-y-1">
            {summary.decisions.map((d: GsdSummaryDecision, i: number) => (
              <div key={i}>
                <p>- {d.decision}</p>
                {d.rationale && (
                  <p className="pl-3 text-muted-foreground/60 italic">
                    {d.rationale}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.deviations && (
        <div>
          <p className="text-xs font-medium mb-1">Deviations</p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {summary.deviations}
          </p>
        </div>
      )}

      {summary.self_check && (
        <div>
          <p className="text-xs font-medium mb-1">Self-Check</p>
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {summary.self_check}
          </p>
        </div>
      )}

      {summary.completed && (
        <p className="text-xs text-muted-foreground">
          Completed: {summary.completed}
        </p>
      )}
    </>
  );
}
