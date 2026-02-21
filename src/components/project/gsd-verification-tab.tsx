// Track Your Shit - GSD Verification Tab
// Phase verification dashboard for GSD projects
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useGsdValidations } from '@/lib/queries';
import type { GsdValidation } from '@/lib/tauri';

interface GsdVerificationTabProps {
  projectId: string;
}

function resultVariant(result: string | null) {
  switch (result) {
    case 'passed':
      return 'success' as const;
    case 'failed':
      return 'error' as const;
    case 'partial':
      return 'warning' as const;
    default:
      return 'secondary' as const;
  }
}

function resultIcon(result: string | null) {
  switch (result) {
    case 'passed':
      return <CheckCircle2 className="h-4 w-4 text-status-success" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-status-error" />;
    case 'partial':
      return <AlertTriangle className="h-4 w-4 text-status-warning" />;
    default:
      return <ShieldCheck className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Derive an overall result from the task_map statuses:
 * - all pass => "passed"
 * - any fail => "failed"
 * - mix => "partial"
 * - no tasks => null
 */
function deriveResult(validation: GsdValidation): string | null {
  const tasks = validation.task_map;
  if (tasks.length === 0) return null;
  const passed = tasks.filter((t) => t.status === 'pass').length;
  if (passed === tasks.length) return 'passed';
  const failed = tasks.filter((t) => t.status === 'fail').length;
  if (failed > 0) return 'failed';
  return 'partial';
}

export function GsdVerificationTab({ projectId }: GsdVerificationTabProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const { data: validations, isLoading } = useGsdValidations(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading verifications...
      </div>
    );
  }

  const items = validations ?? [];

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No phase verifications yet</p>
          <p className="text-xs mt-1">
            Run /gsd:verify-work after completing a phase to generate
            verification reports
          </p>
        </CardContent>
      </Card>
    );
  }

  const passedCount = items.filter((v) => deriveResult(v) === 'passed').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <Badge variant="info">
          {items.length} verified
        </Badge>
        <Badge variant="success">
          {passedCount} passed
        </Badge>
        <Badge variant="error">
          {items.length - passedCount} needs attention
        </Badge>
      </div>

      {/* Phase verification grid */}
      <div className="space-y-2">
        {items.map((validation) => {
          const result = deriveResult(validation);
          const isExpanded = expandedPhase === validation.id;
          const checksTotal = validation.task_map.length;
          const checksPassed = validation.task_map.filter(
            (t) => t.status === 'pass',
          ).length;
          const progressPct =
            checksTotal > 0 ? (checksPassed / checksTotal) * 100 : 0;

          return (
            <Card key={validation.id}>
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3"
                onClick={() =>
                  setExpandedPhase(isExpanded ? null : validation.id)
                }
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}

                {resultIcon(result)}

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">
                    Phase {validation.phase_number}
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <Progress
                      value={progressPct}
                      className="h-1.5 w-24"
                    />
                    <span className="text-xs text-muted-foreground">
                      {checksPassed}/{checksTotal} checks
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={resultVariant(result)}
                    size="sm"
                  >
                    {result ?? 'unknown'}
                  </Badge>
                </div>
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 space-y-3">
                  {/* Manual checks */}
                  {validation.manual_checks.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Manual Checks
                      </p>
                      <ul className="space-y-1">
                        {validation.manual_checks.map((check, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-status-warning" />
                            {check}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Raw content preview */}
                  {validation.raw_content && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Verification Report
                      </p>
                      <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-60 whitespace-pre-wrap">
                        {validation.raw_content}
                      </pre>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
