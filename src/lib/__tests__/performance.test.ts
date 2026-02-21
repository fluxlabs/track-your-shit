// Track Your Shit - Performance Monitoring Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  measureInvoke,
  reportSlowQuery,
  perfMark,
  SLOW_INVOKE_THRESHOLD_MS,
  SLOW_QUERY_THRESHOLD_MS,
  VERY_SLOW_THRESHOLD_MS,
} from "../performance";

// Mock the tauri module so logFrontendEvent doesn't try real IPC
vi.mock("../tauri", () => ({
  logFrontendEvent: vi.fn().mockResolvedValue({
    id: "mock-id",
    level: "info",
    target: "performance",
    message: "test",
    source: "frontend",
    project_id: null,
    metadata: null,
    created_at: new Date().toISOString(),
  }),
}));

describe("constants", () => {
  it("exports sensible threshold values", () => {
    expect(SLOW_INVOKE_THRESHOLD_MS).toBe(200);
    expect(SLOW_QUERY_THRESHOLD_MS).toBe(500);
    expect(VERY_SLOW_THRESHOLD_MS).toBe(2000);
    expect(SLOW_INVOKE_THRESHOLD_MS).toBeLessThan(SLOW_QUERY_THRESHOLD_MS);
    expect(SLOW_QUERY_THRESHOLD_MS).toBeLessThan(VERY_SLOW_THRESHOLD_MS);
  });
});

describe("measureInvoke", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns the result of the wrapped function", async () => {
    const result = await measureInvoke("test_fast", async () => "hello");
    expect(result).toBe("hello");
  });

  it("propagates errors from the wrapped function", async () => {
    await expect(
      measureInvoke("test_error", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });

  it("does not warn for fast operations", async () => {
    await measureInvoke("test_fast", async () => 42);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns for slow operations", async () => {
    // Simulate a slow call by advancing time via a real delay
    await measureInvoke(
      "test_slow",
      () => new Promise((resolve) => setTimeout(() => resolve("ok"), 250)),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[perf] Slow invoke: test_slow"),
    );
  });
});

describe("reportSlowQuery", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("does nothing for fast queries", () => {
    reportSlowQuery(["projects"], 100);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does nothing for queries at exactly the threshold", () => {
    reportSlowQuery(["projects"], SLOW_QUERY_THRESHOLD_MS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns for queries exceeding the threshold", () => {
    reportSlowQuery(["projects", "with-stats"], 600);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[perf] Slow query:"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("600ms"),
    );
  });

  it("includes query key in warning message", () => {
    reportSlowQuery(["roadmap", "abc-123"], 700);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("roadmap"),
    );
  });
});

describe("perfMark", () => {
  it("creates a performance mark and measure", () => {
    const markSpy = vi.spyOn(performance, "mark");
    const measureSpy = vi.spyOn(performance, "measure");

    const end = perfMark("test-operation");
    expect(markSpy).toHaveBeenCalledWith("ct:test-operation:start");

    end();
    expect(measureSpy).toHaveBeenCalledWith(
      "ct:test-operation",
      "ct:test-operation:start",
    );

    markSpy.mockRestore();
    measureSpy.mockRestore();
  });

  it("does not throw if mark was already cleared", () => {
    const measureSpy = vi
      .spyOn(performance, "measure")
      .mockImplementation(() => {
        throw new Error("mark not found");
      });

    const end = perfMark("cleared-mark");
    // Should not throw
    expect(() => end()).not.toThrow();

    measureSpy.mockRestore();
  });
});
