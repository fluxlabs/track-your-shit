// Track Your Shit - Project Vision Card (PROJECT.md)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { readProjectFile } from '@/lib/tauri';
import { Eye } from 'lucide-react';

interface VisionCardProps {
  projectPath: string;
}

/** Parse PROJECT.md markdown sections into a simple key/value structure */
function parseProjectConfig(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentKey = '';

  for (const line of content.split('\n')) {
    const heading = line.match(/^#+\s+(.+)/);
    if (heading) {
      currentKey = heading[1].trim().toLowerCase();
      sections[currentKey] = '';
    } else if (currentKey) {
      sections[currentKey] += line + '\n';
    }
  }

  // Trim all values
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim();
  }

  return sections;
}

export function VisionCard({ projectPath }: VisionCardProps) {
  const { data: content, isLoading } = useQuery({
    queryKey: ['vision-card', projectPath],
    queryFn: () => readProjectFile(projectPath, '.planning/PROJECT.md'),
    enabled: !!projectPath,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading || !content) {
    return null;
  }

  const sections = parseProjectConfig(content);
  const hasContent = Object.keys(sections).length > 0;

  if (!hasContent) return null;

  // Extract common section names (case-insensitive matching)
  const findSection = (...keys: string[]) => {
    for (const k of keys) {
      for (const sectionKey of Object.keys(sections)) {
        if (sectionKey.includes(k)) return sections[sectionKey];
      }
    }
    return null;
  };

  const problem = findSection('problem', 'challenge', 'pain');
  const users = findSection('user', 'audience', 'target');
  const mvp = findSection('mvp', 'feature', 'scope');
  const platform = findSection('platform', 'tech', 'stack', 'decision');
  const constraints = findSection('constraint', 'budget', 'timeline', 'limit');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4" />
          Project Vision
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {problem && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Problem</p>
            <p className="text-xs line-clamp-3">{problem}</p>
          </div>
        )}
        {users && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Target Users</p>
            <p className="text-xs line-clamp-2">{users}</p>
          </div>
        )}
        {mvp && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">MVP Features</p>
            <p className="text-xs line-clamp-3">{mvp}</p>
          </div>
        )}
        {platform && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Technical Decisions</p>
            <p className="text-xs line-clamp-2">{platform}</p>
          </div>
        )}
        {constraints && (
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Constraints</p>
            <p className="text-xs line-clamp-2">{constraints}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
