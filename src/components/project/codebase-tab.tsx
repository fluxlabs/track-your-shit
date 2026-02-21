// Track Your Shit - Codebase Tab (structured .planning/codebase/ browser)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useEffect } from 'react';
import { useCodebaseDoc } from '@/lib/queries';
import { MarkdownRenderer } from '@/components/knowledge/markdown-renderer';
import {
  Layers,
  Building2,
  FolderTree,
  ScrollText,
  TestTube,
  Plug,
  AlertTriangle,
  Loader2,
  FileSearch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface CodebaseTabProps {
  projectId: string;
  projectPath: string;
}

interface DocMeta {
  filename: string;
  label: string;
  icon: LucideIcon;
}

const CODEBASE_DOCS: DocMeta[] = [
  { filename: 'STACK.md', label: 'Tech Stack', icon: Layers },
  { filename: 'ARCHITECTURE.md', label: 'Architecture', icon: Building2 },
  { filename: 'STRUCTURE.md', label: 'Structure', icon: FolderTree },
  { filename: 'CONVENTIONS.md', label: 'Conventions', icon: ScrollText },
  { filename: 'TESTING.md', label: 'Testing', icon: TestTube },
  { filename: 'INTEGRATIONS.md', label: 'Integrations', icon: Plug },
  { filename: 'CONCERNS.md', label: 'Concerns', icon: AlertTriangle },
];

export function CodebaseTab({ projectId, projectPath }: CodebaseTabProps) {
  const [selectedDoc, setSelectedDoc] = useState(CODEBASE_DOCS[0].filename);

  // Probe first doc to detect if codebase docs exist
  const probe = useCodebaseDoc(projectPath, CODEBASE_DOCS[0].filename);
  const { data: content, isLoading: contentLoading } = useCodebaseDoc(projectPath, selectedDoc);

  // Track which docs exist
  const [availableDocs, setAvailableDocs] = useState<Set<string>>(new Set());
  const probeResults = CODEBASE_DOCS.map((doc) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useCodebaseDoc(projectPath, doc.filename);
    return { filename: doc.filename, exists: !!data };
  });

  useEffect(() => {
    const available = new Set<string>();
    for (const r of probeResults) {
      if (r.exists) available.add(r.filename);
    }
    setAvailableDocs(available);
  }, [probeResults.map((r) => r.exists).join(',')]);

  // Auto-select first available doc
  useEffect(() => {
    if (availableDocs.size > 0 && !availableDocs.has(selectedDoc)) {
      const first = CODEBASE_DOCS.find((d) => availableDocs.has(d.filename));
      if (first) setSelectedDoc(first.filename);
    }
  }, [availableDocs, selectedDoc]);

  if (probe.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (availableDocs.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileSearch className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No codebase analysis found</p>
        <p className="text-xs mt-1 text-center max-w-xs">
          Run <code className="font-mono text-[11px]">/gsd:map-codebase</code> to generate
          structured analysis documents for this project.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left sidebar */}
      <div className="w-56 flex-shrink-0 border rounded-lg bg-card overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {CODEBASE_DOCS.filter((doc) => availableDocs.has(doc.filename)).map((doc) => {
            const Icon = doc.icon;
            return (
              <button
                key={doc.filename}
                type="button"
                onClick={() => setSelectedDoc(doc.filename)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                  selectedDoc === doc.filename
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{doc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-y-auto p-6">
        {contentLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : content ? (
          <MarkdownRenderer
            content={content}
            projectId={projectId}
            filePath={`.planning/codebase/${selectedDoc}`}
          />
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Select a document to view
          </div>
        )}
      </div>
    </div>
  );
}
