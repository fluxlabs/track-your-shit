// Track Your Shit - Project Terminal Tab Component
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useCallback } from 'react';
import {
  Rocket,
  FileText,
  Map,
  Zap,
  Cog,
  Terminal,
  Trash2,
  ChevronDown,
  Plus,
  Minus,
  Gauge,
  Play,
  PauseCircle,
  MessageSquareText,
  FlaskConical,
  ShieldCheck,
  ScanSearch,
  CircleCheck,
  Bug,
  Network,
  BookOpen,
  BarChart3,
  Star,
  HelpCircle,
  Wrench,
  Package,
  ScrollText,
  CirclePlus,
  ListTodo,
  Search,
  PlusCircle,
  MinusCircle,
  Trophy,
  ClipboardList,
  Flag,
  Target,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type TerminalViewRef } from '@/components/terminal';
import { cn } from '@/lib/utils';

import { useScriptFavorites, useToggleScriptFavorite, useAddCommandHistory } from '@/lib/queries';
import { CommandHistoryDropdown } from './command-history-dropdown';
import { SnippetsPanel } from './snippets-panel';
import { AutoCommandsSettings } from './auto-commands-settings';

// Script definition type
interface ScriptDef {
  id: string;
  name: string;
  command: string;
  description: string;
  icon: React.ElementType;
  variant: 'default' | 'outline' | 'secondary';
  group: string;
}

