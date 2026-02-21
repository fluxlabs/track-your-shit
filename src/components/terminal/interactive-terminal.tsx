// Track Your Shit - Interactive Terminal Component
// Full PTY-backed terminal with bidirectional I/O
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { SerializeAddon } from "@xterm/addon-serialize";
import "@xterm/xterm/css/xterm.css";
import { cn } from "@/lib/utils";
import { usePtySession } from "@/hooks/use-pty-session";
import { ptyResize as ptyResizeDirect, ptyIsActive, ptyDetach } from "@/lib/tauri";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TerminalSearchBar } from "./terminal-search-bar";
import { BroadcastIndicator } from "./broadcast-indicator";

// Module-level caches: persist terminal instances across unmount/remount cycles.
// Keyed by persistKey (projectId:tabId). Entries are cleaned up when tabs are closed.

/** Cached xterm Terminal with addons, kept alive across page navigations */
interface CachedTerminalInstance {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
  serializeAddon: SerializeAddon;
  onDataDisposable: { dispose: () => void };
  lineHeight: number;
}

const terminalInstanceCache = new Map<string, CachedTerminalInstance>();

// Indirection maps: allow updating React ref targets without re-registering xterm handlers.
// terminal.onData is registered ONCE per Terminal lifetime; these maps route to current refs.
const terminalInputWriters = new Map<string, (data: string) => void>();
const terminalKeyHandlers = new Map<string, (e: KeyboardEvent) => boolean>();

// Session tracking maps: remember which PTY session is associated with each cached terminal.
// Updated via onSessionCreated/onTmuxSessionCreated callbacks; read on cache restore to
// avoid unnecessary PTY reconnections.
const terminalSessionIds = new Map<string, string | null>();
const terminalTmuxNames = new Map<string, string | null>();

// Legacy buffer cache: fallback for pre-existing serialized buffers
const terminalBufferCache = new Map<string, string>();

/** Clean up all caches for a terminal (call when a tab is permanently closed) */
export function clearTerminalCache(key: string) {
  const cached = terminalInstanceCache.get(key);
  if (cached) {
    cached.onDataDisposable.dispose();
    cached.terminal.dispose();
    terminalInstanceCache.delete(key);
  }
  terminalInputWriters.delete(key);
  terminalKeyHandlers.delete(key);
  terminalSessionIds.delete(key);
  terminalTmuxNames.delete(key);
  terminalBufferCache.delete(key);
}

export interface InteractiveTerminalRef {
  /** Focus the terminal */
  focus: () => void;
  /** Clear the terminal display */
  clear: () => void;
  /** Get the current session ID */
  getSessionId: () => string | null;
  /** Check if connected */
  isConnected: () => boolean;
  /** Reconnect to the PTY */
  reconnect: () => Promise<void>;
}

