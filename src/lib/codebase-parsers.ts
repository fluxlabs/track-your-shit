// Track Your Shit - Codebase Document Parsers
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

export interface ConcernCategory {
  name: string;
  count: number;
}

export interface ConcernsSummary {
  categories: ConcernCategory[];
  totalCount: number;
}

/** Parse CONCERNS.md into category counts by ## headings, counting **Bold:** items */
export function parseConcerns(content: string): ConcernsSummary {
  const categories: ConcernCategory[] = [];
  let currentCategory = '';
  let currentCount = 0;

  for (const line of content.split('\n')) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      if (currentCategory) {
        categories.push({ name: currentCategory, count: currentCount });
      }
      currentCategory = heading[1].trim();
      currentCount = 0;
    } else if (currentCategory && /^\s*[-*]\s+\*\*.+?\*\*/.test(line)) {
      currentCount++;
    }
  }

  if (currentCategory) {
    categories.push({ name: currentCategory, count: currentCount });
  }

  const totalCount = categories.reduce((sum, c) => sum + c.count, 0);
  return { categories, totalCount };
}

/** Extract top-level tech items from STACK.md (## headings as categories) */
export function parseStackSummary(content: string): string[] {
  const items: string[] = [];
  for (const line of content.split('\n')) {
    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      items.push(heading[1].trim());
    }
  }
  return items;
}
