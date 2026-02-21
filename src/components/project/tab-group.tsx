// Track Your Shit - Tab Group Component
// Reusable nested tab group for project page sub-tabs
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface TabGroupItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  content: ReactNode;
}

interface TabGroupProps {
  tabs: TabGroupItem[];
  defaultTab?: string;
}

export function TabGroup({ tabs, defaultTab }: TabGroupProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-border/50 mb-4 pb-px">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-md transition-colors relative',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-blue rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">{activeContent}</div>
    </div>
  );
}
