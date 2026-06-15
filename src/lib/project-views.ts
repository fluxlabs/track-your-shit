// VCCA - Project View Definitions
// Canonical list of all project views for sidebar navigation
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import {
  LayoutDashboard,
  FolderTree,
  Package,
  ClipboardList,
  SquareTerminal,
  Key,
  Play,
  GitBranch,
  BarChart3,
  Flag,
  CheckSquare,
  Stethoscope,
  FileText,
  Lightbulb,
  FlaskConical,
  ClipboardCheck,
  ShieldCheck,
  Bug,
  Layers,
  BookOpen,
  Settings2,
  History,
  TrendingUp,
  Terminal,
  type LucideIcon,
} from 'lucide-react';

export interface ProjectView {
  id: string;
  label: string;
  icon: LucideIcon;
  section: string;
  /** Show only for gsd2 projects */
  gsd2Only?: boolean;
  /** Show only for gsd1 projects */
  gsd1Only?: boolean;
  /** Show only when project has any GSD planning */
  gsdOnly?: boolean;
  /** Hide this view in guided mode */
  expertOnly?: boolean;
}

/**
 * All possible project views.
 * Sections are used to group them visually in the sidebar.
 */
export const projectViews: ProjectView[] = [
  // --- Core ---
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, section: 'Core' },
  { id: 'files', label: 'Files', icon: FolderTree, section: 'Core' },
  { id: 'dependencies', label: 'Dependencies', icon: Package, section: 'Core' },
  { id: 'knowledge', label: 'Knowledge', icon: ClipboardList, section: 'Core' },
  { id: 'shell', label: 'Terminal', icon: SquareTerminal, section: 'Core' },
  { id: 'envvars', label: 'Env Vars', icon: Key, section: 'Core' },
  { id: 'git', label: 'Git', icon: GitBranch, section: 'Core' },

  // --- GSD-2 ---
  { id: 'gsd2-group-progress', label: 'Progress', icon: BarChart3, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-group-planning', label: 'Planning', icon: Layers, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-group-metrics', label: 'Analytics', icon: TrendingUp, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-group-commands', label: 'Operations', icon: Terminal, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-group-diagnostics', label: 'Diagnostics', icon: Stethoscope, section: 'Diagnostics', gsd2Only: true },
  { id: 'gsd2-headless', label: 'Runner', icon: Play, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-worktrees', label: 'Worktrees', icon: GitBranch, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-sessions', label: 'History', icon: History, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-knowledge-captures', label: 'Knowledge Captures', icon: BookOpen, section: 'GSD', gsd2Only: true },
  { id: 'gsd2-preferences', label: 'Preferences', icon: Settings2, section: 'GSD', gsd2Only: true },

  // --- GSD-1 ---
  { id: 'gsd-plans', label: 'Plans', icon: FileText, section: 'GSD', gsd1Only: true },
  { id: 'gsd-context', label: 'Context', icon: Lightbulb, section: 'GSD', gsd1Only: true },
  { id: 'gsd-todos', label: 'Todos', icon: CheckSquare, section: 'GSD', gsd1Only: true },
  { id: 'gsd-validation', label: 'Validation', icon: FlaskConical, section: 'GSD', gsd1Only: true },
  { id: 'gsd-uat', label: 'UAT', icon: ClipboardCheck, section: 'GSD', gsd1Only: true },
  { id: 'gsd-verification', label: 'Verification', icon: ShieldCheck, section: 'GSD', gsd1Only: true },
  { id: 'gsd-milestones', label: 'Milestones', icon: Flag, section: 'GSD', gsd1Only: true },
  { id: 'gsd-debug', label: 'Debug', icon: Bug, section: 'GSD', gsd1Only: true },
  { id: 'gsd-phase-docs', label: 'Phase Docs', icon: FileText, section: 'GSD', gsd1Only: true },
  { id: 'gsd-codebase', label: 'Codebase Map', icon: Layers, section: 'GSD', gsd1Only: true },
  { id: 'gsd-process-docs', label: 'Project Docs', icon: BookOpen, section: 'GSD', gsd1Only: true },
];

export interface ProjectViewContext {
  isGsd2: boolean;
  isGsd1: boolean;
  userMode: string;
}

/** Filter views based on project GSD version and current user mode */
export function getVisibleViews(ctx: ProjectViewContext): ProjectView[] {
  return projectViews.filter((v) => {
    if (v.gsd2Only && !ctx.isGsd2) return false;
    if (v.gsd1Only && !ctx.isGsd1) return false;
    if (v.gsdOnly && !ctx.isGsd2 && !ctx.isGsd1) return false;
    if (v.expertOnly && ctx.userMode !== 'expert') return false;
    return true;
  });
}

/** Group visible views by section, preserving order */
export function getViewSections(ctx: ProjectViewContext): { section: string; views: ProjectView[] }[] {
  const visible = getVisibleViews(ctx);
  const sections: { section: string; views: ProjectView[] }[] = [];
  const seen = new Set<string>();

  for (const view of visible) {
    if (!seen.has(view.section)) {
      seen.add(view.section);
      sections.push({ section: view.section, views: [] });
    }
    sections.find((s) => s.section === view.section)!.views.push(view);
  }

  return sections;
}

/** Map old ?tab= values to new view IDs for backwards compat */
const TAB_TO_VIEW: Record<string, string> = {
  overview: 'overview',
  project: 'files',
  knowledge: 'knowledge',
  shell: 'shell',
  envvars: 'envvars',
  gsd: 'gsd2-dashboard', // default GSD landing — caller should pick gsd1 vs gsd2
};

export function resolveViewFromTab(tab: string | null, ctx: ProjectViewContext): string {
  if (!tab) return 'overview';

  // Direct view ID match
  const directView = projectViews.find((view) => view.id === tab);
  if (directView) {
    if (directView.expertOnly && ctx.userMode !== 'expert') return DEFAULT_VIEW;
    return tab;
  }

  // Legacy ?tab= mapping
  if (tab === 'gsd') {
    return ctx.isGsd2 ? 'gsd2-dashboard' : ctx.isGsd1 ? 'gsd-plans' : 'overview';
  }

  const resolved = TAB_TO_VIEW[tab] ?? 'overview';
  const resolvedView = projectViews.find((view) => view.id === resolved);
  if (resolvedView?.expertOnly && ctx.userMode !== 'expert') return DEFAULT_VIEW;

  return resolved;
}

export const DEFAULT_VIEW = 'overview';
