# Control Tower: AP vs GSD Code Inventory

## Purpose
Comprehensive inventory of all code in `control-tower-app` categorized as:
- **AP-ONLY**: Only used by AutoPilot system, should be REMOVED
- **GSD-ONLY**: Only used by GSD system, should STAY
- **SHARED**: Used by both systems, needs analysis/refactoring
- **GENERIC**: Project management, settings, etc. -- stays regardless

---

## 1. Rust Command Modules (`src-tauri/src/commands/`)

### AP-ONLY Modules (Remove entirely)

| Module | Commands | File | Notes |
|--------|----------|------|-------|
| `executions.rs` | 16 | `src-tauri/src/commands/executions.rs` | Claude CLI execution management (start, pause, resume, cancel, compare). Default command is `/ap:cockpit`. Includes autonomous mode (iterations, cooldown, restart). |
| `checkpoints.rs` | 5 | `src-tauri/src/commands/checkpoints.rs` | Session state persistence for AP executions (PRD FR-1). Saves/loads execution checkpoints. |
| `progress.rs` | 5 | `src-tauri/src/commands/progress.rs` | Phase/task progress tracking for AP executions (PRD FR-2). Progress updates, exit signals. |
| `mcp.rs` | 3 | `src-tauri/src/commands/mcp.rs` | MCP bridge setup/status. Looks for servers named "control-tower", "ap", "autopilot". |
| `bookmarks.rs` | 3 | `src-tauri/src/commands/bookmarks.rs` | Execution bookmarks (line-level bookmarks in execution output). |
| `webhooks.rs` | 4 | `src-tauri/src/commands/webhooks.rs` | Webhook notifications for execution events, cost alerts. |

### GSD-ONLY Modules (Keep entirely)

| Module | Commands | File | Notes |
|--------|----------|------|-------|
| `gsd.rs` | 23 | `src-tauri/src/commands/gsd.rs` | Native .planning/ file parsing and CRUD. Todos, milestones, requirements, verifications, plans, summaries, research, debug sessions, sync. |

### SHARED Modules (Needs refactoring)

| Module | Commands | File | Notes |
|--------|----------|------|-------|
| `flightplans.rs` | 15 | `src-tauri/src/commands/flightplans.rs` | Parses both `.autopilot/FLIGHTPLAN.md` AND `.planning/ROADMAP.md`. TRANSPONDER.md parsing is AP-specific but STATE.md parsing is GSD-compatible. The "flight plan" concept maps to GSD's "roadmap" -- keep but rename/simplify. Remove AP-specific TRANSPONDER parsing. |
| `projects.rs` | 13 | `src-tauri/src/commands/projects.rs` | Project CRUD. Import logic references both `.autopilot/` and `.planning/`. TechStack detection has `has_autopilot` field. |
| `filesystem.rs` | 13 | `src-tauri/src/commands/filesystem.rs` | File system ops. `detect_tech_stack` checks for `.autopilot/` dir. `import_project_enhanced` has AP-specific conversion logic. |
| `settings.rs` | 15 | `src-tauri/src/commands/settings.rs` | Contains AP-specific settings: `autopilot_enabled`, `autopilot_mcp_enabled`, `autopilot_max_cost`. Also has AP plugin install/enable/disable/update commands alongside GSD plugin commands. Remove the AP plugin commands and settings. |
| `agents.rs` | 3 | `src-tauri/src/commands/agents.rs` | Agent discovery. Scans for agent definitions. `run_agent` starts an execution. Execution creation is AP-specific but agent discovery itself could stay. |
| `health.rs` | 2 | `src-tauri/src/commands/health.rs` | Health scoring. May reference execution data. Likely GENERIC but needs review. |
| `costs.rs` | 10 | `src-tauri/src/commands/costs.rs` | Cost tracking. References executions and phases. Costs exist for both AP executions and could track GSD workflow costs. |
| `watcher.rs` | 2 | `src-tauri/src/commands/watcher.rs` | File watcher. Emits both `knowledge:file-changed` and `gsd:file-changed` events. |

### GENERIC Modules (Keep as-is)

