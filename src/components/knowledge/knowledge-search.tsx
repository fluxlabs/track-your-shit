// Track Your Shit - Knowledge Full-Text Search (KN-01)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo } from 'react';
import { Search, FileText, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKnowledgeSearch } from '@/lib/queries';
import type { KnowledgeSearchMatch } from '@/lib/tauri';

interface KnowledgeSearchProps {
  projectPath: string;
  onNavigate: (filePath: string) => void;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function KnowledgeSearch({ projectPath, onNavigate }: KnowledgeSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Debounce search
  useMemo(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const { data: results, isLoading } = useKnowledgeSearch(projectPath, debouncedQuery);

  // Group results by file
  const groupedResults = useMemo(() => {
    if (!results) return new Map<string, KnowledgeSearchMatch[]>();
    const grouped = new Map<string, KnowledgeSearchMatch[]>();
    for (const match of results) {
      const existing = grouped.get(match.file_path) || [];
      existing.push(match);
      grouped.set(match.file_path, existing);
    }
    return grouped;
  }, [results]);

  const handleResultClick = (filePath: string) => {
    onNavigate(filePath);
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search knowledge files..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => {
            if (searchQuery.length >= 2) setShowResults(true);
          }}
          className="pl-10 pr-8"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => {
              setSearchQuery('');
              setDebouncedQuery('');
              setShowResults(false);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {showResults && debouncedQuery.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-auto bg-background border rounded-lg shadow-lg">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Searching...</div>
          ) : groupedResults.size === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No results found</div>
          ) : (
            <div className="py-1">
              {Array.from(groupedResults.entries()).map(([filePath, matches]) => (
                <div key={filePath}>
                  <button
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors"
                    onClick={() => handleResultClick(filePath)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-medium truncate">
                        {matches[0].display_name}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1 ml-auto">
                        {matches.length} match{matches.length !== 1 ? 'es' : ''}
                      </Badge>
                    </div>
                    {matches.slice(0, 3).map((match, i) => (
                      <div key={i} className="text-xs text-muted-foreground ml-5 mt-0.5 truncate">
                        <span className="text-[10px] text-muted-foreground/60 mr-1">
                          L{match.line_number}
                        </span>
                        <HighlightMatch text={match.line_content.trim()} query={debouncedQuery} />
                      </div>
                    ))}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
