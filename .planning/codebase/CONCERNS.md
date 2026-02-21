# Codebase Concerns

**Analysis Date:** 2026-02-21

## Tech Debt

**Large Component Files:**
- Issue: Multiple frontend components exceed 600+ lines, making them difficult to test and maintain
- Files:
  - `src/components/project/git-status-widget.tsx` (1079 lines)
  - `src/components/projects/new-project-dialog.tsx` (886 lines)
  - `src/components/projects/import-dialog.tsx` (720 lines)
  - `src/components/project/dependencies-tab.tsx` (686 lines)
  - `src/components/terminal/interactive-terminal.tsx` (678 lines)
  - `src/components/settings/secrets-manager.tsx` (548 lines)
- Impact: Difficult to refactor, test, and reason about; increased risk of regression
- Fix approach: Break into smaller, focused sub-components with clear responsibilities; extract logic into custom hooks

**Large Rust Backend Module:**
- Issue: `src-tauri/src/commands/gsd.rs` at 4005 lines contains all GSD file parsing and CRUD logic in one file
- Files: `src-tauri/src/commands/gsd.rs`
- Impact: Monolithic structure makes it hard to maintain, test individual features, and causes slower compile times
- Fix approach: Refactor into domain-specific submodules (gsd/parsing, gsd/crud, gsd/validation, gsd/todos, gsd/phases)

**Minimal Test Coverage:**
- Issue: Only 3-4 test files found across 135+ source files; test coverage estimated at <5%
- Files: `src/components/__tests__/error-boundary.test.tsx`, `src/components/layout/main-layout.test.tsx`, `src/contexts/terminal-context.test.tsx`, `src/lib/__tests__/performance.test.ts`
- Impact: High risk of undetected regressions; critical paths (git operations, terminal I/O, data mutations) lack automated validation
- Fix approach: Establish unit test coverage targets (aim for 60%+ on critical paths); add integration tests for IPC/Tauri boundary; implement E2E test scenarios for core workflows

## Fragile Areas

**Terminal Instance Caching System:**
- Files: `src/components/terminal/interactive-terminal.tsx`
- Why fragile: Complex multi-level caching system with module-level WeakMaps and indirection layers (`terminalInstanceCache`, `terminalInputWriters`, `terminalKeyHandlers`, `terminalSessionIds`, `terminalTmuxNames`, `terminalBufferCache`). Event listener cleanup and reconnection logic relies on precise state synchronization. Terminal instances persist across unmount/remount cycles without formal lifecycle management.
- Safe modification: Add unit tests for cache lifecycle (store/retrieve/clear); add integration tests for page navigation + terminal reconnection; consider formalizing cache management as a separate class/hook
- Test coverage: Minimal; only basic error boundary test exists

**PTY Session Reconnection Logic:**
- Files: `src/hooks/use-pty-session.ts`, `src/components/terminal/interactive-terminal.tsx`
- Why fragile: Multiple reconnection strategies (direct pty attach, tmux reattach, fallback to new session) with implicit fallback behavior. Error handling routes errors through console logging and toast notifications without structured validation. Session state stored across multiple refs and context objects.
- Safe modification: Extract reconnection logic into standalone service with explicit error types; add comprehensive test suite for each reconnection path; establish clear preconditions/postconditions
- Test coverage: Minimal; hook docstring shows usage but no unit tests

**Query Cache Invalidation Patterns:**
- Files: `src/lib/queries.ts` (uses patterns throughout mutation callbacks)
- Why fragile: Widespread use of query client invalidation with potential race conditions. Multiple mutation handlers invalidate overlapping cache keys (e.g., both `gitStatus` and `gitChangedFiles` invalidated separately). No centralized cache coherency rules or test suite for cache invalidation sequences.
- Safe modification: Establish cache invalidation patterns as documented function; add test fixtures for concurrent mutation scenarios; consider using TanStack Query v5's new invalidation batch API
- Test coverage: None; patterns verified manually only

