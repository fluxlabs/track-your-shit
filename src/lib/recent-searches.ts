// Track Your Shit - Recent Searches Helper
// Persists recent search queries in localStorage
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

const STORAGE_KEY = 'ct-recent-searches';
const MAX_ENTRIES = 5;

interface RecentSearch {
  query: string;
  timestamp: number;
}

export function getRecentSearches(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentSearch[];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;

  const existing = getRecentSearches().filter((s) => s.query !== trimmed);
  const updated = [{ query: trimmed, timestamp: Date.now() }, ...existing].slice(
    0,
    MAX_ENTRIES
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearRecentSearches(): void {
  localStorage.removeItem(STORAGE_KEY);
}
