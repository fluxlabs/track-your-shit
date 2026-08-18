// VCCA - Query Key Factory Tests
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

  describe("onboarding", () => {
    it("generates key for onboarding status", () => {
      expect(queryKeys.onboardingStatus()).toEqual(["onboarding", "status"]);
    });

    it("generates key for onboarding dependency detection", () => {
      expect(queryKeys.onboardingDependencies()).toEqual(["onboarding", "dependencies"]);
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

  describe("Phase 12 artifact query keys", () => {
    const projectId = "proj-123";

    it("generates correct key shapes for all Phase 12 artifact readers", () => {
      expect(queryKeys.gsdPhaseSpec(projectId, 1)).toEqual(["gsd", "phase-spec", projectId, 1]);
      expect(queryKeys.gsdPhaseSecurity(projectId, 1)).toEqual(["gsd", "phase-security", projectId, 1]);
      expect(queryKeys.gsdPhaseValidationDoc(projectId, 1)).toEqual(["gsd", "phase-validation-doc", projectId, 1]);
      expect(queryKeys.gsdPhaseReview(projectId, 1)).toEqual(["gsd", "phase-review", projectId, 1]);
      expect(queryKeys.gsdCodebaseDocs(projectId)).toEqual(["gsd", "codebase-docs", projectId]);
      expect(queryKeys.gsdProcessDocs(projectId)).toEqual(["gsd", "process-docs", projectId]);
    });

    it("generates unique keys across the six new resources", () => {
      const keys = [
        queryKeys.gsdPhaseSpec(projectId, 1),
        queryKeys.gsdPhaseSecurity(projectId, 1),
        queryKeys.gsdPhaseValidationDoc(projectId, 1),
        queryKeys.gsdPhaseReview(projectId, 1),
        queryKeys.gsdCodebaseDocs(projectId),
        queryKeys.gsdProcessDocs(projectId),
      ];
      const uniqueKeys = new Set(keys.map((k) => JSON.stringify(k)));
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it("differentiates phase-scoped keys by phase number", () => {
      expect(queryKeys.gsdPhaseSpec(projectId, 1)).not.toEqual(queryKeys.gsdPhaseSpec(projectId, 2));
      expect(queryKeys.gsdPhaseSecurity(projectId, 1)).not.toEqual(queryKeys.gsdPhaseSecurity(projectId, 2));
      expect(queryKeys.gsdPhaseValidationDoc(projectId, 1)).not.toEqual(queryKeys.gsdPhaseValidationDoc(projectId, 2));
      expect(queryKeys.gsdPhaseReview(projectId, 1)).not.toEqual(queryKeys.gsdPhaseReview(projectId, 2));
    });

    it("phase-scoped keys are distinct from existing gsd phase keys", () => {
      // New phase-spec key must not collide with phase-context, verification, etc.
      expect(queryKeys.gsdPhaseSpec(projectId, 1)).not.toEqual(queryKeys.gsdPhaseContext(projectId, 1));
      expect(queryKeys.gsdPhaseSpec(projectId, 1)).not.toEqual(queryKeys.gsdVerification(projectId, 1));
      expect(queryKeys.gsdPhaseSecurity(projectId, 1)).not.toEqual(queryKeys.gsdPhaseSpec(projectId, 1));
    });

    it("project-level keys are distinct across resources and from phase-scoped keys", () => {
      expect(queryKeys.gsdCodebaseDocs(projectId)).not.toEqual(queryKeys.gsdProcessDocs(projectId));
      expect(queryKeys.gsdCodebaseDocs(projectId)).not.toEqual(queryKeys.gsdResearch(projectId));
      expect(queryKeys.gsdProcessDocs(projectId)).not.toEqual(queryKeys.gsdPhaseSpec(projectId, 1));
    });
  });
});
