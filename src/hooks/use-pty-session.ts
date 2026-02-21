// Track Your Shit - PTY Session Hook
// React hook for managing PTY session state and events
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ptyCreate,
  ptyWrite,
  ptyResize,
  ptyClose,
  ptyDetach,
  ptyIsActive,
  ptyAttach,
  onPtyOutput,
  onPtyExit,
  CreatePtyOptions,
  PtyOutputEvent,
  PtyExitEvent,
} from "@/lib/tauri";

interface PtySessionState {
  /** The session ID once connected */
  sessionId: string | null;
  /** Whether the session is connected and running */
  isConnected: boolean;
  /** Whether connection is in progress */
  isLoading: boolean;
  /** Error message if connection failed */
  error: string | null;
  /** Exit code if the session has terminated */
  exitCode: number | null;
  /** tmux session name if this session is tmux-backed */
  tmuxName: string | null;
}

interface UsePtySessionOptions {
  /** Callback when data is received from PTY */
  onData?: (data: Uint8Array) => void;
  /** Callback when PTY session exits */
  onExit?: (exitCode: number | null) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

interface UsePtySessionReturn {
  /** Current session state */
  state: PtySessionState;
  /** Connect to a new PTY session. Returns { sessionId, tmuxName } */
  connect: (options: Omit<CreatePtyOptions, "cols" | "rows"> & { cols?: number; rows?: number }) => Promise<{ sessionId: string; tmuxName: string | null }>;
  /** Reconnect to an existing PTY session. If tmuxName is provided, reattaches via tmux. */
  reconnect: (sessionId: string, tmuxName?: string | null, workingDir?: string, cols?: number, rows?: number) => Promise<{ success: boolean; sessionId: string | null }>;
  /** Re-register event listeners for an existing active session (no PTY creation/closing) */
  reattachListeners: (sessionId: string, tmuxName?: string | null) => Promise<boolean>;
  /** Disconnect from the current session */
  disconnect: () => Promise<void>;
  /** Write data to the PTY */
  write: (data: string | Uint8Array) => Promise<void>;
  /** Resize the PTY terminal */
  resize: (cols: number, rows: number) => Promise<void>;
}

/**
 * Hook for managing a PTY session
 *
 * @example
 * ```tsx
 * const { state, connect, disconnect, write, resize } = usePtySession({
 *   onData: (data) => terminal.write(data),
 *   onExit: (code) => console.log('Exited with code:', code),
 * });
 *
 * // Connect to a shell
 * await connect({ workingDirectory: '/path/to/project' });
 *
 * // Send input
 * await write('ls -la\n');
 *
 * // Handle resize
 * await resize(120, 40);
 *
 * // Disconnect
 * await disconnect();
 * ```
 */
export function usePtySession(options: UsePtySessionOptions = {}): UsePtySessionReturn {
  const { onData, onExit, onError } = options;

  const [state, setState] = useState<PtySessionState>({
    sessionId: null,
    isConnected: false,
    isLoading: false,
    error: null,
    exitCode: null,
    tmuxName: null,
  });

  // Store callbacks in refs to avoid stale closure issues
  const onDataRef = useRef(onData);
  const onExitRef = useRef(onExit);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onDataRef.current = onData;
    onExitRef.current = onExit;
    onErrorRef.current = onError;
  }, [onData, onExit, onError]);

  // Store unlisten functions
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

  // Clean up event listeners
  const cleanupListeners = useCallback(() => {
    if (unlistenOutputRef.current) {
      unlistenOutputRef.current();
      unlistenOutputRef.current = null;
    }
    if (unlistenExitRef.current) {
      unlistenExitRef.current();
      unlistenExitRef.current = null;
    }
  }, []);

  // Set up event listeners for a session
  const setupListeners = useCallback(async (sessionId: string) => {
    // Set up output listener
    const unlistenOutput = await onPtyOutput(sessionId, (event: PtyOutputEvent) => {
      const data = new Uint8Array(event.data);
      onDataRef.current?.(data);
    });
    unlistenOutputRef.current = unlistenOutput;

    // Set up exit listener
    const unlistenExit = await onPtyExit(sessionId, (event: PtyExitEvent) => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        exitCode: event.exit_code,
      }));
      onExitRef.current?.(event.exit_code);
      cleanupListeners();
    });
    unlistenExitRef.current = unlistenExit;
  }, [cleanupListeners]);

  // Track sessionId in a ref so cleanup can access it without stale closure
  const sessionIdRef = useRef<string | null>(null);

  // Close old PTY session if one exists (prevents PTY leaks on remount).
  // Uses ptyDetach for tmux sessions (preserves tmux) and ptyClose for native.
  const closeOldSession = useCallback(async () => {
    const oldId = sessionIdRef.current;
    if (oldId) {
      try {
        // If the previous session was tmux-backed, detach (don't kill tmux)
        if (state.tmuxName) {
          await ptyDetach(oldId);
        } else {
          await ptyClose(oldId);
        }
      } catch {
        // Old session may already be gone — that's fine
      }
      sessionIdRef.current = null;
    }
  }, [state.tmuxName]);

  // Connect to a new PTY session
  const connect = useCallback(async (
    connectOptions: Omit<CreatePtyOptions, "cols" | "rows"> & { cols?: number; rows?: number }
  ): Promise<{ sessionId: string; tmuxName: string | null }> => {
    // Clean up any existing session
    cleanupListeners();
    await closeOldSession();

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      exitCode: null,
    }));

    try {
      const result = await ptyCreate({
        workingDirectory: connectOptions.workingDirectory,
        command: connectOptions.command,
        cols: connectOptions.cols ?? 80,
        rows: connectOptions.rows ?? 24,
      });

      await setupListeners(result.sessionId);
      sessionIdRef.current = result.sessionId;

      setState({
        sessionId: result.sessionId,
        isConnected: true,
        isLoading: false,
        error: null,
        exitCode: null,
        tmuxName: result.tmuxName,
      });

      return { sessionId: result.sessionId, tmuxName: result.tmuxName };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      onErrorRef.current?.(errorMessage);
      throw err;
    }
  }, [cleanupListeners, closeOldSession, setupListeners]);

  // Reconnect to an existing PTY session
  // If tmuxName is provided, reattaches via ptyAttach (tmux reconnect)
  const reconnect = useCallback(async (sessionId: string, tmuxName?: string | null, workingDir?: string, cols?: number, rows?: number): Promise<{ success: boolean; sessionId: string | null }> => {
    // Clean up any existing listeners and close old PTY
    cleanupListeners();
    await closeOldSession();

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      exitCode: null,
    }));

    try {
      // tmux reconnect path: create new PTY session that attaches to existing tmux
      if (tmuxName) {
        const newSessionId = crypto.randomUUID();
        const attached = await ptyAttach(
          newSessionId,
          tmuxName,
          workingDir ?? "/",
          cols ?? 80,
          rows ?? 24,
        );

        if (!attached) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isConnected: false,
          }));
          return { success: false, sessionId: null };
        }

        await setupListeners(newSessionId);
        sessionIdRef.current = newSessionId;

        setState({
          sessionId: newSessionId,
          isConnected: true,
          isLoading: false,
          error: null,
          exitCode: null,
          tmuxName,
        });

        return { success: true, sessionId: newSessionId };
      }

      // Native reconnect path: check if session is still active
      const isActive = await ptyIsActive(sessionId);

      if (!isActive) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isConnected: false,
        }));
        return { success: false, sessionId: null };
      }

      // Set up listeners for the existing session
      await setupListeners(sessionId);
      sessionIdRef.current = sessionId;

      setState({
        sessionId,
        isConnected: true,
        isLoading: false,
        error: null,
        exitCode: null,
        tmuxName: null,
      });

      return { success: true, sessionId };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      onErrorRef.current?.(errorMessage);
      return { success: false, sessionId: null };
    }
  }, [cleanupListeners, closeOldSession, setupListeners]);

  // Re-register event listeners for an existing active session.
  // This is called when restoring a cached terminal instance whose PTY is still running.
  // It avoids the full reconnect flow (which calls closeOldSession and creates a new PTY).
  const reattachListeners = useCallback(async (sessionId: string, tmuxName?: string | null): Promise<boolean> => {
    // Clean up any stale listeners from a previous mount
    cleanupListeners();

    try {
      const isActive = await ptyIsActive(sessionId);
      if (!isActive) {
        return false;
      }

      await setupListeners(sessionId);
      sessionIdRef.current = sessionId;

      setState({
        sessionId,
        isConnected: true,
        isLoading: false,
        error: null,
        exitCode: null,
        tmuxName: tmuxName ?? null,
      });

      return true;
    } catch {
      return false;
    }
  }, [cleanupListeners, setupListeners]);

  // Disconnect from the current session
  const disconnect = useCallback(async () => {
    const currentId = sessionIdRef.current;
    if (!currentId) return;

    try {
      const exitCode = await ptyClose(currentId);
      sessionIdRef.current = null;
      setState({
        sessionId: null,
        isConnected: false,
        isLoading: false,
        error: null,
        exitCode,
        tmuxName: null,
      });
      cleanupListeners();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onErrorRef.current?.(errorMessage);
    }
  }, [cleanupListeners]);

  // Write data to the PTY
  const write = useCallback(async (data: string | Uint8Array) => {
    if (!state.sessionId || !state.isConnected) return;

    const bytes = typeof data === "string"
      ? new TextEncoder().encode(data)
      : data;

    try {
      await ptyWrite(state.sessionId, bytes);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onErrorRef.current?.(errorMessage);
    }
  }, [state.sessionId, state.isConnected]);

  // Resize the PTY terminal
  const resize = useCallback(async (cols: number, rows: number) => {
    if (!state.sessionId || !state.isConnected) return;

    try {
      await ptyResize(state.sessionId, cols, rows);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      onErrorRef.current?.(errorMessage);
    }
  }, [state.sessionId, state.isConnected]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupListeners();
      // Note: We don't auto-close the session on unmount
      // as the user might want to keep it running
    };
  }, [cleanupListeners]);

  return {
    state,
    connect,
    reconnect,
    reattachListeners,
    disconnect,
    write,
    resize,
  };
}