| Module | Commands | File | Notes |
|--------|----------|------|-------|
| `activity.rs` | 5 | `src-tauri/src/commands/activity.rs` | Activity logging. Used by both systems. |
| `comments.rs` | 5 | `src-tauri/src/commands/comments.rs` | Phase comments. Generic to roadmap/flight plan phases. |
| `data.rs` | 3 | `src-tauri/src/commands/data.rs` | Data export/clear. References both executions and flight plans. |
| `decisions.rs` | 11 | `src-tauri/src/commands/decisions.rs` | Decision tracking. Used by both AP and GSD. |
| `dependencies.rs` | 2 | `src-tauri/src/commands/dependencies.rs` | Package dependency checking. Generic. |
| `git.rs` | 17 | `src-tauri/src/commands/git.rs` | Git operations. Fully generic. |
| `knowledge.rs` | 11 | `src-tauri/src/commands/knowledge.rs` | Knowledge file system (markdown browsing, search). Generic. |
| `logs.rs` | 7 | `src-tauri/src/commands/logs.rs` | Application logging. Generic. |
| `notifications.rs` | 6 | `src-tauri/src/commands/notifications.rs` | Notification system. Generic. |
| `phase_templates.rs` | 4 | `src-tauri/src/commands/phase_templates.rs` | Phase templates. Generic to roadmap phases. |
| `pty.rs` | 13 | `src-tauri/src/commands/pty.rs` | PTY terminal management. Generic. |
| `quality.rs` | 5 | `src-tauri/src/commands/quality.rs` | Quality gates for phase validation. References phases table. Keep -- works for GSD phases. |
| `search.rs` | 1 | `src-tauri/src/commands/search.rs` | Global search. Generic. |
| `secrets.rs` | 6 | `src-tauri/src/commands/secrets.rs` | OS keychain secrets. Generic. |
| `snippets.rs` | 10 | `src-tauri/src/commands/snippets.rs` | Terminal snippets/auto-commands. Generic. |
| `tasks.rs` | 8 | `src-tauri/src/commands/tasks.rs` | Task CRUD within phases. Generic to roadmap. |
| `terminal.rs` | 8 | `src-tauri/src/commands/terminal.rs` | Terminal session persistence. Generic. |
| `testing.rs` | 6 | `src-tauri/src/commands/testing.rs` | Test dashboard. Generic. |

---

## 2. Frontend Routes / Pages

| Route | Page | File | Category | Notes |
|-------|------|------|----------|-------|
| `/` | Dashboard | `src/pages/dashboard.tsx` | GENERIC | Shows project cards. References `has_running_execution` and `flight_plan_progress` (AP concepts). Needs cleanup of AP references. |
| `/projects` | Projects List | `src/pages/projects.tsx` | GENERIC | Project listing. |
| `/projects/:id` | Project Detail | `src/pages/project.tsx` | SHARED | Heavy mix. Imports `cancelAutonomous`, `onAutonomousRestarted`, `onAutonomousComplete` (AP), execution management, AND GSD tabs. Many AP-only tabs need removal. |
| `/projects/:id/executions/:executionId` | Execution Detail | `src/pages/execution.tsx` | **AP-ONLY** | Execution output viewer, pause/resume/cancel, bookmark panel. Pure AP execution management. |
| `/projects/:id/compare` | Execution Compare | `src/pages/execution-compare.tsx` | **AP-ONLY** | Side-by-side execution comparison. |
| `/analytics` | Analytics | `src/pages/analytics.tsx` | SHARED | Cost analytics. References executions. Cost tracking may stay but execution-specific analytics are AP. |
| `/settings` | Settings | `src/pages/settings.tsx` | SHARED | Contains AP-specific settings (autopilot plugin section). |
| `/decisions` | Decisions | `src/pages/decisions.tsx` | GENERIC | Decision tracking. Used by both. |
| `/terminal` | Terminal | `src/pages/shell.tsx` | GENERIC | Shell terminal. Generic. |
| `/terminal/:projectId` | Project Terminal | `src/pages/shell.tsx` | GENERIC | Same component, project-scoped. |
| `/logs` | Logs | `src/pages/logs.tsx` | GENERIC | Application log viewer. |
| `/agents` | Agents | `src/pages/agents.tsx` | **AP-ONLY** | Agent discovery/management. `runAgent` starts an execution. |
| `/notifications` | Notifications | `src/pages/notifications.tsx` | GENERIC | Notification center. |

