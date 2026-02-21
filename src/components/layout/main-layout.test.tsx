// Track Your Shit - MainLayout Collapsible Sidebar Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@/test/test-utils";
import { MainLayout } from "./main-layout";

// Mock ShellPage to avoid PTY/terminal complexity
vi.mock("@/pages/shell", () => ({
  ShellPage: () => <div data-testid="shell-page-mock">Shell</div>,
}));

describe("MainLayout - Collapsible Sidebar", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it("renders sidebar with all navigation items", () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    // Check that navigation items are present (matching current navigation.ts)
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    // Terminal appears multiple times (nav item + shell panel)
    expect(screen.getAllByText("Terminal").length).toBeGreaterThan(0);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders sidebar with toggle button/area", () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    // Check for the collapse toggle button via aria-label
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });

  it("sidebar starts expanded by default (w-64 class)", () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    // Find the aside element and check it has w-64 class
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("w-64");
    expect(aside).not.toHaveClass("w-16");
  });

  it("clicking toggle collapses sidebar (aside gets w-16 class)", async () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    const aside = screen.getByRole("complementary");

    // Initially expanded
    expect(aside).toHaveClass("w-64");

    // Click the collapse button
    const collapseButton = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(collapseButton);

    // Wait for state update and check collapsed class
    await waitFor(() => {
      expect(aside).toHaveClass("w-16");
      expect(aside).not.toHaveClass("w-64");
    });
  });

  it("collapsed state is persisted to localStorage", async () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    // Click collapse button
    const collapseButton = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(collapseButton);

    // Check localStorage was updated
    await waitFor(() => {
      expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
    });
  });

  it("clicking toggle again expands sidebar (aside gets w-64 class)", async () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    const aside = screen.getByRole("complementary");

    // Collapse first
    const collapseButton = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(aside).toHaveClass("w-16");
    });

    // Now expand again using the aria-labeled button
    const expandButton = screen.getByLabelText("Expand sidebar");
    fireEvent.click(expandButton);

    // Should be expanded again
    await waitFor(() => {
      expect(aside).toHaveClass("w-64");
      expect(aside).not.toHaveClass("w-16");
    });
  });

  it("expanded state is persisted to localStorage", async () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    // Collapse first
    const collapseButton = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
    });

    // Expand again
    const expandButton = screen.getByLabelText("Expand sidebar");
    fireEvent.click(expandButton);

    // Check localStorage was updated to false
    await waitFor(() => {
      expect(localStorage.getItem("sidebar-collapsed")).toBe("false");
    });
  });

  it("sidebar starts collapsed when localStorage has 'sidebar-collapsed' = 'true'", () => {
    // Set localStorage before render
    localStorage.setItem("sidebar-collapsed", "true");

    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    const aside = screen.getByRole("complementary");

    // Should start collapsed
    expect(aside).toHaveClass("w-16");
    expect(aside).not.toHaveClass("w-64");
  });

  it("when collapsed, navigation item text is hidden", async () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    // Initially expanded - text should be visible
    expect(screen.getByText("Dashboard")).toBeInTheDocument();

    // Collapse
    const collapseButton = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(collapseButton);

    await waitFor(() => {
      // Text should be hidden (not in document, but links still exist)
      // The text spans are conditionally rendered based on !sidebarCollapsed
      const aside = screen.getByRole("complementary");
      expect(aside).toHaveClass("w-16");
    });

    // Dashboard text should be gone when sidebar is collapsed
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("when collapsed, shows PanelLeftOpen icon with tooltip", async () => {
    render(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    // Collapse sidebar
    const collapseButton = screen.getByLabelText("Collapse sidebar");
    fireEvent.click(collapseButton);

    await waitFor(() => {
      const aside = screen.getByRole("complementary");
      expect(aside).toHaveClass("w-16");
    });

    // The PanelLeftOpen icon should be rendered (we can't directly test lucide icons easily,
    // but we can verify the collapse button text is gone and the toggle area exists)
    // Sidebar shows expand button instead when collapsed
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("children content is rendered", () => {
    render(
      <MainLayout>
        <div data-testid="test-content">Test Content</div>
      </MainLayout>
    );

    expect(screen.getByTestId("test-content")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });
});
