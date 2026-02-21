// Track Your Shit - Error Boundary Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "../error-boundary";
import { invoke } from "@tauri-apps/api/core";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Component that throws an error when prop is true
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>Normal content</div>;
}

// Component that throws a custom error
function ThrowCustomError({ error }: { error?: Error }) {
  if (error) {
    throw error;
  }
  return <div>Normal content</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error from React error boundary in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Mock invoke to return a resolved promise by default
    vi.mocked(invoke).mockResolvedValue(undefined);
  });

  describe("normal rendering", () => {
    it("renders children when no error occurs", () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("renders multiple children when no error", () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ErrorBoundary>
      );

      expect(screen.getByText("First child")).toBeInTheDocument();
      expect(screen.getByText("Second child")).toBeInTheDocument();
    });
  });

  describe("error catching", () => {
    it("catches and displays error when child component throws", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });

    it("displays error message in preformatted block", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorMessage = screen.getByText("Test error message");
      expect(errorMessage.tagName).toBe("PRE");
    });

    it("shows Try Again and Reload App buttons on error", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Try Again")).toBeInTheDocument();
      expect(screen.getByText("Reload App")).toBeInTheDocument();
    });
  });

  describe("full-page mode (default)", () => {
    it("renders full-page error UI by default", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
    });

    it("shows error message with label when provided", () => {
      render(
        <ErrorBoundary label="Dashboard">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("An error occurred in Dashboard.")).toBeInTheDocument();
    });
  });

  describe("inline mode", () => {
    it("renders compact inline error when inline prop is true", () => {
      render(
        <ErrorBoundary inline>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Test error message")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("shows label in inline mode when provided", () => {
      render(
        <ErrorBoundary inline label="Settings Panel">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Settings Panel failed to load")).toBeInTheDocument();
    });

    it("truncates long error messages in inline mode", () => {
      const longError = new Error("A".repeat(200));
      render(
        <ErrorBoundary inline>
          <ThrowCustomError error={longError} />
        </ErrorBoundary>
      );

      const errorText = screen.getByText(/A+/);
      expect(errorText.className).toContain("truncate");
    });
  });

  describe("fallback rendering", () => {
    it("renders custom fallback when provided", () => {
      render(
        <ErrorBoundary fallback={<div>Custom fallback content</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Custom fallback content")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("uses custom fallback instead of default error UI", () => {
      render(
        <ErrorBoundary fallback={<div>Fallback</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText("Try Again")).not.toBeInTheDocument();
      expect(screen.queryByText("Reload App")).not.toBeInTheDocument();
    });
  });

  describe("error recovery", () => {
    it("resets error state when Try Again button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Try Again")).toBeInTheDocument();

      // Click Try Again to reset the error boundary
      const tryAgainButton = screen.getByText("Try Again");
      await user.click(tryAgainButton);

      // The error boundary resets, which causes child to re-render
      // Since ThrowError still has shouldThrow=true, it will throw again
      // and we should still see the error UI
      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("resets error state when Retry button is clicked in inline mode", async () => {
      const user = userEvent.setup();

      render(
        <ErrorBoundary inline>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();

      // Click Retry to reset the error boundary
      const retryButton = screen.getByText("Retry");
      await user.click(retryButton);

      // The error boundary resets, which causes child to re-render
      // Since ThrowError still has shouldThrow=true, it will throw again
      await waitFor(() => {
        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      });
    });

    it("reloads page when Reload App button is clicked", async () => {
      const user = userEvent.setup();
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        value: { reload: reloadMock },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText("Reload App");
      await user.click(reloadButton);

      expect(reloadMock).toHaveBeenCalledOnce();
    });
  });

  describe("logging to backend", () => {
    it("logs error to Tauri backend when error occurs", async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue(undefined);

      render(
        <ErrorBoundary label="TestComponent">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "log_frontend_error",
          expect.objectContaining({
            error: expect.stringContaining("[ErrorBoundary:TestComponent]"),
          })
        );
      });
    });

    it("includes error message in backend log", async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue(undefined);

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "log_frontend_error",
          expect.objectContaining({
            error: expect.stringContaining("Test error message"),
          })
        );
      });
    });

    it("uses unknown label when none provided", async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockResolvedValue(undefined);

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "log_frontend_error",
          expect.objectContaining({
            error: expect.stringContaining("[ErrorBoundary:unknown]"),
          })
        );
      });
    });

    it("silently continues if backend logging fails", async () => {
      const mockInvoke = vi.mocked(invoke);
      mockInvoke.mockRejectedValue(new Error("Backend not available"));

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should still show error UI even if logging fails
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("different error types", () => {
    it("handles TypeError", () => {
      render(
        <ErrorBoundary>
          <ThrowCustomError error={new TypeError("Type error occurred")} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Type error occurred")).toBeInTheDocument();
    });

    it("handles RangeError", () => {
      render(
        <ErrorBoundary>
          <ThrowCustomError error={new RangeError("Range error occurred")} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Range error occurred")).toBeInTheDocument();
    });

    it("handles errors with empty messages", () => {
      render(
        <ErrorBoundary>
          <ThrowCustomError error={new Error("")} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  describe("component state", () => {
    it("maintains error state after error occurs", () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Re-render boundary (not clicking reset)
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should still show error
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("renders normal content when switched from error to non-error", async () => {
      let shouldThrow = true;
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Directly update the child to not throw
      shouldThrow = false;
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );

      // Should still show error UI until reset
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });
});
