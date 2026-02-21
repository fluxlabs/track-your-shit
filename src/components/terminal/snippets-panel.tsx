// Track Your Shit - Snippets Panel
// Sidebar panel for managing and inserting terminal snippets
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo } from 'react';
import { Code, Plus, Trash2, Pencil, X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useSnippets,
  useCreateSnippet,
  useUpdateSnippet,
  useDeleteSnippet,
} from '@/lib/queries';
import type { Snippet, SnippetInput } from '@/lib/tauri';

interface SnippetsPanelProps {
  projectId: string;
  onInsert: (command: string) => void;
  onClose: () => void;
}

interface SnippetFormData {
  label: string;
  command: string;
  description: string;
  category: string;
}

const EMPTY_FORM: SnippetFormData = {
  label: '',
  command: '',
  description: '',
  category: 'general',
};

function SnippetForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: SnippetFormData;
  onSave: (data: SnippetFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<SnippetFormData>(initial);

  return (
    <div className="px-3 py-2 border-b space-y-2">
      <Input
        placeholder="Label"
        value={form.label}
        onChange={(e) => setForm({ ...form, label: e.target.value })}
        className="h-7 text-xs"
      />
      <textarea
        placeholder="Command"
        value={form.command}
        onChange={(e) => setForm({ ...form, command: e.target.value })}
        className="w-full h-14 rounded-md border border-input bg-background px-3 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <Input
        placeholder="Category (e.g. git, docker)"
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
        className="h-7 text-xs"
      />
      <Input
        placeholder="Description (optional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="h-7 text-xs"
      />
      <div className="flex gap-1 justify-end">
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-6 text-xs"
          disabled={!form.label.trim() || !form.command.trim() || saving}
          onClick={() => onSave(form)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function SnippetItem({
  snippet,
  onInsert,
  onEdit,
  onDelete,
}: {
  snippet: Snippet;
  onInsert: (command: string) => void;
  onEdit: (snippet: Snippet) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-start gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{snippet.label}</p>
          <Badge variant="secondary" className="text-[10px] px-1 py-0 flex-shrink-0">
            {snippet.category}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
          {snippet.command}
        </p>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          title="Copy to clipboard"
          onClick={() => {
            onInsert(snippet.command);
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          title="Edit"
          onClick={() => onEdit(snippet)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          title="Delete"
          onClick={() => onDelete(snippet.id)}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
    </div>
  );
}

export function SnippetsPanel({ projectId, onInsert, onClose }: SnippetsPanelProps) {
  const { data: snippets, isLoading } = useSnippets(projectId);
  const createSnippet = useCreateSnippet();
  const updateSnippet = useUpdateSnippet();
  const deleteSnippet = useDeleteSnippet();

  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!snippets) return [];
    if (!search.trim()) return snippets;
    const q = search.toLowerCase();
    return snippets.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
    );
  }, [snippets, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Snippet[]> = {};
    for (const s of filtered) {
      const cat = s.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return groups;
  }, [filtered]);

  const categories = Object.keys(grouped).sort();

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleInsert = (command: string) => {
    void navigator.clipboard.writeText(command);
    toast.success('Copied to clipboard');
    onInsert(command);
  };

  const handleCreate = (data: SnippetFormData) => {
    const input: SnippetInput = {
      label: data.label.trim(),
      command: data.command.trim(),
      description: data.description.trim() || undefined,
      category: data.category.trim() || undefined,
    };
    createSnippet.mutate(
      { projectId, input },
      { onSuccess: () => setShowNew(false) },
    );
  };

  const handleUpdate = (data: SnippetFormData) => {
    if (!editingSnippet) return;
    const input: SnippetInput = {
      label: data.label.trim(),
      command: data.command.trim(),
      description: data.description.trim() || undefined,
      category: data.category.trim() || undefined,
    };
    updateSnippet.mutate(
      { id: editingSnippet.id, input },
      { onSuccess: () => setEditingSnippet(null) },
    );
  };

  return (
    <div className="w-[280px] border-l bg-card flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Snippets</span>
          {snippets && (
            <span className="text-xs text-muted-foreground">({snippets.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="New snippet"
            onClick={() => {
              setShowNew(true);
              setEditingSnippet(null);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <Input
          placeholder="Search snippets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>

      {/* New snippet form */}
      {showNew && (
        <SnippetForm
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => setShowNew(false)}
          saving={createSnippet.isPending}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Code className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No matching snippets' : 'No snippets yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Try a different search term' : 'Click + to create your first snippet'}
            </p>
          </div>
        ) : (
          categories.map((cat) => {
            const items = grouped[cat];
            const collapsed = collapsedCategories.has(cat);
            return (
              <div key={cat} className="mb-1">
                <button
                  className="w-full flex items-center gap-1 px-3 py-1 hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCategory(cat)}
                >
                  <Check
                    className={cn(
                      'h-3 w-3 transition-transform text-muted-foreground',
                      collapsed && '-rotate-90',
                    )}
                  />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {cat} ({items.length})
                  </span>
                </button>
                {!collapsed &&
                  items.map((snippet) =>
                    editingSnippet?.id === snippet.id ? (
                      <SnippetForm
                        key={snippet.id}
                        initial={{
                          label: snippet.label,
                          command: snippet.command,
                          description: snippet.description || '',
                          category: snippet.category,
                        }}
                        onSave={handleUpdate}
                        onCancel={() => setEditingSnippet(null)}
                        saving={updateSnippet.isPending}
                      />
                    ) : (
                      <SnippetItem
                        key={snippet.id}
                        snippet={snippet}
                        onInsert={handleInsert}
                        onEdit={setEditingSnippet}
                        onDelete={(id) => deleteSnippet.mutate(id)}
                      />
                    ),
                  )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
