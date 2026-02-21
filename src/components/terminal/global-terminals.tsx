// Track Your Shit - Global Terminals Component
// Renders all terminal instances globally for persistence across navigation
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { InteractiveTerminal, type InteractiveTerminalRef } from "./interactive-terminal";
import { useTerminalContext } from "@/contexts/terminal-context";
import { Group, Panel, Separator } from "react-resizable-panels";

interface GlobalTerminalsProps {
  /** Currently visible project ID (null if terminals should be hidden) */
  visibleProjectId: string | null;
  /** Currently active tab ID for the visible project */
  activeTabId: string | null;
}

/**
 * Renders all terminal instances globally
 *
 * Terminals are kept mounted but hidden when not visible,
 * preserving their state, output, and PTY connections.
 */
export function GlobalTerminals({
  visibleProjectId,
  activeTabId,
}: GlobalTerminalsProps) {
  const {
    getAllTerminals,
    getProjectPaths,
    setTabExited,
    setTabReady,
    setTabSessionId,
    setTabTmuxSession,
    setSplitSessionId,
    setSplitExited,
    terminalFontSize,
    broadcastMode,
    broadcastTabIds,
    broadcastWrite,
  } = useTerminalContext();
  const terminalRefs = useRef<Map<string, InteractiveTerminalRef>>(new Map());

  // Store terminal ref with composite key (projectId:tabId[:split])
  const setTerminalRef = useCallback((projectId: string, tabId: string, ref: InteractiveTerminalRef | null, isSplit = false) => {
    const key = isSplit ? `${projectId}:${tabId}:split` : `${projectId}:${tabId}`;
    if (ref) {
      terminalRefs.current.set(key, ref);
    } else {
      terminalRefs.current.delete(key);
    }
  }, []);

  const allTerminals = getAllTerminals();
  const projectPaths = getProjectPaths();

  // Collect terminals only for the visible project
  const terminals = useMemo(() => {
    if (!visibleProjectId) return [];

    const projectTerminals = allTerminals.get(visibleProjectId);
    if (!projectTerminals) return [];

    const workingDirectory = projectPaths.get(visibleProjectId);
    if (!workingDirectory) return [];

    return projectTerminals.tabs.map((tab) => ({
      projectId: visibleProjectId,
      tabId: tab.id,
      label: tab.label,
      command: tab.command,
      sessionId: tab.sessionId,
      tmuxSession: tab.tmuxSession,
      workingDirectory,
      split: tab.split,
      splitSessionId: tab.splitSessionId,
      splitCommand: tab.splitCommand,
    }));
  }, [allTerminals, projectPaths, visibleProjectId]);

  // If no terminals or nothing to show, render nothing
  if (terminals.length === 0) {
    return null;
  }

  return (
    <>
      {terminals.map(({ projectId, tabId, command, sessionId, tmuxSession, workingDirectory, split, splitSessionId, splitCommand }) => {
        const isVisible = projectId === visibleProjectId && tabId === activeTabId;
        const isBroadcasting = broadcastMode && broadcastTabIds.has(tabId);

        return (
          <div
            key={`${projectId}:${tabId}`}
            className={cn(
              "absolute inset-0",
              isVisible ? "z-10 visible" : "z-0 invisible pointer-events-none"
            )}
          >
            {split ? (
              <Group orientation="horizontal" className="h-full">
                <Panel defaultSize="50%" minSize="20%">
                  <InteractiveTerminal
                    ref={(ref) => setTerminalRef(projectId, tabId, ref)}
                    persistKey={`${projectId}:${tabId}`}
                    workingDirectory={workingDirectory}
                    command={command}
                    fontSize={terminalFontSize}
                    existingSessionId={sessionId}
                    tmuxSession={tmuxSession}
                    visible={isVisible}
                    onSessionCreated={(sid) => setTabSessionId(projectId, tabId, sid)}
                    onTmuxSessionCreated={(name) => setTabTmuxSession(projectId, tabId, name)}
                    onExit={(code) => setTabExited(projectId, tabId, code)}
                    onReady={() => setTabReady(projectId, tabId)}
                    isBroadcasting={isBroadcasting}
                    onBroadcastWrite={broadcastWrite}
                    className="h-full"
                  />
                </Panel>
                <Separator className="w-1 bg-border hover:bg-brand-blue/50 transition-colors cursor-col-resize" />
                <Panel defaultSize="50%" minSize="20%">
                  <InteractiveTerminal
                    ref={(ref) => setTerminalRef(projectId, tabId, ref, true)}
                    persistKey={`${projectId}:${tabId}:split`}
                    workingDirectory={workingDirectory}
                    command={splitCommand}
                    fontSize={terminalFontSize}
                    existingSessionId={splitSessionId}
                    visible={isVisible}
                    onSessionCreated={(sid) => setSplitSessionId(projectId, tabId, sid)}
                    onExit={(code) => setSplitExited(projectId, tabId, code)}
                    onReady={() => {/* split pane ready */}}
                    className="h-full"
                  />
                </Panel>
              </Group>
            ) : (
              <InteractiveTerminal
                ref={(ref) => setTerminalRef(projectId, tabId, ref)}
                persistKey={`${projectId}:${tabId}`}
                workingDirectory={workingDirectory}
                command={command}
                fontSize={terminalFontSize}
                existingSessionId={sessionId}
                tmuxSession={tmuxSession}
                visible={isVisible}
                onSessionCreated={(sid) => setTabSessionId(projectId, tabId, sid)}
                onTmuxSessionCreated={(name) => setTabTmuxSession(projectId, tabId, name)}
                onExit={(code) => setTabExited(projectId, tabId, code)}
                onReady={() => setTabReady(projectId, tabId)}
                isBroadcasting={isBroadcasting}
                onBroadcastWrite={broadcastWrite}
                className="h-full"
              />
            )}
          </div>
        );
      })}
    </>
  );
}

export default GlobalTerminals;
