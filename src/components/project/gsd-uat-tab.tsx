// Track Your Shit - GSD UAT Tab
// User Acceptance Testing results per phase (XX-UAT.md)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  ClipboardCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useGsdUatResults } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { GsdUatResult, UatTestResult, UatIssue } from '@/lib/tauri';

interface GsdUatTabProps {
  projectId: string;
}

// ── Badge helpers ────────────────────────────────────────────

function statusVariant(status: string): 'warning' | 'success' | 'info' | 'secondary' {
  switch (status) {
    case 'complete':
      return 'success';
    case 'diagnosed':
      return 'info';
    default:
      return 'warning';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'diagnosed':
      return 'Diagnosed';
    default:
      return 'Testing';
  }
}

function resultIcon(result: string) {
  switch (result) {
    case 'pass':
      return <CheckCircle2 className="h-4 w-4 text-status-success flex-shrink-0" />;
    case 'issue':
      return <XCircle className="h-4 w-4 text-status-error flex-shrink-0" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-status-warning flex-shrink-0" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
  }
}

function resultBadgeVariant(result: string): 'success' | 'error' | 'warning' | 'secondary' {
  switch (result) {
    case 'pass':
      return 'success';
    case 'issue':
      return 'error';
    case 'pending':
      return 'warning';
    default:
      return 'secondary';
  }
}

function severityVariant(
  severity: string,
): 'error' | 'warning' | 'secondary' | 'subtle-cyan' {
  switch (severity) {
    case 'blocker':
      return 'error';
    case 'major':
      return 'warning';
    case 'cosmetic':
      return 'subtle-cyan';
    default:
      return 'secondary';
  }
}

// ── Sub-components ───────────────────────────────────────────

function TestResultsTable({ tests }: { tests: UatTestResult[] }) {
  const total = tests.length;
  const passed = tests.filter((t) => t.result === 'pass').length;
  const pct = total > 0 ? (passed / total) * 100 : 0;

  if (tests.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Pass-rate progress bar */}
      <div className="flex items-center gap-3">
        <Progress value={pct} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {passed}/{total} passed ({Math.round(pct)}%)
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Test</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Expected</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-24">Result</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Notes</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr
                key={t.number}
                className={cn(
                  'border-b last:border-0 transition-colors',
                  t.result === 'issue' && 'bg-destructive/5',
                )}
              >
                <td className="px-3 py-2 text-muted-foreground text-xs">{t.number}</td>
                <td className="px-3 py-2">{t.test}</td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{t.expected}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {resultIcon(t.result)}
                    <Badge variant={resultBadgeVariant(t.result)} size="sm">
                      {t.result}
                    </Badge>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground text-xs hidden md:table-cell">
                  {t.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssuesList({ issues }: { issues: UatIssue[] }) {
  if (issues.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Issues Found
      </p>
      <ul className="space-y-1.5">
        {issues.map((issue, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Badge variant={severityVariant(issue.severity)} size="sm" className="mt-0.5 flex-shrink-0 capitalize">
              {issue.severity}
            </Badge>
            <span>{issue.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GapsList({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Gaps
      </p>
      <ul className="space-y-1">
        {gaps.map((gap, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
            <span>{gap}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagnosisCard({ diagnosis }: { diagnosis: string }) {
  return (
    <div className="rounded-md border border-status-success/30 bg-status-success/5 p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs font-medium text-status-success">
        <CheckCircle2 className="h-4 w-4" />
        Diagnosis
      </div>
      <p className="text-sm whitespace-pre-wrap">{diagnosis}</p>
    </div>
  );
}

// ── Phase detail panel ───────────────────────────────────────

function PhaseUatDetail({ uat }: { uat: GsdUatResult }) {
  const totalTests = uat.tests.length;

  return (
    <div className="space-y-5">
      {/* Test Results */}
      {totalTests > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Test Results
          </p>
          <TestResultsTable tests={uat.tests} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No test results recorded.</p>
      )}

      {/* Issues */}
      <IssuesList issues={uat.issues} />

      {/* Gaps */}
      <GapsList gaps={uat.gaps} />

      {/* Diagnosis (only when status=diagnosed) */}
      {uat.status === 'diagnosed' && uat.diagnosis && (
        <DiagnosisCard diagnosis={uat.diagnosis} />
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export function GsdUatTab({ projectId }: GsdUatTabProps) {
  const { data: uatResults, isLoading } = useGsdUatResults(projectId);
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading UAT results...
      </div>
    );
  }

  const results = uatResults ?? [];

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No UAT results yet.</p>
          <p className="text-xs mt-1">
            Run /gsd:verify-work after completing a phase to generate UAT reports.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Overall summary
  const totalTests = results.reduce((sum, r) => sum + r.tests.length, 0);
  const totalPassed = results.reduce((sum, r) => sum + r.pass_count, 0);
  const totalIssues = results.reduce((sum, r) => sum + r.issue_count, 0);

  // Determine selected phase (default to first)
  const activePhase = selectedPhase ?? results[0].phase_number;
  const activeResult = results.find((r) => r.phase_number === activePhase) ?? results[0];

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="info">
          {results.length} {results.length === 1 ? 'phase' : 'phases'}
        </Badge>
        <Badge variant="success">
          {totalPassed}/{totalTests} tests passing
        </Badge>
        {totalIssues > 0 && (
          <Badge variant="error">
            {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'}
          </Badge>
        )}
      </div>

      {/* Phase selector tabs */}
      <div className="flex gap-2 flex-wrap">
        {results.map((r) => (
          <button
            key={r.phase_number}
            onClick={() => setSelectedPhase(r.phase_number)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors border',
              r.phase_number === activePhase
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted',
            )}
          >
            <span className="flex items-center gap-1.5">
              Phase {r.phase_number}
              <Badge variant={statusVariant(r.status)} size="sm">
                {statusLabel(r.status)}
              </Badge>
            </span>
          </button>
        ))}
      </div>

      {/* Phase detail card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          {/* Phase header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                Phase {activeResult.phase_number} — UAT
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Session {activeResult.session_number}
              </span>
              <Badge variant={statusVariant(activeResult.status)} size="sm">
                {statusLabel(activeResult.status)}
              </Badge>
            </div>
          </div>

          <PhaseUatDetail uat={activeResult} />
        </CardContent>
      </Card>
    </div>
  );
}
