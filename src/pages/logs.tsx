// Track Your Shit - Log Viewer Page
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjects, useAppLogs, useAppLogStats, useClearAppLogs } from "@/lib/queries";
import { queryKeys } from "@/lib/query-keys";
import { AppLogEntry, AppLogEvent, AppLogFilters, onLogNew } from "@/lib/tauri";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScrollText,
  Search,
  Trash2,
  Download,
  Loader2,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Radio,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const LEVEL_COLORS: Record<string, string> = {
  error: "bg-red-500/10 text-red-500 border-red-500/30",
  warn: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  debug: "bg-muted text-muted-foreground border-border",
  trace: "bg-muted text-muted-foreground border-border",
};

const LEVEL_STAT_COLORS: Record<string, string> = {
  error: "bg-red-500/10 text-red-600",
  warn: "bg-amber-500/10 text-amber-600",
  info: "bg-blue-500/10 text-blue-600",
  debug: "bg-muted text-muted-foreground",
  trace: "bg-muted text-muted-foreground",
};

function formatTimestamp(dateString: string): string {
  const d = new Date(dateString + "Z");
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatFullDate(dateString: string): string {
  return new Date(dateString + "Z").toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function LogEntryRow({ entry, isNew }: { entry: AppLogEntry; isNew?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-lg px-3 py-2 hover:bg-accent/50 transition-all cursor-pointer ${
        isNew ? "animate-in fade-in slide-in-from-top-1 duration-300 border-brand-blue/30" : ""
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-muted-foreground font-mono shrink-0 w-[70px]">
          {formatTimestamp(entry.created_at)}
        </span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 font-mono uppercase shrink-0 ${LEVEL_COLORS[entry.level] || ""}`}
        >
          {entry.level}
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
          {entry.source}
        </Badge>
        {entry.target && (
          <span className="text-xs text-muted-foreground font-mono shrink-0 max-w-[200px] truncate">
            {entry.target}
          </span>
        )}
        <span className="text-sm truncate min-w-0 flex-1">{entry.message}</span>
        <Button variant="ghost" size="sm" className="shrink-0 h-6 w-6 p-0">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Full Message</div>
            <pre className="text-sm bg-muted p-3 rounded-lg whitespace-pre-wrap font-mono break-all">
              {entry.message}
            </pre>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Time: {formatFullDate(entry.created_at)}</span>
            {entry.target && <span>Target: {entry.target}</span>}
            {entry.project_id && <span>Project: {entry.project_id}</span>}
          </div>
          {entry.metadata && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Metadata</div>
              <pre className="text-xs bg-muted p-3 rounded-lg whitespace-pre-wrap font-mono">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Inner logs UI reusable in other contexts (e.g. Settings > Logs tab) */
export function LogsContent() {
  const queryClient = useQueryClient();
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(new Set());
  const newEntryTimeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const filters: AppLogFilters = useMemo(() => {
    const f: AppLogFilters = { limit: 200 };
    if (levelFilter) f.level = levelFilter;
    if (sourceFilter) f.source = sourceFilter;
    if (projectFilter) f.project_id = projectFilter;
    if (debouncedSearch) f.search = debouncedSearch;
    return f;
  }, [levelFilter, sourceFilter, projectFilter, debouncedSearch]);

  const { data: projects } = useProjects();
  const { data: logs, isLoading } = useAppLogs(filters);
  const { data: stats } = useAppLogStats();
  const clearLogs = useClearAppLogs();

  // Sort logs
  const sortedLogs = useMemo(() => {
    if (!logs) return [];
    const sorted = [...logs];
    sorted.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortNewestFirst ? dateB - dateA : dateA - dateB;
    });
    return sorted.slice(0, 500);
  }, [logs, sortNewestFirst]);

  // Real-time streaming
  useEffect(() => {
    if (!liveMode) return;

    let unlisten: (() => void) | undefined;

    const setup = async () => {
      unlisten = await onLogNew((event: AppLogEvent) => {
        // Check if the event matches current filters
        if (filters.level && event.level !== filters.level) return;
        if (filters.source && event.source !== filters.source) return;
        if (filters.project_id === "__system__" && event.project_id) return;
        if (filters.project_id && filters.project_id !== "__system__" && event.project_id !== filters.project_id) return;
        if (
          filters.search &&
          !event.message.toLowerCase().includes(filters.search.toLowerCase())
        )
          return;

        // Prepend to query cache
        const newEntry: AppLogEntry = {
          id: event.id,
          level: event.level,
          target: event.target,
          message: event.message,
          source: event.source,
          project_id: event.project_id,
          metadata: null,
          created_at: event.created_at,
        };

        queryClient.setQueryData<AppLogEntry[]>(queryKeys.appLogs(filters), (old) => {
          if (!old) return [newEntry];
          return [newEntry, ...old].slice(0, 500);
        });

        // Mark as new for highlight animation
        setNewEntryIds((prev) => new Set(prev).add(event.id));

        // Remove highlight after 2 seconds
        const timeout = setTimeout(() => {
          setNewEntryIds((prev) => {
            const next = new Set(prev);
            next.delete(event.id);
            return next;
          });
          newEntryTimeoutRef.current.delete(event.id);
        }, 2000);
        newEntryTimeoutRef.current.set(event.id, timeout);

        // Invalidate stats
        void queryClient.invalidateQueries({ queryKey: queryKeys.appLogStats() });
      });
    };

    void setup();

    // Copy ref to local variable for cleanup
    const timeoutMap = newEntryTimeoutRef.current;
    return () => {
      unlisten?.();
      // Clear all pending highlight timeouts
      timeoutMap.forEach((t) => clearTimeout(t));
      timeoutMap.clear();
    };
  }, [liveMode, filters, queryClient]);

  // Export to CSV
  const exportToCsv = useCallback(() => {
    if (!sortedLogs.length) return;

    const headers = ["Timestamp", "Level", "Source", "Target", "Message", "Project ID"];
    const rows = sortedLogs.map((l) => [
      l.created_at,
      l.level,
      l.source,
      l.target || "",
      `"${l.message.replace(/"/g, '""')}"`,
      l.project_id || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedLogs]);

  const handleClearLogs = useCallback(() => {
    clearLogs.mutate(undefined);
  }, [clearLogs]);

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleClearLogs}
          disabled={clearLogs.isPending || !logs?.length}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Logs
        </Button>
        <Button variant="outline" onClick={exportToCsv} disabled={!sortedLogs.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Level Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Level</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="">All Levels</option>
                <option value="error">Error</option>
                <option value="warn">Warn</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
                <option value="trace">Trace</option>
              </select>
            </div>

            {/* Source Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Source</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="">All Sources</option>
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
              </select>
            </div>

            {/* Project Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full p-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
              >
                <option value="">All Logs</option>
                <option value="__system__">System (no project)</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search log messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Bar */}
      {stats && stats.total > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground mr-2">
            {stats.total.toLocaleString()} total
          </span>
          {stats.by_level.map((item) => (
            <Badge
              key={item.level}
              variant="outline"
              className={`text-xs ${LEVEL_STAT_COLORS[item.level] || ""}`}
            >
              {item.level}: {item.count.toLocaleString()}
            </Badge>
          ))}
          <span className="text-muted-foreground mx-1">|</span>
          {stats.by_source.map((item) => (
            <Badge key={item.source} variant="outline" className="text-xs">
              {item.source}: {item.count.toLocaleString()}
            </Badge>
          ))}
        </div>
      )}

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Log Entries</CardTitle>
              <CardDescription>
                {sortedLogs.length} entr{sortedLogs.length !== 1 ? "ies" : "y"} shown
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Live toggle */}
              <Button
                variant={liveMode ? "default" : "outline"}
                size="sm"
                onClick={() => setLiveMode(!liveMode)}
                className="gap-2"
              >
                <Radio
                  className={`h-3 w-3 ${liveMode ? "text-green-400 animate-pulse" : ""}`}
                />
                Live
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSortNewestFirst(!sortNewestFirst)}
                className="gap-2"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortNewestFirst ? "Newest First" : "Oldest First"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-gradient-to-br from-brand-blue/10 to-brand-purple/10 w-fit mx-auto mb-4">
                <ScrollText className="h-12 w-12 text-brand-blue" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No Logs Found</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {debouncedSearch || levelFilter || sourceFilter || projectFilter
                  ? "Try adjusting your filters to see more results"
                  : "Logs will appear here as the application runs"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedLogs.map((log) => (
                <LogEntryRow
                  key={log.id}
                  entry={log}
                  isNew={newEntryIds.has(log.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Full-page logs view (accessible via /logs URL) */
export function LogsPage() {
  return (
    <div className="h-full overflow-auto p-8">
      <PageHeader
        title="Logs"
        description="Application logs from backend tracing and frontend events"
        icon={<ScrollText className="h-6 w-6 text-muted-foreground" />}
      />
      <div className="mt-6">
        <LogsContent />
      </div>
    </div>
  );
}
