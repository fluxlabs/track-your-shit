// Track Your Shit - Dependencies Tab Component
// Package dependency analysis and vulnerability detection for project page tab context
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDependencyStatus } from '@/lib/queries';
import { invalidateDependencyCache } from '@/lib/tauri';
import { queryKeys } from '@/lib/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import {
  formatRelativeTime,
  getErrorMessage,
  isMajorBump,
  getRegistryUrl,
} from '@/lib/utils';
import {
  Package,
  Box,
  AlertTriangle,
  ShieldAlert,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

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

function parseOutdatedPackages(
  details: Record<string, unknown> | null
): [string, OutdatedEntry][] {
  if (!details || typeof details !== 'object') return [];
  let resolved = details;
  if (typeof resolved === 'string') {
    try {
      resolved = JSON.parse(resolved) as Record<string, unknown>;
    } catch {
      return [];
    }
  }
  let outdated = resolved.outdated as Record<string, OutdatedEntry> | undefined;
  if (typeof outdated === 'string') {
    try {
      outdated = JSON.parse(outdated) as Record<string, OutdatedEntry>;
    } catch {
      outdated = undefined;
    }
  }
  if (!outdated || typeof outdated !== 'object' || Array.isArray(outdated)) {
    const firstValue = Object.values(resolved)[0];
    if (
      firstValue &&
      typeof firstValue === 'object' &&
      firstValue !== null &&
      'current' in firstValue
    ) {
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
  details: Record<string, unknown> | null
): [string, AuditVulnerability][] {
  if (!details) return [];
  const audit = details.audit as Record<string, unknown> | undefined;
  if (!audit) return [];
  const vulns = audit.vulnerabilities as
    | Record<string, AuditVulnerability>
    | undefined;
  if (!vulns || typeof vulns !== 'object') return [];
  return Object.entries(vulns)
    .filter(([, v]) => v.severity && v.severity !== 'info')
    .sort(([, a], [, b]) => {
      const order: Record<string, number> = {
        critical: 0,
        high: 1,
        moderate: 2,
        low: 3,
      };
      return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
    });
}

function severityBadgeVariant(
  severity: string
): 'error' | 'warning' | 'secondary' {
  switch (severity.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'error';
    case 'moderate':
      return 'warning';
    default:
      return 'secondary';
  }
}

function PackageManagerIcon({
  pm,
  className,
}: {
  pm: string;
  className?: string;
}) {
  switch (pm.toLowerCase()) {
    case 'cargo':
      return <Box className={className} />;
    default:
      return <Package className={className} />;
  }
}

function computeHealthScore(outdated: number): number {
  if (outdated === 0) return 100;
  return Math.max(20, 100 - outdated * 5);
}

function healthVariant(score: number): 'success' | 'warning' | 'error' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'error';
}

function EmptyTabState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Icon className="h-10 w-10 mb-3 opacity-30" />
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-1">{description}</p>
    </div>
  );
}

