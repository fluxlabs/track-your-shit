// Track Your Shit - Dependency Alerts Card
// Compact card showing project dependency status (outdated/vulnerable)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  cn,
  formatRelativeTime,
  isMajorBump,
  getRegistryUrl,
} from '@/lib/utils';
import { useDependencyStatus } from '@/lib/queries';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { invalidateDependencyCache } from '@/lib/tauri';
import {
  Package,
  Box,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface DependencyAlertsCardProps {
  projectId: string;
  projectPath: string;
}

interface OutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
}

interface AuditVulnerability {
  severity: string;
  title?: string;
  url?: string;
  range?: string;
  via?: unknown[];
}

function PackageManagerIcon({ pm, className }: { pm: string; className?: string }) {
  switch (pm.toLowerCase()) {
    case 'cargo':
      return <Box className={className} />;
    default:
      return <Package className={className} />;
  }
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'text-status-error';
    case 'moderate':
      return 'text-status-warning';
    default:
      return 'text-muted-foreground';
  }
}

function parseOutdatedPackages(
  details: Record<string, unknown> | null,
): [string, OutdatedEntry][] {
  if (!details || typeof details !== 'object') return [];

  // Handle double-serialization: details may be a JSON string from cache round-trip
  let resolved = details;
  if (typeof resolved === 'string') {
    try {
      resolved = JSON.parse(resolved) as Record<string, unknown>;
    } catch {
      return [];
    }
  }

  // Try details.outdated first (expected structure from npm outdated merge)
  let outdated = resolved.outdated as Record<string, OutdatedEntry> | undefined;

  // If outdated is itself a JSON string, parse it
  if (typeof outdated === 'string') {
    try {
      outdated = JSON.parse(outdated) as Record<string, OutdatedEntry>;
    } catch {
      outdated = undefined;
    }
  }

  // Fallback: details itself may be the outdated map (alternate structures)
  if (!outdated || typeof outdated !== 'object' || Array.isArray(outdated)) {
    // Check if details directly contains entries with current/wanted/latest
    const firstValue = Object.values(resolved)[0];
    if (firstValue && typeof firstValue === 'object' && firstValue !== null && 'current' in firstValue) {
      outdated = resolved as unknown as Record<string, OutdatedEntry>;
    } else {
      return [];
    }
  }

  return Object.entries(outdated)
    .filter(([, v]) => v && typeof v === 'object' && 'current' in v)
    .sort(([a], [b]) => a.localeCompare(b));
}

function parseVulnerablePackages(
  details: Record<string, unknown> | null,
): [string, AuditVulnerability][] {
  if (!details) return [];
  const audit = details.audit as Record<string, unknown> | undefined;
  if (!audit) return [];
  const vulns = audit.vulnerabilities as Record<string, AuditVulnerability> | undefined;
  if (!vulns || typeof vulns !== 'object') return [];
  return Object.entries(vulns)
    .filter(([, v]) => v.severity && v.severity !== 'info')
    .sort(([, a], [, b]) => {
      const order: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });
}

export function DependencyAlertsCard({ projectId, projectPath }: DependencyAlertsCardProps) {
  const { data: status, isLoading, refetch, isFetching } = useDependencyStatus(projectId, projectPath);
  const queryClient = useQueryClient();
  const [showOutdated, setShowOutdated] = useState(false);
  const [showVulnerable, setShowVulnerable] = useState(false);

  // Auto-expand when issues exist
  useEffect(() => {
    if (status?.outdated_count && status.outdated_count > 0) setShowOutdated(true);
    if (status?.vulnerable_count && status.vulnerable_count > 0) setShowVulnerable(true);
  }, [status?.outdated_count, status?.vulnerable_count]);

  // Listen for deps:file-changed events from watcher and trigger refresh
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{ project_path: string; file_path: string }>(
      'deps:file-changed',
      (event) => {
        if (event.payload.project_path === projectPath) {
          // Invalidate backend cache, then refetch
          void invalidateDependencyCache(projectId).then(() => {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.dependencyStatus(projectId),
            });
          });
        }
      },
    ).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [projectId, projectPath, queryClient]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dependencies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Dependencies
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No dependency data available. Click refresh to check.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasIssues = status.outdated_count > 0 || status.vulnerable_count > 0;
  const outdatedPackages = parseOutdatedPackages(status.details);
  const vulnerablePackages = parseVulnerablePackages(status.details);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <PackageManagerIcon pm={status.package_manager} className="h-4 w-4" />
            Dependencies
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Package Manager */}
          <div className="text-xs text-muted-foreground capitalize">
            {status.package_manager}
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-3">
            {status.outdated_count > 0 ? (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
                onClick={() => setShowOutdated(!showOutdated)}
              >
                <AlertTriangle className="h-4 w-4 text-status-warning" />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-status-warning/10 text-status-warning">
                  {status.outdated_count} outdated
                </span>
                {showOutdated ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            ) : null}
            {status.vulnerable_count > 0 ? (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
                onClick={() => setShowVulnerable(!showVulnerable)}
              >
                <ShieldAlert className="h-4 w-4 text-status-error" />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-status-error/10 text-status-error">
                  {status.vulnerable_count} vulnerable
                </span>
                {showVulnerable ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            ) : null}
            {!hasIssues && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-status-success/10 text-status-success">
                All up to date
              </span>
            )}
          </div>

          {/* Outdated packages list */}
          {showOutdated && status.outdated_count > 0 && (
            <div className="border-t pt-2 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Outdated Packages
              </p>
              {outdatedPackages.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {outdatedPackages.map(([name, info]) => {
                    const breaking = isMajorBump(info.current, info.latest);
                    return (
                      <div
                        key={name}
                        className="flex items-center gap-2 text-xs rounded px-2 py-1 bg-muted/50"
                      >
                        <a
                          href={getRegistryUrl(status.package_manager, name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium truncate flex-1 text-brand-blue hover:underline inline-flex items-center gap-1"
                          title={name}
                        >
                          {name}
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                        <span className="text-muted-foreground font-mono shrink-0">
                          {info.current}
                        </span>
                        <ArrowRight className="h-3 w-3 text-status-warning shrink-0" />
                        <span className="font-mono text-status-warning shrink-0">
                          {info.latest}
                        </span>
                        {breaking && (
                          <span className="text-[10px] font-semibold text-status-error shrink-0">
                            Breaking
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {status.outdated_count} outdated package{status.outdated_count !== 1 ? 's' : ''} detected.
                  Run <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">npm outdated</code> for details.
                </p>
              )}
            </div>
          )}

          {/* Vulnerable packages list */}
          {showVulnerable && status.vulnerable_count > 0 && (
            <div className="border-t pt-2 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Vulnerabilities
              </p>
              {vulnerablePackages.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {vulnerablePackages.map(([name, info]) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 text-xs rounded px-2 py-1 bg-muted/50"
                    >
                      <span className="font-medium truncate flex-1" title={name}>
                        {name}
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-medium uppercase px-1.5 py-0.5 rounded shrink-0',
                          severityColor(info.severity),
                        )}
                      >
                        {info.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {status.vulnerable_count} vulnerabilit{status.vulnerable_count !== 1 ? 'ies' : 'y'} detected.
                  Run <code className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">npm audit</code> for details.
                </p>
              )}
            </div>
          )}

          {/* Last Checked */}
          <div className="text-xs text-muted-foreground">
            Last checked: {formatRelativeTime(status.checked_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
