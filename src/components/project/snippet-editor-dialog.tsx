// Track Your Shit - Snippet Editor Dialog Component
// Create or edit saved command snippets
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCreateSnippet, useUpdateSnippet } from '@/lib/queries';
import type { Snippet } from '@/lib/tauri';

interface SnippetEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  snippet: Snippet | null; // null = create new
}

export function SnippetEditorDialog({
  open,
  onOpenChange,
  projectId,
  snippet,
}: SnippetEditorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Key resets form state when snippet changes or dialog reopens */}
        <SnippetEditorForm
          key={snippet?.id ?? 'new'}
          snippet={snippet}
          projectId={projectId}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SnippetEditorForm({
  snippet,
  projectId,
  onClose,
}: {
  snippet: Snippet | null;
  projectId: string;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(snippet?.label ?? '');
  const [command, setCommand] = useState(snippet?.command ?? '');
  const [description, setDescription] = useState(snippet?.description ?? '');
  const [category, setCategory] = useState(snippet?.category ?? 'general');
  const [isGlobal, setIsGlobal] = useState(!snippet?.project_id && !!snippet);

  const createSnippet = useCreateSnippet();
  const updateSnippet = useUpdateSnippet();

  const isEditing = !!snippet;

  const handleSave = () => {
    const input = {
      label: label.trim(),
      command: command.trim(),
      description: description.trim() || undefined,
      category: category.trim() || 'general',
    };

    if (!input.label || !input.command) return;

    if (isEditing && snippet) {
      updateSnippet.mutate(
        { id: snippet.id, input },
        { onSuccess: () => onClose() },
      );
    } else {
      createSnippet.mutate(
        { projectId: isGlobal ? null : projectId, input },
        { onSuccess: () => onClose() },
      );
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Snippet' : 'New Snippet'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="snippet-label">Label</Label>
          <Input
            id="snippet-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Run migrations"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="snippet-command">Command</Label>
          <Input
            id="snippet-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="e.g. pnpm db:migrate"
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="snippet-description">Description (optional)</Label>
          <Input
            id="snippet-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this command do?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="snippet-category">Category</Label>
          <Input
            id="snippet-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="general"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="snippet-global"
            type="checkbox"
            checked={isGlobal}
            onChange={(e) => setIsGlobal(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="snippet-global" className="text-sm font-normal">
            Global snippet (available in all projects)
          </Label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={
            !label.trim() ||
            !command.trim() ||
            createSnippet.isPending ||
            updateSnippet.isPending
          }
        >
          {isEditing ? 'Save' : 'Create'}
        </Button>
      </DialogFooter>
    </>
  );
}
