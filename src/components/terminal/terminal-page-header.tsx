// Track Your Shit - Terminal Page Header Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusClasses, type Status } from "@/lib/design-tokens";

// Execution state shape used by terminal components
interface Execution {
  id: string;
  status: string;
  phase_current?: number;
  phase_total?: number;
  cost?: number;
  session_number?: number;
  cost_total?: number;
  started_at?: string;
  task_current?: string;
}

interface TerminalPageHeaderProps {
  execution: Execution | null;
}

export function TerminalPageHeader({ execution }: TerminalPageHeaderProps) {
  const pauseExecution = { mutate: (_: string) => {}, isPending: false };
  const resumeExecution = { mutate: (_: string) => {}, isPending: false };
  const cancelExecution = { mutate: (_: string) => {}, isPending: false };

  if (!execution) {
    return (
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>No active execution</span>
        </div>
      </div>
    );
  }

  const isRunning = execution.status === "running";
  const isPaused = execution.status === "paused";
  const isActive = isRunning || isPaused;

  const progress =
    execution.phase_total && execution.phase_current
      ? (Number(execution.phase_current) / execution.phase_total) * 100
      : 0;

  const handlePause = () => {
    pauseExecution.mutate(execution.id);
  };

  const handleResume = () => {
    resumeExecution.mutate(execution.id);
  };

  const handleCancel = () => {
    cancelExecution.mutate(execution.id);
  };

  return (
    <div className="p-4 border-b bg-muted/30 space-y-3">
      {/* Status and Controls Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge
            className={cn(
              "text-xs font-medium",
              getStatusClasses(execution.status as Status).combined
            )}
          >
            {execution.status}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Session #{execution.session_number}
          </span>
          {execution.started_at && (
            <span className="text-sm text-muted-foreground">
              Started: {new Date(execution.started_at + 'Z').toLocaleTimeString()}
            </span>
          )}
        </div>

        {isActive && (
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                disabled={pauseExecution.isPending}
              >
                {pauseExecution.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                <span className="ml-2">Pause</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResume}
                disabled={resumeExecution.isPending}
              >
                {resumeExecution.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="ml-2">Resume</span>
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancel}
              disabled={cancelExecution.isPending}
            >
              {cancelExecution.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              <span className="ml-2">Cancel</span>
            </Button>
          </div>
        )}
      </div>

      {/* Progress Row */}
      {(execution.phase_current || execution.task_current) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {execution.phase_current && (
                <span className="text-muted-foreground">
                  Phase {execution.phase_current}
                  {execution.phase_total && ` / ${execution.phase_total}`}
                </span>
              )}
              {execution.task_current && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium">{execution.task_current}</span>
                </>
              )}
            </div>
            {execution.phase_total && (
              <span className="text-muted-foreground">
                {Math.round(progress)}%
              </span>
            )}
          </div>
          {execution.phase_total && <Progress value={progress} className="h-1.5" />}
        </div>
      )}
    </div>
  );
}