---

## 3. Frontend Components

### AP-ONLY Components (Remove)

| Component Dir/File | File | Notes |
|-------------------|------|-------|
| `components/agents/` | `src/components/agents/` (5 files) | `agent-card.tsx`, `agent-detail-dialog.tsx`, `agent-list-row.tsx`, `run-agent-dialog.tsx`, `index.ts` |
| `components/terminal/execution-output-viewer.tsx` | Terminal execution output | Renders AP execution stdout/stderr |
| `components/terminal/execution-diff-dialog.tsx` | Execution diff | AP execution comparison in terminal |
| `components/terminal/bookmark-panel.tsx` | Execution bookmarks | Bookmarks within AP execution output |
| `components/project/transponder-card.tsx` | Transponder card | Displays TRANSPONDER.md state (AP concept) |
| `components/project/checkpoint-tab.tsx` | Checkpoint tab | AP execution checkpoints |
| `components/project/mcp-status-card.tsx` | MCP status | MCP bridge config for AP |
| `components/project/execution-picker.tsx` | Execution picker | Selects AP executions |
| `components/project/run-agent-project-dialog.tsx` | Run agent dialog | Starts AP agent execution |
| `components/project/bookmarks-tab.tsx` | Bookmarks tab | Execution + knowledge bookmarks |
| `components/layout/plugin-alert-banner.tsx` | Plugin alert | Warns about missing autopilot plugin. AP-specific. |
| `components/flightplan/clone-flight-plan-dialog.tsx` | Clone flight plan | Clones AP flight plan between projects |

### GSD-ONLY Components (Keep)

| Component Dir/File | File | Notes |
|-------------------|------|-------|
| `components/project/gsd-todos-tab.tsx` | GSD Todos | GSD todo management |
| `components/project/gsd-plans-tab.tsx` | GSD Plans | GSD execution plans |
| `components/project/gsd-debug-tab.tsx` | GSD Debug | GSD debug sessions |
| `components/project/gsd-milestones-tab.tsx` | GSD Milestones | GSD milestones view |
| `components/project/gsd-verification-tab.tsx` | GSD Verification | GSD phase verification |
| `components/project/vision-card.tsx` | Vision card | GSD project vision |
| `components/project/requirements-card.tsx` | Requirements card | GSD requirements |

### SHARED Components (Need refactoring)

| Component Dir/File | File | Notes |
|-------------------|------|-------|
| `components/flightplan/` | (18 files) | Flight plan viewer. The concept of "phases with tasks" is used by BOTH AP (FLIGHTPLAN.md) and GSD (ROADMAP.md). Rename from "flight plan" to "roadmap" terminology. Keep the phase/task CRUD, status badges, timeline, etc. Remove AP-specific naming. |
| `components/dashboard/project-card.tsx` | Dashboard card | Shows `flight_plan_progress` and `has_running_execution`. Remove execution indicator, rename flight plan. |
| `components/dashboard/project-row.tsx` | Dashboard row | Same as above. |
| `components/dashboard/status-bar.tsx` | Status bar | May show running executions count. |
| `components/project/project-overview-tab.tsx` | Overview tab | Contains TransponderCard, McpStatusCard (AP), plus GSD cards. |
| `components/project/project-header.tsx` | Project header | Shows execution controls (play button, start execution). AP-specific controls. |
| `components/project/quick-actions-bar.tsx` | Quick actions | Likely has "Start Execution" button (AP). |
| `components/project/progress-card.tsx` | Progress card | Shows flight plan progress (phases/tasks). Rename to roadmap. |
| `components/settings/claude-status-card.tsx` | Claude status | Full AP+GSD plugin management. AP sections to remove. |
| `components/settings/ai-settings-card.tsx` | AI settings | Provider/model config. May reference AP-specific models. |
| `components/settings/cost-threshold-config.tsx` | Cost thresholds | References executions for cost tracking. |
| `components/settings/cost-alert-banner.tsx` | Cost alerts | Execution cost alerts. AP-only if costs are per-execution. |
| `components/analytics/cost-by-phase-chart.tsx` | Cost by phase | References execution costs by phase. |
| `components/analytics/cost-over-time.tsx` | Cost over time | Daily cost chart. Tracks execution costs. |
| `components/analytics/model-breakdown.tsx` | Model breakdown | Cost by AI model. |
| `components/projects/convert-gsd-dialog.tsx` | Convert dialog | Converting AP to GSD (remove or repurpose). |

