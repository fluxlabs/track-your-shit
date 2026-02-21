// Track Your Shit - Terminal Tabs Component
// Multi-tab terminal management with add/close functionality
// Uses global context for persistence across navigation
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlobalTerminals } from "./global-terminals";
import { useTerminalContext } from "@/contexts/terminal-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Plus, X, Terminal, ChevronDown, Play, Minus, Zap, Columns2, Radio, Code } from "lucide-react";
import { SnippetsPanel } from "./snippets-panel";
import { EnvironmentIndicator } from "./environment-indicator";
import { useHotkeys } from "react-hotkeys-hook";

interface TerminalTabsProps {
  /** Project ID for this terminal group */
  projectId: string;
  /** Working directory for all terminals */
  workingDirectory: string;
  /** Additional CSS classes */
  className?: string;
  /** Optional content to render at the start of the tab bar (e.g., project selector) */
  headerSlot?: ReactNode;
}

export function TerminalTabs({ projectId, workingDirectory, className, headerSlot }: TerminalTabsProps) {
  const {
    getProjectTerminals,
    addTab,
    closeTab,
    setActiveTab,
    renameTab,
    registerProject,
    terminalFontSize,
    setTerminalFontSize,
    toggleSplit,
    broadcastMode,
    broadcastTabIds,
    toggleBroadcastMode,
    toggleBroadcastTab,
    isRestored,
  } = useTerminalContext();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [showSnippets, setShowSnippets] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const initialTabCreatedRef = useRef<Set<string>>(new Set());

  // Register project path on mount
  useEffect(() => {
    registerProject(projectId, workingDirectory);
  }, [projectId, workingDirectory, registerProject]);

  // Get terminals from context
  const { tabs, activeTabId } = getProjectTerminals(projectId);

  // Active tab data
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Create initial tab if none exist (wait for session restore to avoid race condition)
  useEffect(() => {
    if (tabs.length === 0 && isRestored && !initialTabCreatedRef.current.has(projectId)) {
      initialTabCreatedRef.current.add(projectId);
      addTab(projectId, "shell");
    }
  }, [tabs.length, projectId, addTab, isRestored]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // Handle adding a tab
  const handleAddTab = useCallback((type: "shell" | "claude" | "yolo") => {
    addTab(projectId, type);
  }, [projectId, addTab]);

  // Handle closing a tab
  const handleCloseTab = useCallback((tabId: string) => {
    closeTab(projectId, tabId);
  }, [projectId, closeTab]);

  // Handle tab selection
  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTab(projectId, tabId);
  }, [projectId, setActiveTab]);

  // Start editing a tab label
  const startEditing = useCallback((tabId: string, currentLabel: string) => {
    setEditingTabId(tabId);
    setEditingLabel(currentLabel);
  }, []);

  // Save the edited label
  const saveLabel = useCallback(() => {
    if (editingTabId && editingLabel.trim()) {
      renameTab(projectId, editingTabId, editingLabel.trim());
    }
    setEditingTabId(null);
    setEditingLabel("");
  }, [projectId, editingTabId, editingLabel, renameTab]);

  // Cancel editing
  const cancelEditing = useCallback(() => {
    setEditingTabId(null);
    setEditingLabel("");
  }, []);

  // Split terminal keyboard shortcut (Ctrl+Shift+\)
  useHotkeys("mod+shift+\\", () => {
    if (activeTabId) {
      toggleSplit(projectId, activeTabId);
    }
  }, { enableOnFormTags: true });

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Tab bar */}
      <div className={cn(
        "flex items-center gap-1 bg-muted/30 border-b px-2 py-1 overflow-x-auto flex-shrink-0",
        broadcastMode && "ring-1 ring-status-error/50 bg-status-error/5"
      )}>
        {/* Optional header slot (e.g., project selector) */}
        {headerSlot && (
          <div className="flex items-center pr-2 mr-1 border-r border-border/30 flex-shrink-0">
            {headerSlot}
          </div>
        )}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-t-md text-sm cursor-pointer transition-colors group min-w-[80px]",
              activeTabId === tab.id
                ? "bg-background border border-b-0 border-border text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => handleSelectTab(tab.id)}
          >
            {broadcastMode && (
              <input
                type="checkbox"
                checked={broadcastTabIds.has(tab.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleBroadcastTab(tab.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-3 w-3 rounded border-muted-foreground flex-shrink-0 accent-red-500"
              />
            )}
            <div className="relative flex-shrink-0">
              <Terminal className="h-3.5 w-3.5" />
              {tab.tmuxSession && (
                <span
                  className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-500"
                  title={`tmux: ${tab.tmuxSession}`}
                />
              )}
            </div>
            {editingTabId === tab.id ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingLabel}
                maxLength={24}
                onChange={(e) => setEditingLabel(e.target.value.slice(0, 24))}
                onBlur={saveLabel}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveLabel();
                  } else if (e.key === "Escape") {
                    cancelEditing();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent border-b border-primary outline-none w-[80px] text-sm"
              />
            ) : (
              <span
                className="truncate max-w-[100px]"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing(tab.id, tab.label);
                }}
                title="Double-click to rename"
              >
                {tab.label}
              </span>
            )}
            {tab.tmuxSession && !tab.isExited && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-500 border-green-500/30">
                tmux
              </Badge>
            )}
            {tab.isExited && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                exited
              </Badge>
            )}
            {tabs.length > 1 && (
              <button
                className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* Add tab dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleAddTab("shell")}>
              <Terminal className="h-4 w-4 mr-2" />
              New Shell
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTab("claude")}>
              <Play className="h-4 w-4 mr-2" />
              Run Claude
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTab("yolo")}>
              <Zap className="h-4 w-4 mr-2 text-yellow-500" />
              Claude YOLO
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Split terminal toggle */}
        {activeTabId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 px-2 text-muted-foreground hover:text-foreground",
                  activeTab?.split && "text-brand-blue"
                )}
                onClick={() => toggleSplit(projectId, activeTabId)}
              >
                <Columns2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {activeTab?.split ? "Close split pane" : "Split terminal"} (Ctrl+Shift+\)
            </TooltipContent>
          </Tooltip>
        )}

        {/* Snippets toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-muted-foreground hover:text-foreground",
                showSnippets && "text-primary bg-primary/10"
              )}
              onClick={() => setShowSnippets((prev) => !prev)}
            >
              <Code className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {showSnippets ? "Hide snippets" : "Show snippets"}
          </TooltipContent>
        </Tooltip>

        {/* Broadcast mode toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2 text-muted-foreground hover:text-foreground",
                broadcastMode && "text-status-error bg-status-error/10"
              )}
              onClick={toggleBroadcastMode}
            >
              <Radio className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {broadcastMode ? "Disable broadcast mode" : "Enable broadcast mode"}
          </TooltipContent>
        </Tooltip>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Environment indicator */}
        <EnvironmentIndicator workingDirectory={workingDirectory} />

        {/* Separator between env indicator and font controls */}
        <div className="w-px h-4 bg-border/30 mx-1" />

        {/* Font size controls */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setTerminalFontSize(terminalFontSize - 1)}
            title="Decrease font size"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="text-[11px] font-mono w-6 text-center select-none">
            {terminalFontSize}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setTerminalFontSize(terminalFontSize + 1)}
            title="Increase font size"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Terminal content */}
      <div className="flex-1 min-h-0 relative flex">
        <div className="flex-1 min-w-0">
          <GlobalTerminals visibleProjectId={projectId} activeTabId={activeTabId} />
        </div>
        {showSnippets && (
          <SnippetsPanel
            projectId={projectId}
            onInsert={() => {}}
            onClose={() => setShowSnippets(false)}
          />
        )}
      </div>
    </div>
  );
}

export default TerminalTabs;
