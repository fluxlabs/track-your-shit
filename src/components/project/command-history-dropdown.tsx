// Track Your Shit - Command History Dropdown Component
// Shows previously executed commands for quick re-use
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCommandHistory, useClearCommandHistory } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface CommandHistoryDropdownProps {
  projectId: string;
  onSelect: (command: string) => void;
  onExecute: (command: string) => void;
  disabled?: boolean;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function CommandHistoryDropdown({
  projectId,
  onSelect,
  onExecute,
  disabled,
}: CommandHistoryDropdownProps) {
  const { data: history } = useCommandHistory(projectId);
  const clearHistory = useClearCommandHistory();

  const hasHistory = history && history.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={disabled || !hasHistory}
          title="Command history"
        >
          <History className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
        {history?.map((entry) => (
          <DropdownMenuItem
            key={entry.id}
            className="flex items-center justify-between gap-2 cursor-pointer"
            onClick={() => onSelect(entry.command)}
            onDoubleClick={() => onExecute(entry.command)}
          >
            <span className={cn('truncate font-mono text-xs flex-1', 'max-w-[200px]')}>
              {entry.command}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {formatRelativeTime(entry.created_at)}
            </span>
          </DropdownMenuItem>
        ))}
        {hasHistory && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => clearHistory.mutate(projectId)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Clear History
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
