// Track Your Shit - Keyboard Shortcut Definitions
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

export function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

export function modKey(): string {
  return isMac() ? '\u2318' : 'Ctrl';
}

export interface ShortcutDef {
  /** Hotkey string for react-hotkeys-hook (e.g. "mod+k") */
  keys: string;
  /** Human-readable description */
  description: string;
  /** Grouping category */
  category: 'Navigation' | 'Search' | 'Shell' | 'General';
  /** Display keys shown in UI (platform aware) */
  displayKeys: () => string[];
}

export const SHORTCUTS: ShortcutDef[] = [
  // Search
  {
    keys: 'mod+k',
    description: 'Open command palette',
    category: 'Search',
    displayKeys: () => [modKey(), 'K'],
  },

  // Navigation
  {
    keys: 'mod+1',
    description: 'Go to Dashboard',
    category: 'Navigation',
    displayKeys: () => [modKey(), '1'],
  },
  {
    keys: 'mod+2',
    description: 'Go to Projects',
    category: 'Navigation',
    displayKeys: () => [modKey(), '2'],
  },
  {
    keys: 'mod+3',
    description: 'Go to Terminal',
    category: 'Navigation',
    displayKeys: () => [modKey(), '3'],
  },

  // Shell
  {
    keys: 'mod+\\',
    description: 'Toggle shell panel',
    category: 'Shell',
    displayKeys: () => [modKey(), '\\'],
  },
  {
    keys: 'mod+shift+\\',
    description: 'Split terminal',
    category: 'Shell',
    displayKeys: () => [modKey(), 'Shift', '\\'],
  },

  // General
  {
    keys: 'shift+/',
    description: 'Show keyboard shortcuts',
    category: 'General',
    displayKeys: () => ['?'],
  },
  {
    keys: 'mod+,',
    description: 'Open settings',
    category: 'General',
    displayKeys: () => [modKey(), ','],
  },
];
