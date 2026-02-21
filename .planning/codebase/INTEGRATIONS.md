# External Integrations

**Analysis Date:** 2026-02-21

## APIs & External Services

**Error Tracking:**
- Sentry - Error and performance monitoring
  - SDK/Client: `@sentry/react` 10.38.0
  - Auth: `VITE_SENTRY_DSN` environment variable
  - Configured in: `src/lib/sentry.ts`
  - Optional - disabled if DSN not provided

## Data Storage

**Databases:**
- SQLite 3 (local, bundled)
  - Connection: Rust backend via `rusqlite 0.32`
  - Client: Direct rusqlite queries (Rust-side)
  - Location: App data directory (platform-specific AppData/Library/config)
  - File-based, no external server required

**File Storage:**
- Local filesystem only
  - Handled via `@tauri-apps/plugin-fs` 2.2.0
  - Project files remain in user-selected directories
  - App data stored in platform-standard locations via `dirs` crate

**Caching:**
- TanStack React Query (in-memory client cache)
  - Configured in `src/main.tsx`
  - QueryClient with default options
  - Server state synchronized with Tauri backend via invoke

## Authentication & Identity

**Auth Provider:**
- None - Application is local/standalone
- Implementation: OS-level permissions (file access, shell commands)
- User identity: Optional app-level tracking via Sentry (user ID)

## Version Control Integration

**Git:**
- Git commands executed via `@tauri-apps/plugin-shell` 2.2.0
- Tauri `git_*` commands provide:
  - Branch detection and management
  - Commit history
  - Status detection (dirty/staged/untracked)
  - Stash operations
  - Tag and branch listing
- No external Git API - all operations are local

## Monitoring & Observability

**Error Tracking:**
- Sentry (optional, via `@sentry/react`)
  - Captured in `src/lib/sentry.ts`
  - React error boundary integration in `src/components/error-boundary.tsx`
  - Frontend error logging: `src/lib/sentry.ts` exports `captureError()`

**Logs:**
- Application logs: SQLite-based logging in Rust backend
- Frontend logs: Console + optional Sentry
- Frontend errors logged via `invoke("log_frontend_error")` to backend
- Frontend events logged via `invoke("log_frontend_event")` to backend
- App logs accessible via `getAppLogs()` API function in `src/lib/tauri.ts`

## CI/CD & Deployment

**Hosting:**
- Desktop application (self-hosted)
- Distributed as native binaries via Tauri
- macOS: DMG installer
- Windows: MSI/EXE installer
- Linux: AppImage or distribution-specific package

**CI Pipeline:**
- Not configured yet (initial commit phase)
- Potential targets: GitHub Actions for cross-platform builds

## Environment Configuration

**Required env vars:**
- None required (all optional)

**Optional env vars:**
- `VITE_SENTRY_DSN` - Sentry error tracking DSN
- `VITE_APP_VERSION` - Application version (defaults to 0.1.0)
- `TAURI_ENV_PLATFORM` - Platform identifier (windows/macos/linux) - set by build system
- `TAURI_ENV_DEBUG` - Debug build flag - set by build system

**Secrets location:**
- OS Keychain integration:
  - macOS: Keychain
  - Windows: Credential Manager
  - Linux: Secret Service (via `secret-service`)
- Rust API: `keyring` crate with platform-native backends
- Frontend API: `src/lib/tauri.ts` exports:
  - `setSecret(service, key, value)`
  - `getSecret(service, key)`
  - `deleteSecret(service, key)`
  - `listSecretKeys(service)`
  - Default service: `"net.fluxlabs.track-your-shit"`

## Webhooks & Callbacks

**Incoming:**
- None - desktop application with no inbound network

**Outgoing:**
- None - application is self-contained

## Shell & Command Execution

**Shell Integration:**
- `@tauri-apps/plugin-shell` 2.2.0
- Executes arbitrary shell commands within project directories
- Command history tracking in SQLite
- Used for:
  - Git operations
  - NPM/package manager commands
  - Build scripts
  - Custom project-specific scripts

## PTY/Terminal Emulation

**Terminal Sessions:**
- `portable-pty` 0.8 (Rust backend)
- PTY management via `src-tauri/src/pty/mod.rs`
- Session-based architecture (each terminal = separate PTY)
- Optional tmux integration for session persistence
- Frontend WebSocket-like communication via Tauri events:
  - `pty:output:{sessionId}` - Terminal output events
  - `pty:exit:{sessionId}` - Terminal exit events
- Terminal UI: `@xterm/xterm` 6.0.0 with addons (search, web-links, etc.)

## Project Discovery & Scanning

**Tech Stack Detection:**
- Local filesystem scanning via `@tauri-apps/plugin-fs`
- Detects: framework, language, package manager, database, test framework
- Scanner integration for code quality reports (optional)

**Markdown Indexing:**
- Recursive markdown file discovery in project directories
- Indexed in SQLite for knowledge base searching
- Full-text search capability

## GSD (Get Stuff Done) Integration

**Workflow Framework:**
- GSD metadata parsing from `.planning/` directory structure
- Requirements, plans, summaries, milestones parsed from markdown
- Validation and verification tracking
- UAT (User Acceptance Testing) results storage
- Roadmap progress tracking
- Exports available in `src/lib/tauri.ts`:
  - `gsdListRequirements()`, `gsdListMilestones()`, `gsdListTodos()`
  - `gsdGetPhaseContext()`, `gsdGetRoadmapProgress()`
  - `gsdSyncProject()` - synchronize .planning/ directory with database

## Notification System

**Notification Storage:**
- SQLite-based persistent notifications
- Types: phase completion, cost warnings, errors, custom messages
- Accessible via `getNotifications()` in `src/lib/tauri.ts`
- Real-time events: `notification:new` event listener

## File Dialogs

**Native Dialogs:**
- `@tauri-apps/plugin-dialog` 2.2.0
- Functions:
  - `pickFolder()` - Select folder (for project import/creation)
  - Platform-native file pickers

## Activity Logging

**Event Tracking:**
- User activities logged to SQLite
- Event types: project operations, phase changes, phase completions
- Activity log queryable with filters
- Real-time events: `activity:logged` event listener
- Metadata support for custom tracking

---

*Integration audit: 2026-02-21*
