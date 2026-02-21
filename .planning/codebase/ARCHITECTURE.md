# Architecture

**Analysis Date:** 2026-02-21

## Pattern Overview

**Overall:** Tauri Desktop Application with React Frontend and Rust Backend

This is a desktop application built with the Tauri framework, combining a modern React frontend (TypeScript + Vite) with a Rust backend for system-level operations. The architecture follows a clear separation of concerns: the frontend handles UI and state management via React Query, while the backend (Rust) manages file I/O, terminal session management (PTY), Git operations, and database access.

**Key Characteristics:**
- Desktop application (cross-platform via Tauri)
- Client-server communication via Tauri's `invoke` command bridge
- React Query for frontend state management and API data synchronization
- Context-based global state for persistent terminal sessions
- Component-driven UI with Shadcn/ui component library
- Type-safe frontend-backend contract via TypeScript interfaces

## Layers

**Frontend (React + TypeScript):**
- Purpose: User interface, state management, event handling
- Location: `src/`
- Contains: React components, pages, hooks, contexts, utility libraries
- Depends on: Tauri API (`@tauri-apps/api`), React Query, external libraries
- Used by: Tauri window, end users

**Tauri Backend Bridge:**
- Purpose: IPC (Inter-Process Communication) between React and Rust
- Location: `src/lib/tauri.ts` (API wrapper), Tauri runtime
- Contains: Type-safe command invocation, event listeners
- Depends on: Tauri runtime
- Used by: All frontend code needing backend operations

**Rust Backend (Tauri Commands):**
- Purpose: System operations, database, file I/O, terminal management
- Location: `src-tauri/src/`
- Contains: Command handlers, PTY management, database models, Git integration
- Depends on: Tokio, rusqlite, git2, nix crate
- Used by: Frontend via Tauri command invoke

**UI Component System:**
- Purpose: Reusable, accessible UI primitives (Radix UI wrapped)
- Location: `src/components/ui/`
- Contains: Button, Dialog, Input, Select, etc. (Shadcn/ui components)
- Depends on: React, Radix UI, Tailwind CSS
- Used by: Feature components throughout app

**Feature Components:**
- Purpose: Domain-specific UI (Projects, Terminal, Settings, Dashboard)
- Location: `src/components/{feature}/`
- Contains: Feature-specific components, dialogs, forms
- Depends on: UI components, hooks, contexts, queries
- Used by: Pages and layout

**Pages:**
- Purpose: Route-level components representing major app sections
- Location: `src/pages/`
- Contains: Dashboard, Projects, Project Detail, Terminal, Settings, Logs, Todos, Notifications
- Depends on: Components, hooks, queries, contexts
- Used by: React Router (App.tsx)

**Data Access Layer:**
- Purpose: React Query hooks for Tauri command invocation
- Location: `src/lib/queries.ts`
- Contains: useQuery and useMutation hooks wrapping Tauri API calls
- Depends on: React Query, Tauri API wrapper
- Used by: Components and pages

**Tauri API Wrapper:**
- Purpose: Type-safe abstraction over Tauri `invoke` calls
- Location: `src/lib/tauri.ts`
- Contains: Async functions wrapping Tauri commands, TypeScript interfaces for all data types
- Depends on: Tauri core API, event listeners
- Used by: Queries layer and hooks

## Data Flow

**User Action → UI Update Flow:**

1. User interacts with React component (click, form submission, etc.)
2. Component calls hook (e.g., `useCreateProject()` mutation)
3. Hook calls Tauri API wrapper function (e.g., `createProject(name, path)`)
4. Wrapper invokes Tauri command: `invoke("create_project", { ... })`
5. Tauri passes command to Rust backend
6. Rust handler executes business logic (DB write, file operations, etc.)
7. Handler returns result/error to frontend
8. React Query processes response (onSuccess/onError callbacks)
9. Query cache updates trigger component re-render
10. UI reflects new state (toast notification, list update, etc.)

**State Management:**

