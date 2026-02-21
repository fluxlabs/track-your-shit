// Track Your Shit - Terminal Context
// Global state for persistent terminal sessions across navigation
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import {
  saveTerminalSessions,
  restoreTerminalSessions,
  SaveTerminalSessionInput,
  ptyWrite,
} from "@/lib/tauri";
import { clearTerminalCache } from "@/components/terminal/interactive-terminal";

interface TerminalTab {
  id: string;
  label: string;
  command?: string;
  isExited: boolean;
  exitCode: number | null;
  /** PTY session ID for reconnection */
  sessionId: string | null;
  /** tmux session name for persistent reconnection */
  tmuxSession: string | null;
  /** Whether this tab is split into two panes */
  split: boolean;
  /** PTY session ID for the split pane */
  splitSessionId: string | null;
  /** Command for split pane (undefined = shell) */
  splitCommand?: string;
  /** Whether the split pane process has exited */
  splitIsExited: boolean;
  /** Exit code of the split pane process */
  splitExitCode: number | null;
}

interface ProjectTerminals {
  tabs: TerminalTab[];
  activeTabId: string;
}

interface TerminalContextValue {
  /** Get terminals for a specific project */
  getProjectTerminals: (projectId: string) => ProjectTerminals;
  /** Add a new terminal tab to a project */
  addTab: (projectId: string, type: "shell" | "claude" | "yolo") => string;
  /** Close a terminal tab */
  closeTab: (projectId: string, tabId: string) => void;
  /** Set the active tab for a project */
  setActiveTab: (projectId: string, tabId: string) => void;
  /** Rename a terminal tab */
  renameTab: (projectId: string, tabId: string, newLabel: string) => void;
  /** Mark a tab as exited */
  setTabExited: (projectId: string, tabId: string, exitCode: number | null) => void;
  /** Mark a tab as ready (running) */
  setTabReady: (projectId: string, tabId: string) => void;
  /** Check if a project has any terminals */
  hasTerminals: (projectId: string) => boolean;
  /** Set the PTY session ID for a tab */
  setTabSessionId: (projectId: string, tabId: string, sessionId: string | null) => void;
  /** Set the tmux session name for a tab */
  setTabTmuxSession: (projectId: string, tabId: string, tmuxSession: string | null) => void;
  /** Register a project's working directory */
  registerProject: (projectId: string, workingDirectory: string) => void;
  /** Get all registered project paths */
  getProjectPaths: () => Map<string, string>;
  /** Get all terminals data for GlobalTerminals rendering */
  getAllTerminals: () => Map<string, ProjectTerminals>;
  /** Global terminal font size */
  terminalFontSize: number;
  /** Set global terminal font size */
  setTerminalFontSize: (size: number) => void;

  // Persistent shell panel state
  /** Project ID for the persistent shell panel */
  shellProjectId: string | null;
  /** Project path for the persistent shell panel */
  shellProjectPath: string | null;
  /** Set the persistent shell panel project */
  setShellProject: (id: string | null, path: string | null) => void;
  /** Whether the persistent shell panel is collapsed */
  shellPanelCollapsed: boolean;
  /** Toggle the shell panel collapsed state */
  setShellPanelCollapsed: (collapsed: boolean) => void;

  // Split terminal (TM-04)
  /** Toggle split pane for a tab */
  toggleSplit: (projectId: string, tabId: string) => void;
  /** Set the PTY session ID for the split pane */
  setSplitSessionId: (projectId: string, tabId: string, sessionId: string | null) => void;
  /** Mark the split pane as exited */
  setSplitExited: (projectId: string, tabId: string, exitCode: number | null) => void;

  // SH-05: Broadcast mode
  /** Whether broadcast mode is active */
  broadcastMode: boolean;
  /** Set of tab IDs participating in broadcast */
  broadcastTabIds: Set<string>;
  /** Toggle broadcast mode on/off */
  toggleBroadcastMode: () => void;
  /** Toggle a specific tab in/out of broadcast set */
  toggleBroadcastTab: (tabId: string) => void;
  /** Write data to all broadcast-participating tabs */
  broadcastWrite: (data: string) => void;

