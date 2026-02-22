# Track Your Shit
<!-- Track Your Shit - Project README -->
<!-- Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net> -->

A native desktop application for managing Claude Code projects with project management, terminal sessions (tmux support), knowledge base browsing, GSD workflow integration, git operations, and more.

## Features

- **Project Management** - Import and manage multiple Claude Code projects with tech stack detection
- **Terminal Sessions** - Integrated PTY terminal with optional tmux support
- **Knowledge Base** - Browse and search project documentation with markdown rendering
- **GSD Workflow** - Track phases, tasks, and progress with file watching
- **Git Operations** - View status, diffs, branches, and commit history
- **Activity Tracking** - Real-time activity feed and decision history
- **Command Palette** - Quick navigation and actions via keyboard
- **Notifications & Todos** - Stay on top of project tasks
- **Native Performance** - Built with Tauri for a lightweight, fast experience

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **UI**: shadcn/ui + Tailwind CSS + Lucide icons
- **State**: TanStack Query
- **Backend**: Rust + Tauri 2.x
- **Database**: SQLite (rusqlite) with WAL mode
- **Terminal**: xterm.js + portable-pty
- **Error Tracking**: Sentry

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Start dev server (frontend + Rust backend with hot reload)
pnpm tauri dev

# Frontend-only dev server (no Tauri backend, runs on port 1420)
pnpm dev
```

### Build

```bash
# Build for production
pnpm tauri build

# Build frontend only (TypeScript check + Vite build)
pnpm build
```

### Testing

```bash
# Unit tests (Vitest + React Testing Library)
pnpm test              # single run
pnpm test:watch        # watch mode

# E2E tests (Playwright)
pnpm test:e2e
pnpm test:e2e:ui       # with Playwright UI
pnpm test:e2e:debug    # debug mode
```

### Lint & Format

```bash
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
```

## Project Structure

```
track-your-shit/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root component with routing
│   ├── pages/                    # Route-level components (lazy-loaded)
│   │   ├── dashboard.tsx         # Dashboard overview
│   │   ├── projects.tsx          # Project list
│   │   ├── project.tsx           # Project detail (tabbed)
│   │   ├── shell.tsx             # Terminal/shell sessions
│   │   ├── settings.tsx          # App settings
│   │   ├── logs.tsx              # Application logs
│   │   ├── notifications.tsx     # Notifications
│   │   └── todos.tsx             # Todo management
│   ├── components/               # UI components by domain
│   │   ├── ui/                   # shadcn/ui primitives
│   │   ├── layout/               # App layout (sidebar, header)
│   │   ├── terminal/             # Terminal components
│   │   ├── project/              # Project detail components
│   │   ├── knowledge/            # Knowledge base & markdown
│   │   ├── dashboard/            # Dashboard widgets
│   │   ├── command-palette/      # Command palette (cmdk)
│   │   ├── notifications/        # Notification components
│   │   ├── settings/             # Settings forms
│   │   ├── import/               # Project import flow
│   │   ├── shared/               # Shared components
│   │   └── theme/                # Theme provider
│   ├── lib/                      # Utilities & API layer
│   │   ├── tauri.ts              # Typed Tauri invoke wrappers
│   │   ├── queries.ts            # TanStack Query hooks
│   │   ├── query-keys.ts         # Query key factory
│   │   ├── utils.ts              # General utilities
│   │   ├── design-tokens.ts      # Design system tokens
│   │   ├── navigation.ts         # Route definitions
│   │   ├── sentry.ts             # Error tracking setup
│   │   └── performance.ts        # Performance utilities
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-pty-session.ts    # Terminal session management
│   │   ├── use-keyboard-shortcuts.ts
│   │   ├── use-theme.ts
│   │   ├── use-gsd-file-watcher.ts
│   │   └── use-close-warning.ts
│   └── contexts/                 # React contexts
│       └── terminal-context.tsx  # Terminal state management
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # App setup & command registration
│   │   ├── commands/             # Tauri command handlers
│   │   │   ├── projects.rs       # Project CRUD
│   │   │   ├── filesystem.rs     # File system operations
│   │   │   ├── git.rs            # Git operations
│   │   │   ├── pty.rs            # PTY session management
│   │   │   ├── knowledge.rs      # Knowledge base
│   │   │   ├── gsd.rs            # GSD workflow
│   │   │   ├── settings.rs       # App settings
│   │   │   ├── secrets.rs        # Keychain access
│   │   │   ├── notifications.rs  # Notifications
│   │   │   ├── terminal.rs       # Terminal config
│   │   │   ├── snippets.rs       # Code snippets
│   │   │   ├── dependencies.rs   # Dependency info
│   │   │   ├── watcher.rs        # File watching
│   │   │   ├── activity.rs       # Activity tracking
│   │   │   ├── search.rs         # Search
│   │   │   ├── logs.rs           # Log management
│   │   │   └── data.rs           # Data operations
│   │   ├── db/                   # SQLite database (WAL mode)
│   │   ├── models/               # Data types
│   │   ├── pty/                  # PTY + tmux integration
│   │   └── security.rs           # OS keychain (keyring)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── website/                      # Marketing website
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── CLAUDE.md                     # Claude Code guidance
```

## Database

SQLite database stored at the OS app data directory as `track-your-shit.db`. WAL mode enabled for concurrent reads. Uses a read/write connection pool (`DbPool`) — 1 writer + 4 readers with round-robin distribution.

## License

MIT