- **Query State:** Managed by React Query with configurable stale times and refetch intervals
- **Global State:** Terminal sessions via `TerminalContext` (persists across navigation)
- **Local State:** Component-level state (search filters, form inputs, expanded panels)
- **Persistent State:** localStorage for sidebar collapse state, theme preference

## Key Abstractions

**Tauri Command as API Contract:**
- Purpose: Type-safe bridge between React and Rust
- Examples: `src/lib/tauri.ts` exports functions like `listProjects()`, `createProject()`, `gitPush()`
- Pattern: Each function wraps an `invoke("command_name", payload)` call with typed parameters and return values

**React Query Hook Pattern:**
- Purpose: Encapsulate data fetching, caching, and mutation logic
- Examples: `useProjects()`, `useGitStatus()`, `useCreateProject()`
- Pattern: Hooks in `src/lib/queries.ts` wrap Tauri API calls with React Query configuration (stale time, refetch intervals, error handling)

**Terminal Context:**
- Purpose: Persistent terminal session management across page navigation
- File: `src/contexts/terminal-context.tsx`
- Pattern: Provides terminal state (tabs, active tab, session IDs) to entire app tree via context; handles PTY reconnection and tmux session tracking

**Component Hierarchy:**
- Purpose: Reusable UI building blocks
- Pattern: Shadcn/ui (Radix + Tailwind) components in `src/components/ui/`, feature-specific compounds in feature directories

**Error Boundary:**
- Purpose: Catch React runtime errors to prevent white-screen crashes
- File: `src/components/error-boundary.tsx`
- Pattern: Class component wrapping page content; logs errors to Sentry and Tauri backend for debugging

## Entry Points

**Application Entry:**
- Location: `src/main.tsx`
- Triggers: Browser loads Tauri window
- Responsibilities: Initialize React root, set up React Query client, wrap app with providers (ThemeProvider, QueryClientProvider, TerminalProvider)

**Router Entry:**
- Location: `src/App.tsx`
- Triggers: React root renders
- Responsibilities: Define routes, set up error boundary, lazy-load pages, handle app-level dialogs (close warning)

**Layout Entry:**
- Location: `src/components/layout/main-layout.tsx`
- Triggers: Rendered by App.tsx
- Responsibilities: Render persistent sidebar, command palette, shell panel; manage sidebar collapse state; show page content with header

**Tauri Backend Entry:**
- Location: `src-tauri/src/main.rs`
- Triggers: Desktop application launches
- Responsibilities: Initialize Tauri runtime, register command handlers, set up window state

## Error Handling

**Strategy:** Multi-layered error catching and reporting

**Patterns:**
- **Component Level:** ErrorBoundary wraps page content; captures React errors, logs to Sentry and Tauri backend
- **Hook Level:** React Query `onError` callbacks show toast notifications via Sonner; specific error messages extracted from backend responses
- **Backend Level:** Rust handlers return `Result<T, String>` with descriptive error messages; converted to frontend-friendly messages
- **User Feedback:** Toast notifications (Sonner) for mutation results, inline error messages in forms, dedicated error dialogs for critical failures

## Cross-Cutting Concerns

**Logging:**
- Frontend: Errors captured by Sentry (DSN from env); Tauri backend logs frontend errors via `log_frontend_error` command
- Backend: Rust standard logging (tracing/log crates)

**Validation:**
- Form validation in React components (client-side)
- Backend validation in Rust handlers (server-side)

**Authentication:**
- Not present in this version; app operates on local desktop only (user's own machine)

**Theme Management:**
- ThemeProvider wraps entire app in `src/main.tsx`
- Theme context manages light/dark mode and custom design tokens
- Tailwind CSS for styling with custom design tokens (colors, spacing)

**Keyboard Shortcuts:**
- Centralized in `KeyboardShortcutsProvider` wrapper
- Shortcuts defined in `src/hooks/use-keyboard-shortcuts.ts`
- Global shortcuts (Cmd/Ctrl+K for command palette) handled via context

---

*Architecture analysis: 2026-02-21*