  /** Whether terminal session restore has completed */
  isRestored: boolean;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  // Global terminal font size
  const [terminalFontSize, setTerminalFontSize] = useState(14);
  // Map of projectId -> ProjectTerminals
  const [terminals, setTerminals] = useState<Map<string, ProjectTerminals>>(new Map());
  // Map of projectId -> working directory path
  const [projectPaths, setProjectPaths] = useState<Map<string, string>>(new Map());
  // Persistent shell panel state
  const [shellProjectId, setShellProjectId] = useState<string | null>(null);
  const [shellProjectPath, setShellProjectPath] = useState<string | null>(null);
  const [shellPanelCollapsed, setShellPanelCollapsed] = useState(() => {
    const stored = localStorage.getItem("shell-panel-collapsed");
    return stored === null ? true : stored === "true";
  });
  // Persist shell panel collapsed preference
  useEffect(() => {
    localStorage.setItem("shell-panel-collapsed", String(shellPanelCollapsed));
  }, [shellPanelCollapsed]);

  // SH-05: Broadcast mode state
  const [broadcastMode, setBroadcastMode] = useState(false);
  const [broadcastTabIds, setBroadcastTabIds] = useState<Set<string>>(new Set());

  // Whether session restore has run
  const restoredRef = useRef(false);
  const [isRestored, setIsRestored] = useState(false);

