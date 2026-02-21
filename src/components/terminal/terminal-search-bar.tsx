// Track Your Shit - Terminal Search Bar Component
// Overlay search bar for xterm.js terminals using SearchAddon
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, CaseSensitive, Regex } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SearchAddon } from '@xterm/addon-search';

interface TerminalSearchBarProps {
  searchAddon: SearchAddon | null;
  visible: boolean;
  onClose: () => void;
  className?: string;
}

export function TerminalSearchBar({
  searchAddon,
  visible,
  onClose,
  className,
}: TerminalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when bar becomes visible
  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [visible]);

  const doSearch = useCallback(
    (direction: 'next' | 'prev') => {
      if (!searchAddon || !query) return;
      const opts = { caseSensitive, regex: useRegex };
      if (direction === 'next') {
        searchAddon.findNext(query, opts);
      } else {
        searchAddon.findPrevious(query, opts);
      }
    },
    [searchAddon, query, caseSensitive, useRegex],
  );

  // Search on query/options change
  useEffect(() => {
    if (!searchAddon || !query) {
      searchAddon?.clearDecorations();
      return;
    }
    searchAddon.findNext(query, { caseSensitive, regex: useRegex });
  }, [searchAddon, query, caseSensitive, useRegex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        searchAddon?.clearDecorations();
        onClose();
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          doSearch('prev');
        } else {
          doSearch('next');
        }
      }
    },
    [searchAddon, onClose, doSearch],
  );

  if (!visible) return null;

  return (
    <div
      className={cn(
        'absolute top-2 right-2 z-50 flex items-center gap-1 bg-background border rounded-md shadow-lg px-2 py-1',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        className="bg-transparent border-none outline-none text-sm w-40 px-1"
      />
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-6 w-6 p-0', caseSensitive && 'bg-muted')}
        onClick={() => setCaseSensitive(!caseSensitive)}
        title="Case Sensitive"
      >
        <CaseSensitive className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-6 w-6 p-0', useRegex && 'bg-muted')}
        onClick={() => setUseRegex(!useRegex)}
        title="Regex"
      >
        <Regex className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => doSearch('prev')}
        title="Previous (Shift+Enter)"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => doSearch('next')}
        title="Next (Enter)"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={() => {
          searchAddon?.clearDecorations();
          onClose();
        }}
        title="Close (Esc)"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
