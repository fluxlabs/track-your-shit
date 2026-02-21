// Track Your Shit - GSD Validation Plan Tab
// Per-phase VALIDATION.md viewer (test strategy, task map, wave tracking)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  FlaskConical,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  XCircle,
  Copy,
  Check,
  Terminal,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGsdValidations } from '@/lib/queries';
import type { GsdValidation, TaskVerification, WaveTracking } from '@/lib/tauri';

interface GsdValidationPlanTabProps {
  projectId: string;
}

// ============================================================
// Helpers
// ============================================================

function testTypeBadge(type: string) {
  const lower = type.toLowerCase();
  if (lower === 'manual') {
    return (
      <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-xs">
        manual
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
      automated
    </Badge>
  );
}

function statusBadge(status: string) {
  const lower = status.toLowerCase();
  if (lower === 'pass' || lower === 'passed') {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
        pass
      </Badge>
    );
  }
  if (lower === 'fail' || lower === 'failed') {
    return (
      <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">
        fail
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      pending
    </Badge>
  );
}

function waveStatusBadge(status: string | null) {
  if (!status) return null;
  const lower = status.toLowerCase();
  if (lower === 'complete' || lower === 'completed') {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
        complete
      </Badge>
    );
  }
  if (lower === 'in_progress' || lower === 'in progress') {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">
        in progress
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      {status}
    </Badge>
  );
}

// ============================================================
// Copy-to-clipboard code snippet
// ============================================================

function CodeSnippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 bg-muted rounded px-3 py-1.5 font-mono text-sm group">
      <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-foreground truncate">{code}</span>
      <button
        onClick={handleCopy}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title="Copy command"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ============================================================
// Test Infrastructure Card
// ============================================================

function TestInfrastructureCard({ validation }: { validation: GsdValidation }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted-foreground" />
          Test Infrastructure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {validation.test_framework && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0">Framework</span>
            <Badge variant="outline" className="text-xs font-mono">
              {validation.test_framework}
            </Badge>
          </div>
        )}
        {validation.quick_run_cmd && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Quick run</span>
            <CodeSnippet code={validation.quick_run_cmd} />
          </div>
        )}
        {validation.full_run_cmd && (
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Full run</span>
            <CodeSnippet code={validation.full_run_cmd} />
          </div>
        )}
        {validation.nyquist_rate && (
          <div className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">
              Nyquist rate
            </span>
            <p className="text-xs text-foreground">{validation.nyquist_rate}</p>
          </div>
        )}
        {!validation.test_framework &&
          !validation.quick_run_cmd &&
          !validation.full_run_cmd &&
          !validation.nyquist_rate && (
            <p className="text-xs text-muted-foreground italic">
              No test infrastructure details found.
            </p>
          )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Per-Task Verification Map
// ============================================================

function TaskVerificationMap({ tasks }: { tasks: TaskVerification[] }) {
  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          No task verification map found in this VALIDATION.md.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Per-Task Verification Map
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Task</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Requirement
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-mono text-foreground">{task.task_id}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {task.requirement ?? <span className="italic opacity-50">—</span>}
                  </td>
                  <td className="px-4 py-2">{testTypeBadge(task.test_type)}</td>
                  <td className="px-4 py-2">{statusBadge(task.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Manual Verifications Checklist
// ============================================================

function ManualVerifications({ checks }: { checks: string[] }) {
  if (checks.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          No manual verifications listed.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          Manual Verifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.map((check, i) => {
          const isDone = check.startsWith('[done] ');
          const label = isDone ? check.slice(7) : check;
          return (
            <div key={i} className="flex items-start gap-2">
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-status-success shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <span
                className={`text-sm ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Wave Execution Tracking
// ============================================================

function WaveTrackingSection({ waves }: { waves: WaveTracking[] }) {
  const [expandedWaves, setExpandedWaves] = useState<Set<number>>(new Set());

  if (waves.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          No wave execution tracking found.
        </CardContent>
      </Card>
    );
  }

  function toggleWave(waveNum: number) {
    setExpandedWaves((prev) => {
      const next = new Set(prev);
      if (next.has(waveNum)) {
        next.delete(waveNum);
      } else {
        next.add(waveNum);
      }
      return next;
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          Wave Execution Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {waves.map((wave) => {
          const isExpanded = expandedWaves.has(wave.wave_number);
          const hasDetails = wave.status || wave.tests_passed || wave.issues;
          return (
            <div key={wave.wave_number} className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                onClick={() => toggleWave(wave.wave_number)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">Wave {wave.wave_number}</span>
                  {wave.task_ids.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({wave.task_ids.join(', ')})
                    </span>
                  )}
                </div>
                {waveStatusBadge(wave.status)}
              </button>
              {isExpanded && hasDetails && (
                <div className="px-4 pb-3 pt-1 space-y-1.5 border-t border-border bg-muted/20">
                  {wave.tests_passed && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-28 shrink-0">Tests passed</span>
                      <span className="font-medium text-foreground">{wave.tests_passed}</span>
                    </div>
                  )}
                  {wave.issues && (
                    <div className="flex items-start gap-2 text-xs">
                      <XCircle className="h-3.5 w-3.5 text-status-warning shrink-0 mt-0.5" />
                      <span className="text-foreground">{wave.issues}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Component
// ============================================================

export function GsdValidationPlanTab({ projectId }: GsdValidationPlanTabProps) {
  const { data: validations, isLoading } = useGsdValidations(projectId);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Loading validation plans...
      </div>
    );
  }

  const list = validations ?? [];

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <FlaskConical className="h-8 w-8 mx-auto mb-3 opacity-40 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No VALIDATION.md files found.</p>
          <p className="text-xs text-muted-foreground mt-1 opacity-70">
            Run /gsd:plan-phase to generate validation plans for each phase.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort by phase_number (numeric sort)
  const sorted = [...list].sort((a, b) => {
    const na = parseInt(a.phase_number, 10);
    const nb = parseInt(b.phase_number, 10);
    return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb);
  });

  // Default to first phase
  const activePhase = selectedPhase ?? sorted[0].phase_number;
  const validation = sorted.find((v) => v.phase_number === activePhase) ?? sorted[0];

  return (
    <div className="space-y-4">
      {/* Phase selector tabs */}
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((v) => (
          <Button
            key={v.phase_number}
            variant={v.phase_number === activePhase ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPhase(v.phase_number)}
            className="text-xs h-7 px-3"
          >
            Phase {v.phase_number}
          </Button>
        ))}
      </div>

      {/* Selected phase content */}
      <div className="space-y-4">
        <TestInfrastructureCard validation={validation} />
        <TaskVerificationMap tasks={validation.task_map} />
        <ManualVerifications checks={validation.manual_checks} />
        <WaveTrackingSection waves={validation.wave_tracking} />
      </div>
    </div>
  );
}
