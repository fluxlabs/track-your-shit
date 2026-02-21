// Track Your Shit - Auto Commands Panel
// Panel for managing pre/post execution auto-commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo } from 'react';
import { Settings2, Plus, Trash2, Pencil, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useAutoCommands,
  useDeleteAutoCommand,
  useToggleAutoCommand,
  useAutoCommandPresets,
  useCreateAutoCommand,
} from '@/lib/queries';
import type { AutoCommand } from '@/lib/tauri';
import { AutoCommandDialog } from './auto-command-dialog';

interface AutoCommandsPanelProps {
  projectId: string;
  onClose: () => void;
}

function CommandRow({
  command,
  projectId,
  onEdit,
}: {
  command: AutoCommand;
  projectId: string;
  onEdit: (cmd: AutoCommand) => void;
}) {
  const toggleAutoCommand = useToggleAutoCommand();
  const deleteAutoCommand = useDeleteAutoCommand();

  return (
    <div className="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
      <Switch
        checked={command.enabled}
        onCheckedChange={() =>
          toggleAutoCommand.mutate({ id: command.id, projectId })
        }
        className="scale-75"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{command.label}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {command.command}
        </p>
      </div>
      {command.preset && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 flex-shrink-0">
          preset
        </Badge>
      )}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          title="Edit"
          onClick={() => onEdit(command)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          title="Delete"
          onClick={() => deleteAutoCommand.mutate({ id: command.id, projectId })}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

export function AutoCommandsPanel({ projectId, onClose }: AutoCommandsPanelProps) {
  const { data: commands, isLoading } = useAutoCommands(projectId);
  const { data: presets } = useAutoCommandPresets();
  const createAutoCommand = useCreateAutoCommand();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCommand, setEditCommand] = useState<AutoCommand | undefined>(undefined);

  const { preExecution, postExecution } = useMemo(() => {
    const pre: AutoCommand[] = [];
    const post: AutoCommand[] = [];
    if (commands) {
      for (const cmd of commands) {
        if (cmd.hook_type === 'post_execution') {
          post.push(cmd);
        } else {
          pre.push(cmd);
        }
      }
    }
    return { preExecution: pre, postExecution: post };
  }, [commands]);

  const openNewDialog = (_hookType: string) => {
    setEditCommand(undefined);
    setDialogOpen(true);
  };

  const openEditDialog = (cmd: AutoCommand) => {
    setEditCommand(cmd);
    setDialogOpen(true);
  };

  const renderSection = (
    title: string,
    hookType: string,
    items: AutoCommand[],
  ) => (
    <div className="mb-3">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title} ({items.length})
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-xs text-muted-foreground"
          onClick={() => openNewDialog(hookType)}
        >
          <Plus className="h-3 w-3 mr-0.5" />
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          No {title.toLowerCase()} commands
        </p>
      ) : (
        items.map((cmd) => (
          <CommandRow
            key={cmd.id}
            command={cmd}
            projectId={projectId}
            onEdit={openEditDialog}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="w-[280px] border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Auto-Commands</span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Presets */}
      {presets && presets.length > 0 && (
        <div className="px-3 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground">Quick Presets</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {presets.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                size="sm"
                className={cn('h-6 text-[10px] px-2', createAutoCommand.isPending && 'opacity-50')}
                disabled={createAutoCommand.isPending}
                onClick={() =>
                  createAutoCommand.mutate({
                    projectId,
                    input: {
                      label: preset.label,
                      command: preset.command,
                      hook_type: preset.hook_type,
                      preset: preset.id,
                    },
                  })
                }
              >
                <Zap className="h-3 w-3 mr-0.5" />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <>
            {renderSection('Pre-Execution', 'pre_execution', preExecution)}
            {renderSection('Post-Execution', 'post_execution', postExecution)}
          </>
        )}
      </div>

      {/* Dialog */}
      <AutoCommandDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        editCommand={editCommand}
      />
    </div>
  );
}
