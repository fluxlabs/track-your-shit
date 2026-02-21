// Track Your Shit - Knowledge Gaps Detection (KN-09)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

export interface ExpectedFile {
  path: string;
  displayName: string;
  description: string;
  folder: string;
}

const PLANNING_FILES: ExpectedFile[] = [
  {
    path: '.planning/ROADMAP.md',
    displayName: 'Roadmap',
    description: 'Project milestones and timeline',
    folder: '.planning',
  },
  {
    path: '.planning/KNOWLEDGE.md',
    displayName: 'Knowledge Base',
    description: 'Accumulated project knowledge and context',
    folder: '.planning',
  },
  {
    path: '.planning/PROJECT.md',
    displayName: 'Project Info',
    description: 'Project overview and configuration',
    folder: '.planning',
  },
];

/**
 * Returns the list of expected knowledge files based on project type.
 */
export function getExpectedFiles(
  hasPlanning: boolean,
): ExpectedFile[] {
  const files: ExpectedFile[] = [];
  if (hasPlanning) {
    files.push(...PLANNING_FILES);
  }
  return files;
}

/**
 * Default template content for each expected file.
 */
export function getTemplateContent(path: string): string {
  const templates: Record<string, string> = {
    '.planning/ROADMAP.md': `# Roadmap\n\n<!-- Project milestones and timeline -->\n`,
    '.planning/KNOWLEDGE.md': `# Knowledge Base\n\n<!-- Accumulated project knowledge -->\n`,
    '.planning/PROJECT.md': `# Project\n\n<!-- Project overview and configuration -->\n`,
  };
  return templates[path] ?? `# ${path}\n\n<!-- Add content here -->\n`;
}
