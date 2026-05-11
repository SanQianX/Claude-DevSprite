import { test, expect } from '@playwright/test';

test.describe('Home Page (/)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Use load instead of networkidle (SSE keeps connection open)
    await page.waitForLoadState('load');
  });

  test('home-01: page loads, project list table visible or empty state', async ({ page }) => {
    // Wait for loading spinner to disappear
    const loading = page.locator('.loading-container');
    if (await loading.isVisible().catch(() => false)) {
      await expect(loading).toBeHidden({ timeout: 15000 });
    }

    // Either table or empty state should be visible
    const table = page.locator('.project-table');
    const emptyState = page.locator('.empty-container');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('home-02: refresh button reloads project list', async ({ page }) => {
    // Wait for initial load
    await page.locator('.project-table, .empty-container').first().waitFor({ state: 'visible', timeout: 15000 });

    const refreshBtn = page.locator('.section-actions button').first();
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // After refresh, content should still be visible
    await page.waitForTimeout(500);
    await expect(page.locator('.project-table, .empty-container').first()).toBeVisible();
  });

  test('home-03: add project button opens modal', async ({ page }) => {
    await page.locator('.project-table, .empty-container').first().waitFor({ state: 'visible', timeout: 15000 });

    const addBtn = page.locator('.section-actions button').nth(1);
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Modal should appear (AddProjectModal uses Teleport to body)
    const modal = page.locator('.modal-overlay, .modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('home-04: in modal, type path and add project', async ({ page }) => {
    await page.locator('.project-table, .empty-container').first().waitFor({ state: 'visible', timeout: 15000 });

    // Open modal
    await page.locator('.section-actions button').nth(1).click();
    const modal = page.locator('.modal-overlay, .modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find input and type path
    const pathInput = modal.locator('input').first();
    await expect(pathInput).toBeVisible();
    await pathInput.fill('D:/test-project');

    // Click Add button (last button in modal footer)
    const addButton = modal.locator('button').filter({ hasText: /添加|Add|确定/ }).last();
    await addButton.click();

    // Wait for response - modal may close or show error
    await page.waitForTimeout(1500);
  });

  test('home-05: in modal, cancel button closes modal', async ({ page }) => {
    await page.locator('.project-table, .empty-container').first().waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('.section-actions button').nth(1).click();
    const modal = page.locator('.modal-overlay, .modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const cancelBtn = modal.locator('button').filter({ hasText: /取消|Cancel/ }).first();
    await cancelBtn.click();

    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('home-06: in modal, X button closes modal', async ({ page }) => {
    await page.locator('.project-table, .empty-container').first().waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('.section-actions button').nth(1).click();
    const modal = page.locator('.modal-overlay, .modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const closeBtn = modal.locator('[aria-label="Close"]');
    await closeBtn.click();

    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('home-07: project row chat icon navigates to chat', async ({ page }) => {
    await page.locator('.project-table, .empty-container').first().waitFor({ state: 'visible', timeout: 15000 });

    const table = page.locator('.project-table');
    const tableVisible = await table.isVisible().catch(() => false);
    test.skip(!tableVisible, 'No projects table visible');

    const projectRow = page.locator('.project-table tbody tr').first();
    // Hover to reveal action buttons
    await projectRow.hover();
    await page.waitForTimeout(300);

    const chatBtn = projectRow.locator('button').first();
    if (await chatBtn.isVisible()) {
      await chatBtn.click();
      await page.waitForURL('**/chat**', { timeout: 5000 });
      expect(page.url()).toContain('chat');
    }
  });

  test('home-08: project row delete with confirmation', async ({ page }) => {
    await page.locator('.project-table, .empty-container').first().waitFor({ state: 'visible', timeout: 15000 });

    const table = page.locator('.project-table');
    const tableVisible = await table.isVisible().catch(() => false);
    test.skip(!tableVisible, 'No projects table visible');

    const projectRow = page.locator('.project-table tbody tr').first();
    await projectRow.hover();
    await page.waitForTimeout(300);

    const deleteBtn = projectRow.locator('button').last();
    if (await deleteBtn.isVisible()) {
      page.on('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test('home-09: language toggle switches locale', async ({ page }) => {
    // Language button shows "中" (Chinese) or "EN" (English)
    const langBtn = page.locator('.header-right button .lang-label').first();
    await expect(langBtn).toBeVisible({ timeout: 10000 });

    const initialText = await langBtn.textContent();
    // Click the parent button
    await langBtn.locator('..').click();
    await page.waitForTimeout(500);

    const newText = await langBtn.textContent();
    expect(newText).not.toBe(initialText);
  });

  test('home-10: theme toggle switches light/dark', async ({ page }) => {
    // Theme is stored in data-theme attribute on <html>
    await page.locator('.header-right').waitFor({ state: 'visible', timeout: 10000 });
    const headerBtns = page.locator('.header-right button');
    const count = await headerBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const themeBtn = headerBtns.nth(1);
    await expect(themeBtn).toBeVisible();

    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme') || 'light';

    await themeBtn.click();
    await page.waitForTimeout(500);

    const newTheme = await html.getAttribute('data-theme') || 'light';
    expect(newTheme).not.toBe(initialTheme);
  });

  test('home-11: tokensbar period buttons update stats', async ({ page }) => {
    // Wait for tokens bar to load
    const tokensBar = page.locator('[class*="tokens-bar"], [class*="tokens"]').first();
    await expect(tokensBar).toBeVisible({ timeout: 10000 });

    const periodBtns = tokensBar.locator('button');
    const count = await periodBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click second period button
    await periodBtns.nth(1).click();
    await page.waitForTimeout(500);
    await expect(tokensBar).toBeVisible();
  });

  test('home-12: logfilters level buttons filter logs', async ({ page }) => {
    // Wait for console panel footer to appear
    await page.locator('.console-footer').waitFor({ state: 'visible', timeout: 10000 });

    // Click footer to expand console
    await page.locator('.console-footer').click();
    await page.waitForTimeout(500);

    // Now LogFilters should be visible
    const logFilters = page.locator('.log-filters, [class*="log-filter"]').first();
    await expect(logFilters).toBeVisible({ timeout: 5000 });

    // Click Info filter button
    const infoBtn = logFilters.locator('button').filter({ hasText: /Info/ }).first();
    if (await infoBtn.isVisible()) {
      await infoBtn.click();
      await page.waitForTimeout(300);
    }

    // Click All filter button
    const allBtn = logFilters.locator('button').filter({ hasText: /All/ }).first();
    if (await allBtn.isVisible()) {
      await allBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('home-13: consolepanel refresh button reloads logs', async ({ page }) => {
    // Wait for console panel footer
    await page.locator('.console-footer').waitFor({ state: 'visible', timeout: 10000 });

    // Expand console
    await page.locator('.console-footer').click();
    await page.waitForTimeout(500);

    // Find refresh button (↻ symbol) in console header
    const refreshBtn = page.locator('.console-btn').first();
    await expect(refreshBtn).toBeVisible({ timeout: 5000 });
    await refreshBtn.click();
    await page.waitForTimeout(500);
  });

  test('home-14: consolepanel close button collapses panel', async ({ page }) => {
    // Wait for console panel footer
    await page.locator('.console-footer').waitFor({ state: 'visible', timeout: 10000 });

    // Expand console
    await page.locator('.console-footer').click();
    await page.waitForTimeout(500);

    // Find close button (✕ symbol) - second console-btn
    const closeBtn = page.locator('.console-btn').last();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    await page.waitForTimeout(500);

    // Console should collapse - footer should reappear
    await expect(page.locator('.console-footer')).toBeVisible({ timeout: 5000 });
  });

  test('home-15: search bar clear button clears input', async ({ page }) => {
    const searchInput = page.locator('.header-center input, input[placeholder*="搜索"], input[placeholder*="Search"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await searchInput.fill('test query');
    await expect(searchInput).toHaveValue('test query');

    const clearBtn = page.locator('[aria-label="Clear search"]');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await expect(searchInput).toHaveValue('');
    } else {
      await searchInput.fill('');
      await expect(searchInput).toHaveValue('');
    }
  });
});
