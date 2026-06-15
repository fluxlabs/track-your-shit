// VCCA - GSD Process Docs Tab
// Read-only viewer for project-level process docs (ARTF-04): discussion-log, retrospective,
// discovery, dev-preferences, continue-here, milestone-archive
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { ScrollText, FileSearch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MarkdownRenderer } from '@/components/knowledge/markdown-renderer';
import { useGsdProcessDocs } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface GsdProcessDocsTabProps {
  projectId: string;
}

interface DocMeta {
  doc_type: string;
  label: string;
}

const PROCESS_DOCS: DocMeta[] = [
  { doc_type: 'discussion-log', label: 'Discussion Log' },
  { doc_type: 'retrospective', label: 'Retrospective' },
  { doc_type: 'discovery', label: 'Discovery' },
  { doc_type: 'dev-preferences', label: 'Dev Preferences' },
  { doc_type: 'continue-here', label: 'Continue Here' },
  { doc_type: 'milestone-archive', label: 'Milestone Archive' },
];

export function GsdProcessDocsTab({ projectId }: GsdProcessDocsTabProps) {
  const { data: docs, isLoading } = useGsdProcessDocs(projectId);
  const [selectedType, setSelectedType] = useState<string>(PROCESS_DOCS[0].doc_type);

  if (isLoading) {
    return (
      <div className="flex gap-4 h-full min-h-0">
        {/* Left sidebar skeleton */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {PROCESS_DOCS.map((d) => (
            <div key={d.doc_type} className="h-8 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
        {/* Right panel skeleton */}
        <div className="flex-1 h-48 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // Build a lookup map by doc_type
  const docMap = new Map((docs ?? []).map((d) => [d.doc_type, d]));

  // Check if ALL docs are absent
  const allAbsent = PROCESS_DOCS.every((meta) => {
    const d = docMap.get(meta.doc_type);
    return !d?.present;
  });

  if (allAbsent) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileSearch className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">No project docs found</p>
          <p className="text-xs mt-1">
            Process docs (discussion-log, retrospective, discovery, etc.) will appear here when
            present in your <code className="font-mono text-[11px]">.planning/</code> directory.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedDoc = docMap.get(selectedType) ?? null;
  const isPresent =
    selectedDoc?.present === true &&
    selectedDoc?.raw_content != null &&
    selectedDoc.raw_content.trim().length > 0;

  const filePath = selectedDoc?.source_file ?? `.planning/${selectedType}.md`;

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left sidebar — doc type list */}
      <div className="w-48 flex-shrink-0 border rounded-lg bg-card overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {PROCESS_DOCS.map((meta) => {
            const d = docMap.get(meta.doc_type);
            const present = d?.present === true;
            return (
              <button
                key={meta.doc_type}
                type="button"
                onClick={() => setSelectedType(meta.doc_type)}
                className={cn(
                  'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                  selectedType === meta.doc_type
                    ? 'bg-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                <ScrollText className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{meta.label}</span>
                {present && (
                  <Badge variant="default" className="text-[9px] px-1 py-0 h-4 shrink-0">
                    ✓
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel — content or empty state */}
      <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-y-auto p-6">
        {isPresent && selectedDoc?.raw_content != null ? (
          <MarkdownRenderer
            content={selectedDoc.raw_content}
            projectId={projectId}
            filePath={filePath}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileSearch className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              Not present for this project
            </p>
            <p className="text-xs mt-1 text-center max-w-xs">
              {PROCESS_DOCS.find((m) => m.doc_type === selectedType)?.label ?? selectedType} has
              not been created yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