function OutdatedTable({
  packages,
  packageManager,
}: {
  packages: [string, OutdatedEntry][];
  packageManager: string;
}) {
  return (
    <ScrollArea className="max-h-[500px]">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 py-2 border-b sticky top-0 bg-background z-10">
        <span className="flex-1 min-w-0">Package</span>
        <span className="w-24 text-right shrink-0">Current</span>
        <span className="w-24 text-right shrink-0">Wanted</span>
        <span className="w-32 text-right shrink-0">Latest</span>
      </div>
      {packages.map(([name, info]) => {
        const breaking = isMajorBump(info.current, info.latest);
        return (
          <div
            key={name}
            className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/50 transition-colors"
          >
            <span className="flex-1 min-w-0 truncate" title={name}>
              <a
                href={getRegistryUrl(packageManager, name)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-blue hover:underline inline-flex items-center gap-1"
              >
                {name}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </span>
            <span className="w-24 text-right shrink-0 font-mono text-muted-foreground text-xs">
              {info.current}
            </span>
            <span className="w-24 text-right shrink-0 font-mono text-status-warning text-xs">
              {info.wanted}
            </span>
            <span className="w-32 text-right shrink-0 font-mono text-status-success text-xs inline-flex items-center justify-end gap-1.5">
              {info.latest}
              {breaking && (
                <Badge variant="error" size="sm">
                  Breaking
                </Badge>
              )}
            </span>
          </div>
        );
      })}
    </ScrollArea>
  );
}

function VulnerabilityTable({
  packages,
  severityFilter,
}: {
  packages: [string, AuditVulnerability][];
  severityFilter: string;
}) {
  const filtered =
    severityFilter === 'all'
      ? packages
      : packages.filter(
          ([, v]) => v.severity.toLowerCase() === severityFilter
        );

  if (filtered.length === 0) {
    return (
      <EmptyTabState
        icon={ShieldCheck}
        title="No matches"
        description={
          severityFilter === 'all'
            ? 'No vulnerabilities found'
            : `No ${severityFilter} severity vulnerabilities`
        }
      />
    );
  }

  return (
    <ScrollArea className="max-h-[500px]">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 py-2 border-b sticky top-0 bg-background z-10">
        <span className="flex-1 min-w-0">Package</span>
        <span className="w-20 shrink-0">Severity</span>
        <span className="flex-1 min-w-0">Title</span>
        <span className="w-20 text-right shrink-0">Advisory</span>
      </div>
      {filtered.map(([name, info]) => (
        <div
          key={name}
          className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-b-0 hover:bg-muted/50 transition-colors"
        >
          <span
            className="flex-1 min-w-0 font-medium truncate"
            title={name}
          >
            {name}
          </span>
          <span className="w-20 shrink-0">
            <Badge variant={severityBadgeVariant(info.severity)} size="sm">
              {info.severity}
            </Badge>
          </span>
          <span className="flex-1 min-w-0 text-muted-foreground truncate text-xs">
            {info.title ?? '-'}
          </span>
          <span className="w-20 text-right shrink-0">
            {info.url ? (
              <a
                href={info.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline"
              >
                View
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </span>
        </div>
      ))}
    </ScrollArea>
  );
}

interface DependenciesTabProps {
  projectId: string;
  projectPath: string;
}

export function DependenciesTab({
  projectId,
  projectPath,
}: DependenciesTabProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: status, isLoading } = useDependencyStatus(
    projectId,
    projectPath
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.toLowerCase().trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const outdatedPackages = useMemo(
    () => parseOutdatedPackages(status?.details ?? null),
    [status?.details]
  );

  const vulnerablePackages = useMemo(
    () => parseVulnerablePackages(status?.details ?? null),
    [status?.details]
  );

  const filteredOutdated = useMemo(
    () =>
      debouncedSearch
        ? outdatedPackages.filter(([name]) =>
            name.toLowerCase().includes(debouncedSearch)
          )
        : outdatedPackages,
    [outdatedPackages, debouncedSearch]
  );

  const filteredVulnerable = useMemo(
    () =>
      debouncedSearch
        ? vulnerablePackages.filter(([name]) =>
            name.toLowerCase().includes(debouncedSearch)
          )
        : vulnerablePackages,
    [vulnerablePackages, debouncedSearch]
  );

  const severityBreakdown = useMemo(() => {
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
    };
    for (const [, v] of vulnerablePackages) {
      const s = v.severity.toLowerCase();
      if (s in counts) counts[s]++;
    }
    return counts;
  }, [vulnerablePackages]);

  const healthScore = computeHealthScore(status?.outdated_count ?? 0);
  const variant = healthVariant(healthScore);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await invalidateDependencyCache(projectId);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.dependencyStatus(projectId),
      });
      toast.success('Dependency data refreshed');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>No dependency data available for this project.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PackageManagerIcon
                pm={status.package_manager}
                className="h-4 w-4 text-muted-foreground"
              />
              Package Manager
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-sm capitalize">
              {status.package_manager}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Last checked: {formatRelativeTime(status.checked_at)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-bold text-status-${variant}`}>
                {healthScore}%
              </span>
            </div>
            <Progress
              value={healthScore}
              variant={variant}
              size="sm"
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card
          className={
            status.outdated_count > 0 ? 'border-status-warning/30' : ''
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock
                className={`h-4 w-4 ${status.outdated_count > 0 ? 'text-status-warning' : 'text-muted-foreground'}`}
              />
              Outdated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${status.outdated_count > 0 ? 'text-status-warning' : ''}`}
            >
              {status.outdated_count}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {status.outdated_count === 0
                ? 'All packages up to date'
                : `${status.outdated_count} package${status.outdated_count !== 1 ? 's' : ''} behind latest`}
            </p>
          </CardContent>
        </Card>

        <Card
          className={
            status.vulnerable_count > 0 ? 'border-status-error/30' : ''
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert
                className={`h-4 w-4 ${status.vulnerable_count > 0 ? 'text-status-error' : 'text-muted-foreground'}`}
              />
              Vulnerabilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${status.vulnerable_count > 0 ? 'text-status-error' : ''}`}
            >
              {status.vulnerable_count}
            </div>
            {status.vulnerable_count > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {severityBreakdown.critical > 0 && (
                  <Badge variant="error" size="sm">
                    {severityBreakdown.critical} critical
                  </Badge>
                )}
                {severityBreakdown.high > 0 && (
                  <Badge variant="error" size="sm">
                    {severityBreakdown.high} high
                  </Badge>
                )}
                {severityBreakdown.moderate > 0 && (
                  <Badge variant="warning" size="sm">
                    {severityBreakdown.moderate} moderate
                  </Badge>
                )}
                {severityBreakdown.low > 0 && (
                  <Badge variant="secondary" size="sm">
                    {severityBreakdown.low} low
                  </Badge>
                )}
              </div>
            )}
            {status.vulnerable_count === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                No known vulnerabilities
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search + Refresh toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search packages..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Tabs: Outdated / Vulnerabilities */}
      <Tabs defaultValue="outdated" className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="outdated" className="gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              Outdated
              {status.outdated_count > 0 && (
                <Badge variant="warning" size="sm">
                  {debouncedSearch
                    ? `${filteredOutdated.length}/${status.outdated_count}`
                    : status.outdated_count}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="vulnerabilities" className="gap-2">
              <ShieldAlert className="h-3.5 w-3.5" />
              Vulnerabilities
              {status.vulnerable_count > 0 && (
                <Badge variant="error" size="sm">
                  {debouncedSearch
                    ? `${filteredVulnerable.length}/${status.vulnerable_count}`
                    : status.vulnerable_count}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="outdated">
          <Card>
            <CardContent className="p-0">
              {filteredOutdated.length === 0 ? (
                status.outdated_count === 0 ? (
                  <EmptyTabState
                    icon={CheckCircle2}
                    title="All up to date"
                    description="Every package is on the latest version"
                  />
                ) : debouncedSearch ? (
                  <EmptyTabState
                    icon={Search}
                    title="No matches"
                    description={`No outdated packages matching "${debouncedSearch}"`}
                  />
                ) : (
                  <EmptyTabState
                    icon={AlertTriangle}
                    title={`${status.outdated_count} outdated packages detected`}
                    description="Run npm outdated for detailed version info"
                  />
                )
              ) : (
                <OutdatedTable packages={filteredOutdated} packageManager={status.package_manager} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vulnerabilities">
          <Card>
            {status.vulnerable_count > 0 && (
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Filter:
                  </span>
                  <Select
                    value={severityFilter}
                    onValueChange={setSeverityFilter}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
            )}
            <CardContent className="p-0">
              {filteredVulnerable.length === 0 &&
              status.vulnerable_count === 0 ? (
                <EmptyTabState
                  icon={ShieldCheck}
                  title="No vulnerabilities"
                  description="No known security issues found"
                />
              ) : filteredVulnerable.length === 0 && debouncedSearch ? (
                <EmptyTabState
                  icon={Search}
                  title="No matches"
                  description={`No vulnerable packages matching "${debouncedSearch}"`}
                />
              ) : filteredVulnerable.length === 0 ? (
                <EmptyTabState
                  icon={ShieldAlert}
                  title={`${status.vulnerable_count} vulnerabilities detected`}
                  description="Run npm audit for detailed security info"
                />
              ) : (
                <VulnerabilityTable
                  packages={filteredVulnerable}
                  severityFilter={severityFilter}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
