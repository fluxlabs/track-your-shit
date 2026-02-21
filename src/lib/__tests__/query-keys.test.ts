// Track Your Shit - Query Key Factory Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it, expect } from "vitest";
import { queryKeys } from "../query-keys";
import type { AppLogFilters } from "../tauri";

describe("queryKeys", () => {
  describe("projects", () => {
    it("generates consistent keys for all projects", () => {
      expect(queryKeys.projects()).toEqual(["projects"]);
      expect(queryKeys.projects()).toEqual(queryKeys.projects());
    });

    it("generates unique keys for specific projects", () => {
      expect(queryKeys.project("123")).toEqual(["project", "123"]);
      expect(queryKeys.project("456")).toEqual(["project", "456"]);
      expect(queryKeys.project("123")).not.toEqual(queryKeys.project("456"));
    });

    it("differentiates between all projects and specific project", () => {
      expect(queryKeys.projects()).not.toEqual(queryKeys.project("123"));
    });
  });

  describe("activity", () => {
    it("generates keys for activity logs", () => {
      expect(queryKeys.activity()).toEqual(["activity", undefined, undefined]);
      expect(queryKeys.activity("project-1")).toEqual(["activity", "project-1", undefined]);
      expect(queryKeys.activity("project-1", 10)).toEqual(["activity", "project-1", 10]);
    });

    it("generates key for all activity", () => {
      expect(queryKeys.allActivity()).toEqual(["activity"]);
    });

    it("generates different keys for different parameters", () => {
      expect(queryKeys.activity("project-1", 10)).not.toEqual(
        queryKeys.activity("project-1", 20)
      );
      expect(queryKeys.activity("project-1")).not.toEqual(queryKeys.activity("project-2"));
    });
  });

  describe("settings", () => {
    it("generates consistent settings key", () => {
      expect(queryKeys.settings()).toEqual(["settings"]);
      expect(queryKeys.settings()).toEqual(queryKeys.settings());
    });
  });

  describe("app logs", () => {
    it("generates keys for app logs with filters", () => {
      const filters: AppLogFilters = { level: "error" } as AppLogFilters;
      expect(queryKeys.appLogs(filters)).toEqual(["app-logs", filters]);
    });

    it("generates key for all app logs", () => {
      expect(queryKeys.allAppLogs()).toEqual(["app-logs"]);
    });

    it("generates key for app log stats", () => {
      expect(queryKeys.appLogStats()).toEqual(["app-logs", "stats"]);
    });
  });

  describe("key uniqueness", () => {
    it("generates unique keys across different resources", () => {
      const keys = [
        queryKeys.projects(),
        queryKeys.activity(),
        queryKeys.settings(),
        queryKeys.appLogStats(),
      ];

      const uniqueKeys = new Set(keys.map((k) => JSON.stringify(k)));
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe("key consistency", () => {
    it("returns the same reference for same parameters", () => {
      const key1 = queryKeys.project("123");
      const key2 = queryKeys.project("123");
      expect(key1).toEqual(key2);
    });

    it("returns readonly arrays", () => {
      const key = queryKeys.projects();
      // TypeScript enforces readonly, but we can verify the structure
      expect(Array.isArray(key)).toBe(true);
    });
  });

  describe("parameter handling", () => {
    it("handles undefined parameters consistently", () => {
      expect(queryKeys.activity(undefined, undefined)).toEqual([
        "activity",
        undefined,
        undefined,
      ]);
    });
  });
});
