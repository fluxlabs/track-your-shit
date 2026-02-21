// Track Your Shit - GSD Todos Tab
// Full CRUD todo manager for GSD projects
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  Plus,
  CheckCircle2,
  Circle,
  Trash2,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useGsdTodos,
  useGsdCreateTodo,
  useGsdCompleteTodo,
  useGsdDeleteTodo,
} from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { GsdTodo } from '@/lib/tauri';

interface GsdTodosTabProps {
  projectId: string;
}

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function priorityVariant(priority: string | null) {
  switch (priority) {
    case 'critical':
      return 'error' as const;
    case 'high':
      return 'warning' as const;
    case 'medium':
      return 'info' as const;
    case 'low':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

export function GsdTodosTab({ projectId }: GsdTodosTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GsdTodo | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newPhase, setNewPhase] = useState('');
  const [newIsBlocker, setNewIsBlocker] = useState(false);

  const { data: todos, isLoading } = useGsdTodos(projectId);
  const createTodo = useGsdCreateTodo();
  const completeTodo = useGsdCompleteTodo();
  const deleteTodo = useGsdDeleteTodo();

  const filteredTodos = (todos ?? [])
    .filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter)
        return false;
      return true;
    })
    .sort((a, b) => {
      // Blockers first
      if (a.is_blocker && !b.is_blocker) return -1;
      if (!a.is_blocker && b.is_blocker) return 1;
      // Then by priority
      const pa = priorityOrder[a.priority ?? 'medium'] ?? 2;
      const pb = priorityOrder[b.priority ?? 'medium'] ?? 2;
      return pa - pb;
    });

  const pendingCount = (todos ?? []).filter((t) => t.status === 'pending').length;
  const doneCount = (todos ?? []).filter((t) => t.status === 'done').length;
  const blockerCount = (todos ?? []).filter(
    (t) => t.is_blocker && t.status === 'pending'
  ).length;

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createTodo.mutate(
      {
        projectId,
        input: {
          title: newTitle.trim(),
          area: newArea || null,
          priority: newPriority || null,
          phase: newPhase || null,
          is_blocker: newIsBlocker,
        },
      },
      {
        onSuccess: () => {
          setNewTitle('');
          setNewArea('');
          setNewPriority('medium');
          setNewPhase('');
          setNewIsBlocker(false);
          setShowCreateForm(false);
        },
      }
    );
  };

  const handleToggleComplete = (todo: GsdTodo) => {
    if (todo.status === 'pending') {
      completeTodo.mutate({ projectId, todoId: todo.id });
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteTodo.mutate(
      { projectId, todoId: deleteTarget.id },
      { onSuccess: () => setDeleteTarget(null) }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading todos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="info">{pendingCount} pending</Badge>
          <Badge variant="success">{doneCount} done</Badge>
          {blockerCount > 0 && (
            <Badge variant="error">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {blockerCount} blocker{blockerCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            New Todo
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Todo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Todo title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Input
                placeholder="Area (e.g. frontend)"
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Phase (e.g. 3)"
                value={newPhase}
                onChange={(e) => setNewPhase(e.target.value)}
                className="w-[120px]"
              />
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={newIsBlocker ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setNewIsBlocker(!newIsBlocker)}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                Blocker
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newTitle.trim() || createTodo.isPending}
              >
                {createTodo.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Todo list */}
      {filteredTodos.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {(todos ?? []).length === 0 ? (
              <>
                <p className="mb-2">No todos yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create your first todo
                </Button>
              </>
            ) : (
              <p>No todos match the current filters</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filteredTodos.map((todo) => (
            <div
              key={todo.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md border bg-card hover:bg-accent/50 transition-colors group',
                todo.status === 'done' && 'opacity-60'
              )}
            >
              <button
                className="flex-shrink-0"
                onClick={() => handleToggleComplete(todo)}
                disabled={todo.status === 'done'}
              >
                {todo.status === 'done' ? (
                  <CheckCircle2 className="h-5 w-5 text-status-success" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground hover:text-status-success transition-colors" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium truncate',
                      todo.status === 'done' && 'line-through'
                    )}
                  >
                    {todo.title}
                  </span>
                  {todo.is_blocker && (
                    <Badge variant="error" size="sm">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                      blocker
                    </Badge>
                  )}
                </div>
                {(todo.area || todo.phase) && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {todo.area && (
                      <span className="text-xs text-muted-foreground">
                        {todo.area}
                      </span>
                    )}
                    {todo.phase && (
                      <span className="text-xs text-muted-foreground">
                        Phase {todo.phase}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {todo.priority && (
                  <Badge variant={priorityVariant(todo.priority)} size="sm">
                    {todo.priority}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => setDeleteTarget(todo)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Todo?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTodo.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