  // ============================================================
  // SH-03: Restore terminal sessions on mount
  // ============================================================
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    restoreTerminalSessions()
      .then((sessions) => {
        if (sessions.length === 0) return;

        // Collect paths to restore (outside setTerminals to avoid setState-in-setState)
        const pathsToRestore = new Map<string, string>();
        for (const session of sessions) {
          if (!pathsToRestore.has(session.project_id)) {
            pathsToRestore.set(session.project_id, session.working_directory);
          }
        }

        // Restore project paths first
        if (pathsToRestore.size > 0) {
          setProjectPaths((prev) => {
            const newPaths = new Map(prev);
            for (const [pid, dir] of pathsToRestore) {
              if (!newPaths.has(pid)) {
                newPaths.set(pid, dir);
              }
            }
            return newPaths;
          });
        }

        // Then restore terminal tabs
        setTerminals((prev) => {
          const newMap = new Map(prev);

          // Group sessions by project_id
          const grouped = new Map<string, typeof sessions>();
          for (const session of sessions) {
            const list = grouped.get(session.project_id) || [];
            list.push(session);
            grouped.set(session.project_id, list);
          }

          for (const [projectId, projectSessions] of grouped) {
            // Skip projects that already have tabs
            if (newMap.has(projectId) && newMap.get(projectId)!.tabs.length > 0) continue;

            const tabs: TerminalTab[] = projectSessions.map((s) => ({
              id: crypto.randomUUID(),
              label: s.tab_name,
              command: tabTypeToCommand(s.tab_type),
              isExited: false,
              exitCode: null,
              sessionId: null, // Fresh PTY on restore (tmux reattach happens in InteractiveTerminal)
              tmuxSession: s.tmux_session ?? null,
              split: false,
              splitSessionId: null,
              splitIsExited: false,
              splitExitCode: null,
            }));

            newMap.set(projectId, {
              tabs,
              activeTabId: tabs[0]?.id ?? "",
            });
          }

          return newMap;
        });
      })
      .catch(() => {
        // Silently fail - not critical
      })
      .finally(() => {
        setIsRestored(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // SH-03: Auto-save sessions (debounced 5s)
  // ============================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      const sessions: SaveTerminalSessionInput[] = [];
      let sortOrder = 0;

      terminals.forEach((projectTerminals, projectId) => {
        const workDir = projectPaths.get(projectId);
        if (!workDir) return;

        for (const tab of projectTerminals.tabs) {
          if (tab.isExited) continue;
          sessions.push({
            project_id: projectId,
            tab_name: tab.label,
            tab_type: commandToTabType(tab.command),
            working_directory: workDir,
            sort_order: sortOrder++,
            tmux_session: tab.tmuxSession ?? undefined,
          });
        }
      });

      saveTerminalSessions(sessions).catch(() => {
        // Silently fail
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [terminals, projectPaths]);

  // Backup save on window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessions: SaveTerminalSessionInput[] = [];
      let sortOrder = 0;

      terminals.forEach((projectTerminals, projectId) => {
        const workDir = projectPaths.get(projectId);
        if (!workDir) return;

        for (const tab of projectTerminals.tabs) {
          if (tab.isExited) continue;
          sessions.push({
            project_id: projectId,
            tab_name: tab.label,
            tab_type: commandToTabType(tab.command),
            working_directory: workDir,
            sort_order: sortOrder++,
            tmux_session: tab.tmuxSession ?? undefined,
          });
        }
      });

      // Fire-and-forget on unload
      saveTerminalSessions(sessions).catch(() => {});
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [terminals, projectPaths]);

  // Clamp font size to reasonable range
  const handleSetTerminalFontSize = useCallback((size: number) => {
    setTerminalFontSize(Math.min(32, Math.max(8, size)));
  }, []);

  // Get terminals for a project, creating default if none exist
  const getProjectTerminals = useCallback((projectId: string): ProjectTerminals => {
    const existing = terminals.get(projectId);
    if (existing) {
      return existing;
    }
    return {
      tabs: [],
      activeTabId: "",
    };
  }, [terminals]);

  // Add a new tab to a project
  const addTab = useCallback((projectId: string, type: "shell" | "claude" | "yolo"): string => {
    const tabId = crypto.randomUUID();
    const labelMap = { shell: "Shell", claude: "Claude", yolo: "Claude YOLO" };
    const commandMap: Record<string, string | undefined> = {
      shell: undefined,
      claude: "claude",
      yolo: "claude --dangerously-skip-permissions",
    };
    const newTab: TerminalTab = {
      id: tabId,
      label: labelMap[type],
      command: commandMap[type],
      isExited: false,
      exitCode: null,
      sessionId: null,
      tmuxSession: null,
      split: false,
      splitSessionId: null,
      splitIsExited: false,
      splitExitCode: null,
    };

    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (existing) {
        newMap.set(projectId, {
          tabs: [...existing.tabs, newTab],
          activeTabId: tabId,
        });
      } else {
        newMap.set(projectId, {
          tabs: [newTab],
          activeTabId: tabId,
        });
      }

      return newMap;
    });

    return tabId;
  }, []);

  // Close a tab
  const closeTab = useCallback((projectId: string, tabId: string) => {
    // Clean up cached terminal instances for this tab
    clearTerminalCache(`${projectId}:${tabId}`);
    clearTerminalCache(`${projectId}:${tabId}:split`);

    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      const newTabs = existing.tabs.filter((t) => t.id !== tabId);

      if (newTabs.length === 0) {
        newMap.delete(projectId);
        return newMap;
      }

      let newActiveTabId = existing.activeTabId;
      if (existing.activeTabId === tabId) {
        newActiveTabId = newTabs[newTabs.length - 1].id;
      }

      newMap.set(projectId, {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      });

      return newMap;
    });
  }, []);

  // Set active tab
  const setActiveTab = useCallback((projectId: string, tabId: string) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        activeTabId: tabId,
      });

      return newMap;
    });
  }, []);

  // Rename a tab
  const renameTab = useCallback((projectId: string, tabId: string, newLabel: string) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId ? { ...t, label: newLabel } : t
        ),
      });

      return newMap;
    });
  }, []);

  // Mark tab as exited
  const setTabExited = useCallback((projectId: string, tabId: string, exitCode: number | null) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId ? { ...t, isExited: true, exitCode } : t
        ),
      });

      return newMap;
    });
  }, []);

  // Mark tab as ready
  const setTabReady = useCallback((projectId: string, tabId: string) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId ? { ...t, isExited: false, exitCode: null } : t
        ),
      });

      return newMap;
    });
  }, []);

  // Check if project has terminals
  const hasTerminals = useCallback((projectId: string): boolean => {
    const existing = terminals.get(projectId);
    return existing ? existing.tabs.length > 0 : false;
  }, [terminals]);

  // Register a project's working directory
  const registerProject = useCallback((projectId: string, workingDirectory: string) => {
    setProjectPaths((prev) => {
      if (prev.get(projectId) === workingDirectory) {
        return prev;
      }
      const newMap = new Map(prev);
      newMap.set(projectId, workingDirectory);
      return newMap;
    });
  }, []);

  // Get all project paths
  const getProjectPaths = useCallback(() => projectPaths, [projectPaths]);

  // Get all terminals data
  const getAllTerminals = useCallback(() => terminals, [terminals]);

  // Set PTY session ID for a tab
  const setTabSessionId = useCallback((projectId: string, tabId: string, sessionId: string | null) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId ? { ...t, sessionId } : t
        ),
      });

      return newMap;
    });
  }, []);

  // Helper: build save payload from current state and trigger immediate save
  const saveSessionsNow = useCallback((currentTerminals: Map<string, ProjectTerminals>, currentPaths: Map<string, string>) => {
    const sessions: SaveTerminalSessionInput[] = [];
    let sortOrder = 0;

    currentTerminals.forEach((projectTerminals, projectId) => {
      const workDir = currentPaths.get(projectId);
      if (!workDir) return;

      for (const tab of projectTerminals.tabs) {
        if (tab.isExited) continue;
        sessions.push({
          project_id: projectId,
          tab_name: tab.label,
          tab_type: commandToTabType(tab.command),
          working_directory: workDir,
          sort_order: sortOrder++,
          tmux_session: tab.tmuxSession ?? undefined,
        });
      }
    });

    saveTerminalSessions(sessions).catch(() => {});
  }, []);

  // Set tmux session name for a tab (with immediate save for orphan-cleanup safety)
  const setTabTmuxSession = useCallback((projectId: string, tabId: string, tmuxSession: string | null) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId ? { ...t, tmuxSession } : t
        ),
      });

      // Immediately save when a tmux session is attached so DB stays in sync
      // (protects against orphan cleanup killing valid sessions on next startup)
      if (tmuxSession) {
        saveSessionsNow(newMap, projectPaths);
      }

      return newMap;
    });
  }, [projectPaths, saveSessionsNow]);

  // ============================================================
  // TM-04: Split terminal methods
  // ============================================================

  const toggleSplit = useCallback((projectId: string, tabId: string) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId
            ? {
                ...t,
                split: !t.split,
                splitSessionId: t.split ? null : t.splitSessionId,
                splitIsExited: t.split ? false : t.splitIsExited,
                splitExitCode: t.split ? null : t.splitExitCode,
              }
            : t
        ),
      });

      return newMap;
    });
  }, []);

  const setSplitSessionId = useCallback((projectId: string, tabId: string, sessionId: string | null) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId ? { ...t, splitSessionId: sessionId } : t
        ),
      });

      return newMap;
    });
  }, []);

  const setSplitExited = useCallback((projectId: string, tabId: string, exitCode: number | null) => {
    setTerminals((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(projectId);

      if (!existing) return prev;

      newMap.set(projectId, {
        ...existing,
        tabs: existing.tabs.map((t) =>
          t.id === tabId ? { ...t, splitIsExited: true, splitExitCode: exitCode } : t
        ),
      });

      return newMap;
    });
  }, []);

  // ============================================================
  // SH-05: Broadcast mode methods
  // ============================================================

  const toggleBroadcastMode = useCallback(() => {
    setBroadcastMode((prev) => {
      if (prev) {
        // Turning off — clear participating tabs
        setBroadcastTabIds(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleBroadcastTab = useCallback((tabId: string) => {
    setBroadcastTabIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  }, []);

  const broadcastWrite = useCallback(
    (data: string) => {
      const encoder = new TextEncoder();
      const encoded = encoder.encode(data);
      // Write to all participating tabs that have active sessions
      terminals.forEach((projectTerminals) => {
        for (const tab of projectTerminals.tabs) {
          if (broadcastTabIds.has(tab.id) && tab.sessionId && !tab.isExited) {
            ptyWrite(tab.sessionId, encoded).catch(() => {
              // Silently fail for individual tabs
            });
          }
        }
      });
    },
    [terminals, broadcastTabIds],
  );

  // Set the persistent shell panel project
  const setShellProject = useCallback((id: string | null, path: string | null) => {
    setShellProjectId(id);
    setShellProjectPath(path);
  }, []);

  const value: TerminalContextValue = {
    getProjectTerminals,
    addTab,
    closeTab,
    setActiveTab,
    renameTab,
    setTabExited,
    setTabReady,
    hasTerminals,
    registerProject,
    getProjectPaths,
    getAllTerminals,
    setTabSessionId,
    setTabTmuxSession,
    terminalFontSize,
    setTerminalFontSize: handleSetTerminalFontSize,
    // Persistent shell panel state
    shellProjectId,
    shellProjectPath,
    setShellProject,
    shellPanelCollapsed,
    setShellPanelCollapsed,
    // Split terminal
    toggleSplit,
    setSplitSessionId,
    setSplitExited,
    // Broadcast mode
    broadcastMode,
    broadcastTabIds,
    toggleBroadcastMode,
    toggleBroadcastTab,
    broadcastWrite,
    // Session restore state
    isRestored,
  };

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

// ============================================================
// Helpers for tab type <-> command mapping (SH-03)
// ============================================================

function commandToTabType(command: string | undefined): string {
  if (!command) return "shell";
  if (command.includes("--dangerously-skip-permissions")) return "yolo";
  if (command.includes("claude")) return "claude";
  return "shell";
}

function tabTypeToCommand(tabType: string): string | undefined {
  if (tabType === "yolo") return "claude --dangerously-skip-permissions";
  if (tabType === "claude") return "claude";
  return undefined;
}

export function useTerminalContext() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error("useTerminalContext must be used within a TerminalProvider");
  }
  return context;
}
