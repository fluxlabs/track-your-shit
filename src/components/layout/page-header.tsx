// Track Your Shit - Page Header Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import type { ReactNode } from 'react';

export interface PageHeaderProps {
  /** Page title text */
  title: string;
  /** Optional subtitle/description text */
  description?: string;
  /** Optional icon element (should be h-6 w-6) */
  icon?: ReactNode;
  /** Optional action buttons to display on the right */
  actions?: ReactNode;
}

/**
 * Unified page header component for consistent title styling across all pages.
 * Enforces design system: text-2xl title, muted icons, optional description.
 */
export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {icon}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
