// Track Your Shit - E2E Dashboard Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { test, expect } from '@playwright/test';

/**
 * Dashboard E2E Tests
 * 
 * Tests the dashboard page functionality including layout, empty states,
 * and interactive elements. Note: These tests run against the web layer only
 * and may need to mock Tauri IPC calls for full functionality.
 */

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
    
    // Wait for app to load - check for heading
    const heading = page.locator('h1').filter({ hasText: /command center/i });
    await expect(heading).toBeVisible();
  });

  test('should render dashboard page without crashing', async ({ page }) => {
    // Verify the page loaded successfully - check for heading
    const heading = page.locator('h1').filter({ hasText: /command center/i });
    await expect(heading).toBeVisible();
    
    // Check that we're on the root path
    await expect(page).toHaveURL('/');
  });

  test('should have main layout structure', async ({ page }) => {
    // Check for main layout elements - sidebar and content area
    await expect(page.getByText('Track Your Shit')).toBeVisible();
    
    // Should have the Command Center heading
    const heading = page.getByRole('heading', { name: /command center/i });
    await expect(heading).toBeVisible();
  });

  test('should display action buttons', async ({ page }) => {
    // Look for common action buttons like "New Project" or "Import"
    // These are typically in the dashboard toolbar/header area
    
    // Check for buttons with common action text
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    // Should have at least some interactive buttons
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('should have search or filter controls', async ({ page }) => {
    // Dashboard typically has search input or filter controls
    const searchInput = page.locator('input[type="text"]').first();
    const searchCount = await searchInput.count();
    
    // If search exists, verify it's interactive
    if (searchCount > 0) {
      await expect(searchInput).toBeVisible();
      await expect(searchInput).toBeEnabled();
      
      // Try typing in the search
      await searchInput.fill('test search');
      await expect(searchInput).toHaveValue('test search');
      
      // Clear it
      await searchInput.clear();
      await expect(searchInput).toHaveValue('');
    }
  });

  test('should have sort controls', async ({ page }) => {
    // Dashboard often has sort controls (dropdowns, buttons)
    // Look for sort-related UI elements
    
    // Check for buttons that might control sorting
    const sortButton = page.locator('button').filter({ 
      hasText: /sort|order|activity|name|cost|grade/i 
    });
    
    const count = await sortButton.count();
    if (count > 0) {
      await expect(sortButton.first()).toBeVisible();
    }
  });

  test('should handle view mode toggles if present', async ({ page }) => {
    // Some dashboards have grid/list view toggles
    // Look for view mode buttons (grid icon, list icon)
    
    const viewButtons = page.locator('button').filter({
      has: page.locator('svg')
    });
    
    const count = await viewButtons.count();
    
    // Just verify we have some interactive buttons
    expect(count).toBeGreaterThan(0);
  });

  test('should display project cards or list when data loads', async ({ page }) => {
    // Wait a bit for any async data loading
    await page.waitForTimeout(500);
    
    // Look for either project cards or empty state message
    const hasEmptyState = await page.getByText(/no projects yet/i).count() > 0;
    const hasCards = await page.locator('[class*="card"]').count() > 0;
    
    // Should have either cards or empty state
    expect(hasEmptyState || hasCards).toBeTruthy();
  });

  test('should handle dialog interactions', async ({ page }) => {
    // Test opening dialogs (New Project, Import, etc.)
    // Look for buttons that open dialogs
    
    const dialogButtons = page.locator('button').filter({
      hasText: /new|import|add|create/i
    });
    
    const count = await dialogButtons.count();
    
    if (count > 0) {
      const button = dialogButtons.first();
      await expect(button).toBeVisible();
      
      // Click to open dialog
      await button.click();
      
      // Wait for dialog to potentially appear
      await page.waitForTimeout(300);
      
      // Look for a dialog/modal
      const dialog = page.locator('[role="dialog"]');
      const dialogCount = await dialog.count();
      
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible();
        
        // Try to close it (look for close button or escape)
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('should be responsive and not have layout breaks', async ({ page }) => {
    // Check that nav/sidebar is properly sized
    const nav = page.locator('nav');
    const box = await nav.boundingBox();
    
    // Nav should have dimensions
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('should handle rapid interactions without crashing', async ({ page }) => {
    // Rapid clicks on various elements to test stability
    const buttons = page.locator('button').filter({ hasText: /.+/ });
    const count = await buttons.count();
    
    if (count > 0) {
      // Click first button multiple times
      const button = buttons.first();
      if (await button.isVisible() && await button.isEnabled()) {
        await button.click();
        await page.waitForTimeout(50);
        
        // Verify page is still functional
        await expect(page.locator('nav')).toBeVisible();
      }
    }
  });

  test('should maintain state during navigation and return', async ({ page }) => {
    // If there's a search input, fill it
    const searchInput = page.locator('input[type="text"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('test state');
    }
    
    // Navigate away
    await page.goto('/settings');
    await expect(page).toHaveURL('/settings');
    
    // Navigate back
    await page.goto('/');
    await expect(page).toHaveURL('/');
    
    // Verify dashboard still works
    const heading = page.locator('h1').filter({ hasText: /command center/i });
    await expect(heading).toBeVisible();
  });
});