**GSD File Parsing in `gsd.rs`:**
- Files: `src-tauri/src/commands/gsd.rs` (functions `parse_frontmatter`, `extract_section`)
- Why fragile: String-based YAML frontmatter parsing with hand-rolled logic (lines 41-94); brittle assumptions about file structure (section order, heading levels). Edge cases for multiline lists and indented continuations. No schema validation or error recovery for malformed documents.
- Safe modification: Add unit tests for edge cases (empty frontmatter, missing sections, malformed YAML); consider switching to proper YAML parser crate; add logging for parsing failures
- Test coverage: None; assumed to work through manual testing

## Test Coverage Gaps

**Terminal Component Tests:**
- What's not tested: PTY lifecycle (connect, reconnect, disconnect), event listener cleanup, error recovery, session state synchronization, cache restoration after navigation
- Files: `src/components/terminal/interactive-terminal.tsx`, `src/hooks/use-pty-session.ts`, `src/contexts/terminal-context.tsx`
- Risk: Navigation away and back to a terminal page could fail to reconnect or create orphaned PTY sessions; memory leaks from uncleaned event listeners
- Priority: High - terminal is critical feature; failures degrade user experience

**Git Operations Tests:**
- What's not tested: All git mutation hooks (push, pull, fetch, commit, stash); query invalidation sequences; concurrent git operations
- Files: `src/lib/queries.ts` (lines 66-400+), `src/lib/tauri.ts` (git functions)
- Risk: Git command failures could leave UI state inconsistent with backend; concurrent operations could cause race conditions or data loss
- Priority: High - git is core feature; data loss risk

**Error Boundary Tests:**
- What's not tested: Inline variant, fallback component variants, error capture in nested boundaries, Sentry integration
- Files: `src/components/error-boundary.tsx`
- Risk: Error state might not render correctly; Sentry may not receive errors; backend error logging could fail
- Priority: Medium - existing test covers basic error state

**GSD Operations Tests:**
- What's not tested: CRUD operations for todos, phases, plans; file parsing and schema validation; data consistency after disk writes
- Files: `src-tauri/src/commands/gsd.rs` (entire module)
- Risk: Malformed GSD files could corrupt project data; parsing errors could cause silent failures
- Priority: Medium-High - data integrity concern

## Performance Bottlenecks

**Database Query Polling Overhead:**
- Problem: Multiple TanStack Query hooks polling simultaneously with `refetchInterval` (30-60 second intervals)
- Files: `src/lib/queries.ts` (lines 30-65)
- Cause: `useGitStatus` (30s interval), `useGitInfo` (60s interval), `useGitLog`, `useGitChangedFiles` (15s interval) all fire on the same 30-60s cadence; serialization via single `Arc<Mutex<Database>>` before DbPool refactoring could cause lock contention
- Improvement path: Stagger polling intervals to avoid thundering herd; implement adaptive polling (only when window focused); batch invalidation queries; monitor query cache hit rates

**Large Component Re-renders:**
- Problem: Components like `git-status-widget` (1079 lines) with many state-dependent render branches could trigger expensive re-renders
- Files: `src/components/project/git-status-widget.tsx`
- Cause: Complex conditional rendering with inline dialogs/modals; no memoization of sub-components
- Improvement path: Extract dialog/modal content into separate memoized components; use `useMemo` for expensive computations; profile with React DevTools

**Terminal Buffer Serialization:**
- Problem: SerializeAddon is called on every buffer change but results are cached; unclear if large terminal buffers cause memory issues
- Files: `src/components/terminal/interactive-terminal.tsx` (lines 46-48, buffer cache)
- Cause: No limits on buffer size; cache grows indefinitely across session lifetime
- Improvement path: Set max buffer size limit; implement LRU eviction for cached buffers; monitor memory usage in long-running terminal sessions

