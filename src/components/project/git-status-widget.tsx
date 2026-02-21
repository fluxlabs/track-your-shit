// Track Your Shit - Git Status Widget (OV-01)
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState } from 'react';
import {
  GitBranch,
  GitCommit,
  RefreshCw,
  Check,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Copy,
  Upload,
  Download,
  CloudDownload,
  Archive,
  ArchiveRestore,
  FileText,
  ChevronDown,
  ChevronRight,
  Loader2,
  Maximize2,
  Plus,
  Minus,
  Tag,
  Globe,
  Undo2,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useGitStatus,
  useGitChangedFiles,
  useGitLog,
  useGitPush,
  useGitPull,
  useGitFetch,
  useGitStageAll,
  useGitCommit,
  useGitStashSave,
  useGitStashPop,
  useGitStageFile,
  useGitUnstageFile,
  useGitDiscardFile,
  useGitRemoteUrl,
  useGitBranches,
  useGitTags,
} from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

type ConfirmAction = 'push' | 'pull' | 'commit' | 'stash' | 'pop' | null;

const confirmConfig: Record<Exclude<ConfirmAction, null>, { title: string; description: string; action: string }> = {
  push: {
    title: 'Push to remote?',
    description: 'This will push your local commits to the remote repository.',
    action: 'Push',
  },
  pull: {
    title: 'Pull from remote?',
    description: 'This will merge remote changes into your local branch. Resolve any conflicts if they arise.',
    action: 'Pull',
  },
  commit: {
    title: 'Commit staged changes?',
    description: 'This will create a new commit with the staged changes.',
    action: 'Commit',
  },
  stash: {
    title: 'Stash changes?',
    description: 'This will stash all uncommitted changes. You can restore them later with Pop.',
    action: 'Stash',
  },
  pop: {
    title: 'Pop stash?',
    description: 'This will restore the most recent stash and apply its changes to your working tree.',
    action: 'Pop',
  },
};

