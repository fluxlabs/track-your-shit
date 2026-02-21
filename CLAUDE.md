# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Track Your Shit is a native desktop application for managing Claude Code projects. It provides project management, terminal sessions (with tmux support), knowledge base browsing, GSD workflow integration, git operations, and more. Built with Tauri 2.x (Rust backend + React frontend).

## Development Commands

```bash
# Install dependencies
pnpm install

# Start dev server (frontend + Rust backend with hot reload)
pnpm tauri dev

# Build for production
pnpm tauri build

# Frontend-only dev server (no Tauri backend, runs on port 1420)
pnpm dev

# Build frontend only (TypeScript check + Vite build)
pnpm build

# Run unit tests
pnpm test              # single run
pnpm test:watch        # watch mode

# Run E2E tests
pnpm test:e2e
pnpm test:e2e:ui       # with Playwright UI
pnpm test:e2e:debug    # debug mode

# Lint & format
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

## Architecture

### Two-Process Model (Tauri)

- **Frontend** (`src/`): React 18 + TypeScript + Vite. Communicates with backend via Tauri's `invoke()` IPC.
- **Backend** (`src-tauri/`): Rust. Exposes Tauri commands that the frontend calls. Manages SQLite database, PTY sessions, file watching, and OS keychain access.

### Frontend Structure (`src/`)

- **Pages** (`pages/`): Route-level components — dashboard, projects, project detail, terminal/shell, settings, logs, notifications, todos. Lazy-loaded via React.lazy for code splitting.
- **Components** (`components/`): Organized by domain — `ui/` (shadcn/ui primitives), `layout/`, `terminal/`, `project/`, `knowledge/`, `notifications/`, `settings/`, `dashboard/`, `command-palette/`, `theme/`.
- **Lib** (`lib/`): `tauri.ts` (typed invoke wrappers), `queries.ts` (TanStack Query hooks), `query-keys.ts` (query key factory), `utils.ts`, `design-tokens.ts`, `navigation.ts`.
- **Hooks** (`hooks/`): `use-pty-session.ts`, `use-keyboard-shortcuts.ts`, `use-theme.ts`, `use-gsd-file-watcher.ts`, `use-close-warning.ts`.
- **Contexts** (`contexts/`): `terminal-context.tsx` — manages terminal session state across pages.

### Backend Structure (`src-tauri/src/`)

- **Commands** (`commands/`): Tauri command handlers organized by domain — `projects`, `filesystem`, `git`, `pty`, `knowledge`, `gsd`, `settings`, `secrets`, `notifications`, `terminal`, `snippets`, `dependencies`, `watcher`, `activity`, `search`, `logs`, `data`. Each module exposes `#[tauri::command]` functions registered in `lib.rs`.
- **Database** (`db/`): SQLite via rusqlite with WAL mode. Uses a read/write connection pool (`DbPool`) — 1 writer + 4 readers with round-robin distribution. Schema migrations run on startup. Also includes a custom `SqliteLayer` for tracing.
- **Models** (`models/`): Serde-serializable structs for `Project`, `TechStack`, `ActivityEntry`, etc.
- **PTY** (`pty/`): Terminal session management via `portable-pty` with optional tmux integration.
- **Security** (`security.rs`): OS keychain integration via the `keyring` crate.

### Key Patterns

- **IPC**: Frontend calls `invoke<T>("command_name", { args })` from `@tauri-apps/api`. Backend functions are `#[tauri::command] async fn` that receive `State<Arc<DbPool>>` and return `Result<T, String>`.
- **Data fetching**: TanStack Query hooks in `lib/queries.ts` wrap Tauri invocations with caching, polling, and invalidation. Query keys are defined in `lib/query-keys.ts`.
- **Path alias**: `@/*` maps to `./src/*` (configured in both tsconfig.json and vite.config.ts).
- **Styling**: Tailwind CSS with shadcn/ui design system. Colors use HSL CSS variables (e.g., `hsl(var(--primary))`). Dark mode via class strategy. Custom brand, status, and terminal color tokens.
- **Error handling**: `ErrorBoundary` component wraps the app and individual pages. Sentry integration for production error tracking.

## File Header Convention

All files must include:
```
// Track Your Shit - [File Purpose]
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
```

## Testing

- Unit tests use Vitest + React Testing Library + jsdom. Config in `vite.config.ts` under `test`.
- Test setup in `src/test/setup.ts`, test utilities in `src/test/test-utils.tsx`.
- Tests live alongside source as `*.test.ts(x)` files or in `__tests__/` directories.
- E2E tests use Playwright.

## Database

SQLite database stored at the OS app data directory as `track-your-shit.db`. WAL mode enabled for concurrent reads. The `DbPool` pattern is critical — use `pool.read()` for SELECT queries and `pool.write()` for mutations to avoid contention.