**Rust Backend File I/O:**
- Problem: GSD file parsing reads entire `.planning/` directory structure synchronously for each query
- Files: `src-tauri/src/commands/gsd.rs` (project info, todos, phases all scan filesystem)
- Cause: No file watching or caching; each query does full directory walk
- Improvement path: Implement file change watcher (inotify/FSEvents) with debounced cache invalidation; consider memory cache for frequently accessed GSD files

## Dependencies at Risk

**Sentry Integration with Incomplete Configuration:**
- Risk: Sentry DSN must be provided via `VITE_SENTRY_DSN` env var; if not set, error tracking silently disables
- Impact: Production errors in deployed app are not captured; no observability without manual configuration
- Migration plan: Make DSN configuration explicit with warnings; add fallback console logging for development; consider using Sentry's Replay API for debugging terminal issues

**Tauri API Surface Exposure:**
- Risk: All Tauri `invoke()` calls are untyped except for return type; parameter validation happens only in Rust backend
- Impact: Frontend can send malformed commands; errors bubble up as generic strings with limited context
- Migration plan: Add runtime validation middleware for IPC parameters; create typed command builders; implement command versioning for backward compatibility

## Scaling Limits

**SQLite Write Concurrency:**
- Current capacity: Single writer via `Mutex<Database>` (serialized); 4 read-only connections (concurrent)
- Limit: Once write throughput exceeds single-threaded capability (~5K+ INSERTs/sec), write queue will block all mutations
- Scaling path: For multi-project scenarios with high activity logging, consider migrating to PostgreSQL with connection pooling; implement write-ahead logging batching

**PTY Session Limit:**
- Current capacity: Each tab spawns a new PTY process; OS limit typically 256-512 processes per user
- Limit: Apps with 50+ terminal tabs open will approach process limits; potential fork bomb if reconnection logic retries aggressively
- Scaling path: Implement session pooling; warn user when approaching process limit; implement graceful session cleanup on idle

**Terminal Buffer Memory:**
- Current capacity: No documented limit on xterm buffer; caching system stores serialized buffers indefinitely
- Limit: Long-running terminal sessions (24+ hours) could accumulate GBs of buffer data
- Scaling path: Implement configurable buffer size limits; add buffer rotation/archival; implement memory monitoring with warnings

## Known Bugs

**Terminal Reconnection on App Focus:**
- Symptoms: Terminal may not automatically reconnect after app is brought to foreground if underlying PTY process has exited
- Files: `src/components/terminal/interactive-terminal.tsx` (useEffect on window focus, line ~300+)
- Trigger: Minimize app for >5 minutes, bring back to focus with long-running terminal command
- Workaround: Manual "Reconnect" button visible in UI when disconnected

**Git Status Stale Cache After External Operations:**
- Symptoms: If user modifies git state outside app (e.g., via command line), UI cache doesn't update immediately
- Files: `src/lib/queries.ts` (useGitStatus staleTime: 30000)
- Trigger: Edit files in terminal, UI git-status-widget shows stale state for up to 30 seconds
- Workaround: User can click refresh button or wait for staleTime to expire

**Broadcast Mode Tab Cleanup:**
- Symptoms: If broadcast mode is active and a tab is closed, broadcast set may retain dangling references
- Files: `src/contexts/terminal-context.tsx` (broadcastTabIds Set management)
- Trigger: Enable broadcast, close one of the broadcast tabs without explicitly removing from broadcast first
- Workaround: Disable broadcast mode explicitly before closing tabs

## Security Considerations

**Secrets Storage via OS Keychain:**
- Risk: Secrets are stored in OS keychain (via `keyring` crate in Rust), but no encryption at rest for other stored data (SQLite plaintext)
- Files: `src/components/settings/secrets-manager.tsx`, `src-tauri/src/security.rs`
- Current mitigation: Keychain integration for auth tokens/passwords; user must grant OS-level permissions for keychain access
- Recommendations:
  - Audit keychain permissions model (some OS versions may cache credentials in memory)
  - Add encryption for sensitive project metadata stored in SQLite (API keys, deployment credentials in project config)
  - Document keychain backup/restore behavior for user migrations between machines

