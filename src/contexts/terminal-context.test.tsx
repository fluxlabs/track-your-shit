// Track Your Shit - Terminal Context Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { TerminalProvider, useTerminalContext } from "@/contexts/terminal-context";

// Wrapper component for renderHook
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TerminalProvider>{children}</TerminalProvider>
);

describe("TerminalContext", () => {
  describe("Project Terminals Management", () => {
    it("getProjectTerminals returns empty tabs for unknown project", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      const terminals = result.current.getProjectTerminals("unknown-project");

      expect(terminals.tabs).toEqual([]);
      expect(terminals.activeTabId).toBe("");
    });

    it("addTab creates a shell tab and sets it active", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let tabId: string;
      act(() => {
        tabId = result.current.addTab("project-1", "shell");
      });

      const terminals = result.current.getProjectTerminals("project-1");

      expect(terminals.tabs).toHaveLength(1);
      expect(terminals.tabs[0].label).toBe("Shell");
      expect(terminals.tabs[0].command).toBeUndefined();
      expect(terminals.tabs[0].isExited).toBe(false);
      expect(terminals.tabs[0].exitCode).toBeNull();
      expect(terminals.tabs[0].sessionId).toBeNull();
      expect(terminals.activeTabId).toBe(tabId);
    });

    it("tab state survives multiple addTab calls (tabs accumulate)", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      act(() => {
        result.current.addTab("project-1", "shell");
        result.current.addTab("project-1", "claude");
        result.current.addTab("project-1", "yolo");
      });

      const terminals = result.current.getProjectTerminals("project-1");

      expect(terminals.tabs).toHaveLength(3);
      expect(terminals.tabs[0].label).toBe("Shell");
      expect(terminals.tabs[1].label).toBe("Claude");
      expect(terminals.tabs[1].command).toBe("claude");
      expect(terminals.tabs[2].label).toBe("Claude YOLO");
      expect(terminals.tabs[2].command).toBe("claude --dangerously-skip-permissions");
    });

    it("setActiveTab switches the active tab ID", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let firstTabId: string;
      let secondTabId: string;

      act(() => {
        firstTabId = result.current.addTab("project-1", "shell");
        secondTabId = result.current.addTab("project-1", "claude");
      });

      // Second tab should be active after adding
      let terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.activeTabId).toBe(secondTabId);

      // Switch to first tab
      act(() => {
        result.current.setActiveTab("project-1", firstTabId);
      });

      terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.activeTabId).toBe(firstTabId);
    });

    it("closeTab removes tab and auto-selects another if it was active", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let firstTabId: string;
      let secondTabId: string;
      let thirdTabId: string;

      act(() => {
        firstTabId = result.current.addTab("project-1", "shell");
        secondTabId = result.current.addTab("project-1", "claude");
        thirdTabId = result.current.addTab("project-1", "yolo");
      });

      // Third tab should be active
      let terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.activeTabId).toBe(thirdTabId);
      expect(terminals.tabs).toHaveLength(3);

      // Close the active tab
      act(() => {
        result.current.closeTab("project-1", thirdTabId);
      });

      terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs).toHaveLength(2);
      // Should auto-select the last remaining tab
      expect(terminals.activeTabId).toBe(secondTabId);

      // Close a non-active tab
      act(() => {
        result.current.closeTab("project-1", firstTabId);
      });

      terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs).toHaveLength(1);
      // Active tab should remain unchanged
      expect(terminals.activeTabId).toBe(secondTabId);
    });

    it("renameTab updates the tab label", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let tabId: string;

      act(() => {
        tabId = result.current.addTab("project-1", "shell");
      });

      act(() => {
        result.current.renameTab("project-1", tabId, "Custom Shell");
      });

      const terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs[0].label).toBe("Custom Shell");
    });

    it("tab state persists across project switches", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      // Add tabs to project A
      act(() => {
        result.current.addTab("project-a", "shell");
        result.current.addTab("project-a", "claude");
      });

      let terminalsA = result.current.getProjectTerminals("project-a");
      expect(terminalsA.tabs).toHaveLength(2);

      // Add tabs to project B
      act(() => {
        result.current.addTab("project-b", "shell");
      });

      const terminalsB = result.current.getProjectTerminals("project-b");
      expect(terminalsB.tabs).toHaveLength(1);

      // Check that project A's tabs are still there
      terminalsA = result.current.getProjectTerminals("project-a");
      expect(terminalsA.tabs).toHaveLength(2);
      expect(terminalsA.tabs[0].label).toBe("Shell");
      expect(terminalsA.tabs[1].label).toBe("Claude");
    });
  });

  describe("Shell Panel State", () => {
    it("shellPanelCollapsed starts true (default) and toggles correctly", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      // Default is collapsed (true) when no localStorage value
      expect(result.current.shellPanelCollapsed).toBe(true);

      act(() => {
        result.current.setShellPanelCollapsed(false);
      });

      expect(result.current.shellPanelCollapsed).toBe(false);

      act(() => {
        result.current.setShellPanelCollapsed(true);
      });

      expect(result.current.shellPanelCollapsed).toBe(true);
    });

    it("setShellProject updates shellProjectId and shellProjectPath", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      expect(result.current.shellProjectId).toBeNull();
      expect(result.current.shellProjectPath).toBeNull();

      act(() => {
        result.current.setShellProject("project-1", "/path/to/project");
      });

      expect(result.current.shellProjectId).toBe("project-1");
      expect(result.current.shellProjectPath).toBe("/path/to/project");

      act(() => {
        result.current.setShellProject(null, null);
      });

      expect(result.current.shellProjectId).toBeNull();
      expect(result.current.shellProjectPath).toBeNull();
    });
  });

  describe("Additional Features", () => {
    it("setTabExited marks tab as exited with exit code", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let tabId: string;

      act(() => {
        tabId = result.current.addTab("project-1", "shell");
      });

      act(() => {
        result.current.setTabExited("project-1", tabId, 0);
      });

      const terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs[0].isExited).toBe(true);
      expect(terminals.tabs[0].exitCode).toBe(0);
    });

    it("setTabReady clears exit status", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let tabId: string;

      act(() => {
        tabId = result.current.addTab("project-1", "shell");
        result.current.setTabExited("project-1", tabId, 1);
      });

      act(() => {
        result.current.setTabReady("project-1", tabId);
      });

      const terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs[0].isExited).toBe(false);
      expect(terminals.tabs[0].exitCode).toBeNull();
    });

    it("hasTerminals returns correct status", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      expect(result.current.hasTerminals("project-1")).toBe(false);

      act(() => {
        result.current.addTab("project-1", "shell");
      });

      expect(result.current.hasTerminals("project-1")).toBe(true);
    });

    it("setTabSessionId updates the tab session ID", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let tabId: string;

      act(() => {
        tabId = result.current.addTab("project-1", "shell");
      });

      let terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs[0].sessionId).toBeNull();

      act(() => {
        result.current.setTabSessionId("project-1", tabId, "session-123");
      });

      terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs[0].sessionId).toBe("session-123");
    });

    it("registerProject and getProjectPaths work correctly", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      act(() => {
        result.current.registerProject("project-1", "/path/to/project-1");
        result.current.registerProject("project-2", "/path/to/project-2");
      });

      const paths = result.current.getProjectPaths();
      expect(paths.get("project-1")).toBe("/path/to/project-1");
      expect(paths.get("project-2")).toBe("/path/to/project-2");
    });

    it("getAllTerminals returns all project terminals", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      act(() => {
        result.current.addTab("project-1", "shell");
        result.current.addTab("project-2", "claude");
      });

      const allTerminals = result.current.getAllTerminals();
      expect(allTerminals.size).toBe(2);
      expect(allTerminals.get("project-1")?.tabs).toHaveLength(1);
      expect(allTerminals.get("project-2")?.tabs).toHaveLength(1);
    });

    it("terminalFontSize starts at 14 and clamps to 8-32 range", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      expect(result.current.terminalFontSize).toBe(14);

      act(() => {
        result.current.setTerminalFontSize(20);
      });

      expect(result.current.terminalFontSize).toBe(20);

      act(() => {
        result.current.setTerminalFontSize(5); // Below min
      });

      expect(result.current.terminalFontSize).toBe(8);

      act(() => {
        result.current.setTerminalFontSize(50); // Above max
      });

      expect(result.current.terminalFontSize).toBe(32);
    });

    it("closing all tabs removes project entry", () => {
      const { result } = renderHook(() => useTerminalContext(), { wrapper });

      let tabId: string;

      act(() => {
        tabId = result.current.addTab("project-1", "shell");
      });

      expect(result.current.hasTerminals("project-1")).toBe(true);

      act(() => {
        result.current.closeTab("project-1", tabId);
      });

      expect(result.current.hasTerminals("project-1")).toBe(false);
      const terminals = result.current.getProjectTerminals("project-1");
      expect(terminals.tabs).toEqual([]);
    });
  });
});
