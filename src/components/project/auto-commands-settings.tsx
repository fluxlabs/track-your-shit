// Track Your Shit - Auto-commands Settings Dialog
// Pre/post execution hooks management
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { Settings, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useAutoCommands,
  useAutoCommandPresets,
  useCreateAutoCommand,
  useDeleteAutoCommand,
  useToggleAutoCommand,
} from '@/lib/queries';
import type { AutoCommand } from '@/lib/tauri';

interface AutoCommandsSettingsProps {
  projectId: string;
}

function AutoCommandRow({
  cmd,
  projectId,
}: {
  cmd: AutoCommand;
  projectId: string;
}) {
  const toggleCmd = useToggleAutoCommand();
  const deleteCmd = useDeleteAutoCommand();

  return (
    <div className="flex items-center gap-2 py-1.5 px-1">
      <Switch
        checked={cmd.enabled}
        onCheckedChange={() =>
          toggleCmd.mutate({ id: cmd.id, projectId })
        }
        className="scale-75"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{cmd.label}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {cmd.command}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
        onClick={() => deleteCmd.mutate({ id: cmd.id, projectId })}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function AutoCommandsSettings({ projectId }: AutoCommandsSettingsProps) {
  const { data: autoCommands } = useAutoCommands(projectId);
  const { data: presets } = useAutoCommandPresets();
  const createCmd = useCreateAutoCommand();
  const [customLabel, setCustomLabel] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [customHookType, setCustomHookType] = useState<'pre' | 'post'>('post');

  const preCommands = (autoCommands ?? []).filter((c) => c.hook_type === 'pre');
  const postCommands = (autoCommands ?? []).filter((c) => c.hook_type === 'post');

  const handleAddPreset = (presetId: string) => {
    const preset = presets?.find((p) => p.id === presetId);
    if (!preset) return;
    createCmd.mutate({
      projectId,
      input: {
        label: preset.label,
        command: preset.command,
        hook_type: preset.hook_type,
        preset: preset.id,
      },
    });
  };

  const handleAddCustom = () => {
    if (!customLabel.trim() || !customCommand.trim()) return;
    createCmd.mutate(
      {
        projectId,
        input: {
          label: customLabel.trim(),
          command: customCommand.trim(),
          hook_type: customHookType,
        },
      },
      {
        onSuccess: () => {
          setCustomLabel('');
          setCustomCommand('');
        },
      },
    );
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          title="Auto-commands settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Auto-commands
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pre-execution */}
          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pre-execution
            </Label>
            <div className="mt-1 space-y-0.5">
              {preCommands.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">
                  No pre-execution commands
                </p>
              )}
              {preCommands.map((cmd) => (
                <AutoCommandRow
                  key={cmd.id}
                  cmd={cmd}
                  projectId={projectId}
                />
              ))}
            </div>
          </div>

          {/* Post-execution */}
          <div>
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Post-execution
            </Label>
            <div className="mt-1 space-y-0.5">
              {postCommands.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">
                  No post-execution commands
                </p>
              )}
              {postCommands.map((cmd) => (
                <AutoCommandRow
                  key={cmd.id}
                  cmd={cmd}
                  projectId={projectId}
                />
              ))}
            </div>
          </div>

          {/* Add from preset */}
          <div className="border-t pt-3">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Add Preset
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {presets?.map((preset) => (
                    <DropdownMenuItem
                      key={preset.id}
                      onClick={() => handleAddPreset(preset.id)}
                    >
                      <span className="flex-1">{preset.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {preset.hook_type}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Add custom */}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs font-medium">Add Custom</Label>
            <div className="flex gap-2">
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Label"
                className="text-sm"
              />
              <select
                value={customHookType}
                onChange={(e) =>
                  setCustomHookType(e.target.value as 'pre' | 'post')
                }
                className="border rounded-md px-2 text-sm bg-background"
              >
                <option value="pre">Pre</option>
                <option value="post">Post</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Input
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="Command..."
                className="text-sm font-mono flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
              />
              <Button
                size="sm"
                onClick={handleAddCustom}
                disabled={!customLabel.trim() || !customCommand.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Auto-commands are displayed here for configuration. Execution chain
            integration will be available in a future update.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
