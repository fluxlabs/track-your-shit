// Track Your Shit - Knowledge File Tree Navigation (KN-02)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import { Folder, FolderOpen, FileText, FilePlus2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { writeProjectFile } from '@/lib/tauri';
import { getErrorMessage } from '@/lib/utils';
import type { KnowledgeFileEntry, KnowledgeFileTree, KnowledgeFolder } from '@/lib/tauri';
import { getExpectedFiles, getTemplateContent, type ExpectedFile } from './knowledge-gaps';

interface KnowledgeFileTreeProps {
  tree: KnowledgeFileTree;
  activeFile: string;
  onFileSelect: (relativePath: string) => void;
  onFileDelete?: (file: KnowledgeFileEntry) => void;
  projectPath?: string;
  hasPlanning?: boolean;
  onFileCreated?: () => void;
}

function FolderSection({
  folder,
  activeFile,
  onFileSelect,
  onFileDelete,
}: {
  folder: KnowledgeFolder;
  activeFile: string;
  onFileSelect: (relativePath: string) => void;
  onFileDelete?: (file: KnowledgeFileEntry) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium hover:bg-muted/50 rounded-md transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
        )}
        <span className="truncate">{folder.display_name}</span>
        <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
          {folder.files.length}
        </Badge>
      </button>
      {expanded && (
        <div className="ml-3 border-l border-border pl-2 space-y-0.5 mt-0.5">
          {folder.files.map((file) => (
            <div
              key={file.relative_path}
              className="group flex items-center gap-1"
              title={file.relative_path}
            >
              <button
                className={cn(
                  'flex items-center gap-2 w-full px-2 py-1 text-sm rounded-md transition-colors truncate',
                  activeFile === file.relative_path
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
                onClick={() => onFileSelect(file.relative_path)}
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate flex-1 text-left">{file.display_name}</span>
              </button>
              {onFileDelete && (
                <button
                  type="button"
                  className={cn(
                    'p-1 rounded transition-opacity',
                    'opacity-0 group-hover:opacity-70 text-muted-foreground hover:text-destructive'
                  )}
                  onClick={() => onFileDelete(file)}
                  title="Delete file"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GhostFileEntry({
  file,
  projectPath,
  onCreated,
}: {
  file: ExpectedFile;
  projectPath: string;
  onCreated?: () => void;
}) {
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const content = getTemplateContent(file.path);
      await writeProjectFile(projectPath, file.path, content);
      toast.success(`Created ${file.displayName}`);
      onCreated?.();
    } catch (err) {
      toast.error(`Failed to create file: ${getErrorMessage(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="flex items-center gap-2 w-full px-2 py-1 text-sm rounded-md border border-dashed border-muted-foreground/30 opacity-50 group/ghost"
      title={file.description}
    >
      <FilePlus2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="truncate italic text-muted-foreground flex-1">{file.displayName}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1.5 text-[10px] opacity-0 group-hover/ghost:opacity-100 transition-opacity"
        onClick={() => void handleCreate()}
        disabled={creating}
      >
        Create
      </Button>
    </div>
  );
}

export function KnowledgeFileTreeNav({
  tree,
  activeFile,
  onFileSelect,
  onFileDelete,
  projectPath,
  hasPlanning = false,
  onFileCreated,
}: KnowledgeFileTreeProps) {
  // Compute missing expected files
  const expectedFiles = getExpectedFiles(hasPlanning);
  const existingPaths = new Set<string>();
  for (const folder of tree.folders) {
    for (const file of folder.files) {
      existingPaths.add(file.relative_path);
    }
  }
  const missingFiles = expectedFiles.filter((ef) => !existingPaths.has(ef.path));

  if (tree.folders.length === 0 && missingFiles.length === 0) {
    return (
      <div className="px-2 py-4 text-sm text-muted-foreground text-center">No files found</div>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {tree.folders.map((folder) => (
        <FolderSection
          key={folder.name}
          folder={folder}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
          onFileDelete={onFileDelete}
        />
      ))}

      {/* Ghost entries for missing expected files */}
      {missingFiles.length > 0 && projectPath && (
        <div className="mt-3 pt-2 border-t border-dashed border-muted-foreground/20 space-y-1 px-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2">
            Missing Files
          </p>
          {missingFiles.map((file) => (
            <GhostFileEntry
              key={file.path}
              file={file}
              projectPath={projectPath}
              onCreated={onFileCreated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
