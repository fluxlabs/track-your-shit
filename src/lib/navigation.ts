// Track Your Shit - Shared Navigation Configuration
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import {
  LayoutDashboard,
  CheckSquare,
  Terminal,
  Bell,
  Settings,
  LucideIcon,
} from 'lucide-react';

export interface NavItem {
  type: 'link';
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  type: 'section';
  label: string;
}

export type NavigationItem = NavItem | NavSection;

export const navigation: NavigationItem[] = [
  { type: 'section', label: 'Your Shit' },
  { type: 'link', name: 'Home', href: '/', icon: LayoutDashboard },
  { type: 'link', name: 'Todos', href: '/todos', icon: CheckSquare },
  { type: 'link', name: 'Terminal', href: '/terminal', icon: Terminal },

  { type: 'section', label: 'System' },
  { type: 'link', name: 'Notifications', href: '/notifications', icon: Bell },
  { type: 'link', name: 'Settings', href: '/settings', icon: Settings },
];

/** Flat array of link-only navigation items (used by command palette + breadcrumbs) */
export const navLinks: NavItem[] = navigation.filter(
  (item): item is NavItem => item.type === 'link'
);
