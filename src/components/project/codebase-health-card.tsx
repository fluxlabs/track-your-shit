// Track Your Shit - Codebase Health Card for Overview
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCodebaseDoc } from '@/lib/queries';
import { parseConcerns, parseStackSummary } from '@/lib/codebase-parsers';
import { Layers, AlertTriangle, ArrowRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface CodebaseHealthCardProps {
  projectPath: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  'critical': 'bg-red-500/15 text-red-600 dark:text-red-400',
  'high': 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  'medium': 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  'low': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
};

function getConcernColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(SEVERITY_COLORS)) {
    if (lower.includes(key)) return value;
  }
  return 'bg-muted text-muted-foreground';
}

export function CodebaseHealthCard({ projectPath }: CodebaseHealthCardProps) {
  const [, setSearchParams] = useSearchParams();
  const { data: concernsContent } = useCodebaseDoc(projectPath, 'CONCERNS.md');
  const { data: stackContent } = useCodebaseDoc(projectPath, 'STACK.md');

  if (!concernsContent && !stackContent) return null;

  const concerns = concernsContent ? parseConcerns(concernsContent) : null;
  const stackItems = stackContent ? parseStackSummary(stackContent) : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Layers className="h-4 w-4" />
          Codebase Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {stackItems.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Stack</p>
            <p className="text-xs line-clamp-2">{stackItems.join(' / ')}</p>
          </div>
        )}

        {concerns && concerns.totalCount > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {concerns.totalCount} concern{concerns.totalCount !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-1">
              {concerns.categories
                .filter((c) => c.count > 0)
                .map((c) => (
                  <span
                    key={c.name}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getConcernColor(c.name)}`}
                  >
                    {c.name}
                    <span className="opacity-70">{c.count}</span>
                  </span>
                ))}
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2 -ml-2"
          onClick={() => setSearchParams({ tab: 'codebase' })}
        >
          View Codebase
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