**Unencrypted IPC Messages:**
- Risk: Frontend-backend communication via Tauri IPC is unencrypted at the protocol level (but isolated within single process)
- Files: `src/lib/tauri.ts` (all invoke calls), `src-tauri/src/commands/` (command handlers)
- Current mitigation: Desktop app is single-user; IPC is local, not network-exposed
- Recommendations: Document threat model; add input validation for all IPC parameters; sanitize file paths to prevent directory traversal

**Environment Variable Exposure in Frontend Bundle:**
- Risk: `VITE_` prefixed env vars are embedded in bundle; if Sentry DSN or other config is sensitive, it's exposed in source
- Files: `vite.config.ts` (envPrefix), `src/lib/sentry.ts` (reads VITE_SENTRY_DSN)
- Current mitigation: Only non-sensitive config (Sentry DSN, app version) exposed; actual auth tokens stored in OS keychain
- Recommendations: Audit all VITE_ variables to ensure none contain secrets; use `.env.local` for development without committing

**File Path Traversal in GSD File Operations:**
- Risk: GSD file paths are user-provided (from project path); no explicit validation of path components
- Files: `src-tauri/src/commands/gsd.rs` (get_project_path, read GSD files), `src-tauri/src/commands/filesystem.rs`
- Current mitigation: Assumed safe because project paths are pre-validated on import
- Recommendations: Add explicit path canonicalization; reject paths with `..` components; add unit tests for path injection attempts

## Missing Critical Features

**Data Export Format Standardization:**
- Problem: Export functionality exists but format/compatibility not documented; no import validation for exported data
- Blocks: Data recovery, backup/restore workflows, migration between environments
- Impact: Users cannot reliably backup or transfer projects

**PTY Error Recovery Strategy:**
- Problem: If PTY backend crashes, no documented recovery path; frontend may hang waiting for responses
- Blocks: Reliability in production; user can only force-quit and restart app
- Impact: Loss of terminal session history; frustration for long-running tasks

**GSD File Validation/Repair Tool:**
- Problem: No validation that `.planning/` directory structure conforms to expected schema; corrupted files cause silent failures
- Blocks: Integrity checking for imported projects; debugging corrupted state
- Impact: Silent data loss or inconsistency

## Code Quality Issues

**Unhandled Promise Rejections:**
- Pattern: Several async operations use `.catch(() => {})` to silently ignore errors
- Files: `src/components/error-boundary.tsx` (line 44), `src/components/terminal/interactive-terminal.tsx` (multiple places)
- Impact: Errors are hidden from debugging; users don't know if operation succeeded
- Fix approach: Log caught errors with context; use specific error types instead of generic handlers

**Console Logging in Production:**
- Pattern: `console.log`, `console.error` used directly instead of structured logging
- Files: `src/lib/sentry.ts` (line 9), `src/lib/performance.ts` (lines 68, 104), `src/components/settings/secrets-manager.tsx` (line 114), `src/components/project/env-vars-tab.tsx` (line 98)
- Impact: Production logs are not captured; development debugging pollutes console output
- Fix approach: Implement structured logger abstraction; route errors to backend logging service; remove console.log from shipped code

**Implicit Type Assumptions:**
- Pattern: No explicit validation of Tauri command results beyond `Result<T, String>` type
- Files: `src/lib/tauri.ts` (all invoke calls), `src/lib/queries.ts` (all mutation handlers)
- Impact: Type mismatches between frontend expectations and backend responses caught only at runtime
- Fix approach: Add runtime schema validation (zod/io-ts); generate TypeScript types from Rust types via code generation

---

*Concerns audit: 2026-02-21*
