# Codebase Structure

**Analysis Date:** 2026-02-21

## Directory Layout

```
track-your-shit/
├── src/                           # React frontend source code
│   ├── components/                # Reusable React components
│   ├── contexts/                  # React Context providers (terminal, theme)
│   ├── hooks/                     # Custom React hooks
│   ├── lib/                       # Utilities and API layer
│   ├── pages/                     # Route-level page components
│   ├── styles/                    # Global CSS and Tailwind setup
│   ├── test/                      # Test utilities and setup
│   ├── App.tsx                    # Root app component with routing
│   └── main.tsx                   # React root initialization
├── src-tauri/                     # Rust backend (Tauri commands)
│   └── src/
│       ├── commands/              # Tauri command handlers
│       ├── db/                    # SQLite database models
│       ├── models/                # Data structures
│       ├── pty/                   # PTY (pseudo-terminal) management
│       ├── main.rs               # Tauri app entry point
│       └── lib.rs                # Backend library setup
├── e2e/                           # Playwright end-to-end tests
├── .planning/                     # Codebase analysis and planning docs
├── .plans/                        # Implementation plans and docs
├── dist/                          # Built frontend output (Tauri distribution)
├── public/                        # Static assets
├── node_modules/                  # NPM dependencies
├── vite.config.ts                # Vite build config (includes Vitest)
├── tsconfig.json                 # TypeScript configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── eslint.config.js              # ESLint rules
├── .prettierrc                   # Prettier formatting rules
├── package.json                  # NPM dependencies and scripts
└── playwright.config.ts          # Playwright E2E test config
```

## Directory Purposes

**src/:**
- Purpose: Complete React frontend application
- Contains: Components, pages, hooks, contexts, utilities, styles
- Key files: `main.tsx` (React root), `App.tsx` (routing), `index.html` (DOM root)

**src/components/:**
- Purpose: Reusable React components organized by feature
- Contains: UI components, feature-specific components, layout components
- Structure:
  - `ui/` - Shadcn/ui primitives (Button, Dialog, Input, etc.)
  - `layout/` - Layout components (MainLayout, Breadcrumbs, PageHeader)
  - `projects/` - Project-related components (ProjectCard, NewProjectDialog, etc.)
  - `terminal/` - Terminal components (InteractiveTerminal, TerminalTabs, etc.)
  - `dashboard/` - Dashboard-specific components
  - `settings/` - Settings UI components
  - `theme/` - Theme provider and customization
  - `shared/` - Shared components (ProjectSelector)
  - `command-palette/` - Global command palette
  - `knowledge/` - Knowledge graph visualization
  - `notifications/` - Notification components

**src/contexts/:**
- Purpose: Global state management via React Context
- Contains:
  - `terminal-context.tsx` - Persistent terminal session state
  - Theme context (in `src/components/theme/`)

**src/hooks/:**
- Purpose: Custom React hooks for common patterns
- Key hooks:
  - `use-close-warning.ts` - App close confirmation when terminals active
  - `use-pty-session.ts` - PTY terminal session management
  - `use-keyboard-shortcuts.ts` - Global keyboard shortcut handling
  - `use-gsd-file-watcher.ts` - File system watching for GSD projects
  - `use-theme.ts` - Theme switching

**src/lib/:**
- Purpose: Utilities, API layer, and business logic helpers
- Key files:
  - `tauri.ts` - Tauri command wrapper with TypeScript types
  - `queries.ts` - React Query hooks for all API operations
  - `query-keys.ts` - React Query key factories
  - `utils.ts` - Helper functions (formatCost, formatRelativeTime, truncatePath, getErrorMessage, cn)
  - `navigation.ts` - App navigation routes and menu config
  - `design-tokens.ts` - Design system constants (colors, spacing)
  - `performance.ts` - Performance monitoring utilities
  - `sentry.ts` - Sentry error tracking initialization
  - `knowledge-graph-utils.ts` - Utilities for knowledge graph visualization
  - `recent-searches.ts` - Recent search history management

**src/pages/:**
- Purpose: Route-level page components
- Key pages:
  - `dashboard.tsx` - Project grid with stats
  - `projects.tsx` - Projects list/grid view
  - `project.tsx` - Single project detail page
  - `shell.tsx` - Terminal shell interface
  - `settings.tsx` - App settings
  - `logs.tsx` - Activity logs
  - `todos.tsx` - Todo management
  - `notifications.tsx` - Notification center

**src/styles/:**
- Purpose: Global CSS styling
- Contains: `globals.css` with Tailwind directives and custom CSS variables

**src/test/:**
- Purpose: Test utilities and configuration
- Contains:
  - `setup.ts` - Vitest global setup (mocks localStorage, sessionStorage, Tauri APIs)
  - `test-utils.tsx` - Custom render function and test helpers

