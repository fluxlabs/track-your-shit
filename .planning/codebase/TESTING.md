# Testing Patterns

**Analysis Date:** 2026-02-21

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vite.config.ts` (test section)
- Environment: jsdom (for DOM testing)
- Global test utilities enabled

**Assertion Library:**
- Vitest built-in `expect()` assertions
- React Testing Library for component testing
- Testing Library User Event for user interactions

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode for development
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Interactive E2E test runner
npm run test:e2e:debug   # Debug E2E tests with inspector
```

## Test File Organization

**Location:**
- Co-located with source files using `.test.tsx` or `.test.ts` extensions
- Alternatively, in `src/**/__tests__/` subdirectories
- E2E tests in `e2e/` directory at project root

**Naming:**
- `.test.ts` for utility/hook tests: `utils.test.ts`, `performance.test.ts`
- `.test.tsx` for component tests: `error-boundary.test.tsx`
- E2E specs: `*.spec.ts` format (e.g., `navigation.spec.ts`, `projects.spec.ts`)

**Structure:**
```
src/
├── components/
│   ├── error-boundary.tsx
│   └── __tests__/
│       └── error-boundary.test.tsx
├── lib/
│   ├── utils.ts
│   └── __tests__/
│       └── utils.test.ts
└── hooks/
    └── use-close-warning.ts
e2e/
├── navigation.spec.ts
├── projects.spec.ts
└── dashboard.spec.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe("ErrorBoundary", () => {
  describe("normal rendering", () => {
    it("renders children when no error occurs", () => {
      // Test body
    });
  });

  describe("error catching", () => {
    it("catches and displays error when child component throws", () => {
      // Test body
    });
  });
});
```

**Patterns:**
- Top-level `describe()` block for component/function name
- Nested `describe()` blocks for feature grouping
- `it()` for individual test cases with descriptive names
- Setup via `beforeEach()` for test isolation
- Cleanup via `afterEach()` for mocks and spies

## Mocking

**Framework:** Vitest's `vi` module

**Patterns:**
```typescript
// Mock entire module
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock specific function
const reloadMock = vi.fn();
Object.defineProperty(window, "location", {
  value: { reload: reloadMock },
  writable: true,
});

// Spy on existing functions
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
warnSpy.mockRestore(); // In afterEach

// Suppress console errors in error boundary tests
vi.spyOn(console, "error").mockImplementation(() => {});
```

**Setup File (`src/test/setup.ts`):**
- Global mocks for browser APIs: localStorage, sessionStorage, ResizeObserver, IntersectionObserver
- Tauri API mocks: `@tauri-apps/api/core`, `@tauri-apps/api/event`, `@tauri-apps/plugin-shell`, etc.
- Element.prototype.scrollIntoView mock for cmdk component
- Mock cleanup in `beforeEach()` via `vi.clearAllMocks()`

**What to Mock:**
- External APIs and third-party Tauri modules
- Browser APIs that may not be available in jsdom
- setTimeout/setInterval for performance tests
- Window events and methods

**What NOT to Mock:**
- Component internal state and behavior
- React Router navigation (use MemoryRouter with routerProps)
- React Query (use test QueryClient with retry:false, gcTime:0)

## Fixtures and Factories

**Test Data:**
```typescript
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}
```

**Location:**
- Helper functions defined at top of test files or in `src/test/test-utils.tsx`
- Component wrappers for testing: `AllProviders`, `customRender`

**Custom Render (`src/test/test-utils.tsx`):**
```typescript
function customRender(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const { routerProps, queryClient, ...renderOptions } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders routerProps={routerProps} queryClient={queryClient}>
        {children}
      </AllProviders>
    ),
    ...renderOptions,
  });
}

export { customRender as render, createTestQueryClient };
```

**Providers Wrapper:**
- Wraps all required context providers: QueryClientProvider, TerminalProvider, MemoryRouter
- Automatically included in all component test renders
- Allows passing custom routerProps and queryClient via options

## Coverage

**Requirements:** None enforced (no coverage thresholds configured)

**View Coverage:**
```bash
npm run test -- --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, hooks, components in isolation
- Approach: Mock external dependencies, test function behavior
- Examples: `utils.test.ts`, `performance.test.ts`, hook tests

**Component Tests:**
- Scope: React components, user interactions, prop handling
- Approach: Render with React Testing Library, query by role/text
- Examples: `error-boundary.test.tsx`, context tests
- Pattern: Use `render()` (which includes all providers), `userEvent.setup()`, `waitFor()`

**Integration Tests:**
- Scope: Multiple components working together with real hooks
- Approach: Render full component trees, test data flow
- Note: Not heavily used; most tests are component-level

**E2E Tests:**
- Framework: Playwright 1.58.2
- Config: `playwright.config.ts`
- Scope: Full application flow through browser
- Target: Vite dev server at `http://localhost:1420`
- Execution: Single worker in CI, parallel locally
- Artifacts: HTML reports, screenshots on failure

## Common Patterns

**Async Testing:**
```typescript
// For components that render asynchronously
await waitFor(() => {
  expect(mockInvoke).toHaveBeenCalledWith(
    "log_frontend_error",
    expect.objectContaining({
      error: expect.stringContaining("[ErrorBoundary:TestComponent]"),
    })
  );
});

// For user events
const user = userEvent.setup();
const tryAgainButton = screen.getByText("Try Again");
await user.click(tryAgainButton);
```

**Error Testing:**
```typescript
// Component that throws
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>Normal content</div>;
}

// Test error catching
render(
  <ErrorBoundary>
    <ThrowError shouldThrow={true} />
  </ErrorBoundary>
);

expect(screen.getByText("Something went wrong")).toBeInTheDocument();
expect(screen.getByText("Test error message")).toBeInTheDocument();
```

**Hook Testing:**
```typescript
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TerminalProvider>{children}</TerminalProvider>
);

const { result } = renderHook(() => useTerminalContext(), { wrapper });

act(() => {
  result.current.addTab("project-1", "shell");
});

const terminals = result.current.getProjectTerminals("project-1");
expect(terminals.tabs).toHaveLength(1);
```

**Mock Verification:**
```typescript
const mockInvoke = vi.mocked(invoke);

// Set mock return value
mockInvoke.mockResolvedValue(undefined);

// Verify called with arguments
expect(mockInvoke).toHaveBeenCalledWith(
  "test_command",
  expect.objectContaining({ param: "value" })
);

// Reset mocks between tests
vi.clearAllMocks();
```

**Suppressing Console Errors:**
```typescript
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // Cleanup happens in vi.clearAllMocks() or explicit restore
});
```

## Playwright E2E Configuration

**Setup (`playwright.config.ts`):**
- Single browser: Chromium (Desktop Chrome)
- Base URL: `http://localhost:1420`
- Auto-starts Vite dev server on port 1420
- Reuses existing server in development (not CI)
- Screenshots: Only on failure
- Traces: Recorded on first retry
- Reporter: HTML format

**Sample Tests:**
- `e2e/navigation.spec.ts`: Navigation between routes
- `e2e/projects.spec.ts`: Project creation and management
- `e2e/dashboard.spec.ts`: Dashboard functionality

---

*Testing analysis: 2026-02-21*