export interface InteractiveTerminalProps {
  /** Stable key for buffer persistence across unmount/remount (e.g., "projectId:tabId") */
  persistKey?: string;
  /** Working directory for the shell */
  workingDirectory: string;
  /** Optional command to run (default: user's shell) */
  command?: string;
  /** Existing PTY session ID to reconnect to */
  existingSessionId?: string | null;
  /** Existing tmux session name to reattach to on restart */
  tmuxSession?: string | null;
  /** Callback when a new session is created (with session ID) */
  onSessionCreated?: (sessionId: string) => void;
  /** Callback when a tmux session is created/attached */
  onTmuxSessionCreated?: (tmuxName: string | null) => void;
  /** Callback when terminal is ready */
  onReady?: () => void;
  /** Callback when terminal exits */
  onExit?: (exitCode: number | null) => void;
  /** Callback when terminal errors */
  onError?: (error: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Font size in pixels (default: 14) */
  fontSize?: number;
  /** Line height multiplier (default: 1.2) */
  lineHeight?: number;
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
  /** Whether this terminal is currently the active/visible tab */
  visible?: boolean;
  /** SH-05: Whether this terminal is in broadcast mode */
  isBroadcasting?: boolean;
  /** SH-05: Callback to write to all broadcast terminals */
  onBroadcastWrite?: (data: string) => void;
}

/**
 * Interactive terminal component with full PTY support
 *
 * Features:
 * - Bidirectional I/O with real PTY
 * - Keyboard input sent to shell
 * - ANSI color support
 * - Terminal resize handling
 * - Auto-reconnect capability
 */
export const InteractiveTerminal = forwardRef<InteractiveTerminalRef, InteractiveTerminalProps>(
  function InteractiveTerminal(
    {
      persistKey,
      workingDirectory,
      command,
      existingSessionId,
      tmuxSession,
      onSessionCreated,
      onTmuxSessionCreated,
      onReady,
      onExit,
      onError,
      className,
      fontSize = 14,
      lineHeight = 1.2,
      autoConnect = true,
      visible = true,
      isBroadcasting = false,
      onBroadcastWrite,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const searchAddonRef = useRef<SearchAddon | null>(null);
    const serializeAddonRef = useRef<SerializeAddon | null>(null);
    // Capture persistKey in a ref so the cleanup closure always has the latest value
    const persistKeyRef = useRef(persistKey);
    persistKeyRef.current = persistKey;
    const [showExitOverlay, setShowExitOverlay] = useState(false);
    const [showSearch, setShowSearch] = useState(false);

    // Refs to hold current write/resize functions to avoid stale closures
    const writeRef = useRef<(data: string | Uint8Array) => Promise<void>>();
    const resizeRef = useRef<(cols: number, rows: number) => Promise<void>>();
    // SH-05: Broadcast write ref (null when not broadcasting)
    const broadcastWriteRef = useRef<((data: string) => void) | null>(null);

    // PTY session hook
    const { state, connect, reconnect: ptyReconnect, reattachListeners, disconnect, write, resize } = usePtySession({
      onData: useCallback((data: Uint8Array) => {
        if (terminalRef.current) {
          terminalRef.current.write(data);
        }
      }, []),
      onExit: useCallback((exitCode: number | null) => {
        setShowExitOverlay(true);
        onExit?.(exitCode);
      }, [onExit]),
      onError: useCallback((error: string) => {
        if (terminalRef.current) {
          terminalRef.current.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
        }
        onError?.(error);
      }, [onError]),
    });

    // Keep refs updated with latest functions
    useEffect(() => {
      writeRef.current = write;
      resizeRef.current = resize;
    }, [write, resize]);

    // SH-05: Update broadcast ref based on props
    useEffect(() => {
      broadcastWriteRef.current = isBroadcasting && onBroadcastWrite ? onBroadcastWrite : null;
    }, [isBroadcasting, onBroadcastWrite]);

    // Seed session tracking maps from props on mount (so cache-restore path can find them)
    useEffect(() => {
      const key = persistKeyRef.current;
      if (!key) return;
      if (existingSessionId && !terminalSessionIds.has(key)) {
        terminalSessionIds.set(key, existingSessionId);
      }
      if (tmuxSession && !terminalTmuxNames.has(key)) {
        terminalTmuxNames.set(key, tmuxSession);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only on mount — subsequent updates come from connectToPty

    // Connect to PTY (tries cached session first, then tmux reattach, then native reconnect, then new)
    const connectToPty = useCallback(async (skipCacheCheck = false) => {
      if (!terminalRef.current || !fitAddonRef.current) return;

      setShowExitOverlay(false);
      const { cols, rows } = terminalRef.current;
      const key = persistKeyRef.current;

      // Fast path: check if the cached session is still active (avoids full PTY reconnect).
      // This is the common case when navigating between pages with instance-cached terminals.
      if (!skipCacheCheck && key) {
        const cachedSessionId = terminalSessionIds.get(key);
        const cachedTmuxName = terminalTmuxNames.get(key);

        if (cachedSessionId) {
          try {
            const active = await ptyIsActive(cachedSessionId);
            if (active) {
              // PTY is still alive — just re-register event listeners
              const attached = await reattachListeners(cachedSessionId, cachedTmuxName);
              if (attached) {
                await ptyResizeDirect(cachedSessionId, cols, rows).catch(() => {});
                return;
              }
            }

            // Session is dead. For tmux: detach the old PTY wrapper to prevent leaks,
            // then fall through to reconnect via tmux attach.
            if (cachedTmuxName) {
              await ptyDetach(cachedSessionId).catch(() => {});
            }
          } catch {
            // ptyIsActive or reattachListeners threw — fall through to full reconnect
          }
        }
      }

      // Try to reattach to tmux session first (survives app restarts)
      const effectiveTmux = tmuxSession ?? (key ? terminalTmuxNames.get(key) : undefined) ?? null;
      const effectiveSession = existingSessionId ?? (key ? terminalSessionIds.get(key) : undefined) ?? null;

      if (effectiveTmux) {
        const result = await ptyReconnect(effectiveSession ?? "", effectiveTmux, workingDirectory, cols, rows);
        if (result.success && result.sessionId) {
          // Use direct ptyResize to bypass hook state guard (state hasn't updated yet)
          await ptyResizeDirect(result.sessionId, cols, rows).catch(() => {});
          onSessionCreated?.(result.sessionId);
          onTmuxSessionCreated?.(effectiveTmux);
          // Update session tracking
          if (key) {
            terminalSessionIds.set(key, result.sessionId);
            terminalTmuxNames.set(key, effectiveTmux);
          }
          return;
        }
        // tmux session no longer exists, fall through to create new
      }

      // Try to reconnect to existing native session
      if (effectiveSession && !effectiveTmux) {
        const result = await ptyReconnect(effectiveSession);
        if (result.success && result.sessionId) {
          await ptyResizeDirect(result.sessionId, cols, rows).catch(() => {});
          onSessionCreated?.(result.sessionId);
          if (key) {
            terminalSessionIds.set(key, result.sessionId);
          }
          return;
        }
        // Session no longer active, fall through to create new
      }

      // Create new session
      const { sessionId, tmuxName } = await connect({
        workingDirectory,
        command,
        cols,
        rows,
      });

      // Notify parent of new session ID and tmux name
      onSessionCreated?.(sessionId);
      onTmuxSessionCreated?.(tmuxName);
      // Update session tracking
      if (key) {
        terminalSessionIds.set(key, sessionId);
        terminalTmuxNames.set(key, tmuxName);
      }
    }, [connect, ptyReconnect, reattachListeners, workingDirectory, command, existingSessionId, tmuxSession, onSessionCreated, onTmuxSessionCreated]);

    // Reconnect handler (user-initiated restart, skip cache check to force fresh connection)
    const reconnect = useCallback(async () => {
      if (terminalRef.current) {
        terminalRef.current.reset();
        terminalRef.current.clear();
      }
      await connectToPty(true);
    }, [connectToPty]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => terminalRef.current?.focus(),
      clear: () => {
        terminalRef.current?.reset();
        terminalRef.current?.clear();
      },
      getSessionId: () => state.sessionId,
      isConnected: () => state.isConnected,
      reconnect,
    }), [state.sessionId, state.isConnected, reconnect]);

    // Initialize terminal (or restore from cache)
    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const key = persistKeyRef.current;
      let terminal: Terminal;
      let fitAddon: FitAddon;
      let searchAddon: SearchAddon;
      let serializeAddon: SerializeAddon;
      let isRestoredFromCache = false;

      // Path A: Restore cached terminal instance (persisted across page navigations)
      const cached = key ? terminalInstanceCache.get(key) : undefined;
      if (cached && cached.lineHeight === lineHeight) {
        terminal = cached.terminal;
        fitAddon = cached.fitAddon;
        searchAddon = cached.searchAddon;
        serializeAddon = cached.serializeAddon;
        isRestoredFromCache = true;

        // Move the cached terminal's DOM element into the new container
        if (terminal.element) {
          container.appendChild(terminal.element);
        }

        // Fit to new container dimensions and refresh display
        requestAnimationFrame(() => {
          fitAddon.fit();
          terminal.refresh(0, terminal.rows - 1);
        });
      } else {
        // If cached terminal has mismatched lineHeight, dispose it first
        if (cached && key) {
          cached.onDataDisposable.dispose();
          cached.terminal.dispose();
          terminalInstanceCache.delete(key);
          terminalInputWriters.delete(key);
          terminalKeyHandlers.delete(key);
          terminalSessionIds.delete(key);
          terminalTmuxNames.delete(key);
        }

        // Path B: Create new terminal
        terminal = new Terminal({
          cursorBlink: true,
          cursorStyle: "block",
          theme: {
            background: "#0a0a0a",
            foreground: "#fafafa",
            cursor: "#fafafa",
            cursorAccent: "#0a0a0a",
            selectionBackground: "#3b3b3b",
            selectionForeground: "#fafafa",
            black: "#000000",
            red: "#ff5555",
            green: "#50fa7b",
            yellow: "#f1fa8c",
            blue: "#6272a4",
            magenta: "#ff79c6",
            cyan: "#8be9fd",
            white: "#f8f8f2",
            brightBlack: "#6272a4",
            brightRed: "#ff6e6e",
            brightGreen: "#69ff94",
            brightYellow: "#ffffa5",
            brightBlue: "#d6acff",
            brightMagenta: "#ff92df",
            brightCyan: "#a4ffff",
            brightWhite: "#ffffff",
          },
          fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
          fontSize,
          lineHeight,
          scrollback: 10000,
          convertEol: true,
          allowProposedApi: true,
        });

        fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        searchAddon = new SearchAddon();
        serializeAddon = new SerializeAddon();

        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);
        terminal.loadAddon(searchAddon);
        terminal.loadAddon(serializeAddon);
        terminal.open(container);

        // Restore legacy serialized buffer if present (from before instance caching existed)
        if (key) {
          const legacyBuffer = terminalBufferCache.get(key);
          if (legacyBuffer) {
            terminal.write(legacyBuffer);
            terminalBufferCache.delete(key);
          }
        }

        // Register key handler through indirection (once per Terminal lifetime)
        terminal.attachCustomKeyEventHandler((e) => {
          if (key) {
            const handler = terminalKeyHandlers.get(key);
            if (handler) return handler(e);
          }
          // Default: intercept Cmd/Ctrl+F for search
          if ((e.metaKey || e.ctrlKey) && e.key === 'f' && e.type === 'keydown') {
            return false;
          }
          return true;
        });

        // Register onData through indirection (once per Terminal lifetime)
        const onDataDisposable = terminal.onData((data) => {
          if (key) {
            const writer = terminalInputWriters.get(key);
            if (writer) {
              writer(data);
              return;
            }
          }
          // Fallback: direct ref access (for terminals without persistKey)
          if (broadcastWriteRef.current) {
            broadcastWriteRef.current(data);
          } else {
            void writeRef.current?.(data);
          }
        });

        // Initial fit after short delay
        requestAnimationFrame(() => {
          fitAddon.fit();
        });

        // Store in instance cache for future remounts
        if (key) {
          terminalInstanceCache.set(key, {
            terminal,
            fitAddon,
            searchAddon,
            serializeAddon,
            onDataDisposable,
            lineHeight,
          });
        }
      }

      // Both paths: Update indirection maps with current React refs
      if (key) {
        terminalInputWriters.set(key, (data: string) => {
          if (broadcastWriteRef.current) {
            broadcastWriteRef.current(data);
          } else {
            void writeRef.current?.(data);
          }
        });
        terminalKeyHandlers.set(key, (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'f' && e.type === 'keydown') {
            setShowSearch(true);
            return false;
          }
          return true;
        });
      }

      // Store refs for component access
      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;
      serializeAddonRef.current = serializeAddon;

      // ResizeObserver for responsive fit
      let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
      const resizeObserver = new ResizeObserver((entries) => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        // Skip resize when container has no dimensions (e.g., display:none from forceMount tabs).
        // Without this guard, fitAddon.fit() would resize the terminal to ~1x1, which sends
        // a tiny resize to tmux and destroys all content formatting.
        const entry = entries[0];
        if (!entry || entry.contentRect.width === 0 || entry.contentRect.height === 0) {
          return;
        }
        resizeTimeout = setTimeout(() => {
          fitAddon.fit();
          if (terminal.cols && terminal.rows) {
            void resizeRef.current?.(terminal.cols, terminal.rows);
          }
        }, 150);
      });
      resizeObserver.observe(container);

      // IntersectionObserver to refit when container becomes visible.
      // Handles forceMount tabs where display transitions from none to flex,
      // and shell panel expanding from h-0 invisible to h-[300px].
      const intersectionObserver = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) {
          fitAddon.fit();
          // Force canvas repaint after visibility transition (CSS invisible -> visible)
          terminal.refresh(0, terminal.rows - 1);
          if (terminal.cols && terminal.rows) {
            void resizeRef.current?.(terminal.cols, terminal.rows);
          }
        }
      });
      intersectionObserver.observe(container);

      // Auto-connect if enabled (both fresh terminals and cached ones need PTY reconnection)
      let autoConnectTimer: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;
      if (autoConnect) {
        // Small delay to ensure terminal is ready
        autoConnectTimer = setTimeout(() => {
          if (!cancelled) {
            void connectToPty().then(() => onReady?.());
          }
        }, isRestoredFromCache ? 50 : 100);
      }

      // Cleanup
      return () => {
        cancelled = true;
        if (autoConnectTimer) {
          clearTimeout(autoConnectTimer);
        }
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeObserver.disconnect();
        intersectionObserver.disconnect();

        if (persistKeyRef.current && terminalInstanceCache.has(persistKeyRef.current)) {
          // Cached terminal: detach DOM element but keep Terminal alive
          if (terminal.element) {
            terminal.element.remove();
          }
        } else {
          // No persistKey: dispose terminal as before
          terminal.dispose();
        }

        terminalRef.current = null;
        fitAddonRef.current = null;
        searchAddonRef.current = null;
        serializeAddonRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lineHeight]); // Only re-init on lineHeight change

    // Dynamically update font size without re-initializing the terminal
    useEffect(() => {
      if (terminalRef.current && fitAddonRef.current) {
        terminalRef.current.options.fontSize = fontSize;
        fitAddonRef.current.fit();
        // Notify PTY of new dimensions
        if (terminalRef.current.cols && terminalRef.current.rows) {
          void resizeRef.current?.(terminalRef.current.cols, terminalRef.current.rows);
        }
      }
    }, [fontSize]);

    // Force repaint when terminal becomes the active/visible tab.
    // CSS visibility:hidden doesn't trigger IntersectionObserver, so the
    // canvas can go stale while hidden. Refresh all rows on visibility change.
    useEffect(() => {
      if (visible && terminalRef.current && fitAddonRef.current) {
        fitAddonRef.current.fit();
        terminalRef.current.refresh(0, terminalRef.current.rows - 1);
      }
    }, [visible]);

    // Handle workingDirectory or command changes - reconnect
    // Note: state.isConnected and autoConnect intentionally excluded to avoid
    // infinite loops (connecting changes state which would re-trigger).
    // disconnect/connectToPty are stable refs captured at call time.
    useEffect(() => {
      if (state.isConnected && autoConnect) {
        // Disconnect and reconnect with new settings
        void disconnect().then(() => {
          setTimeout(() => {
            void connectToPty();
          }, 100);
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workingDirectory, command]);

    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        {/* Search bar overlay */}
        <TerminalSearchBar
          searchAddon={searchAddonRef.current}
          visible={showSearch}
          onClose={() => setShowSearch(false)}
        />

        {/* Terminal container */}
        <div
          ref={containerRef}
          className="h-full w-full bg-[#0a0a0a] rounded-lg overflow-hidden xterm-container"
        />

        {/* Broadcast indicator */}
        {isBroadcasting && <BroadcastIndicator />}

        {/* Loading overlay */}
        {state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span>Connecting...</span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {state.error && !state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 rounded-lg">
            <div className="flex flex-col items-center gap-3 text-center p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <span className="text-destructive text-sm">{state.error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void reconnect()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Exit overlay */}
        {showExitOverlay && !state.isConnected && !state.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 rounded-lg">
            <div className="flex flex-col items-center gap-3 text-center p-4">
              <span className="text-muted-foreground">
                Session ended
                {state.exitCode !== null && ` (exit code: ${state.exitCode})`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void reconnect()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Restart
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default InteractiveTerminal;
