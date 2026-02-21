// Track Your Shit - Auto Command Dialog
// Dialog for creating and editing auto-commands
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateAutoCommand, useUpdateAutoCommand } from '@/lib/queries';
import type { AutoCommand, AutoCommandInput } from '@/lib/tauri';

interface AutoCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  editCommand?: AutoCommand;
}

export function AutoCommandDialog({
  open,
  onOpenChange,
  projectId,
  editCommand,
}: AutoCommandDialogProps) {
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [hookType, setHookType] = useState('pre_execution');

  const createAutoCommand = useCreateAutoCommand();
  const updateAutoCommand = useUpdateAutoCommand();

  const isEditing = !!editCommand;
  const saving = createAutoCommand.isPending || updateAutoCommand.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      // Reset form when dialog opens
      setLabel(editCommand?.label ?? '');
      setCommand(editCommand?.command ?? '');
      setHookType(editCommand?.hook_type ?? 'pre_execution');
    }
    onOpenChange(nextOpen);
  };

  const handleSave = () => {
    const input: AutoCommandInput = {
      label: label.trim(),
      command: command.trim(),
      hook_type: hookType,
    };

    if (isEditing && editCommand) {
      updateAutoCommand.mutate(
        { id: editCommand.id, input, projectId },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createAutoCommand.mutate(
        { projectId, input },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Auto-Command' : 'New Auto-Command'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Label</label>
            <Input
              placeholder="e.g. Run linter"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Command</label>
            <Input
              placeholder="e.g. npm run lint"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hook Type</label>
            <Select value={hookType} onValueChange={setHookType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pre_execution">Pre-Execution</SelectItem>
                <SelectItem value="post_execution">Post-Execution</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!label.trim() || !command.trim() || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
