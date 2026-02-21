// Track Your Shit - Global GSD Todos Page
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Circle, ChevronDown, ChevronRight, ListTodo } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllGsdTodos, useGsdCompleteTodo } from '@/lib/queries';
import type { GsdTodoWithProject } from '@/lib/tauri';

// ─── Priority badge ────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;

  const colors: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    blocker: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    normal: 'bg-muted/60 text-muted-foreground border-border/40',
    low: 'bg-muted/30 text-muted-foreground/60 border-border/20',
  };

  const cls = colors[priority.toLowerCase()] ?? 'bg-muted/60 text-muted-foreground border-border/40';

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${cls}`}
    >
      {priority}
    </span>
  );
}

// ─── Single todo row ───────────────────────────────────────────────────────

interface TodoRowProps {
  todo: GsdTodoWithProject;
  onComplete: (projectId: string, todoId: string) => void;
  completing: boolean;
  showProject?: boolean;
}

function TodoRow({ todo, onComplete, completing, showProject = false }: TodoRowProps) {
  const navigate = useNavigate();
  const isDone = todo.status === 'done';

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors ${isDone ? 'opacity-50' : ''}`}
    >
      {/* Blocker icon or status toggle */}
      <div className="flex items-center gap-1.5 mt-0.5 flex-shrink-0">
        {todo.is_blocker && !isDone && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" aria-label="Blocker" />
        )}
        <button
          type="button"
          disabled={isDone || completing}
          onClick={() => onComplete(todo.project_id, todo.id)}
          className="flex-shrink-0 text-muted-foreground hover:text-green-400 disabled:cursor-default disabled:opacity-50 transition-colors"
          title={isDone ? 'Completed' : 'Mark as done'}
          aria-label={isDone ? 'Completed' : 'Mark todo as done'}
        >
          {isDone ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
          >
            {todo.title}
          </span>

          {todo.area && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {todo.area}
            </Badge>
          )}

          {todo.phase && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {todo.phase}
            </Badge>
          )}

          <PriorityBadge priority={todo.priority} />
        </div>

        {todo.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{todo.description}</p>
        )}
      </div>

      {/* Project chip */}
      {showProject && (
        <button
          type="button"
          onClick={() => void navigate(`/projects/${todo.project_id}?tab=gsd`)}
          className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20 hover:bg-brand-blue/20 transition-colors font-medium"
          title={`Go to ${todo.project_name}`}
        >
          {todo.project_name}
        </button>
      )}
    </div>
  );
}

// ─── Project group section ─────────────────────────────────────────────────

interface ProjectGroupProps {
  projectId: string;
  projectName: string;
  todos: GsdTodoWithProject[];
  onComplete: (projectId: string, todoId: string) => void;
  completingKey: string | null;
}

