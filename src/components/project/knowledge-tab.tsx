// Track Your Shit - Knowledge Tab Component
// Knowledge viewer with Research sub-tab for .planning/research/ files
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { useProject, useKnowledgeFiles, useKnowledgeFileContent } from '@/lib/queries';
import { KnowledgeViewer } from '@/components/knowledge';
import { MarkdownRenderer } from '@/components/knowledge/markdown-renderer';
import { BookOpen, FlaskConical, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KnowledgeTabProps {
  projectId: string;
}

type SubTab = 'knowledge' | 'research';

export function KnowledgeTab({ projectId }: KnowledgeTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('knowledge');
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Could not load project knowledge</p>
      </div>
    );
  }

  const hasPlanning = project.tech_stack?.has_planning ?? false;

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      {/* Sub-tab bar — only shown for GSD projects with .planning/ */}
      {hasPlanning && (
        <div className="flex items-center gap-1 border-b pb-2">
          <SubTabButton
            active={activeSubTab === 'knowledge'}
            onClick={() => setActiveSubTab('knowledge')}
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Knowledge"
          />
          <SubTabButton
            active={activeSubTab === 'research'}
            onClick={() => setActiveSubTab('research')}
            icon={<FlaskConical className="h-3.5 w-3.5" />}
            label="Research"
          />
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeSubTab === 'knowledge' || !hasPlanning ? (
          <KnowledgeViewer project={project} />
        ) : (
          <ResearchBrowser projectId={project.id} projectPath={project.path} />
        )}
      </div>
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ResearchBrowser({
  projectId,
  projectPath,
}: {
  projectId: string;
  projectPath: string;
}) {
  const [selectedFile, setSelectedFile] = useState<string>('');

  // List all files under .planning/research
  const researchPath = `${projectPath}/.planning/research`;
  const { data: fileTree, isLoading: treeLoading } = useKnowledgeFiles(researchPath);

  // Flatten all files from the tree for the sidebar
  const allFiles = (fileTree?.folders ?? []).flatMap((folder) => folder.files);

  // Auto-select first file when tree loads
  if (allFiles.length > 0 && !selectedFile) {
    setSelectedFile(allFiles[0].relative_path);
  }

  const { data: content, isLoading: contentLoading } = useKnowledgeFileContent(
    projectId,
    researchPath,
    selectedFile,
  );

  if (treeLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FlaskConical className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">No research files found</p>
        <p className="text-xs mt-1 text-center max-w-xs">
          Research docs live in <code className="font-mono text-[11px]">.planning/research/</code>.
          Run /gsd:research to populate this folder.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left sidebar: file list */}
      <div className="w-56 flex-shrink-0 border rounded-lg bg-card overflow-y-auto">
        <div className="p-2 space-y-0.5">
          {allFiles.map((file) => (
            <button
              key={file.relative_path}
              type="button"
              onClick={() => setSelectedFile(file.relative_path)}
              className={cn(
                'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                selectedFile === file.relative_path
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate" title={file.display_name}>
                {file.display_name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: file content */}
      <div className="flex-1 min-w-0 border rounded-lg bg-card overflow-y-auto p-6">
        {contentLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : content ? (
          <MarkdownRenderer
            content={content}
            projectId={projectId}
            filePath={selectedFile}
          />
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Select a file to view its contents
          </div>
        )}
      </div>
    </div>
  );
}