### GENERIC Components (Keep as-is)

| Component Dir/File | File | Notes |
|-------------------|------|-------|
| `components/decisions/` | (11 files) | Decision tracking. Generic to both. |
| `components/knowledge/` | (10 files) | Knowledge file browser, graph, search. Generic. |
| `components/graph/` | (5 files) | Phase dependency graph. Generic. |
| `components/terminal/` (most) | (~12 generic files) | `interactive-terminal.tsx`, `terminal-tabs.tsx`, `terminal-view.tsx`, `terminal-search-bar.tsx`, `snippets-panel.tsx`, `auto-command-dialog.tsx`, `auto-commands-panel.tsx`, `broadcast-indicator.tsx`, `environment-indicator.tsx`, `global-terminals.tsx`, `terminal-page-header.tsx` |
| `components/notifications/` | (4 files) | Generic notification system. |
| `components/command-palette/` | Command palette | Generic navigation. |
| `components/layout/main-layout.tsx` | Main layout | Generic. |
| `components/layout/breadcrumbs.tsx` | Breadcrumbs | Generic. |
| `components/layout/keyboard-shortcuts-dialog.tsx` | Keyboard shortcuts | Generic. |
| `components/shared/project-selector.tsx` | Project selector | Generic. |
| `components/project/activity-feed.tsx` | Activity feed | Generic activity log. |
| `components/project/decisions-viewer.tsx` | Decisions viewer | Generic. |
| `components/project/project-terminal-tab.tsx` | Terminal tab | Generic terminal in project. |
| `components/project/cost-trend-chart.tsx` | Cost trend | Tracks spending. Useful for GSD too. |
| `components/project/git-status-widget.tsx` | Git status | Generic. |
| `components/project/health-score-widget.tsx` | Health score | Generic. |
| `components/project/scanner-card.tsx` | Scanner | Generic project scanning. |
| `components/project/test-health-card.tsx` | Test health | Generic. |
| `components/project/tests-tab.tsx` | Tests tab | Generic. |
| `components/project/quality-tab.tsx` | Quality tab | Generic quality gates. |
| `components/project/quality-gates-card.tsx` | Quality gates | Generic. |
| `components/project/dependencies-tab.tsx` | Dependencies | Generic. |
| `components/project/dependency-alerts-card.tsx` | Dependency alerts | Generic. |
| `components/project/knowledge-tab.tsx` | Knowledge tab | Generic. |
| `components/project/graph-tab.tsx` | Graph tab | Generic. |
| `components/project/automation-tab.tsx` | Automation tab | Terminal automation. Generic. |
| `components/project/file-browser.tsx` | File browser | Generic. |
| `components/project/tab-group.tsx` | Tab group | Generic UI. |
| `components/project/env-vars-tab.tsx` | Env vars | Generic. |
| `components/project/export-report-dialog.tsx` | Export report | Generic. |
| `components/settings/theme-customization.tsx` | Theme | Generic. |
| `components/settings/export-data-dialog.tsx` | Export data | Generic. |
| `components/settings/clear-data-dialog.tsx` | Clear data | Generic. |
| `components/settings/secrets-manager.tsx` | Secrets | Generic. |
| `components/projects/import-dialog.tsx` | Import dialog | References AP but generic concept. |
| `components/projects/project-wizard-dialog.tsx` | Project wizard | Generic. |

---

## 4. Query Hooks (`src/lib/queries.ts`)

### AP-ONLY Hooks (Remove)

