// Track Your Shit - Projects Page Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/test-utils";
import { ProjectsPage } from "./projects";
import type { ProjectWithStats } from "@/lib/tauri";
import * as queries from "@/lib/queries";

// Mock the queries - match what the component actually uses
vi.mock("@/lib/queries", () => ({
  useProjectsWithStats: vi.fn(),
  useUpdateProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteProject: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

// Mock the dialog and card components to avoid complex rendering
vi.mock("@/components/projects", () => ({
  ImportDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="import-dialog">Import Dialog</div> : null,
  ProjectWizardDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="new-project-dialog">New Dialog</div> : null,
  ProjectCard: ({ project }: { project: { id: string; name: string; status: string; tech_stack?: { framework?: string; language?: string } | null } }) => (
    <a href={`/projects/${project.id}`} data-testid={`project-card-${project.id}`}>
      <span data-testid={`project-name-${project.id}`}>{project.name}</span>
      <span>{project.status}</span>
      {project.tech_stack?.framework && <span>{project.tech_stack.framework}</span>}
      {project.tech_stack?.language && <span>{project.tech_stack.language}</span>}
    </a>
  ),
  BulkProjectBar: () => null,
}));

// Mock skeleton component
vi.mock("@/components/ui/skeleton", () => ({
  SkeletonProjectItem: () => <div data-testid="skeleton-project">Loading...</div>,
}));

// Mock design tokens
vi.mock("@/lib/design-tokens", () => ({
  getProjectType: vi.fn(() => "web"),
}));

const mockProjects: ProjectWithStats[] = [
  {
    id: "1",
    name: "Control Tower",
    path: "/users/test/control-tower",
    description: "Mission control for projects",
    tech_stack: {
      framework: "React",
      language: "TypeScript",
      package_manager: "npm",
      build_tool: "Vite",
      test_framework: "Vitest",
    },
    config: {},
    status: "active",
    is_favorite: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    total_cost: 0,
    roadmap_progress: null,
    last_activity_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    name: "Test Project",
    path: "/users/test/project",
    description: "Autonomous execution engine",
    tech_stack: {
      framework: "Express",
      language: "TypeScript",
      package_manager: "npm",
      build_tool: null,
      test_framework: null,
    },
    config: {},
    status: "active",
    is_favorite: false,
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
    total_cost: 0,
    roadmap_progress: null,
    last_activity_at: "2026-01-02T00:00:00Z",
  },
  {
    id: "3",
    name: "Archived Project",
    path: "/users/test/archived",
    description: null,
    tech_stack: null,
    config: null,
    status: "archived",
    is_favorite: false,
    created_at: "2025-12-01T00:00:00Z",
    updated_at: "2025-12-01T00:00:00Z",
    total_cost: 0,
    roadmap_progress: null,
    last_activity_at: "2025-12-01T00:00:00Z",
  },
];

describe("ProjectsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Projects page with heading", () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    render(<ProjectsPage />);

    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("shows loading skeletons while data is loading", () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    render(<ProjectsPage />);

    const skeletons = screen.getAllByTestId("skeleton-project");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays empty state when no projects", () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    render(<ProjectsPage />);

    expect(screen.getByText("No Projects Yet")).toBeInTheDocument();
  });

  it("renders project cards when projects exist", () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: mockProjects,
      isLoading: false,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    render(<ProjectsPage />);

    expect(screen.getByText("Control Tower")).toBeInTheDocument();
    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("Archived Project")).toBeInTheDocument();
  });

  it("project cards link to /projects/:id", () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: mockProjects,
      isLoading: false,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    render(<ProjectsPage />);

    const controlTowerLink = screen.getByTestId("project-card-1");
    expect(controlTowerLink).toHaveAttribute("href", "/projects/1");
  });

  it("renders search input field", () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: mockProjects,
      isLoading: false,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    render(<ProjectsPage />);

    // Search input is present and functional
    const searchInput = screen.getByPlaceholderText("Search by name, path, or description...");
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveValue("");
  });

  it("opens import dialog when Import button is clicked", async () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    const user = userEvent.setup();
    render(<ProjectsPage />);

    const importButtons = screen.getAllByText("Import");
    await user.click(importButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("import-dialog")).toBeInTheDocument();
    });
  });

  it("opens new project dialog when New Project button is clicked", async () => {
    vi.mocked(queries.useProjectsWithStats).mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof queries.useProjectsWithStats>);

    const user = userEvent.setup();
    render(<ProjectsPage />);

    const newProjectButtons = screen.getAllByText("New Project");
    await user.click(newProjectButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId("new-project-dialog")).toBeInTheDocument();
    });
  });
});
