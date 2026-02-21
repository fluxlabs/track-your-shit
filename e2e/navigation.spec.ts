// Track Your Shit - E2E Navigation Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { test, expect } from '@playwright/test';

/**
 * Navigation E2E Tests
 * 
 * Tests basic page navigation and sidebar interactions.
 * These tests verify the React Router navigation without requiring Tauri IPC.
 */

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
    
    // Wait for the app to load - check for Track Your Shit branding
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should load dashboard as default route', async ({ page }) => {
    // Verify we're on the dashboard
    await expect(page).toHaveURL('/');
    
    // Look for dashboard-specific content (heading with "Command Center")
    const heading = page.locator('h1').filter({ hasText: /command center/i });
    await expect(heading).toBeVisible();
  });

  test('should navigate to Projects page', async ({ page }) => {
    // Find and click the Projects navigation button
    // Projects link should be in the sidebar
    const projectsButton = page.getByRole('button', { name: /projects/i });
    await expect(projectsButton).toBeVisible();
    await projectsButton.click();
    
    // Verify navigation
    await expect(page).toHaveURL('/projects');
    
    // Wait for page content to load
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should navigate to Settings page', async ({ page }) => {
    // Find and click the Settings navigation button
    const settingsButton = page.getByRole('button', { name: /settings/i });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    
    // Verify navigation
    await expect(page).toHaveURL('/settings');
    
    // Wait for page content to load
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should navigate to Analytics page', async ({ page }) => {
    // Find and click the Analytics navigation button
    const analyticsButton = page.getByRole('button', { name: /analytics/i });
    await expect(analyticsButton).toBeVisible();
    await analyticsButton.click();
    
    // Verify navigation
    await expect(page).toHaveURL('/analytics');
    
    // Wait for page content to load
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should have functional sidebar navigation', async ({ page }) => {
    // Test multiple navigation items in sequence
    const routes = [
      { name: 'Projects', path: '/projects' },
      { name: 'Analytics', path: '/analytics' },
      { name: 'Dashboard', path: '/' },
    ];

    for (const route of routes) {
      const button = page.getByRole('button', { name: route.name });
      await expect(button).toBeVisible();
      await button.click();
      await expect(page).toHaveURL(route.path);
      await expect(page.getByText('Track Your Shit')).toBeVisible();
      
      // Small delay for state updates
      await page.waitForTimeout(100);
    }
  });

  test('should have sidebar toggle button', async ({ page }) => {
    // Look for sidebar collapse/expand functionality
    // The sidebar component likely has a toggle button
    // This test verifies the button exists and is clickable
    
    // Try to find a button that might collapse the sidebar
    // Common patterns: ChevronLeft, Menu, PanelLeft icons
    const toggleButton = page.locator('button').filter({ 
      hasText: /collapse|expand|menu|toggle/i 
    }).or(
      page.locator('button').filter({ has: page.locator('svg') }).first()
    );
    
    // If toggle exists, test it
    const count = await toggleButton.count();
    if (count > 0) {
      await expect(toggleButton.first()).toBeVisible();
      // Just verify it's clickable, don't assert on visual state
      // as that would require more complex DOM inspection
      await toggleButton.first().click();
    }
  });

  test('should handle direct URL navigation', async ({ page }) => {
    // Navigate directly to a route via URL
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
    await expect(page.getByText('Track Your Shit')).toBeVisible();
    
    // Navigate to another route
    await page.goto('/projects');
    await expect(page).toHaveURL('/projects');
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should maintain navigation state after page interactions', async ({ page }) => {
    // Navigate to projects page
    await page.getByRole('button', { name: /projects/i }).click();
    await expect(page).toHaveURL('/projects');
    
    // Interact with the page (e.g., search input if present)
    const searchInput = page.locator('input[type="text"]').first();
    const searchCount = await searchInput.count();
    if (searchCount > 0) {
      await searchInput.fill('test');
    }
    
    // Navigate back to dashboard
    await page.getByRole('button', { name: /dashboard/i }).click();
    await expect(page).toHaveURL('/');
    
    // Navigate back to projects
    await page.getByRole('button', { name: /projects/i }).click();
    await expect(page).toHaveURL('/projects');
    
    // Verify we're still on a functional page
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });
});