| Hook | Notes |
|------|-------|
| `useExecutions` | Lists AP executions for a project |
| `useExecution` | Single AP execution with polling |
| `useStartExecution` | Starts AP Claude execution |
| `usePauseExecution` | Pauses AP execution |
| `useResumeExecution` | Resumes AP execution |
| `useCancelExecution` | Cancels AP execution |
| `useDeleteExecution` | Deletes AP execution |
| `useRunningExecutions` | Lists running AP executions |
| `useTransponderState` | Reads TRANSPONDER.md (AP concept) |
| `useMcpStatus` | MCP bridge status (AP) |
| `useSetupMcpBridge` | MCP setup (AP) |
| `useSetMcpBridgeEnabled` | MCP enable/disable (AP) |
| `useInstallAutopilot` | Install AP plugin |
| `useEnableAutopilot` | Enable AP plugin |
| `useUpdateAutopilot` | Update AP plugin |
| `useDisableAutopilot` | Disable AP plugin |
| `useExecutionActivity` | Execution-specific activity log |
| `useExecutionComparison` | Compare two executions |
| `useCloneFlightPlan` | Clone flight plan between projects |
| `useExecutionBookmarks` | Execution bookmarks |
| `useCreateExecutionBookmark` | Create execution bookmark |
| `useDeleteExecutionBookmark` | Delete execution bookmark |
| `useRunAgent` | Run agent (starts execution) |
| `useCheckpoints` | Checkpoint list |
| `useDeleteCheckpoint` | Delete checkpoint |
| `useClearCheckpoints` | Clear checkpoints |
| `useExecutionCosts` | Costs for specific execution |
| `useCostsByPhase` | Costs by phase for execution |

### GSD-ONLY Hooks (Keep)

| Hook | Notes |
|------|-------|
| `useGsdProjectInfo` | GSD project info |
| `useGsdState` | GSD current state |
| `useGsdConfig` | GSD config |
| `useGsdTodos` | GSD todo list |
| `useGsdDebugSessions` | GSD debug sessions |
| `useGsdMilestones` | GSD milestones |
| `useGsdRequirements` | GSD requirements |
| `useGsdVerification` | GSD phase verification |
| `useGsdResearch` | GSD research docs |
| `useGsdCreateTodo` | Create GSD todo |
| `useGsdUpdateTodo` | Update GSD todo |
| `useGsdCompleteTodo` | Complete GSD todo |
| `useGsdDeleteTodo` | Delete GSD todo |
| `useGsdPlans` | GSD plans |
| `useGsdPhasePlans` | GSD phase plans |
| `useGsdSummaries` | GSD summaries |
| `useGsdPhaseSummaries` | GSD phase summaries |
| `useGsdPhaseResearchList` | GSD phase research |
| `useGsdPhaseResearch` | Single GSD phase research |
| `useGsdMilestoneAudits` | GSD milestone audits |
| `useGsdSync` | Sync GSD data |
| `useInstallGsd` | Install GSD plugin |
| `useEnableGsd` | Enable GSD plugin |
| `useDisableGsd` | Disable GSD plugin |
| `useUpdateGsd` | Update GSD plugin |

### SHARED Hooks (Rename/refactor)

| Hook | Notes |
|------|-------|
| `useFlightPlan` | Get flight plan (used for both AP and GSD roadmaps). Rename to `useRoadmap`. |
| `useSyncFlightPlan` | Sync flight plan from files. Rename to `useSyncRoadmap`. |
| `useUpdatePhaseStatus` | Update phase status. Works for GSD phases. Keep. |
| `useCreatePhase` | Phase CRUD. Works for GSD. Keep. |
| `useUpdatePhase` | Phase update. Generic. Keep. |
| `useDeletePhase` | Phase delete. Generic. Keep. |
| `useCreateTask` | Task CRUD within phases. Keep. |
| `useUpdateTask` | Task update. Keep. |
| `useDeleteTask` | Task delete. Keep. |
| `useReorderPhases` | Reorder phases. Keep. |
| `useBulkUpdatePhaseStatus` | Bulk phase status. Keep. |
| `useBulkDeletePhases` | Bulk delete phases. Keep. |
| `usePhaseComments` | Phase comments. Generic. Keep. |
| `useImportProjectEnhanced` | Import. References `flight_plan_synced`. Refactor. |

### GENERIC Hooks (Keep)

All other hooks (projects, git, settings, costs, activity, decisions, knowledge, search, notifications, terminal, testing, etc.)

