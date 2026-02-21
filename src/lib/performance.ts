// Track Your Shit - Frontend Performance Monitoring
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { logFrontendEvent } from "./tauri";

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/** IPC calls taking longer than this are considered slow (ms). */
export const SLOW_INVOKE_THRESHOLD_MS = 200;

/** React Query fetches taking longer than this are considered slow (ms). */
export const SLOW_QUERY_THRESHOLD_MS = 500;

/** Very slow threshold – triggers a warning-level backend log (ms). */
export const VERY_SLOW_THRESHOLD_MS = 2000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget: log a performance event to the Tauri backend.
 * Errors are silently swallowed so perf logging never breaks the app.
 */
function logPerfEvent(
  level: string,
  message: string,
  metadata?: Record<string, unknown>,
): void {
  logFrontendEvent(level, message, "performance", undefined, metadata).catch(
    () => {
      /* best-effort */
    },
  );
}

// ---------------------------------------------------------------------------
// measureInvoke – wraps any Tauri IPC call with timing
// ---------------------------------------------------------------------------

/**
 * Time a Tauri `invoke` call (or any async operation).
 *
 * - Calls under {@link SLOW_INVOKE_THRESHOLD_MS} are silent.
 * - Calls above the threshold emit a `console.warn` and a backend log event.
 * - Calls above {@link VERY_SLOW_THRESHOLD_MS} escalate to `warn` level.
 *
 * Usage:
 * ```ts
 * const projects = await measureInvoke("list_projects", () => invoke("list_projects"));
 * ```
 */
export function measureInvoke<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now();

  return fn().finally(() => {
    const duration = performance.now() - start;

    if (duration > SLOW_INVOKE_THRESHOLD_MS) {
      const durationMs = Math.round(duration);
      const level = duration > VERY_SLOW_THRESHOLD_MS ? "warn" : "info";

      console.warn(
        `[perf] Slow invoke: ${name} took ${durationMs}ms`,
      );

      logPerfEvent(level, `Slow invoke: ${name} (${durationMs}ms)`, {
        invoke_name: name,
        duration_ms: durationMs,
        threshold_ms: SLOW_INVOKE_THRESHOLD_MS,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// reportSlowQuery – log slow React Query fetches
// ---------------------------------------------------------------------------

/**
 * Report a React Query fetch that exceeded {@link SLOW_QUERY_THRESHOLD_MS}.
 *
 * Intended to be called from a React Query `onSuccess` / `onSettled` callback,
 * or from a global query observer.
 *
 * @param queryKey  The query key (for identification).
 * @param durationMs  Wall-clock time of the fetch in milliseconds.
 */
export function reportSlowQuery(
  queryKey: readonly unknown[],
  durationMs: number,
): void {
  if (durationMs <= SLOW_QUERY_THRESHOLD_MS) return;

  const keyStr = JSON.stringify(queryKey);
  const roundedMs = Math.round(durationMs);
  const level = durationMs > VERY_SLOW_THRESHOLD_MS ? "warn" : "info";

  console.warn(
    `[perf] Slow query: ${keyStr} took ${roundedMs}ms`,
  );

  logPerfEvent(level, `Slow query: ${keyStr} (${roundedMs}ms)`, {
    query_key: keyStr,
    duration_ms: roundedMs,
    threshold_ms: SLOW_QUERY_THRESHOLD_MS,
  });
}

// ---------------------------------------------------------------------------
// Performance mark helpers (for manual profiling with DevTools)
// ---------------------------------------------------------------------------

/**
 * Create a named performance mark and return a function to end the
 * measurement. The resulting `PerformanceMeasure` is visible in Chrome
 * DevTools → Performance tab.
 *
 * ```ts
 * const end = perfMark("render-dashboard");
 * // ... do work ...
 * end(); // creates the measure
 * ```
 */
export function perfMark(label: string): () => void {
  const markName = `ct:${label}:start`;
  performance.mark(markName);

  return () => {
    const measureName = `ct:${label}`;
    try {
      performance.measure(measureName, markName);
    } catch {
      // Swallow if the mark was already cleared
    }
  };
}
