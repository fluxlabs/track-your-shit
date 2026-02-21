// Track Your Shit - Utility Functions
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCost(cost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cost);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString || "unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatRelativeTime(dateString: string): string {
  if (!dateString) return "unknown";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return formatDate(dateString);
  }
}

/**
 * Extract a human-readable error message from an unknown error value.
 * Handles Error objects, strings, and Tauri backend errors.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

export function formatMinutes(minutes: number | null): string {
  if (minutes == null || minutes === 0) return "\u2014";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function isMajorBump(current: string, latest: string): boolean {
  const majorRe = /^(\d+)\./;
  const currentMatch = majorRe.exec(current);
  const latestMatch = majorRe.exec(latest);
  if (!currentMatch || !latestMatch) return false;
  return Number(latestMatch[1]) > Number(currentMatch[1]);
}

export function getRegistryUrl(
  packageManager: string,
  packageName: string,
): string {
  switch (packageManager.toLowerCase()) {
    case 'cargo':
      return `https://crates.io/crates/${packageName}`;
    case 'pip':
    case 'pipenv':
    case 'poetry':
      return `https://pypi.org/project/${packageName}/`;
    default:
      return `https://www.npmjs.com/package/${packageName}`;
  }
}

export function truncatePath(path: string, maxLength: number = 40): string {
  if (path.length <= maxLength) return path;

  const parts = path.split("/");
  if (parts.length <= 2) return path;

  const start = parts.slice(0, 2).join("/");
  const end = parts.slice(-2).join("/");

  if (start.length + end.length + 5 > maxLength) {
    return `.../${parts.slice(-2).join("/")}`;
  }

  return `${start}/.../${end}`;
}