**src-tauri/src/:**
- Purpose: Rust backend implementation
- Key modules:
  - `main.rs` - Tauri app entry point
  - `lib.rs` - Library setup and module exports
  - `commands/` - Command handlers (invoked from frontend)
  - `db/` - SQLite database layer
  - `models/` - Data structures
  - `pty/` - PTY session management
  - `security.rs` - Security utilities

**e2e/:**
- Purpose: End-to-end tests with Playwright
- Contains: Test specs for major user flows

**.planning/codebase/:**
- Purpose: Auto-generated codebase analysis (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Contents: Architecture docs, tech stack analysis, conventions, testing patterns

**.plans/:**
- Purpose: Hand-written implementation plans
- Contents: Phase plans, feature specs, decision logs

**dist/:**
- Purpose: Built frontend output
- Generated by: `npm run build`
- Consumed by: Tauri bundler

**public/:**
- Purpose: Static assets (favicon, images)
- Contents: `cat-logo.jpeg`, favicons

## Key File Locations

**Entry Points:**
- `index.html` - DOM root (`<div id="root"></div>`)
- `src/main.tsx` - React root initialization
- `src/App.tsx` - Router setup and page-level structure
- `src-tauri/src/main.rs` - Tauri application start

**Configuration:**
- `vite.config.ts` - Vite build config and Vitest setup
- `tsconfig.json` - TypeScript compiler options
- `tailwind.config.js` - Tailwind CSS configuration
- `eslint.config.js` - ESLint rules
- `.prettierrc` - Code formatting rules
- `playwright.config.ts` - E2E test configuration

**API Layer:**
- `src/lib/tauri.ts` - Tauri command wrapper (all backend operations)
- `src/lib/queries.ts` - React Query hooks (all API calls)
- `src-tauri/src/commands/` - Rust command handlers

**Core Logic:**
- `src/contexts/terminal-context.tsx` - Terminal session state management
- `src/components/layout/main-layout.tsx` - App layout and sidebar
- `src/components/error-boundary.tsx` - React error catching

**Testing:**
- `src/test/setup.ts` - Vitest global configuration
- `src/test/test-utils.tsx` - Custom test utilities
- `e2e/` - Playwright end-to-end tests

## Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `MainLayout.tsx`, `ProjectCard.tsx`)
- Pages: `lowercase.tsx` (e.g., `dashboard.tsx`, `projects.tsx`)
- Utilities/Hooks: `kebab-case.ts` (e.g., `use-keyboard-shortcuts.ts`, `query-keys.ts`)
- Tests: `{filename}.test.ts` or `{filename}.test.tsx` (e.g., `utils.test.ts`, `error-boundary.test.tsx`)

**Directories:**
- Feature directories: `lowercase` (e.g., `projects/`, `terminal/`, `settings/`)
- Utility directories: `lowercase` (e.g., `hooks/`, `lib/`, `contexts/`)
- Component library: `ui/` for Shadcn/ui components

**Exports:**
- Named exports for components and hooks
- Default export for pages (lazy-loaded routes)
- Barrel files (index.ts) for grouping related exports (e.g., `src/components/projects/index.ts`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/pages/{feature}.tsx` (page) + `src/components/{feature}/` (components)
- Queries: Add hooks to `src/lib/queries.ts` and keys to `src/lib/query-keys.ts`
- Backend: Add command handler to `src-tauri/src/commands/{feature}.rs`
- Tests: `src/pages/{feature}.test.tsx`, `src/components/{feature}/{component}.test.tsx`

**New Component/Module:**
- Feature-specific: `src/components/{feature}/{component}.tsx`
- Shared/reusable: `src/components/shared/{component}.tsx`
- UI primitive: `src/components/ui/{component}.tsx` (typically from Shadcn/ui)

**Utilities:**
- General helpers: `src/lib/utils.ts`
- Feature-specific: `src/lib/{feature}-utils.ts`
- Hooks: `src/hooks/use-{feature}.ts`
- Context: `src/contexts/{feature}-context.tsx`

**Backend (Rust):**
- Command handler: `src-tauri/src/commands/{feature}.rs`
- Database model: `src-tauri/src/db/models.rs`
- Type definition: `src-tauri/src/models/` (separate files per domain)

## Special Directories

**src/components/__tests__/:**
- Purpose: Component-level test files
- Generated: No
- Committed: Yes
- Contains: Tests for components that need more complex setup (ErrorBoundary, MainLayout)

**src/lib/__tests__/:**
- Purpose: Utility function tests
- Generated: No
- Committed: Yes
- Contains: Unit tests for utils, query-keys, performance, etc.

**dist/:**
- Purpose: Built frontend bundle
- Generated: Yes (by `npm run build`)
- Committed: No

**src-tauri/target/:**
- Purpose: Rust build output
- Generated: Yes (by Rust compiler)
- Committed: No

**.git/:**
- Purpose: Git repository metadata
- Generated: Yes
- Committed: Yes (directory itself)

---

*Structure analysis: 2026-02-21*
