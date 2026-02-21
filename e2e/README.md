// Track Your Shit - E2E Testing Documentation
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

# End-to-End Testing with Playwright

This directory contains E2E tests for the Track Your Shit desktop application using Playwright.

## Overview

The E2E tests validate the React frontend layer running against the Vite dev server. These tests cover:

- **Navigation**: Page routing and sidebar navigation
- **Dashboard**: Main dashboard UI and interactions
- **Projects**: Project management page functionality

## Important Notes

### Current Scope

These tests run against the **web layer only** (React + Vite dev server on port 1420). They do NOT test:

- Native Tauri APIs
- Backend Rust functionality
- Full desktop app features (file system access, native dialogs, etc.)

### Future Enhancements

For full Tauri E2E testing with native API access, we'll need to integrate `tauri-driver` in a future phase. This will enable:

- Testing Tauri IPC calls
- File system operations
- Native window behavior
- WebView-specific functionality

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests in UI mode (interactive)
pnpm test:e2e:ui

# Run tests in debug mode
pnpm test:e2e:debug

# Run specific test file
pnpm exec playwright test e2e/navigation.spec.ts

# Run tests in headed mode (see browser)
pnpm exec playwright test --headed
```

## Test Files

### `navigation.spec.ts`
Tests basic navigation and routing:
- Default dashboard route loading
- Navigating between pages (Projects, Settings, Analytics)
- Sidebar navigation functionality
- Sidebar collapse/expand
- Direct URL navigation
- Navigation state persistence

### `dashboard.spec.ts`
Tests the main dashboard page:
- Page rendering and layout
- Search and filter controls
- Sort controls
- View mode toggles
- Dialog interactions
- Empty state vs project cards
- Rapid interaction handling
- State persistence during navigation

### `projects.spec.ts`
Tests the projects management page:
- Page rendering and heading
- Search functionality
- Filter controls
- New Project dialog
- Import dialog
- Project cards or empty state display
- Multiple filter combinations
- Search state persistence
- Rapid input handling
- Navigation back to dashboard

## Configuration

The Playwright configuration is in `playwright.config.ts`. Key settings:

- **Base URL**: `http://localhost:1420` (Vite dev server)
- **Test Directory**: `./e2e`
- **Web Server**: Automatically starts Vite dev server
- **Retries**: 2 retries in CI, 0 locally
- **Workers**: 1 in CI (for stability), parallel locally
- **Reporters**: HTML report (viewable after tests)
- **Screenshots**: Captured on failure only
- **Traces**: Captured on first retry

## Viewing Test Results

After running tests, view the HTML report:

```bash
pnpm exec playwright show-report
```

Failed tests will have:
- Screenshots of the failure state
- Error context with DOM snapshot
- Full trace logs (if retried)

## Writing New Tests

### Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByText`, `getByLabel` over CSS selectors
2. **Wait for visibility**: Always wait for elements to be visible before interacting
3. **Test behavior, not implementation**: Focus on user interactions, not internal state
4. **Keep tests isolated**: Each test should be independent
5. **Use descriptive names**: Test names should clearly describe what they validate

### Example Test Structure

```typescript
test('should perform user action', async ({ page }) => {
  // Navigate to page
  await page.goto('/target-page');
  
  // Wait for page to load
  await expect(page.getByText('Track Your Shit')).toBeVisible();
  
  // Perform actions
  const button = page.getByRole('button', { name: 'Action' });
  await expect(button).toBeVisible();
  await button.click();
  
  // Verify results
  await expect(page).toHaveURL('/expected-url');
  await expect(page.getByText('Success')).toBeVisible();
});
```

## Tauri IPC Mocking (Future)

When implementing full Tauri E2E tests, you'll need to:

1. Mock Tauri IPC calls using `page.route()` or similar
2. Or use `tauri-driver` for actual Tauri app testing
3. Handle async data loading from backend
4. Mock file system operations

## Troubleshooting

### Tests Timeout

- Increase timeout in `playwright.config.ts` or specific tests
- Check if Vite dev server started correctly
- Look for console errors in test output

### Elements Not Found

- Use Playwright Inspector: `pnpm test:e2e:debug`
- Check element selectors match actual DOM
- Ensure page has fully loaded before assertions
- Use `page.pause()` to debug interactively

### Flaky Tests

- Add explicit waits for async operations
- Use `waitForLoadState('networkidle')` for data loading
- Increase debounce timeouts for input fields
- Check for race conditions in navigation

## CI/CD Integration

The tests are configured for CI environments:

- Single worker to avoid resource contention
- 2 retries for flaky test resilience
- `forbidOnly` enabled to prevent `.only` in commits
- HTML reporter for artifact storage

## Dependencies

- `@playwright/test`: ^1.58.2
- Chromium browser (installed via `playwright install`)

## Test Coverage

Current test coverage (34 tests):

- ✅ Navigation (8 tests)
- ✅ Dashboard (11 tests)  
- ✅ Projects Page (15 tests)

**Total: 34 passing tests**

---

For questions or issues with E2E testing, refer to:
- [Playwright Documentation](https://playwright.dev)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)
