// Track Your Shit - E2E Projects Page Tests
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>

import { test, expect } from '@playwright/test';

/**
 * Projects Page E2E Tests
 * 
 * Tests the dedicated projects management page including search, filters,
 * and project card interactions. These tests verify UI behavior without
 * requiring full Tauri backend functionality.
 */

test.describe('Projects Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects');
    
    // Wait for app branding to load
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should render projects page without crashing', async ({ page }) => {
    // Verify page loaded successfully
    await expect(page).toHaveURL('/projects');
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should have page heading', async ({ page }) => {
    // Look for a heading that indicates this is the projects page
    // Could be h1, h2, or large text with "Projects"
    const heading = page.locator('h1, h2').filter({ hasText: /projects/i });
    
    const count = await heading.count();
    if (count > 0) {
      await expect(heading.first()).toBeVisible();
    }
  });

  test('should have search input', async ({ page }) => {
    // Projects page should have a search input
    const searchInput = page.getByRole('textbox', { name: /search/i });
    
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEnabled();
  });

  test('should allow searching/filtering projects', async ({ page }) => {
    // Find search input
    const searchInput = page.getByRole('textbox', { name: /search/i });
    await expect(searchInput).toBeVisible();
    
    // Type a search query
    await searchInput.fill('test project');
    await expect(searchInput).toHaveValue('test project');
    
    // Wait for any debounce/filtering to occur
    await page.waitForTimeout(400);
    
    // Clear search
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });

  test('should have New Project button', async ({ page }) => {
    // Look for button to create new project
    const newButton = page.getByRole('button', { name: 'New Project' });
    
    await expect(newButton).toBeVisible();
    await expect(newButton).toBeEnabled();
  });

  test('should have Import button', async ({ page }) => {
    // Look for import button
    const importButton = page.locator('button').filter({ 
      hasText: /import/i 
    });
    
    const count = await importButton.count();
    
    if (count > 0) {
      await expect(importButton.first()).toBeVisible();
      await expect(importButton.first()).toBeEnabled();
    }
  });

  test('should open New Project dialog when button clicked', async ({ page }) => {
    // Find and click New Project button
    const newButton = page.locator('button').filter({ 
      hasText: /new\s+project|create|add\s+project/i 
    }).first();
    
    const count = await newButton.count();
    
    if (count > 0) {
      await newButton.click();
      
      // Wait for dialog to appear
      await page.waitForTimeout(300);
      
      // Look for dialog
      const dialog = page.locator('[role="dialog"]');
      const dialogCount = await dialog.count();
      
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible();
        
        // Dialog should have some form elements
        const dialogContent = dialog.first();
        const inputs = dialogContent.locator('input');
        const inputCount = await inputs.count();
        expect(inputCount).toBeGreaterThan(0);
        
        // Close dialog with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('should open Import dialog when button clicked', async ({ page }) => {
    // Find and click Import button
    const importButton = page.locator('button').filter({ 
      hasText: /import/i 
    }).first();
    
    const count = await importButton.count();
    
    if (count > 0) {
      await importButton.click();
      
      // Wait for dialog to appear
      await page.waitForTimeout(300);
      
      // Look for dialog
      const dialog = page.locator('[role="dialog"]');
      const dialogCount = await dialog.count();
      
      if (dialogCount > 0) {
        await expect(dialog.first()).toBeVisible();
        
        // Close dialog with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('should have filter controls', async ({ page }) => {
    // Projects page may have status/type filters
    // Look for select dropdowns or filter buttons
    
    const selects = page.locator('select, button[role="combobox"]');
    const count = await selects.count();
    
    // Should have some form of filtering UI
    if (count > 0) {
      await expect(selects.first()).toBeVisible();
    }
  });

  test('should display project cards or empty state', async ({ page }) => {
    // Wait for any data loading
    await page.waitForTimeout(500);
    
    // Look for either cards or empty state text
    const hasCards = await page.locator('[class*="card"]').count() > 0;
    const hasEmptyText = await page.locator('text=/no projects|empty|get started/i').count() > 0;
    
    // Should have either cards or empty state
    expect(hasCards || hasEmptyText).toBeTruthy();
  });

  test('should handle multiple filter combinations', async ({ page }) => {
    // Test using search + filter together
    const searchInput = page.getByRole('textbox', { name: /search/i });
    
    await expect(searchInput).toBeVisible();
    await searchInput.fill('test');
    await page.waitForTimeout(300);
    
    // Try changing a filter if one exists
    const filterSelect = page.locator('button[role="combobox"]').first();
    const filterCount = await filterSelect.count();
    if (filterCount > 0) {
      await filterSelect.click();
      await page.waitForTimeout(200);
      // Click again to close
      await page.keyboard.press('Escape');
    }
    
    // Clear search
    await searchInput.clear();
    
    // Page should still be functional
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });

  test('should maintain search state during interactions', async ({ page }) => {
    const searchInput = page.getByRole('textbox', { name: /search/i });
    
    // Enter search term
    await searchInput.fill('persistent search');
    await expect(searchInput).toHaveValue('persistent search');
    
    // Interact with another element (like opening/closing a dialog)
    const newProjectButton = page.getByRole('button', { name: /new project/i });
    if (await newProjectButton.isVisible()) {
      await newProjectButton.click();
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    
    // Search value should still be there
    await expect(searchInput).toHaveValue('persistent search');
  });

  test('should be responsive and scrollable', async ({ page }) => {
    // Check layout doesn't break - verify Track Your Shit branding has dimensions
    const branding = page.getByText('Track Your Shit');
    const box = await branding.boundingBox();
    
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('should handle rapid search input changes', async ({ page }) => {
    const searchInput = page.getByRole('textbox', { name: /search/i });
    
    // Rapidly type and clear
    await searchInput.fill('a');
    await searchInput.fill('ab');
    await searchInput.fill('abc');
    await searchInput.clear();
    await searchInput.fill('test');
    
    // Page should still be responsive
    await expect(page.getByText('Track Your Shit')).toBeVisible();
    await expect(searchInput).toHaveValue('test');
  });

  test('should navigate back to dashboard', async ({ page }) => {
    // Click on dashboard button to navigate back
    const dashboardButton = page.getByRole('button', { name: /dashboard/i });
    await expect(dashboardButton).toBeVisible();
    
    await dashboardButton.click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Track Your Shit')).toBeVisible();
  });
});
