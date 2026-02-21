// Track Your Shit - Dashboard Status Bar
// 3-stat summary: projects, pending todos, blockers
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { FolderOpen, ListTodo, AlertTriangle } from 'lucide-react';
import { useProjectsWithStats } from '@/lib/queries';

export function StatusBar() {
  const { data: projects } = useProjectsWithStats();

  const projectCount = projects?.length ?? 0;

  // Aggregate todo and blocker counts from tech_stack data embedded in ProjectWithStats
  const gsdProjects = projects?.filter((p) => p.tech_stack?.has_planning) ?? [];
  const totalTodos = gsdProjects.reduce(
    (sum, p) => sum + (p.tech_stack?.gsd_todo_count ?? 0),
    0,
  );

  // Blocker count isn't in ProjectWithStats directly — we compute from what we have.
  // The gsd_todo_count reflects total todos; blockers require per-project GSD queries.
  // We show the GSD project count as a proxy here to avoid N+1 queries on the status bar.
  const gsdCount = gsdProjects.length;

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card/50 text-sm">
      <StatItem
        icon={<FolderOpen className="h-3.5 w-3.5" />}
        value={projectCount}
        label={projectCount === 1 ? 'project' : 'projects'}
      />
      <Sep />
      <StatItem
        icon={<ListTodo className="h-3.5 w-3.5 text-brand-purple" />}
        value={totalTodos}
        label="pending todos"
        accent="purple"
      />
      <Sep />
      <StatItem
        icon={<AlertTriangle className="h-3.5 w-3.5 text-brand-purple/60" />}
        value={gsdCount}
        label={gsdCount === 1 ? 'GSD project' : 'GSD projects'}
      />
    </div>
  );
}

function StatItem({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: 'purple' | 'red';
}) {
  const accentClass =
    accent === 'purple'
      ? 'text-brand-purple font-semibold'
      : accent === 'red'
        ? 'text-status-error font-semibold'
        : 'font-semibold';

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className={accentClass}>{value}</span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function Sep() {
  return <span className="text-border select-none">|</span>;
}
