// Track Your Shit - Playwright E2E Test Configuration
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Track Your Shit E2E tests
 * 
 * Note: These tests run against the Vite dev server (web layer only).
 * Full Tauri E2E testing with native APIs requires tauri-driver and will
 * be configured in a future phase.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm exec vite --port 1420',
    port: 1420,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
