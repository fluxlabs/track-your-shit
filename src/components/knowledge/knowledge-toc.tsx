// Track Your Shit - Knowledge Table of Contents Sidebar (KN-07)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKnowledgeBookmarks, useCreateKnowledgeBookmark, useDeleteKnowledgeBookmark } from '@/lib/queries';
import type { KnowledgeBookmark } from '@/lib/tauri';

interface TocHeading {
  level: number;
  text: string;
  slug: string;
}

interface KnowledgeTocProps {
  content: string;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  projectId?: string;
  filePath?: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function parseHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const regex = /^(#{1,4})\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      slug: slugify(match[2].trim()),
    });
  }
  return headings;
}

export function KnowledgeToc({ content, scrollContainerRef, projectId, filePath }: KnowledgeTocProps) {
  const [activeSlug, setActiveSlug] = useState<string>('');

  const headings = useMemo(() => parseHeadings(content), [content]);

  const { data: bookmarks } = useKnowledgeBookmarks(projectId || '');
  const createBookmark = useCreateKnowledgeBookmark();
  const deleteBookmark = useDeleteKnowledgeBookmark();

  // Build a set of bookmarked heading texts for quick lookup
  const bookmarkMap = useMemo(() => {
    const map = new Map<string, KnowledgeBookmark>();
    if (bookmarks && filePath) {
      for (const bm of bookmarks) {
        if (bm.file_path === filePath) {
          map.set(bm.heading, bm);
        }
      }
    }
    return map;
  }, [bookmarks, filePath]);

  const toggleBookmark = useCallback(
    (heading: TocHeading) => {
      if (!projectId || !filePath) return;
      const existing = bookmarkMap.get(heading.text);
      if (existing) {
        deleteBookmark.mutate(existing.id);
      } else {
        createBookmark.mutate({
          projectId,
          filePath,
          heading: heading.text,
          headingLevel: heading.level,
        });
      }
    },
    [projectId, filePath, bookmarkMap, createBookmark, deleteBookmark],
  );

  // IntersectionObserver to track visible headings
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
          }
        }
      },
      {
        root: container,
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0,
      },
    );

    // Observe all heading elements
    for (const heading of headings) {
      const el = container.querySelector(`#${CSS.escape(heading.slug)}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings, scrollContainerRef]);

  if (headings.length < 5) return null;

  const handleClick = (slug: string) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`#${CSS.escape(slug)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const canBookmark = !!projectId && !!filePath;

  return (
    <nav className="space-y-0.5 text-xs">
      <h4 className="font-medium text-sm mb-2 text-muted-foreground">On This Page</h4>
      {headings.map((heading, i) => {
        const isBookmarked = bookmarkMap.has(heading.text);
        return (
          <div
            key={`${heading.slug}-${i}`}
            className={cn(
              'group flex items-center gap-1',
              heading.level === 1 && 'pl-0',
              heading.level === 2 && 'pl-2',
              heading.level === 3 && 'pl-4',
              heading.level === 4 && 'pl-6',
            )}
          >
            <button
              className={cn(
                'flex-1 text-left py-0.5 transition-colors truncate hover:text-foreground',
                activeSlug === heading.slug
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground',
              )}
              onClick={() => handleClick(heading.slug)}
              title={heading.text}
            >
              {heading.text}
            </button>
            {canBookmark && (
              <button
                className={cn(
                  'flex-shrink-0 p-0.5 rounded transition-opacity',
                  isBookmarked
                    ? 'text-primary opacity-100'
                    : 'text-muted-foreground opacity-0 group-hover:opacity-100',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(heading);
                }}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this heading'}
              >
                <Bookmark
                  className="h-3 w-3"
                  fill={isBookmarked ? 'currentColor' : 'none'}
                />
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}