const fileStatusColor = (fileStatus: string) => {
  switch (fileStatus) {
    case 'M': return 'text-status-warning';
    case 'A': return 'text-status-success';
    case 'D': return 'text-status-error';
    case 'R': return 'text-status-info';
    case '??': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
};

interface GitStatusWidgetProps {
  projectPath: string;
}

export function GitStatusWidget({ projectPath }: GitStatusWidgetProps) {
  const { data: status, isLoading } = useGitStatus(projectPath);
  const { data: changedFiles } = useGitChangedFiles(projectPath);
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [showFiles, setShowFiles] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const pushMutation = useGitPush();
  const pullMutation = useGitPull();
  const fetchMutation = useGitFetch();
  const stageAllMutation = useGitStageAll();
  const commitMutation = useGitCommit();
  const stashSaveMutation = useGitStashSave();
  const stashPopMutation = useGitStashPop();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Git Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!status?.has_git) {
    return null;
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) }),
    ]).finally(() => setIsRefreshing(false));
  };

  const handleCopyBranch = () => {
    if (status.branch) {
      void navigator.clipboard.writeText(status.branch);
      toast.success('Branch name copied');
    }
  };

  const executeConfirmedAction = () => {
    switch (confirmAction) {
      case 'push':
        pushMutation.mutate(projectPath);
        break;
      case 'pull':
        pullMutation.mutate(projectPath);
        break;
      case 'commit':
        if (!commitMessage.trim()) return;
        commitMutation.mutate(
          { projectPath, message: commitMessage.trim() },
          { onSuccess: (result) => { if (result.success) setCommitMessage(''); } },
        );
        break;
      case 'stash':
        stashSaveMutation.mutate(projectPath);
        break;
      case 'pop':
        stashPopMutation.mutate(projectPath);
        break;
    }
    setConfirmAction(null);
  };

  const totalChanged = (changedFiles?.length ?? 0);
  const anyMutationPending =
    pushMutation.isPending ||
    pullMutation.isPending ||
    fetchMutation.isPending ||
    stageAllMutation.isPending ||
    commitMutation.isPending ||
    stashSaveMutation.isPending ||
    stashPopMutation.isPending;

  return (
    <TooltipProvider delayDuration={300}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Git Status
            </CardTitle>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setDetailOpen(true)}
                  >
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View full git details</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRefresh}
                disabled={anyMutationPending}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Branch + clean/dirty */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyBranch}
              className="flex items-center gap-1.5 text-sm font-mono hover:text-foreground text-muted-foreground transition-colors"
              title="Click to copy"
            >
              {status.branch}
              <Copy className="h-3 w-3 opacity-50" />
            </button>
            {status.is_dirty ? (
              <Badge variant="warning" size="sm">dirty</Badge>
            ) : (
              <Badge variant="success" size="sm">clean</Badge>
            )}
          </div>

          {/* Ahead/Behind info */}
          {(status.ahead > 0 || status.behind > 0) && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {status.ahead > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  {status.ahead} ahead
                </span>
              )}
              {status.behind > 0 && (
                <span className="flex items-center gap-1">
                  <ArrowDown className="h-3 w-3" />
                  {status.behind} behind
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5">
            {status.ahead > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs gap-1"
                    onClick={() => setConfirmAction('push')}
                    disabled={anyMutationPending}
                  >
                    {pushMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    Push ({status.ahead})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Push commits to remote</TooltipContent>
              </Tooltip>
            )}

            {status.behind > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setConfirmAction('pull')}
                    disabled={anyMutationPending}
                  >
                    {pullMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    Pull ({status.behind})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pull changes from remote</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => fetchMutation.mutate(projectPath)}
                  disabled={anyMutationPending}
                >
                  {fetchMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CloudDownload className="h-3 w-3" />
                  )}
                  Fetch
                </Button>
              </TooltipTrigger>
              <TooltipContent>Fetch remote changes without merging</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => setConfirmAction('stash')}
                  disabled={anyMutationPending || !status.is_dirty}
                >
                  {stashSaveMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Archive className="h-3 w-3" />
                  )}
                  Stash
                </Button>
              </TooltipTrigger>
              <TooltipContent>Stash current changes</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => setConfirmAction('pop')}
                  disabled={anyMutationPending || status.stash_count === 0}
                >
                  {stashPopMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ArchiveRestore className="h-3 w-3" />
                  )}
                  Pop
                  {status.stash_count > 0 && (
                    <Badge variant="secondary" size="sm" className="ml-0.5 h-4 px-1 text-[10px]">
                      {status.stash_count}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pop most recent stash</TooltipContent>
            </Tooltip>
          </div>

          {/* Commit section (only when dirty) */}
          {status.is_dirty && (
            <div className="border-t pt-2 space-y-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {status.staged_count > 0 && (
                  <span className="text-status-success">{status.staged_count} staged</span>
                )}
                {status.unstaged_count > 0 && (
                  <span className="text-status-warning">{status.unstaged_count} unstaged</span>
                )}
                {status.untracked_count > 0 && (
                  <span className="text-status-info">{status.untracked_count} untracked</span>
                )}
              </div>

              {(status.unstaged_count > 0 || status.untracked_count > 0) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1 w-full"
                      onClick={() => stageAllMutation.mutate(projectPath)}
                      disabled={anyMutationPending}
                    >
                      {stageAllMutation.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Stage All
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stage all changes (git add -A)</TooltipContent>
                </Tooltip>
              )}

              {status.staged_count > 0 && (
                <div className="flex gap-1.5">
                  <Input
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Commit message..."
                    className="h-7 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (commitMessage.trim()) setConfirmAction('commit');
                      }
                    }}
                    disabled={anyMutationPending}
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs px-3"
                        onClick={() => setConfirmAction('commit')}
                        disabled={anyMutationPending || !commitMessage.trim()}
                      >
                        {commitMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Commit'
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Commit staged changes</TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          )}

          {/* Changed files (expandable) */}
          {totalChanged > 0 && (
            <div className="border-t pt-2">
              <button
                onClick={() => setShowFiles(!showFiles)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                {showFiles ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <FileText className="h-3 w-3" />
                {totalChanged} changed file{totalChanged !== 1 && 's'}
              </button>
              {showFiles && changedFiles && (
                <div className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                  {changedFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center gap-2 text-xs font-mono py-0.5"
                    >
                      <span className={`w-5 text-center font-bold ${fileStatusColor(file.status)}`}>
                        {file.status}
                      </span>
                      <span className="text-muted-foreground truncate" title={file.path}>
                        {file.path}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Last commit */}
          {status.last_commit && (
            <div className="border-t pt-2">
              <div className="flex items-start gap-2">
                {status.is_dirty ? (
                  <AlertCircle className="h-3.5 w-3.5 text-status-warning mt-0.5 flex-shrink-0" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-status-success mt-0.5 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    <span className="font-mono">{status.last_commit.hash}</span>
                    {' \u2014 '}
                    {status.last_commit.message}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {status.last_commit.author} &middot; {formatRelativeTime(status.last_commit.date)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction && confirmConfig[confirmAction].title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && confirmConfig[confirmAction].description}
              {confirmAction === 'commit' && commitMessage.trim() && (
                <>
                  <br />
                  <span className="font-mono text-foreground mt-1 block">
                    &ldquo;{commitMessage.trim()}&rdquo;
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmedAction}>
              {confirmAction && confirmConfig[confirmAction].action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail pop-out dialog */}
      <GitDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        projectPath={projectPath}
        status={status}
        changedFiles={changedFiles ?? []}
      />
    </TooltipProvider>
  );
}

// ─── Detail Dialog ───────────────────────────────────────────────────────────

interface GitDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  status: NonNullable<ReturnType<typeof useGitStatus>['data']>;
  changedFiles: { path: string; status: string; staged: boolean }[];
}

function GitDetailDialog({ open, onOpenChange, projectPath, status, changedFiles }: GitDetailDialogProps) {
  const { data: logEntries, isLoading: logLoading } = useGitLog(projectPath, 30, open);
  const { data: remoteUrl } = useGitRemoteUrl(projectPath, open);
  const { data: branches } = useGitBranches(projectPath, open);
  const { data: tags } = useGitTags(projectPath, open);
  const queryClient = useQueryClient();

  const [commitMessage, setCommitMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const pushMutation = useGitPush();
  const pullMutation = useGitPull();
  const fetchMutation = useGitFetch();
  const stageAllMutation = useGitStageAll();
  const commitMutation = useGitCommit();
  const stashSaveMutation = useGitStashSave();
  const stashPopMutation = useGitStashPop();
  const stageFileMutation = useGitStageFile();
  const unstageFileMutation = useGitUnstageFile();
  const discardFileMutation = useGitDiscardFile();

  const anyMutationPending =
    pushMutation.isPending || pullMutation.isPending || fetchMutation.isPending ||
    stageAllMutation.isPending || commitMutation.isPending ||
    stashSaveMutation.isPending || stashPopMutation.isPending ||
    stageFileMutation.isPending || unstageFileMutation.isPending || discardFileMutation.isPending;

  const stagedFiles = changedFiles.filter((f) => f.staged);
  const unstagedFiles = changedFiles.filter((f) => !f.staged && f.status !== '??');
  const untrackedFiles = changedFiles.filter((f) => f.status === '??');

  const handleRefresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.gitStatus(projectPath) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.gitChangedFiles(projectPath) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.gitLog(projectPath, 30) }),
    ]);
  };

  const executeConfirmedAction = () => {
    switch (confirmAction) {
      case 'push':
        pushMutation.mutate(projectPath);
        break;
      case 'pull':
        pullMutation.mutate(projectPath);
        break;
      case 'commit':
        if (!commitMessage.trim()) return;
        commitMutation.mutate(
          { projectPath, message: commitMessage.trim() },
          { onSuccess: (result) => { if (result.success) setCommitMessage(''); } },
        );
        break;
      case 'stash':
        stashSaveMutation.mutate(projectPath);
        break;
      case 'pop':
        stashPopMutation.mutate(projectPath);
        break;
    }
    setConfirmAction(null);
  };

  const copyText = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Git Details
              </DialogTitle>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleRefresh}>
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
            <DialogDescription className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => copyText(status.branch ?? '', 'Branch name')}
                className="inline-flex items-center gap-1 font-mono font-medium text-foreground hover:text-foreground/80 transition-colors"
              >
                {status.branch}
                <Copy className="h-3 w-3 opacity-50" />
              </button>
              <span>{status.is_dirty ? 'working tree has changes' : 'clean working tree'}</span>
              {remoteUrl && (
                <span className="inline-flex items-center gap-1 text-xs">
                  <Globe className="h-3 w-3" />
                  <span className="font-mono truncate max-w-[300px]" title={remoteUrl}>{remoteUrl}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
            <TabsList className="flex-shrink-0 w-full justify-start">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="files">
                Files
                {changedFiles.length > 0 && (
                  <Badge variant="secondary" size="sm" className="ml-1.5 h-4 px-1 text-[10px]">
                    {changedFiles.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="branches">Branches &amp; Tags</TabsTrigger>
            </TabsList>

            {/* ─── Overview Tab ────────────────────────────── */}
            <TabsContent value="overview">
              <div className="overflow-y-auto flex-1 min-h-0 space-y-5 pr-1">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <StatCard label="Ahead" value={status.ahead} icon={<ArrowUp className="h-3.5 w-3.5" />} color="text-status-info" />
                  <StatCard label="Behind" value={status.behind} icon={<ArrowDown className="h-3.5 w-3.5" />} color="text-status-warning" />
                  <StatCard label="Staged" value={status.staged_count} icon={<Check className="h-3.5 w-3.5" />} color="text-status-success" />
                  <StatCard label="Changed" value={changedFiles.length} icon={<FileText className="h-3.5 w-3.5" />} color={changedFiles.length > 0 ? 'text-status-warning' : 'text-muted-foreground'} />
                  <StatCard label="Stashes" value={status.stash_count} icon={<Archive className="h-3.5 w-3.5" />} color="text-muted-foreground" />
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Actions</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant={status.ahead > 0 ? 'default' : 'outline'} className="h-8 text-xs gap-1.5" onClick={() => setConfirmAction('push')} disabled={anyMutationPending || status.ahead === 0}>
                      {pushMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Push {status.ahead > 0 && `(${status.ahead})`}
                    </Button>
                    <Button size="sm" variant={status.behind > 0 ? 'default' : 'outline'} className="h-8 text-xs gap-1.5" onClick={() => setConfirmAction('pull')} disabled={anyMutationPending || status.behind === 0}>
                      {pullMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      Pull {status.behind > 0 && `(${status.behind})`}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => fetchMutation.mutate(projectPath)} disabled={anyMutationPending}>
                      {fetchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudDownload className="h-3.5 w-3.5" />}
                      Fetch
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => stageAllMutation.mutate(projectPath)} disabled={anyMutationPending || (!status.unstaged_count && !status.untracked_count)}>
                      {stageAllMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Stage All
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setConfirmAction('stash')} disabled={anyMutationPending || !status.is_dirty}>
                      {stashSaveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                      Stash
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setConfirmAction('pop')} disabled={anyMutationPending || status.stash_count === 0}>
                      {stashPopMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
                      Pop {status.stash_count > 0 && `(${status.stash_count})`}
                    </Button>
                  </div>
                </div>

                {/* Commit section */}
                {status.staged_count > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Commit ({status.staged_count} staged)</h3>
                    <div className="flex gap-2">
                      <Input
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        placeholder="Commit message..."
                        className="h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && commitMessage.trim()) {
                            e.preventDefault();
                            setConfirmAction('commit');
                          }
                        }}
                        disabled={anyMutationPending}
                      />
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs px-4 gap-1.5"
                        onClick={() => setConfirmAction('commit')}
                        disabled={anyMutationPending || !commitMessage.trim()}
                      >
                        {commitMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCommit className="h-3.5 w-3.5" />}
                        Commit
                      </Button>
                    </div>
                  </div>
                )}

                {/* Last commit */}
                {status.last_commit && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Last Commit</h3>
                    <div className="flex items-start gap-3 p-3 rounded-md border">
                      <GitCommit className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{status.last_commit.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            onClick={() => copyText(status.last_commit!.hash, 'Commit hash')}
                            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                          >
                            {status.last_commit.hash}
                            <Copy className="h-2.5 w-2.5 opacity-50" />
                          </button>
                          <span className="text-[11px] text-muted-foreground">
                            {status.last_commit.author} &middot; {formatRelativeTime(status.last_commit.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ─── Files Tab ──────────────────────────────── */}
            <TabsContent value="files">
              <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">
                {changedFiles.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    <Check className="h-8 w-8 mx-auto mb-2 text-status-success" />
                    No changed files — working tree is clean
                  </div>
                ) : (
                  <>
                    {stagedFiles.length > 0 && (
                      <FileGroupActions
                        label="Staged"
                        count={stagedFiles.length}
                        color="text-status-success"
                        files={stagedFiles}
                        projectPath={projectPath}
                        onUnstage={(fp) => unstageFileMutation.mutate({ projectPath, filePath: fp })}
                        disabled={anyMutationPending}
                        mode="staged"
                      />
                    )}
                    {unstagedFiles.length > 0 && (
                      <FileGroupActions
                        label="Unstaged"
                        count={unstagedFiles.length}
                        color="text-status-warning"
                        files={unstagedFiles}
                        projectPath={projectPath}
                        onStage={(fp) => stageFileMutation.mutate({ projectPath, filePath: fp })}
                        onDiscard={(fp) => discardFileMutation.mutate({ projectPath, filePath: fp })}
                        disabled={anyMutationPending}
                        mode="unstaged"
                      />
                    )}
                    {untrackedFiles.length > 0 && (
                      <FileGroupActions
                        label="Untracked"
                        count={untrackedFiles.length}
                        color="text-status-info"
                        files={untrackedFiles}
                        projectPath={projectPath}
                        onStage={(fp) => stageFileMutation.mutate({ projectPath, filePath: fp })}
                        disabled={anyMutationPending}
                        mode="untracked"
                      />
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* ─── History Tab ────────────────────────────── */}
            <TabsContent value="history">
              <div className="overflow-y-auto flex-1 min-h-0 pr-1">
                {logLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : logEntries && logEntries.length > 0 ? (
                  <div className="space-y-0.5">
                    {logEntries.map((entry) => (
                      <div
                        key={entry.hash}
                        className="flex items-start gap-3 py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors group"
                      >
                        <GitCommit className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => copyText(entry.hash, 'Hash')}
                              className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 inline-flex items-center gap-1"
                            >
                              {entry.short_hash}
                              <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </button>
                            <p className="text-sm truncate">{entry.message}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              {entry.author} &middot; {formatRelativeTime(entry.date)}
                            </span>
                            {entry.files_changed > 0 && (
                              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span>{entry.files_changed} file{entry.files_changed !== 1 && 's'}</span>
                                {entry.insertions > 0 && (
                                  <span className="flex items-center gap-0.5 text-status-success">
                                    <Plus className="h-2.5 w-2.5" />{entry.insertions}
                                  </span>
                                )}
                                {entry.deletions > 0 && (
                                  <span className="flex items-center gap-0.5 text-status-error">
                                    <Minus className="h-2.5 w-2.5" />{entry.deletions}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-8 text-sm text-muted-foreground">No commits found</p>
                )}
              </div>
            </TabsContent>

            {/* ─── Branches & Tags Tab ────────────────────── */}
            <TabsContent value="branches">
              <div className="overflow-y-auto flex-1 min-h-0 pr-1 space-y-5">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Branches ({branches?.length ?? 0})
                  </h3>
                  {branches && branches.length > 0 ? (
                    <div className="rounded-md border divide-y">
                      {branches.map((branch) => (
                        <div key={branch} className="flex items-center gap-2 px-3 py-2 text-sm font-mono">
                          {branch === status.branch ? (
                            <Badge variant="success" size="sm" className="text-[10px]">current</Badge>
                          ) : (
                            <span className="w-[52px]" />
                          )}
                          <span className={branch === status.branch ? 'font-semibold' : 'text-muted-foreground'}>{branch}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No branches found</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Tags ({tags?.length ?? 0})
                  </h3>
                  {tags && tags.length > 0 ? (
                    <div className="rounded-md border divide-y">
                      {tags.map((tag) => (
                        <div key={tag} className="flex items-center gap-2 px-3 py-2 text-sm font-mono text-muted-foreground">
                          <Tag className="h-3 w-3 flex-shrink-0" />
                          {tag}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No tags found</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirm dialog for actions within detail dialog */}
      <AlertDialog open={confirmAction !== null} onOpenChange={(o) => { if (!o) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction && confirmConfig[confirmAction].title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction && confirmConfig[confirmAction].description}
              {confirmAction === 'commit' && commitMessage.trim() && (
                <>
                  <br />
                  <span className="font-mono text-foreground mt-1 block">&ldquo;{commitMessage.trim()}&rdquo;</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeConfirmedAction}>
              {confirmAction && confirmConfig[confirmAction].action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className={`flex items-center gap-1.5 text-xs ${color}`}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

interface FileGroupActionsProps {
  label: string;
  count: number;
  color: string;
  files: { path: string; status: string }[];
  projectPath: string;
  onStage?: (filePath: string) => void;
  onUnstage?: (filePath: string) => void;
  onDiscard?: (filePath: string) => void;
  disabled: boolean;
  mode: 'staged' | 'unstaged' | 'untracked';
}

function FileGroupActions({ label, count, color, files, onStage, onUnstage, onDiscard, disabled, mode }: FileGroupActionsProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${color} hover:opacity-80 transition-opacity`}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label} ({count})
      </button>
      {expanded && (
        <div className="rounded-md border divide-y">
          {files.map((file) => (
            <div key={file.path} className="flex items-center gap-2 px-3 py-1.5 text-xs font-mono group">
              <span className={`w-5 text-center font-bold flex-shrink-0 ${fileStatusColor(file.status)}`}>
                {file.status}
              </span>
              <span className="text-muted-foreground truncate flex-1" title={file.path}>
                {file.path}
              </span>
              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {mode === 'staged' && onUnstage && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onUnstage(file.path)} disabled={disabled}>
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Unstage</TooltipContent>
                  </Tooltip>
                )}
                {(mode === 'unstaged' || mode === 'untracked') && onStage && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onStage(file.path)} disabled={disabled}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Stage</TooltipContent>
                  </Tooltip>
                )}
                {mode === 'unstaged' && onDiscard && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-status-error hover:text-status-error" onClick={() => onDiscard(file.path)} disabled={disabled}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Discard changes</TooltipContent>
                  </Tooltip>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
