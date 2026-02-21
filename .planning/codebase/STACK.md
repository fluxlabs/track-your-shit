# Technology Stack

**Analysis Date:** 2026-02-21

## Languages

**Primary:**
- TypeScript 5.7.2 - Frontend React components and utilities
- Rust 2021 edition - Tauri backend, database, file system, PTY, native APIs

**Secondary:**
- JavaScript (transpiled from TypeScript)
- HTML5 - Application template
- CSS - Styling via Tailwind CSS

## Runtime

**Environment:**
- Node.js (development, build tooling)
- Tauri 2.x runtime (desktop application container)
- Chrome/WebKit browser engines (Windows uses Chromium 105+, macOS/Linux use Safari 15+)

**Package Manager:**
- pnpm (primary package manager for Node dependencies)
- Cargo (Rust package manager)
- Lockfiles: `pnpm-lock.yaml` (expected, using pnpm)

## Frameworks

**Core:**
- React 18.3.1 - UI framework
- React Router DOM 7.1.1 - Client-side routing
- Tauri 2.2.0 - Desktop application framework and IPC bridge

**UI Components:**
- Radix UI (v1.x-v2.x) - Accessible component primitives
- shadcn/ui pattern - Component composition pattern built on Radix UI

**State Management:**
- TanStack React Query 5.62.0 - Server state management and caching
- React Context API - Local state management (terminal state)
- localStorage/sessionStorage - Client-side persistence

**Testing:**
- Vitest 4.0.18 - Unit test framework
- Playwright 1.58.2 - E2E testing framework
- Testing Library (@testing-library/react 16.3.2, @testing-library/jest-dom 6.9.1) - Component testing

**Build/Dev:**
- Vite 6.0.5 - Build tool and dev server
- TypeScript 5.7.2 - Type checking
- ESLint 9.39.2 + TypeScript ESLint 8.54.0 - Linting
- Prettier 3.8.1 - Code formatting
- PostCSS 8.4.49 - CSS processing
- Tailwind CSS 3.4.17 - Utility-first CSS framework

## Key Dependencies

**Critical:**
- @tauri-apps/api 2.2.0 - JavaScript bridge to Tauri runtime commands
- @tauri-apps/cli 2.2.0 - Build and development CLI for Tauri
- @tauri-apps/plugin-shell 2.2.0 - Shell command execution (native shell integration)
- @tauri-apps/plugin-dialog 2.2.0 - Native file/folder dialogs
- @tauri-apps/plugin-fs 2.2.0 - File system operations
- rusqlite 0.32 - SQLite database (bundled, Rust side)
- portable-pty 0.8 - PTY/terminal session management
- keyring 3.x - OS keychain integration (secrets management)

**Infrastructure:**
- @sentry/react 10.38.0 - Error tracking and monitoring (optional, DSN-based initialization)
- @tanstack/react-query-devtools 5.91.3 - React Query debugging tools

**UI/UX:**
- Lucide React 0.468.0 - Icon library
- recharts 2.15.0 - Charting library
- @xyflow/react 12.10.0 - React flow diagram/graph visualization
- @dnd-kit 6.3.1+ - Drag-and-drop utilities
- react-resizable-panels 4.6.2 - Resizable panel layout
- sonner 2.0.7 - Toast notifications
- cmdk 1.1.1 - Command palette/menu component
- react-markdown 10.1.0 - Markdown rendering
- remark-gfm 4.0.1 - GitHub-flavored markdown support
- rehype-highlight 7.0.2 - Code syntax highlighting
- highlight.js 11.11.1 - Syntax highlighter

**Terminal:**
- @xterm/xterm 6.0.0 - Terminal emulator UI
- @xterm/addon-fit 0.11.0 - Terminal auto-fit
- @xterm/addon-search 0.16.0 - Terminal search
- @xterm/addon-serialize 0.14.0 - Terminal session serialization
- @xterm/addon-web-links 0.12.0 - Web link detection in terminal

**Utilities:**
- date-fns 4.1.0 - Date formatting and manipulation
- diff 8.0.3 - Diff utilities (code comparison)
- class-variance-authority 0.7.1 - CSS class composition
- clsx 2.1.1 - Conditional class names
- tailwind-merge 2.6.0 - Tailwind CSS class merging
- react-hotkeys-hook 5.2.4 - Keyboard shortcut bindings
- @fontsource-variable/jetbrains-mono 5.2.8 - JetBrains Mono font

## Configuration

**Environment:**
- Environment variables: `VITE_` prefix for frontend, `TAURI_` prefix for Tauri-specific vars
- Optional: `VITE_SENTRY_DSN` for Sentry error tracking
- Optional: `VITE_APP_VERSION` for app version tracking
- Secrets storage: OS keychain via Tauri `keyring` plugin (macOS Keychain, Windows Credential Manager, Linux secret-service)

**Build:**
- `vite.config.ts` - Vite build configuration with Tauri-specific settings, bundle chunking
- `tsconfig.json` - TypeScript compiler options (strict mode, ES2020 target)
- `tsconfig.node.json` - TypeScript config for build files
- `tailwind.config.js` - Tailwind CSS customization (dark mode, brand colors, custom tokens)
- `eslint.config.js` - ESLint rules (React hooks, refresh, TypeScript checks)
- `.prettierrc` - Prettier formatting rules (semi, single quotes, 100 char width)
- `playwright.config.ts` - E2E test configuration (Chromium only, Vite dev server target)

## Platform Requirements

**Development:**
- Node.js (v18+ recommended for modern JavaScript)
- Rust toolchain (1.70+)
- pnpm (or compatible npm-like package manager)
- Tauri CLI (`npm install -g @tauri-apps/cli` or via pnpm)
- Git (for version control integration)

**Production:**
- Deployment target: Desktop (macOS, Windows, Linux)
- Minimum OS versions: macOS 10.13+, Windows 7+ (through Tauri), Linux (distributions with GTK 3+)
- No external servers required - entirely self-contained desktop application
- Local SQLite database stored in app data directory

## Database

**SQLite 3** (bundled with rusqlite):
- Local file-based database in app data directory
- No external database server
- Modern SQLite features enabled (`modern_sqlite` feature)

## Monitoring & Error Tracking

**Sentry (Optional):**
- Configured via `VITE_SENTRY_DSN` environment variable
- Initialized in `src/lib/sentry.ts`
- Includes sensitive data stripping (Authorization headers)
- Development: 100% sampling, replay disabled
- Production: 10% transaction sampling, error-triggered replays enabled
- Integrated with React error boundary

---

*Stack analysis: 2026-02-21*
