// Track Your Shit - Design Token System
// Centralized spacing, sizing, animation, and status utilities
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

/**
 * Status type definition
 */
export type Status =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "failed"
  | "skipped"
  | "archived"
  | "running"
  | "paused"
  | "cancelled";

/**
 * Status color classes using CSS variables
 */
export const statusColors: Record<Status, {
  bg: string;
  text: string;
  border: string;
  dot: string;
  combined: string;
}> = {
  pending: {
    bg: "bg-status-pending/10",
    text: "text-status-pending",
    border: "border-status-pending/30",
    dot: "bg-status-pending",
    combined: "bg-status-pending/10 text-status-pending border-status-pending/30",
  },
  in_progress: {
    bg: "bg-status-info/10",
    text: "text-status-info",
    border: "border-status-info/30",
    dot: "bg-status-info animate-pulse",
    combined: "bg-status-info/10 text-status-info border-status-info/30",
  },
  running: {
    bg: "bg-status-info/10",
    text: "text-status-info",
    border: "border-status-info/30",
    dot: "bg-status-info animate-pulse",
    combined: "bg-status-info/10 text-status-info border-status-info/30",
  },
  completed: {
    bg: "bg-status-success/10",
    text: "text-status-success",
    border: "border-status-success/30",
    dot: "bg-status-success",
    combined: "bg-status-success/10 text-status-success border-status-success/30",
  },
  blocked: {
    bg: "bg-status-blocked/10",
    text: "text-status-blocked",
    border: "border-status-blocked/30",
    dot: "bg-status-blocked",
    combined: "bg-status-blocked/10 text-status-blocked border-status-blocked/30",
  },
  paused: {
    bg: "bg-status-paused/10",
    text: "text-status-paused",
    border: "border-status-paused/30",
    dot: "bg-status-paused",
    combined: "bg-status-paused/10 text-status-paused border-status-paused/30",
  },
  failed: {
    bg: "bg-status-error/10",
    text: "text-status-error",
    border: "border-status-error/30",
    dot: "bg-status-error",
    combined: "bg-status-error/10 text-status-error border-status-error/30",
  },
  cancelled: {
    bg: "bg-status-error/10",
    text: "text-status-error",
    border: "border-status-error/30",
    dot: "bg-status-error",
    combined: "bg-status-error/10 text-status-error border-status-error/30",
  },
  skipped: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-muted",
    dot: "bg-muted-foreground",
    combined: "bg-muted text-muted-foreground border-muted",
  },
  archived: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-muted",
    dot: "bg-muted-foreground",
    combined: "bg-muted text-muted-foreground border-muted",
  },
};

/**
 * Get status classes for a given status
 */
export function getStatusClasses(status: Status) {
  return statusColors[status] || statusColors.pending;
}

/**
 * Project type derived from TechStack flags
 */
export type ProjectType = "gsd" | "bare";

/**
 * Project type display metadata
 */
export const projectTypeConfig: Record<
  ProjectType,
  { label: string; classes: string; tooltip: string }
> = {
  gsd: {
    label: "GSD",
    classes:
      "bg-brand-purple/10 text-brand-purple border-brand-purple/20",
    tooltip: "GSD project (.planning/)",
  },
  bare: {
    label: "Bare",
    classes: "bg-muted text-muted-foreground border-muted",
    tooltip: "No project framework detected",
  },
};

/**
 * Derive project type from TechStack flags
 */
export function getProjectType(techStack: {
  has_planning: boolean;
} | null | undefined): ProjectType {
  if (!techStack) return "bare";
  if (techStack.has_planning) return "gsd";
  return "bare";
}

/**
 * System group type for project visual delineation
 */
export type SystemGroup = "gsd";

export const systemGroupConfig: Record<
  SystemGroup,
  { label: string; color: string; bgTint: string }
> = {
  gsd: {
    label: "GSD",
    color: "text-brand-purple",
    bgTint: "bg-brand-purple/20",
  },
};
