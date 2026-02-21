// Track Your Shit - Main Layout Component
// Persistent shell panel at bottom with page content above
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { ReactNode, useState, useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTerminalContext } from '@/contexts/terminal-context';

const ShellPage = lazy(() =>
  import('@/pages/shell').then((m) => ({ default: m.ShellPage }))
);
import { navigation } from '@/lib/navigation';
import {
  useUnreadNotificationCount,
  useProjectsWithStats,
} from '@/lib/queries';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Radio,
  SquareTerminal,
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  FolderOpen,
} from 'lucide-react';
import { modKey } from '@/hooks/use-keyboard-shortcuts';
import { KeyboardShortcutsProvider } from './keyboard-shortcuts-provider';
import { KeyboardShortcutsDialog } from './keyboard-shortcuts-dialog';
import { Breadcrumbs } from './breadcrumbs';

const CommandPalette = lazy(() =>
  import('@/components/command-palette').then((m) => ({
    default: m.CommandPalette,
  }))
);

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isShellRoute = location.pathname.startsWith("/terminal");
  const isProjectShellTab =
    location.pathname.startsWith('/projects/') &&
    new URLSearchParams(location.search).get('tab') === 'shell';
  const { shellPanelCollapsed, setShellPanelCollapsed } = useTerminalContext();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: projectsWithStats } = useProjectsWithStats();

  // Recent projects: sorted by last_activity_at, top 3
  const recentProjects = (projectsWithStats ?? [])
    .filter((p) => p.last_activity_at)
    .sort(
      (a, b) =>
        new Date(b.last_activity_at!).getTime() -
        new Date(a.last_activity_at!).getTime()
    )
    .slice(0, 3);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <KeyboardShortcutsProvider>
      {({ searchOpen, setSearchOpen, helpOpen, setHelpOpen }) => (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Sidebar */}
        <aside
          className={cn(
            "border-r border-border/40 bg-card flex flex-col transition-all duration-200",
            sidebarCollapsed ? "w-16" : "w-64"
          )}
        >
          {/* Logo */}
          <div
            className={cn(
              "h-14 flex items-center border-b border-border/40",
              sidebarCollapsed ? "px-3 justify-center" : "px-5"
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-brand-blue/15 flex-shrink-0">
                <Radio className="h-[18px] w-[18px] text-brand-blue" />
              </div>
              {!sidebarCollapsed && (
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  Track Your Shit
                </span>
              )}
            </div>
          </div>

          {/* Command palette trigger */}
          <button
            className={cn(
              "flex items-center gap-2 mx-2 mt-2 rounded-md border border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors cursor-pointer",
              sidebarCollapsed ? "justify-center p-2" : "px-3 py-1.5"
            )}
            onClick={() => setSearchOpen(true)}
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="text-xs flex-1 text-left">Search...</span>
                <kbd className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/30">
                  {modKey()}K
                </kbd>
              </>
            )}
          </button>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 overflow-y-auto",
            sidebarCollapsed ? "p-2 space-y-1" : "p-2"
          )}>
            {navigation.map((item, index) => {
              if (item.type === "section") {
                if (sidebarCollapsed) {
                  return (
                    <div
                      key={`section-${item.label}`}
                      className={index === 0 ? "" : "pt-4"}
                    />
                  );
                }
                return (
                  <div
                    key={`section-${item.label}`}
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-3 pb-1.5",
                      index === 0 ? "pt-3" : "pt-5"
                    )}
                  >
                    {item.label}
                  </div>
                );
              }

              const isActive =
                item.href === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.href);

              const linkContent = (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => void navigate(item.href)}
                  className={cn(
                    "w-full flex items-center rounded-md text-sm font-medium transition-colors duration-150 relative",
                    sidebarCollapsed
                      ? "justify-center px-0 py-2.5"
                      : "gap-3 px-3 py-2",
                    isActive
                      ? "bg-muted/80 text-foreground nav-item-active"
                      : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {/* Active indicator: left bar (expanded) or bottom dot (collapsed) */}
                  {isActive && !sidebarCollapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-full bg-brand-blue" />
                  )}
                  {isActive && sidebarCollapsed && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-blue" />
                  )}

                  <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <>
                      <span>{item.name}</span>
                      {/* Unread notification badge */}
                      {item.name === 'Notifications' && unreadCount && unreadCount > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
                          {unreadCount}
                        </Badge>
                      )}
                    </>
                  )}
                </button>
              );

              if (sidebarCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent side="right">{item.name}</TooltipContent>
                  </Tooltip>
                );
              }

              return linkContent;
            })}
          </nav>

          {/* Recents section (expanded sidebar only) */}
          {!sidebarCollapsed && recentProjects.length > 0 && (
            <div className="px-2 pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-3 pb-1.5">
                Recents
              </div>
              {recentProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => void navigate(`/projects/${project.id}`)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors truncate',
                    location.pathname === `/projects/${project.id}` &&
                      'bg-muted/60 text-foreground'
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Collapse toggle + version */}
          <div className="border-t border-border/40">
            <button
              className="flex items-center justify-center p-2 cursor-pointer hover:bg-muted/50 transition-colors w-full"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PanelLeftOpen className="h-4 w-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent side="right">Expand sidebar</TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground/60 hover:text-foreground transition-colors">
                  <PanelLeftClose className="h-4 w-4" />
                  <span className="text-[11px] font-medium">Collapse</span>
                </div>
              )}
            </button>
            {!sidebarCollapsed && (
              <div className="pb-3 text-center">
                <span className="text-[10px] font-mono text-muted-foreground/40">
                  v0.2.0
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Main content - vertical split: page content + persistent shell panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-background to-muted/10">
          {/* Top bar: breadcrumbs + notification bell (always visible) */}
          {!isShellRoute && <Breadcrumbs />}

          {/* Page content area */}
          <div className={cn(
            "overflow-hidden min-h-0 transition-all duration-200",
            isShellRoute ? "h-0 invisible" : "flex-1"
          )}>
            {children}
          </div>

          {/* Shell panel collapse toggle (hidden on /shell route and project Shell tab) */}
          {!isShellRoute && !isProjectShellTab && (
            <button
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 border-t cursor-pointer select-none flex-shrink-0 w-full transition-all duration-200 group",
                shellPanelCollapsed
                  ? "border-brand-blue/30 bg-gradient-to-r from-brand-blue/5 via-brand-purple/5 to-transparent hover:from-brand-blue/10 hover:via-brand-purple/10"
                  : "border-border/50 bg-muted/30 hover:bg-muted/50"
              )}
              onClick={() => setShellPanelCollapsed(!shellPanelCollapsed)}
              aria-label={shellPanelCollapsed ? "Expand shell panel" : "Collapse shell panel"}
              aria-expanded={!shellPanelCollapsed}
            >
              {/* Accent line on top when collapsed */}
              {shellPanelCollapsed && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-brand-blue via-brand-purple to-brand-blue/0" />
              )}
              <SquareTerminal className={cn(
                "h-4 w-4 transition-colors duration-200",
                shellPanelCollapsed
                  ? "text-brand-blue group-hover:text-brand-purple"
                  : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors duration-200",
                shellPanelCollapsed
                  ? "text-foreground/70 group-hover:text-foreground"
                  : "text-muted-foreground"
              )}>
                Terminal
              </span>
              {shellPanelCollapsed && (
                <span className="text-[10px] text-muted-foreground/60 font-mono ml-1">
                  Click to open
                </span>
              )}
              {shellPanelCollapsed ? (
                <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground ml-auto transition-colors" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
              )}
            </button>
          )}

          {/* Persistent shell panel - always mounted, visible based on state */}
          <div className={cn(
            "flex-shrink-0 transition-all duration-200",
            isShellRoute
              ? "flex-1"
              : shellPanelCollapsed || isProjectShellTab
                ? "h-0 invisible"
                : "h-[300px]"
          )}>
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Loading terminal...</div>}>
              <ShellPage />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Command palette (lazy loaded) */}
      {searchOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
        </Suspense>
      )}

      {/* Keyboard shortcuts help */}
      <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </TooltipProvider>
      )}
    </KeyboardShortcutsProvider>
  );
}