---

## 5. Tauri API Types & Functions (`src/lib/tauri.ts`)

### AP-ONLY Types (Remove)

| Type | Notes |
|------|-------|
| `Execution` | AP execution model with mode, iteration, max_iterations, cooldown_seconds, parent_execution_id |
| `ExecutionOptions` | AP execution start options |
| `RunningExecution` | Running execution dashboard type |
| `ExecutionComparison` | Execution comparison |
| `PhaseComparison` | Phase-level execution comparison |
| `TransponderState` | TRANSPONDER.md state |
| `ExecutionOutputEvent` | Execution stdout/stderr event |
| `ExecutionProgressEvent` | Execution progress event |
| `AutonomousRestartEvent` | Autonomous mode restart |
| `AutonomousCompleteEvent` | Autonomous mode complete |
| `ExecutionBookmark` | Execution bookmark |
| `ActiveProcessInfo` | Active process info (execution + PTY) |
| `McpStatus` | MCP bridge status |
| `CheckpointSummary` | Checkpoint summary |
| `CheckpointListResponse` | Checkpoint list |

### AP-ONLY Functions (Remove)

| Function | Notes |
|----------|-------|
| `listExecutions` | |
| `getExecution` | |
| `startExecution` | |
| `pauseExecution` | |
| `resumeExecution` | |
| `cancelExecution` | |
| `deleteExecution` | |
| `sendExecutionInput` | |
| `listRunningExecutions` | |
| `cancelAutonomous` | |
| `installAutopilotPlugin` | |
| `enableAutopilotPlugin` | |
| `disableAutopilotPlugin` | |
| `updateAutopilotPlugin` | |
| `checkMcpStatus` | |
| `setupMcpBridge` | |
| `setMcpBridgeEnabled` | |
| `onExecutionOutput` | |
| `onExecutionProcessExited` | |
| `onAutonomousRestarted` | |
| `onAutonomousComplete` | |
| `onExecutionProgress` | |
| `getTransponderState` | |
| `canSafelyClose` | Partially -- remove execution counting, keep PTY check |
| `forceCloseAll` | Partially -- remove execution killing |
| `cleanupStaleExecutions` | |
| `compareExecutions` | |
| `cloneFlightPlan` | |
| `createExecutionBookmark` | |
| `listExecutionBookmarks` | |
| `deleteExecutionBookmark` | |
| `checkpointList` | |
| `checkpointDelete` | |
| `checkpointClearProject` | |
| `getExecutionCosts` | |
| `getCostsByPhase` | |

### SHARED Types (Need refactoring)

| Type | Notes |
|------|-------|
| `FlightPlan` | Rename to `Roadmap`. Used by both. |
| `Phase` | Contains `gsd_metadata`. Shared. |
| `Task` | Shared between both systems. |
| `FlightPlanProgress` | Rename to `RoadmapProgress`. |
| `ProjectWithStats` | Contains `has_running_execution` (AP) and `flight_plan_progress` (shared). Remove `has_running_execution`. |
| `TechStack` | Contains `has_autopilot` (AP) and GSD fields. Remove `has_autopilot`. |
| `Settings` | Contains `autopilot_enabled`, `autopilot_mcp_enabled`, `autopilot_max_cost` (AP). Remove those. |
| `ClaudeStatus` | Contains `autopilot_installed`, `autopilot_enabled` (AP). Remove. |
| `ImportResult` | `import_mode` references "existing" (has .autopilot). |
| `ExportOptions` | `include_executions`, `include_flight_plans`. Rename flight_plans, remove executions. |
| `Cost` / `CostSummary` / `ProjectCosts` / `DailyCost` | Cost tracking references executions. Keep cost tracking but decouple from executions. |

---

## 6. Query Keys (`src/lib/query-keys.ts`)

### AP-ONLY Keys (Remove)

| Key | Notes |
|-----|-------|
| `executions` | |
| `execution` | |
| `runningExecutions` | |
| `transponder` | |
| `mcpStatus` | |
| `executionActivity` | |
| `executionBookmarks` | |
| `executionComparison` | |
| `checkpoints` / `allCheckpoints` | |
| `executionCosts` | |
| `costsByPhase` | |