function ProjectGroup({ projectId, projectName, todos, onComplete, completingKey }: ProjectGroupProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const pendingCount = todos.filter((t) => t.status !== 'done').length;
  const blockerCount = todos.filter((t) => t.is_blocker && t.status !== 'done').length;

  return (
    <div className="rounded-lg border border-border/40 bg-card overflow-hidden mb-3">
      {/* Group header */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setCollapsed(!collapsed)}
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void navigate(`/projects/${projectId}?tab=gsd`);
          }}
          className="text-sm font-semibold text-foreground hover:text-brand-blue transition-colors"
        >
          {projectName}
        </button>

        <div className="flex items-center gap-1.5 ml-2">
          {blockerCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {blockerCount} blocker{blockerCount > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {pendingCount} pending
          </Badge>
        </div>
      </button>

      {/* Todo rows */}
      {!collapsed && (
        <div>
          {todos.map((todo) => (
            <TodoRow
              key={`${todo.project_id}:${todo.id}`}
              todo={todo}
              onComplete={onComplete}
              completing={completingKey === `${todo.project_id}:${todo.id}`}
              showProject={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

type FilterMode = 'all' | 'pending' | 'blockers' | 'done';
type SortMode = 'priority' | 'project' | 'created';

export function TodosPage() {
  const { data: todos, isLoading } = useAllGsdTodos();
  const completeMutation = useGsdCompleteTodo();

  const [filterMode, setFilterMode] = useState<FilterMode>('pending');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [completingKey, setCompletingKey] = useState<string | null>(null);

  // Derive unique project list for dropdown
  const projectOptions = useMemo(() => {
    if (!todos) return [];
    const seen = new Map<string, string>();
    todos.forEach((t) => seen.set(t.project_id, t.project_name));
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [todos]);

  // Has GSD projects at all?
  const hasGsdProjects = (todos?.length ?? 0) > 0 || isLoading;

  // Apply filters
  const filtered = useMemo(() => {
    if (!todos) return [];
    return todos.filter((t) => {
      if (projectFilter !== 'all' && t.project_id !== projectFilter) return false;
      if (filterMode === 'pending') return t.status !== 'done';
      if (filterMode === 'done') return t.status === 'done';
      if (filterMode === 'blockers') return t.is_blocker && t.status !== 'done';
      return true; // 'all'
    });
  }, [todos, filterMode, projectFilter]);

  // Apply sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortMode === 'priority') {
        const priorityOrd = (t: GsdTodoWithProject) => {
          if (t.is_blocker) return 0;
          switch (t.priority?.toLowerCase()) {
            case 'critical':
            case 'blocker':
              return 0;
            case 'high':
              return 1;
            case 'medium':
              return 2;
            case 'low':
              return 3;
            default:
              return 4;
          }
        };
        return priorityOrd(a) - priorityOrd(b) || a.project_name.localeCompare(b.project_name);
      }
      if (sortMode === 'project') return a.project_name.localeCompare(b.project_name);
      if (sortMode === 'created') {
        const da = a.created_at ?? '';
        const db_ = b.created_at ?? '';
        return db_.localeCompare(da); // newest first
      }
      return 0;
    });
  }, [filtered, sortMode]);

  // Group by project
  const groups = useMemo(() => {
    const map = new Map<string, { projectId: string; projectName: string; todos: GsdTodoWithProject[] }>();
    sorted.forEach((t) => {
      if (!map.has(t.project_id)) {
        map.set(t.project_id, { projectId: t.project_id, projectName: t.project_name, todos: [] });
      }
      map.get(t.project_id)!.todos.push(t);
    });
    return Array.from(map.values());
  }, [sorted]);

  const pendingTotal = todos?.filter((t) => t.status !== 'done').length ?? 0;
  const blockerTotal = todos?.filter((t) => t.is_blocker && t.status !== 'done').length ?? 0;

  function handleComplete(projectId: string, todoId: string) {
    const key = `${projectId}:${todoId}`;
    setCompletingKey(key);
    completeMutation.mutate(
      { projectId, todoId },
      { onSettled: () => setCompletingKey(null) },
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-brand-blue/15">
            <ListTodo className="h-5 w-5 text-brand-blue" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Todos</h1>
            {pendingTotal > 0 && (
              <Badge variant="secondary" className="text-xs">
                {pendingTotal} pending
              </Badge>
            )}
            {blockerTotal > 0 && (
              <Badge variant="destructive" className="text-xs">
                {blockerTotal} blocker{blockerTotal > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Filter / sort bar */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-border/30 flex flex-wrap items-center gap-2">
        {/* Status filter buttons */}
        <div className="flex items-center gap-1 rounded-md border border-border/40 p-0.5 bg-muted/20">
          {(['pending', 'all', 'blockers', 'done'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-2.5 py-1 text-xs rounded font-medium transition-colors capitalize ${
                filterMode === mode
                  ? 'bg-brand-blue text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'blockers' ? 'Blockers' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        {/* Project dropdown */}
        {projectOptions.length > 1 && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-7 text-xs w-44">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projectOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Sort */}
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="h-7 text-xs w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Sort: Priority</SelectItem>
            <SelectItem value="project">Sort: Project</SelectItem>
            <SelectItem value="created">Sort: Newest</SelectItem>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {sorted.length} todo{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Loading todos...
          </div>
        ) : !hasGsdProjects ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <ListTodo className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
              No GSD projects imported yet
            </p>
            <p className="text-xs text-muted-foreground/60">
              Import a project with a <code className="font-mono">.planning/</code> directory to see todos here.
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {filterMode === 'blockers'
                ? 'No blockers across your GSD projects'
                : filterMode === 'done'
                ? 'No completed todos'
                : 'No pending todos across your GSD projects'}
            </p>
          </div>
        ) : (
          <div>
            {groups.map((group) => (
              <ProjectGroup
                key={group.projectId}
                projectId={group.projectId}
                projectName={group.projectName}
                todos={group.todos}
                onComplete={handleComplete}
                completingKey={completingKey}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
