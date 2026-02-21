# Coding Conventions

**Analysis Date:** 2026-02-21

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `ErrorBoundary.tsx`, `MainLayout.tsx`)
- Hooks: Lowercase with `use-` prefix (e.g., `use-close-warning.ts`, `use-keyboard-shortcuts.ts`)
- Utilities/Libraries: Lowercase with hyphens (e.g., `design-tokens.ts`, `knowledge-graph-utils.ts`)
- Test files: Colocated with source using `.test.tsx` or `.spec.ts` extensions
- UI components: Lowercase with hyphens (e.g., `alert-dialog.tsx`, `dropdown-menu.tsx`)

**Functions:**
- camelCase for all functions, both exported and internal
- Hook functions start with `use` prefix: `useCloseWarning()`, `useTerminalContext()`
- Utility functions start with verbs: `formatCost()`, `formatRelativeTime()`, `getErrorMessage()`, `truncatePath()`
- Component rendering functions use uppercase: `PageLoader()`, `CloseWarningDialog()`, `ThrowError()`

**Variables:**
- camelCase for all variables: `showWarning`, `processInfo`, `handleCancel`
- Boolean variables use `is` or `has` prefixes: `hasTerminals`, `isExited`
- State setters follow React convention: `setShowWarning()`, `setActiveTab()`
- Private/internal variables use underscore prefix: `_component` (rarely used, mostly implicit via scope)

**Types/Interfaces:**
- PascalCase for all type definitions: `UseCloseWarningReturn`, `CustomRenderOptions`
- Interface names describe what they provide: `UseCloseWarningReturn`, `ActiveProcessInfo`
- Union/enum types follow same naming: `ClassValue`, `ErrorType`

## Code Style

**Formatting:**
- Prettier: 100 character print width, semicolons enabled, single quotes, 2-space tabs
- Trailing commas: `es5` (included in arrays/objects)
- Config: `.prettierrc` at project root

**Linting:**
- ESLint with TypeScript support via `typescript-eslint`
- Config: `eslint.config.js`
- Plugin integration: `react-hooks` and `react-refresh`
- Ignored patterns: test files, config files, `src-tauri/`, node_modules, dist

**Key ESLint Rules:**
- `@typescript-eslint/no-unused-vars`: Error, with `_` prefix exception for intentionally unused parameters
- `@typescript-eslint/no-explicit-any`: Warn (discourage but allow with justification)
- `@typescript-eslint/no-floating-promises`: Error (all promises must be awaited or .catch() handled)
- `@typescript-eslint/no-misused-promises`: Error (prevent promise-like types in if/loops)
- `react-refresh/only-export-components`: Warn if non-component exports in .jsx/.tsx files

## Import Organization

**Order:**
1. External libraries from node_modules (`react`, `@tanstack/react-query`, etc.)
2. Internal absolute imports using `@` alias (`@/components`, `@/hooks`, `@/lib`)
3. Relative imports (rarely used, prefer absolute `@` imports)

**Path Aliases:**
- `@/` resolves to `src/` (configured in `vite.config.ts`)
- Always use `@/` for imports within the src directory

**Example:**
```typescript
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { ErrorBoundary } from "@/components/error-boundary";
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations, especially Tauri IPC calls
- Silent failures are acceptable for non-critical operations (commented with "// best-effort" or similar)
- Error messages extracted via `getErrorMessage()` utility function
- Backend errors logged via `invoke("log_frontend_error", { error })` in error boundaries
- Error boundaries wrap major page sections and provide fallback UI

**Error Boundary Pattern:**
- Global app-level boundary: `<ErrorBoundary label="Application">`
- Page-level boundary: `<ErrorBoundary label="Page" inline>`
- Specialized boundaries: `<ErrorBoundary inline label="Settings Panel">`
- Custom fallback UI via `fallback` prop

**Example:**
```typescript
try {
  await forceCloseAll();
  const window = getCurrentWindow();
  await window.destroy();
} catch {
  // Force close is best-effort; window may already be closing
}
```

## Logging

**Framework:** `console` for development; no dedicated logger found

**Patterns:**
- Performance warnings via `console.warn()` for slow operations
- Performance marks via `performance.mark()` and `performance.measure()`
- Slow Tauri invokes logged when exceeding 200ms threshold
- Slow React Query invokes logged when exceeding 500ms threshold
- Errors logged to backend via `logFrontendEvent()` in error boundaries

**Performance Thresholds:**
- `SLOW_INVOKE_THRESHOLD_MS = 200`
- `SLOW_QUERY_THRESHOLD_MS = 500`
- `VERY_SLOW_THRESHOLD_MS = 2000`

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic
- Workarounds with explanations (see error handling blocks)
- JSDoc for exported functions and types

**JSDoc/TSDoc:**
- Sparse usage but present for utility functions
- Format: Multi-line comment blocks with description
- Example from `utils.ts`:
```typescript
/**
 * Extract a human-readable error message from an unknown error value.
 * Handles Error objects, strings, and Tauri backend errors.
 */
export function getErrorMessage(err: unknown): string
```

**File Headers:**
All source files include copyright header:
```typescript
// Track Your Shit - [Component/Feature Name]
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
```

## Function Design

**Size:**
- Most utility functions 5-20 lines
- Component functions vary based on JSX complexity
- Helper functions extracted when reused or exceeding 30 lines

**Parameters:**
- Named parameters for 2+ related config values
- Type safety via TypeScript interfaces for options objects
- Example: `customRender(ui: ReactElement, options: CustomRenderOptions = {})`

**Return Values:**
- Explicit typing required for all exported functions
- Return types annotated after function signature
- Promise returns clearly marked: `Promise<void>`, `Promise<UseCloseWarningReturn>`

## Module Design

**Exports:**
- Named exports preferred for utilities and hooks
- Default export for React components (page routes)
- Barrel files (`index.ts`) for organizing related exports

**Barrel Files:**
- Used in component directories: `src/components/terminal/index.ts`
- Re-export key components for simplified imports
- Example:
```typescript
// src/components/terminal/index.ts
export { InteractiveTerminal } from './interactive-terminal';
export { TerminalTabs } from './terminal-tabs';
```

**File Organization:**
- One component/hook per file (single responsibility)
- Tests colocated in `__tests__` subdirectories or as `.test.tsx` files alongside source
- Utility files grouped by domain: `src/lib/tauri.ts`, `src/lib/utils.ts`, `src/lib/performance.ts`

## TypeScript Configuration

**Strict Mode:**
- Enabled via `@typescript-eslint/recommended-type-checked`
- Explicit any disallowed (with warning level for pragmatism)
- Type checking includes tsconfig.json and tsconfig.node.json

**Common Patterns:**
- Interface for component props: `interface ComponentNameProps { ... }`
- Union types for state management
- Generic types for reusable components and hooks

---

*Convention analysis: 2026-02-21*
