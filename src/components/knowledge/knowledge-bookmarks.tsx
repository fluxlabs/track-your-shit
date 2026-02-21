// Track Your Shit - Knowledge Bookmarks Panel (G2-3 KN-06)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Bookmark, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import { useKnowledgeBookmarks, useDeleteKnowledgeBookmark } from '@/lib/queries';
import type { KnowledgeBookmark } from '@/lib/tauri';

interface KnowledgeBookmarksProps {
  projectId: string;
  onNavigate: (filePath: string, heading: string) => void;
}

function BookmarkEntry({
  bookmark,
  onNavigate,
  onDelete,
}: {
  bookmark: KnowledgeBookmark;
  onNavigate: (filePath: string, heading: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      className="group flex items-start gap-2 px-3 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
      onClick={() => onNavigate(bookmark.file_path, bookmark.heading)}
    >
      <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {'#'.repeat(bookmark.heading_level)} {bookmark.heading}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {bookmark.file_path}
        </p>
        {bookmark.note && (
          <p className="text-xs text-muted-foreground italic mt-0.5 truncate">
            {bookmark.note}
          </p>
        )}
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeTime(bookmark.created_at)}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(bookmark.id);
        }}
      >
        <Trash2 className="h-3 w-3 text-muted-foreground" />
      </Button>
    </div>
  );
}

export function KnowledgeBookmarks({ projectId, onNavigate }: KnowledgeBookmarksProps) {
  const { data: bookmarks, isLoading } = useKnowledgeBookmarks(projectId);
  const deleteBookmark = useDeleteKnowledgeBookmark();

  return (
    <div className={cn('w-56 flex-shrink-0 border rounded-lg bg-card flex flex-col')}>
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <Bookmark className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Bookmarks</span>
        {bookmarks && (
          <span className="text-xs text-muted-foreground">({bookmarks.length})</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
        ) : !bookmarks || bookmarks.length === 0 ? (
          <div className="p-4 text-center">
            <Bookmark className="h-6 w-6 text-muted-foreground/50 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">No bookmarks</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Click the bookmark icon next to headings to save them
            </p>
          </div>
        ) : (
          bookmarks.map((bm) => (
            <BookmarkEntry
              key={bm.id}
              bookmark={bm}
              onNavigate={onNavigate}
              onDelete={(id) => deleteBookmark.mutate(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