### GSD-ONLY Keys (Keep)

All `gsd*` keys (lines 139-155 in query-keys.ts).

### SHARED Keys (Rename)

| Key | Notes |
|-----|-------|
| `flightplan` | Rename to `roadmap` |
| `allFlightplans` | Rename to `allRoadmaps` |

---

## 7. Navigation (`src/lib/navigation.ts`)

| Item | Category | Notes |
|------|----------|-------|
| Dashboard (`/`) | GENERIC | Keep |
| Projects (`/projects`) | GENERIC | Keep |
| Terminal (`/terminal`) | GENERIC | Keep |
| **Agents (`/agents`)** | **AP-ONLY** | **Remove** |
| Decisions (`/decisions`) | GENERIC | Keep |
| Analytics (`/analytics`) | SHARED | Keep but remove execution-specific analytics |
| Notifications (`/notifications`) | GENERIC | Keep |
| Logs (`/logs`) | GENERIC | Keep |
| Settings (`/settings`) | GENERIC | Keep, remove AP settings section |

---

## 8. Database Tables (`src-tauri/src/db/mod.rs`)

### AP-ONLY Tables (Remove)

| Table | Notes |
|-------|-------|
| `executions` | AP execution tracking (session_number, pid, phase_current, status, etc.) |
| `checkpoints` | AP execution checkpoints (state, phase, task, context_usage_pct) |
| `cache_statistics` | Cache stats tied to executions |

### SHARED Tables (Keep, refactor)

| Table | Notes |
|-------|-------|
| `flight_plans` | Rename conceptually to "roadmaps". Used by both AP (FLIGHTPLAN.md) and GSD (ROADMAP.md). |
| `phases` | Phase tracking. Has `gsd_metadata` column. Generic to both. |
| `tasks` | Tasks within phases. Generic. |
| `costs` | Costs tracking. Has `execution_id` FK to executions. Decouple from executions or keep nullable. |
| `cost_thresholds` | Per-project cost limits. Useful for GSD too. |

### GENERIC Tables (Keep as-is)

| Table | Notes |
|-------|-------|
| `projects` | Core project table |
| `phase_comments` | Comments on phases |
| `decisions` | Decision tracking |
| `activity_log` | Activity events (has `execution_id` FK but nullable) |
| `knowledge` | Knowledge/memory storage |
| `test_runs` | Test tracking (has `execution_id` FK but nullable) |
| `test_results` | Test results |
| `flaky_tests` | Flaky test tracking |
| `app_logs` | Application logs |
| `command_history` | Terminal command history |
| `snippets` | Terminal snippets |
| `script_favorites` | Script favorites |
| `auto_commands` | Auto commands |
| `settings` | Key/value settings |
| `schema_migrations` | Migration tracking |

---

## 9. Hooks (`src/hooks/`)

| Hook | File | Category | Notes |
|------|------|----------|-------|
| `use-tauri-events.ts` | `useExecutionEvents`, `useGlobalExecutionEvents` | **AP-ONLY** | Listens for execution:progress, execution:process-exited, autonomous events |
| `use-gsd-file-watcher.ts` | `useGsdFileWatcher` | **GSD-ONLY** | Listens for gsd:file-changed events |
| `use-close-warning.ts` | `useCloseWarning` | SHARED | Warns about running executions (AP) and active terminals (generic) |
| `use-pty-session.ts` | `usePtySession` | GENERIC | PTY terminal management |
| `use-keyboard-shortcuts.ts` | `useKeyboardShortcuts` | GENERIC | Keyboard shortcuts |
| `use-theme.ts` | `useTheme` | GENERIC | Theme management |

---

## 10. Contexts (`src/contexts/`)

| Context | File | Category | Notes |
|---------|------|----------|-------|
| `terminal-context.tsx` | `TerminalProvider` | GENERIC | Terminal session management |

---

## 11. Lib Utilities

