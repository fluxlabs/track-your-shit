// Track Your Shit - GSD Debug Sessions Tab
// Viewer for GSD debug sessions
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  Bug,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGsdDebugSessions } from '@/lib/queries';
import { cn } from '@/lib/utils';

interface GsdDebugTabProps {
  projectId: string;
}

export function GsdDebugTab({ projectId }: GsdDebugTabProps) {
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: sessions, isLoading } = useGsdDebugSessions(projectId);

  const filteredSessions = (sessions ?? []).filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'active') return s.status !== 'resolved';
    if (filter === 'resolved') return s.status === 'resolved';
    return true;
  });

  const activeCount = (sessions ?? []).filter(
    (s) => s.status !== 'resolved'
  ).length;
  const resolvedCount = (sessions ?? []).filter(
    (s) => s.status === 'resolved'
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading debug sessions...
      </div>
    );
  }

  if ((sessions ?? []).length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bug className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No debug sessions found</p>
          <p className="text-xs mt-1">
            Debug sessions are created by GSD&apos;s /gsd:debug command
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <Badge variant="warning">
              <Clock className="h-3 w-3 mr-1" />
              {activeCount} active
            </Badge>
          )}
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {resolvedCount} resolved
          </Badge>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Sessions list */}
      <div className="space-y-2">
        {filteredSessions.map((session) => {
          const isExpanded = expandedId === session.id;
          const isResolved = session.status === 'resolved';

          return (
            <Card
              key={session.id}
              className={cn(isResolved && 'opacity-75')}
            >
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-3"
                onClick={() =>
                  setExpandedId(isExpanded ? null : session.id)
                }
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}

                <Bug
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    isResolved
                      ? 'text-status-success'
                      : 'text-status-error'
                  )}
                />

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">
                    {session.title}
                  </span>
                  {session.error_type && (
                    <span className="text-xs text-muted-foreground">
                      {session.error_type}
                    </span>
                  )}
                </div>

                <Badge
                  variant={isResolved ? 'success' : 'warning'}
                  size="sm"
                >
                  {session.status}
                </Badge>
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 space-y-3">
                  {session.summary && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Summary
                      </p>
                      <p className="text-sm whitespace-pre-wrap">
                        {session.summary}
                      </p>
                    </div>
                  )}

                  {session.resolution && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Resolution
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-status-success">
                        {session.resolution}
                      </p>
                    </div>
                  )}

                  {session.source_file && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      {session.source_file}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {session.created_at && (
                      <span>
                        Created: {new Date(session.created_at).toLocaleDateString()}
                      </span>
                    )}
                    {session.resolved_at && (
                      <span>
                        Resolved: {new Date(session.resolved_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