// GSD script definitions
const GSD_SCRIPTS: ScriptDef[] = [
  // --- Planning ---
  { id: 'plan', name: 'Plan Phase', command: '/gsd:plan-phase', description: 'Create detailed execution plan for a phase', icon: FileText, variant: 'outline', group: 'Planning' },
  { id: 'briefing', name: 'Discuss Phase', command: '/gsd:discuss-phase', description: 'Gather phase context through adaptive questioning', icon: MessageSquareText, variant: 'outline', group: 'Planning' },
  { id: 'progress', name: 'Progress', command: '/gsd:progress', description: 'Check project progress and route to next action', icon: Map, variant: 'outline', group: 'Planning' },
  { id: 'research', name: 'Research Phase', command: '/gsd:research-phase', description: 'Research how to implement a phase before planning', icon: Search, variant: 'outline', group: 'Planning' },
  { id: 'assumptions', name: 'Assumptions', command: '/gsd:list-phase-assumptions', description: 'Surface assumptions about phase approach', icon: HelpCircle, variant: 'outline', group: 'Planning' },
  { id: 'add-phase', name: 'Add Phase', command: '/gsd:add-phase', description: 'Add phase to end of current milestone', icon: PlusCircle, variant: 'outline', group: 'Planning' },
  { id: 'insert-phase', name: 'Insert Phase', command: '/gsd:insert-phase', description: 'Insert urgent work between existing phases', icon: CirclePlus, variant: 'outline', group: 'Planning' },
  { id: 'remove-phase', name: 'Remove Phase', command: '/gsd:remove-phase', description: 'Remove a future phase and renumber', icon: MinusCircle, variant: 'outline', group: 'Planning' },
  // --- Execution ---
  { id: 'execute', name: 'Execute Phase', command: '/gsd:execute-phase', description: 'Execute the current phase plan', icon: Rocket, variant: 'outline', group: 'Execution' },
  { id: 'quick', name: 'Quick Task', command: '/gsd:quick', description: 'Execute a small ad-hoc task with GSD guarantees', icon: Gauge, variant: 'outline', group: 'Execution' },
  { id: 'resume', name: 'Resume', command: '/gsd:resume-work', description: 'Resume work from previous session', icon: Play, variant: 'outline', group: 'Execution' },
  { id: 'pause', name: 'Pause', command: '/gsd:pause-work', description: 'Create context handoff for later resume', icon: PauseCircle, variant: 'outline', group: 'Execution' },
  // --- Milestones ---
  { id: 'new-milestone', name: 'New Milestone', command: '/gsd:new-milestone', description: 'Start a new milestone cycle', icon: Flag, variant: 'outline', group: 'Milestones' },
  { id: 'complete-milestone', name: 'Complete Milestone', command: '/gsd:complete-milestone', description: 'Archive completed milestone and prepare for next', icon: Trophy, variant: 'outline', group: 'Milestones' },
  { id: 'audit-milestone', name: 'Audit Milestone', command: '/gsd:audit-milestone', description: 'Audit milestone completion against original intent', icon: ClipboardList, variant: 'outline', group: 'Milestones' },
  { id: 'plan-gaps', name: 'Plan Gaps', command: '/gsd:plan-milestone-gaps', description: 'Create phases to close gaps identified by audit', icon: Target, variant: 'outline', group: 'Milestones' },
  // --- Todos ---
  { id: 'check-todos', name: 'Check Todos', command: '/gsd:check-todos', description: 'List pending todos and select one to work on', icon: ListTodo, variant: 'outline', group: 'Todos' },
  { id: 'add-todo', name: 'Add Todo', command: '/gsd:add-todo', description: 'Capture idea or task from current context', icon: CirclePlus, variant: 'outline', group: 'Todos' },
  // --- Quality (shared AP commands where no GSD equivalent exists) ---
  { id: 'review', name: 'Code Review', command: '/ap:review', description: 'Automated code review with best practices checking', icon: Zap, variant: 'outline', group: 'Quality' },
  { id: 'test', name: 'Test', command: '/ap:test', description: 'Run tests, generate coverage, and gap analysis', icon: FlaskConical, variant: 'outline', group: 'Quality' },
  { id: 'scan', name: 'Scan', command: '/ap:scan', description: 'Unified code analysis: deps, debt, security, performance', icon: ShieldCheck, variant: 'outline', group: 'Quality' },
  { id: 'project-scanner', name: 'Project Scanner', command: 'Run the project-scanner agent on this project', description: 'Full project audit with scorecard, gap analysis, and recommendations', icon: ScanSearch, variant: 'outline', group: 'Quality' },
  { id: 'verify', name: 'Verify', command: '/gsd:verify-work', description: 'Validate built features through conversational UAT', icon: CircleCheck, variant: 'outline', group: 'Quality' },
  { id: 'refactor', name: 'Refactor', command: '/ap:refactor', description: 'Guided refactoring with code smell detection', icon: Wrench, variant: 'outline', group: 'Quality' },
  { id: 'deps', name: 'Dependencies', command: '/ap:deps', description: 'Dependency audit, security scanning, and upgrade planning', icon: Package, variant: 'outline', group: 'Quality' },
  // --- Analysis ---
  { id: 'debug', name: 'Debug', command: '/gsd:debug', description: 'Systematic debugging with persistent state', icon: Bug, variant: 'outline', group: 'Analysis' },
  { id: 'map', name: 'Map Codebase', command: '/gsd:map-codebase', description: 'Analyze codebase with parallel mapper agents', icon: Network, variant: 'outline', group: 'Analysis' },
  { id: 'report', name: 'Report', command: '/ap:report', description: 'Generate comprehensive project health report', icon: BarChart3, variant: 'outline', group: 'Analysis' },
  { id: 'docs', name: 'Docs', command: '/ap:docs', description: 'Generate API docs, architecture guides, and README', icon: BookOpen, variant: 'outline', group: 'Analysis' },
  { id: 'changelog', name: 'Changelog', command: '/ap:changelog', description: 'Generate release notes and changelogs', icon: ScrollText, variant: 'outline', group: 'Analysis' },
  // --- Config ---
  { id: 'settings', name: 'Settings', command: '/gsd:settings', description: 'Configure GSD workflow toggles and model profile', icon: Settings2, variant: 'outline', group: 'Config' },
  { id: 'set-profile', name: 'Set Profile', command: '/gsd:set-profile', description: 'Switch model profile (quality/balanced/budget)', icon: SlidersHorizontal, variant: 'outline', group: 'Config' },
  // --- Custom (always last) ---
  { id: 'custom', name: 'Custom Command', command: '', description: 'Run a custom Claude command', icon: Cog, variant: 'secondary', group: 'Custom' },
];