| File | Category | Notes |
|------|----------|-------|
| `src/lib/flight-plan-diff.ts` | SHARED | Compares phase arrays. Rename file, works for roadmap phases. |
| `src/lib/graph-utils.ts` | GENERIC | Phase dependency graph utils. |
| `src/lib/knowledge-graph-utils.ts` | SHARED | References `.autopilot` folder color. Remove AP-specific colors. |
| `src/lib/design-tokens.ts` | SHARED | Contains `ProjectType` with "autopilot" and "autopilot_gsd". Remove AP types, keep "gsd" and "bare". Remove `isHybridProject`, `systemGroupConfig.autopilot`. |
| `src/lib/performance.ts` | GENERIC | Performance monitoring. |
| `src/lib/recent-searches.ts` | GENERIC | Search history. |
| `src/lib/sentry.ts` | GENERIC | Error tracking. |
| `src/lib/utils.ts` | GENERIC | General utilities. |

---

## 12. Config / Settings

### Settings Model Fields to REMOVE (AP-specific)

From `Settings` type in `tauri.ts` and `models/mod.rs`:
- `autopilot_enabled: boolean` -- AP toggle
- `autopilot_mcp_enabled: boolean` -- AP MCP toggle
- `autopilot_max_cost: number` -- AP cost limit

### Settings Model Fields to KEEP

All other settings (theme, notifications, cost thresholds, terminal, etc.)

### ClaudeStatus Fields to REMOVE (AP-specific)

- `autopilot_installed: boolean`
- `autopilot_enabled: boolean`

### TechStack Fields to REMOVE (AP-specific)

- `has_autopilot: boolean` -- remove
- `autopilot_init_incomplete: boolean` -- remove
- `autopilot_init_issues: Option<Vec<String>>` -- remove
- `gsd_conversion_incomplete: boolean` -- remove (refers to AP->GSD conversion)
- `gsd_conversion_issues: Option<Vec<String>>` -- remove

---

## 13. Rust Backend Non-Command Files

| File | Category | Notes |
|------|----------|-------|
| `src-tauri/src/process/` | **AP-ONLY** | Process manager for Claude CLI executions. Start/stop/pause/resume child processes. |
| `src-tauri/src/mcp/` | **AP-ONLY** | MCP server for AP control tower bridge. |
| `src-tauri/src/pty/` | GENERIC | PTY terminal management. |
| `src-tauri/src/db/` | GENERIC | Database module. Schema needs table cleanup. |
| `src-tauri/src/models/mod.rs` | SHARED | Contains both AP and GSD models. Split accordingly. |
| `src-tauri/src/security.rs` | GENERIC | Security module. |
| `src-tauri/src/lib.rs` | SHARED | Tauri command registration. Remove AP command registrations. |
| `src-tauri/src/main.rs` | SHARED | App initialization. Remove AP-specific setup. |

---

## 14. Knowledge Gaps File (`src/components/knowledge/knowledge-gaps.ts`)

**AP-ONLY**: References `.autopilot/FLIGHTPLAN.md`, `.autopilot/TRANSPONDER.md`, `.autopilot/DECISIONS.md`, `.autopilot/CLEARANCE.md`, `.autopilot/codebase/ARCHITECTURE.md`, `.autopilot/LOGBOOK.md`. This entire file defines expected AP knowledge files and their templates. Replace with GSD equivalents (`.planning/` structure).

---

## Summary Statistics

| Category | Items |
|----------|-------|
| **AP-ONLY Rust Modules** | 6 modules (~46 commands) |
| **AP-ONLY Pages** | 3 pages (execution, execution-compare, agents) |
| **AP-ONLY Components** | ~12 component files |
| **AP-ONLY Query Hooks** | ~28 hooks |
| **AP-ONLY API Types** | ~15 types |
| **AP-ONLY API Functions** | ~35 functions |
| **AP-ONLY DB Tables** | 3 tables (executions, checkpoints, cache_statistics) |
| **AP-ONLY Navigation Items** | 1 item (Agents) |
| **AP-ONLY Hooks** | 1 file (use-tauri-events.ts) |
| **AP-ONLY Rust Backend** | 2 dirs (process/, mcp/) |
| **SHARED (needs refactoring)** | ~20 files across all categories |
| **GSD-ONLY** | ~25 hooks, 1 Rust module (23 cmds), 5+ components |
| **GENERIC (keep as-is)** | ~100+ files |
