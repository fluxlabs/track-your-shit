// Track Your Shit - Snippets Panel Component
// Saved command snippets grouped by category
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { Code2, Plus, ChevronDown, ChevronRight, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSnippets, useDeleteSnippet } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { Snippet } from '@/lib/tauri';
import { SnippetEditorDialog } from './snippet-editor-dialog';

interface SnippetsPanelProps {
  projectId: string;
  onSelect: (command: string) => void;
  onExecute: (command: string) => void;
  disabled?: boolean;
}

export function SnippetsPanel({
  projectId,
  onSelect,
  onExecute,
  disabled,
}: SnippetsPanelProps) {
  const { data: snippets } = useSnippets(projectId);
  const deleteSnippet = useDeleteSnippet();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  // Group snippets by category
  const grouped = (snippets ?? []).reduce<Record<string, Snippet[]>>((acc, s) => {
    const cat = s.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();
  const isEmpty = categories.length === 0;

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleEdit = (snippet: Snippet) => {
    setEditingSnippet(snippet);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingSnippet(null);
    setEditorOpen(true);
  };

  return (
    <>
      <Card className={cn('w-full', isEmpty && 'opacity-70')}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Code2 className="h-3.5 w-3.5" />
              Snippets
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleCreate}
              title="Add snippet"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {isEmpty && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No snippets yet
            </p>
          )}
          {categories.map((cat) => (
            <div key={cat}>
              <button
                className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground w-full px-1 py-1 hover:text-foreground"
                onClick={() => toggleCategory(cat)}
              >
                {collapsed[cat] ? (
                  <ChevronRight className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {cat}
                <span className="ml-auto text-[10px]">{grouped[cat].length}</span>
              </button>
              {!collapsed[cat] &&
                grouped[cat].map((snippet) => (
                  <div key={snippet.id} className="flex items-center group">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 justify-start text-xs h-7 px-2 font-normal"
                      onClick={() => onSelect(snippet.command)}
                      onDoubleClick={() => onExecute(snippet.command)}
                      disabled={disabled}
                      title={snippet.description || snippet.command}
                    >
                      <span className="truncate">{snippet.label}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(snippet)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteSnippet.mutate(snippet.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
            </div>
          ))}
        </CardContent>
      </Card>

      <SnippetEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        projectId={projectId}
        snippet={editingSnippet}
      />
    </>
  );
}