/** Returns the appropriate script list and panel title based on project type */
function getProjectScripts(hasPlanning: boolean): { scripts: ScriptDef[]; title: string } {
  if (hasPlanning) {
    return { scripts: GSD_SCRIPTS, title: 'GSD Scripts' };
  }
  return { scripts: GSD_SCRIPTS, title: 'Project Scripts' };
}

interface ProjectTerminalTabProps {
  projectId: string;
  terminalRef: React.RefObject<TerminalViewRef>;
  terminalFontSize: number;
  setTerminalFontSize: React.Dispatch<React.SetStateAction<number>>;
  onRunScript: (command: string) => void;
  onClearTerminal: () => void;
  onScrollToBottom: () => void;
  hasPlanning: boolean;
}

export function ProjectTerminalTab({
  projectId,
  terminalRef: _terminalRef,
  terminalFontSize,
  setTerminalFontSize,
  onRunScript,
  onClearTerminal,
  onScrollToBottom,
  hasPlanning,
}: ProjectTerminalTabProps) {
  const [customCommand, setCustomCommand] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);

  const { scripts, title: panelTitle } = getProjectScripts(hasPlanning);

  // Script favorites
  const { data: favorites } = useScriptFavorites(projectId);
  const toggleFavorite = useToggleScriptFavorite();
  const addHistory = useAddCommandHistory();

  const favoriteIds = new Set((favorites ?? []).map((f) => f.script_id));
  const favoriteScripts = scripts.filter((s) => favoriteIds.has(s.id) && s.id !== 'custom');

  const handleRunScript = useCallback(
    (command: string) => {
      // Delegate execution to parent handler (project.tsx)
      onRunScript(command);
      if (command) {
        addHistory.mutate({ projectId, command, source: 'script' });
      }
    },
    [onRunScript, addHistory, projectId],
  );

  const handleRunCustomCommand = () => {
    if (!customCommand.trim()) return;
    setActiveScriptId(null);
    handleRunScript(customCommand.trim());
    setCustomCommand('');
    setShowCustomInput(false);
  };

  const handleHistorySelect = (command: string) => {
    setCustomCommand(command);
    setShowCustomInput(true);
  };

  const handleHistoryExecute = (command: string) => {
    setActiveScriptId(null);
    handleRunScript(command);
  };

  const handleSnippetSelect = (command: string) => {
    setCustomCommand(command);
    setShowCustomInput(true);
  };

  const handleSnippetExecute = (command: string) => {
    setActiveScriptId(null);
    handleRunScript(command);
  };

  const handleToggleFavorite = (scriptId: string) => {
    toggleFavorite.mutate({ projectId, scriptId });
  };

  return (
    <div className="flex gap-6 flex-1 min-h-0">
      {/* Left sidebar — Scripts + Snippets in scrollable column */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto max-h-full">
        {/* Scripts Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Rocket className="h-4 w-4" />
                {panelTitle}
              </span>
              <AutoCommandsSettings projectId={projectId} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {/* Favorites section */}
            {favoriteScripts.length > 0 && (
              <>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  Favorites
                </p>
            {favoriteScripts.map((script) => (
              <Button
                key={`fav-${script.id}`}
                variant={activeScriptId === script.id ? 'default' : 'outline'}
                className={cn(
                  'w-full justify-start gap-2 border-yellow-500/30',
                  activeScriptId === script.id && 'bg-brand-blue text-white border-brand-blue/60'
                )}
                onClick={() => {
                  setActiveScriptId(script.id);
                  handleRunScript(script.command);
                }}
                        title={script.description}
              >
                    <script.icon className="h-4 w-4" />
                    {script.name}
                  </Button>
                ))}
                <div className="mt-2 pt-2 border-t" />
              </>
            )}

            {scripts.map((script, index) => {
              const prevGroup = index > 0 ? scripts[index - 1].group : null;
              const showGroupHeader = script.group !== prevGroup && script.group !== 'Custom';

              const header = showGroupHeader ? (
                <p
                  key={`group-${script.group}`}
                  className={cn(
                    'text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1',
                    index > 0 && 'mt-3 pt-2 border-t',
                  )}
                >
                  {script.group}
                </p>
              ) : null;

              if (script.id === 'custom') {
                return (
                  <div key={script.id}>
                    {index > 0 && <div className="mt-3 pt-2 border-t" />}
                    {showCustomInput ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={customCommand}
                            onChange={(e) => setCustomCommand(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRunCustomCommand()}
                            placeholder="/command or prompt..."
                            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                            autoFocus
                          />
                          <CommandHistoryDropdown
                            projectId={projectId}
                            onSelect={handleHistorySelect}
                            onExecute={handleHistoryExecute}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={handleRunCustomCommand}
                            disabled={!customCommand.trim()}
                          >
                            Run
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setShowCustomInput(false);
                              setCustomCommand('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant={script.variant}
                          className="flex-1 justify-start gap-2"
                          onClick={() => setShowCustomInput(true)}
                        >
                          <script.icon className="h-4 w-4" />
                          {script.name}
                        </Button>
                        <CommandHistoryDropdown
                          projectId={projectId}
                          onSelect={handleHistorySelect}
                          onExecute={handleHistoryExecute}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={script.id}>
                  {header}
                  <div className="group flex items-center">
                     <Button
                       variant={activeScriptId === script.id ? 'default' : script.variant}
                       className={cn(
                         'flex-1 justify-start gap-2',
                         activeScriptId === script.id && 'bg-brand-blue text-white border-brand-blue/60'
                       )}
                       onClick={() => {
                         setActiveScriptId(script.id);
                         handleRunScript(script.command);
                       }}
                title={script.description}
                     >
                      <script.icon className="h-4 w-4" />
                      {script.name}
                    </Button>
                    <button
                      className={cn(
                        'p-1 rounded transition-opacity',
                        favoriteIds.has(script.id)
                          ? 'opacity-100 text-yellow-500'
                          : 'opacity-0 group-hover:opacity-60 text-muted-foreground hover:text-yellow-500',
                      )}
                      onClick={() => handleToggleFavorite(script.id)}
                      title={favoriteIds.has(script.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        className={cn('h-3.5 w-3.5', favoriteIds.has(script.id) && 'fill-yellow-500')}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Snippets Panel */}
        <SnippetsPanel
          projectId={projectId}
          onSelect={handleSnippetSelect}
          onExecute={handleSnippetExecute}
        />
      </div>

      {/* Terminal Panel - fills remaining space */}
      <Card className="flex-1 flex flex-col min-h-0">
        {/* Terminal Controls */}
        <CardHeader className="py-2 flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4" />
              Output
            </CardTitle>
            <div className="flex items-center gap-2">
              {/* Font Size Controls */}
              <div className="flex items-center gap-1 border rounded-md">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setTerminalFontSize((s) => Math.max(8, s - 2))}
                  title="Decrease font size"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-xs w-6 text-center">{terminalFontSize}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setTerminalFontSize((s) => Math.min(24, s + 2))}
                  title="Increase font size"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onScrollToBottom}
                title="Scroll to bottom"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearTerminal}
                title="Clear terminal"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Terminal View - fills remaining height */}
        <CardContent className="flex-1 min-h-0 p-2">
          <div className="h-full relative" />
        </CardContent>
      </Card>
    </div>
  );
}
