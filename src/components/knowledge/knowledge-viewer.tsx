// Track Your Shit - Knowledge Viewer Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { Project, watchProjectFiles, unwatchProjectFiles } from '@/lib/tauri';
import { useKnowledgeFiles, useKnowledgeFileContent, useDeleteProjectFile } from '@/lib/queries';
import { queryKeys } from '@/lib/query-keys';
import { KnowledgeFileTreeNav } from './knowledge-file-tree';
import { KnowledgeSearch } from './knowledge-search';
import { KnowledgeToc } from './knowledge-toc';
import { KnowledgeBookmarks } from './knowledge-bookmarks';
import { KnowledgeGraph } from './knowledge-graph';
import { MarkdownRenderer } from './markdown-renderer';
import { FileQuestion, GitBranch, Loader2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { slugify } from './knowledge-toc';

interface KnowledgeViewerProps {
  project: Project;
}

export function KnowledgeViewer({ project }: KnowledgeViewerProps) {
  const [activeFile, setActiveFile] = useState<string>('');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [viewMode, setViewMode] = useState<'content' | 'graph'>('content');
  const [isWatching, setIsWatching] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // KN-05: File watching for auto-refresh
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const startWatching = async () => {
      try {
        await watchProjectFiles(project.path);
        setIsWatching(true);

        const unlistenFn = await listen('knowledge:file-changed', () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeFiles(project.path) });
          if (activeFile) {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.knowledgeFile(project.id, activeFile),
            });
          }
        });
        unlisten = unlistenFn;
      } catch {
        setIsWatching(false);
      }
    };

    void startWatching();

    return () => {
      if (unlisten) unlisten();
      void unwatchProjectFiles(project.path).catch(() => {});
      setIsWatching(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.path, project.id]);

  const handleFileCreated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeFiles(project.path) });
  }, [queryClient, project.path]);

  const { data: fileTree, isLoading: treeLoading } = useKnowledgeFiles(project.path);
  const deleteProjectFile = useDeleteProjectFile();

  // Auto-select first file when tree loads
  if (fileTree && !activeFile && fileTree.folders.length > 0) {
    const firstFolder = fileTree.folders[0];
    if (firstFolder.files.length > 0) {
      setActiveFile(firstFolder.files[0].relative_path);
    }
  }

  const {
    data: content,
    isLoading: contentLoading,
    error,
  } = useKnowledgeFileContent(project.id, project.path, activeFile);

  const handleNavigate = (filePath: string) => {
    setActiveFile(filePath);
  };

  const handleRequestDelete = (file: { relative_path: string; display_name: string }) => {
    setDeleteTarget({ path: file.relative_path, name: file.display_name });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    deleteProjectFile.mutate(
      {
        projectId: project.id,
        projectPath: project.path,
        filePath: deleteTarget.path,
      },
      {
        onSuccess: () => {
          if (activeFile === deleteTarget.path) {
            setActiveFile('');
          }
        },
        onSettled: () => {
          setDeleteTarget(null);
        },
      }
    );
  };

  const handleBookmarkNavigate = useCallback(
    (filePath: string, heading: string) => {
      setActiveFile(filePath);
      // Scroll to heading after a short delay to allow content to load
      setTimeout(() => {
        const container = contentRef.current;
        if (!container) return;
        const slug = slugify(heading);
        const el = container.querySelector(`#${CSS.escape(slug)}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    },
    [],
  );

  if (treeLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!fileTree || fileTree.total_files === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
        <div className="p-4 rounded-full bg-gradient-to-br from-brand-blue/10 to-brand-purple/10 mb-4">
          <FileQuestion className="h-12 w-12 text-brand-blue" />
        </div>
        <h3 className="text-lg font-medium mb-2">No Knowledge Files Found</h3>
        <p className="text-sm text-center max-w-md">
          This project doesn&apos;t have any knowledge files yet. Create a KNOWLEDGE.md file in your
          project&apos;s root or .planning directory.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Toolbar: Search + Graph toggle + Bookmark toggle + Live indicator */}
      <div className="flex-shrink-0 mb-4 flex items-center gap-2">
        <div className="flex-1">
          <KnowledgeSearch projectPath={project.path} onNavigate={handleNavigate} />
        </div>
        {isWatching && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-status-success" />
            </span>
            Live
          </div>
        )}
        <Button
          variant={viewMode === 'graph' ? 'secondary' : 'outline'}
          size="sm"
          className="gap-1 flex-shrink-0"
          onClick={() => setViewMode(viewMode === 'graph' ? 'content' : 'graph')}
        >
          <GitBranch className="h-4 w-4" />
          Graph
        </Button>
        <Button
          variant={showBookmarks ? 'secondary' : 'outline'}
          size="sm"
          className="gap-1 flex-shrink-0"
          onClick={() => setShowBookmarks(!showBookmarks)}
        >
          <Bookmark className="h-4 w-4" />
          Bookmarks
        </Button>
      </div>

      {/* Graph View */}
      {viewMode === 'graph' ? (
        <div className="flex-1 min-h-0 border rounded-lg bg-card overflow-hidden">
          <KnowledgeGraph
            projectPath={project.path}
            onSelectFile={(filePath) => {
              setActiveFile(filePath);
              setViewMode('content');
            }}
          />
        </div>
      ) : (
        /* Three-panel layout */
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left: File tree */}
          <div className="w-56 flex-shrink-0 border rounded-lg bg-card overflow-y-auto">
              <KnowledgeFileTreeNav
                tree={fileTree}
                activeFile={activeFile}
                onFileSelect={setActiveFile}
                onFileDelete={handleRequestDelete}
                projectPath={project.path}
                hasPlanning={project.tech_stack?.has_planning}
                onFileCreated={handleFileCreated}
              />
            </div>

          {/* Center: Content */}
          <div
            ref={contentRef}
            className="flex-1 p-6 bg-card rounded-lg border overflow-y-auto min-w-0"
          >
            {contentLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-16 text-destructive">
                Failed to load file: {String(error)}
              </div>
            ) : content ? (
              <MarkdownRenderer content={content} projectId={project.id} filePath={activeFile} />
            ) : null}
          </div>

          {/* Right: Table of Contents (conditional) */}
          {content && (
            <div className="w-48 flex-shrink-0 overflow-y-auto">
              <KnowledgeToc
                content={content}
                scrollContainerRef={contentRef}
                projectId={project.id}
                filePath={activeFile}
              />
            </div>
          )}

          {/* Bookmarks panel (conditional) */}
          {showBookmarks && (
            <KnowledgeBookmarks
              projectId={project.id}
              onNavigate={handleBookmarkNavigate}
            />
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete knowledge file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove
              <span className="font-semibold"> {deleteTarget?.name}</span> from the project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProjectFile.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteProjectFile.isPending}
            >
              {deleteProjectFile.isPending ? 'Deleting...' : 'Delete File'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
