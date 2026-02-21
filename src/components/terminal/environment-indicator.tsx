// Track Your Shit - Environment Indicator Component
// Shows git branch + runtime versions in terminal tab bar
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useEnvironmentInfo } from '@/lib/queries';
import { GitBranch } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface EnvironmentIndicatorProps {
  workingDirectory: string;
}

export function EnvironmentIndicator({ workingDirectory }: EnvironmentIndicatorProps) {
  const { data, isLoading } = useEnvironmentInfo(workingDirectory);

  if (isLoading) {
    return <Skeleton className="h-4 w-40" />;
  }

  if (!data) return null;

  const parts: string[] = [];

  if (data.node_version) parts.push(`Node ${data.node_version}`);
  if (data.python_version) parts.push(`Py ${data.python_version}`);
  if (data.rust_version) parts.push(`Rust ${data.rust_version}`);

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground select-none">
      {data.git_branch && (
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          <span className="font-mono">{data.git_branch}</span>
        </span>
      )}
      {data.git_branch && parts.length > 0 && (
        <span className="text-border">|</span>
      )}
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-border">|</span>}
          <span className="font-mono">{part}</span>
        </span>
      ))}
    </div>
  );
}
