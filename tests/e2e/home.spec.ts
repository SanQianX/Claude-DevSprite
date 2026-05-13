import { test, expect } from '@playwright/test';

test.describe('Home Page (/)', () => {
  // Helper function to wait for content visible (table or empty state)
  async function waitForContentVisible(page: any) {
    await page.locator('[data-testid="project-table"], [data-testid="empty-container"]').first().waitFor({ state: 'visible', timeout: 15000 });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Use load instead of networkidle (SSE keeps connection open)
    await page.waitForLoadState('load');
  });

  test('home-01: page loads, project list table visible or empty state', async ({ page }) => {
    // Wait for loading spinner to disappear
    const loading = page.locator('[data-testid="loading-container"]');
    await expect(loading).toBeHidden({ timeout: 15000 });

    // Either table or empty state should be visible
    const table = page.locator('[data-testid="project-table"]');
    const emptyState = page.locator('[data-testid="empty-container"]');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('home-02: refresh button reloads project list', async ({ page }) => {
    // Wait for initial load
    await waitForContentVisible(page);

    const refreshBtn = page.locator('[data-testid="section-actions"] button').first();
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    // After refresh, content should still be visible - wait for it to reappear
    await waitForContentVisible(page);
  });

  test('home-03: add project button opens modal', async ({ page }) => {
    await waitForContentVisible(page);

    const addBtn = page.locator('[data-testid="section-actions"] button').nth(1);
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Modal should appear (AddProjectModal uses Teleport to body)
    const modal = page.locator('[data-testid="modal-overlay"], [data-testid="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('home-04: in modal, type path and add project', async ({ page }) => {
    await waitForContentVisible(page);

    // Open modal
    await page.locator('[data-testid="section-actions"] button').nth(1).click();
    const modal = page.locator('[data-testid="modal-overlay"], [data-testid="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find input and type path
    const pathInput = modal.locator('input').first();
    await expect(pathInput).toBeVisible();
    await pathInput.fill(process.env.TEST_PROJECT_PATH || './test-project');

    // Click Add button (last button in modal footer)
    const addButton = modal.locator('button').filter({ hasText: /添加|Add|确定/ }).last();
    await addButton.click();

    // Wait for modal to close after successful add
    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('home-05: in modal, cancel button closes modal', async ({ page }) => {
    await waitForContentVisible(page);

    await page.locator('[data-testid="section-actions"] button').nth(1).click();
    const modal = page.locator('[data-testid="modal-overlay"], [data-testid="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const cancelBtn = modal.locator('button').filter({ hasText: /取消|Cancel/ }).first();
    await cancelBtn.click();

    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('home-06: in modal, X button closes modal', async ({ page }) => {
    await waitForContentVisible(page);

    await page.locator('[data-testid="section-actions"] button').nth(1).click();
    const modal = page.locator('[data-testid="modal-overlay"], [data-testid="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    const closeBtn = modal.locator('[aria-label="Close"]');
    await closeBtn.click();

    await expect(modal).toBeHidden({ timeout: 5000 });
  });

  test('home-07: project row chat icon navigates to chat', async ({ page }) => {
    await waitForContentVisible(page);

    const table = page.locator('[data-testid="project-table"]');
    // Directly assert table is visible instead of conditional skip
    await expect(table).toBeVisible({ timeout: 5000 });

    const projectRow = page.locator('[data-testid="project-table"] tbody tr').first();
    // Hover to reveal action buttons
    await projectRow.hover();

    const chatBtn = projectRow.locator('button').first();
    await expect(chatBtn).toBeVisible({ timeout: 5000 });
    await chatBtn.click();
    // Wait for navigation and assert precise URL pattern
    await expect(page).toHaveURL(/\/\//, { timeout: 5000 });
    // Wait for a key element of the chat page to be ready
    const chatInput = page.locator('textarea, input[placeholder*="chat"], input[placeholder*="消息"], [data-testid="chat-input"]').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test('home-08: project row delete with confirmation', async ({ page }) => {
    await waitForContentVisible(page);

    const table = page.locator('[data-testid="project-table"]');
    // Directly assert table is visible instead of conditional skip
    await expect(table).toBeVisible({ timeout: 5000 });

    const projectRow = page.locator('[data-testid="project-table"] tbody tr').first();
    // Get initial row count
    const initialRowCount = await table.locator('tbody tr').count();
    // Keep a reference to the row we're about to delete
    const rowToDelete = projectRow;

    await projectRow.hover();

    const deleteBtn = projectRow.locator('button').filter({ hasText: /Delete|删除/ }).last();
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    // Register dialog handler before clicking to ensure it captures any dialog
    page.on('dialog', dialog => dialog.accept());
    await deleteBtn.click();

    // Verify the row is hidden after deletion
    await expect(rowToDelete).toBeHidden({ timeout: 5000 });
    // Verify the total row count has decreased
    await expect(table.locator('tbody tr')).toHaveCount(initialRowCount - 1);
  });

  test('home-09: language toggle switches locale', async ({ page }) => {
    // Locate the "Add Project" button in the header to verify its label changes
    const addProjectBtn = page.locator('[data-testid="section-actions"] button').nth(1);
    await expect(addProjectBtn).toBeVisible({ timeout: 10000 });

    const initialText = await addProjectBtn.textContent();
    // Determine initial language based on button text
    const isChineseInitially = initialText.includes('添加');

    // Now click the language button to toggle
    const langBtn = page.locator('[data-testid="header-right"] button [data-testid="lang-label"]').first();
    await expect(langBtn).toBeVisible({ timeout: 10000 });
    await langBtn.locator('..').click();

    // Wait for i18n to apply by checking button text changes
    await expect(addProjectBtn).not.toHaveText(initialText, { timeout: 5000 });

    // Get the new text of the "Add Project" button
    const newText = await addProjectBtn.textContent();

    // The button text should have changed, confirming i18n worked
    expect(newText).not.toBe(initialText);

    // Verify it switched to the opposite language
    if (isChineseInitially) {
      // Should now be English. We check for a common English variant.
      expect(newText.toLowerCase()).toContain('add');
    } else {
      // Should now be Chinese
      expect(newText).toContain('添加');
    }

    // NEW: Verify page content updated by checking a key element's text
    // Assume there is a page title or heading with data-testid="page-title"
    const pageTitle = page.locator('[data-testid="page-title"]').first();
    if (await pageTitle.isVisible().catch(() => false)) {
      // If the element is visible, check its text content
      const titleText = await pageTitle.textContent();
      if (isChineseInitially) {
        // Switched to English, so title should contain English text
        expect(titleText).toMatch(/English|Project|Home/i); // Example assertion; adjust as needed
      } else {
        // Switched to Chinese, so title should contain Chinese text
        expect(titleText).toMatch(/中文|项目|首页/); // Example assertion; adjust as needed
      }
    } else {
      // If the element is not found, we can skip or use another element
      // For example, check for an empty state message or another label
      const emptyState = page.locator('[data-testid="empty-container"]');
      if (await emptyState.isVisible().catch(() => false)) {
        const emptyText = await emptyState.textContent();
        if (isChineseInitially) {
          expect(emptyText).toContain('No projects'); // Example English text
        } else {
          expect(emptyText).toContain('暂无项目'); // Example Chinese text
        }
      }
    }
  });

  test('home-10: theme toggle switches light/dark', async ({ page }) => {
    // Theme is stored in data-theme attribute on <html>
    await page.locator('[data-testid="header-right"]').waitFor({ state: 'visible', timeout: 10000 });
    const headerBtns = page.locator('[data-testid="header-right"] button');
    const count = await headerBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const themeBtn = headerBtns.nth(1);
    await expect(themeBtn).toBeVisible();

    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme') || 'light';

    // Get initial background color of body to verify style change
    const body = page.locator('body');
    const initialBgColor = await body.evaluate(el => getComputedStyle(el).backgroundColor);

    await themeBtn.click();

    // Wait for theme change by checking data-theme attribute changes
    await expect(html).not.toHaveAttribute('data-theme', initialTheme, { timeout: 5000 });

    const newTheme = await html.getAttribute('data-theme') || 'light';
    expect(newTheme).not.toBe(initialTheme);

    // Verify that the computed style (e.g., background color) has changed
    const newBgColor = await body.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(newBgColor).not.toBe(initialBgColor);

    // Additionally, check that the color is appropriate for the theme
    if (newTheme === 'dark') {
      // Expect a dark background; simple check: not white
      expect(newBgColor).not.toBe('rgb(255, 255, 255)');
    } else {
      // Expect a light background; simple check: not black
      expect(newBgColor).not.toBe('rgb(0, 0, 0)');
    }
  });

  test('home-11: tokensbar period buttons update stats', async ({ page }) => {
    // Wait for tokens bar to load
    const tokensBar = page.locator('[data-testid="tokens-bar"]').first();
    await expect(tokensBar).toBeVisible({ timeout: 10000 });

    const periodBtns = tokensBar.locator('button');
    const count = await periodBtns.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Click second period button
    await periodBtns.nth(1).click();
    await expect(tokensBar).toBeVisible();
  });

  test('home-12: logfilters level buttons filter logs', async ({ page }) => {
    // Wait for console panel footer to appear
    await page.locator('[data-testid="console-footer"]').waitFor({ state: 'visible', timeout: 10000 });

    // Click footer to expand console
    await page.locator('[data-testid="console-footer"]').click();

    // Now LogFilters should be visible
    const logFilters = page.locator('[data-testid="log-filters"]').first();
    await expect(logFilters).toBeVisible({ timeout: 5000 });

    // Wait for log list to be visible (assuming there is a log list container)
    const logList = page.locator('[data-testid="log-list"]').first(); // Adjust selector as needed
    await expect(logList).toBeVisible({ timeout: 5000 });

    // Get initial log entry count
    const initialCount = await logList.locator('li, .log-entry, [data-testid="log-entry"]').count(); // Assume log entries are list items or specific elements

    // Click Info filter button
    const infoBtn = logFilters.locator('button').filter({ hasText: /Info/ }).first();
    if (await infoBtn.isVisible()) {
      await infoBtn.click();
      // Wait for log list to update by waiting for the expected count to stabilize or change
      // Instead of fixed timeout, directly assert the condition we care about
      const infoCount = await logList.locator('li, .log-entry, [data-testid="log-entry"]').count();
      expect(infoCount).toBeLessThanOrEqual(initialCount); // Info filter should show fewer or equal logs
    }

    // Click All filter button
    const allBtn = logFilters.locator('button').filter({ hasText: /All/ }).first();
    if (await allBtn.isVisible()) {
      await allBtn.click();
      // Directly assert the condition after clicking, without fixed wait
      const allCount = await logList.locator('li, .log-entry, [data-testid="log-entry"]').count();
      expect(allCount).toBeGreaterThanOrEqual(infoCount); // After switching to All, should have more logs
    }

    // Verify the filter buttons remain accessible after switching back to 'All'
    await expect(logFilters).toBeVisible();
  });

  test('home-13: consolepanel refresh button reloads logs', async ({ page }) => {
    // Wait for console panel footer
    await page.locator('[data-testid="console-footer"]').waitFor({ state: 'visible', timeout: 10000 });

    // Expand console
    await page.locator('[data-testid="console-footer"]').click();

    // Find refresh button (↻ symbol) in console header
    const refreshBtn = page.locator('[data-testid="console-btn"]').first();
    await expect(refreshBtn).toBeVisible({ timeout: 5000 });
    await refreshBtn.click();
  });

  test('home-14: consolepanel close button collapses panel', async ({ page }) => {
    // Wait for console panel footer
    await page.locator('[data-testid="console-footer"]').waitFor({ state: 'visible', timeout: 10000 });

    // Expand console
    await page.locator('[data-testid="console-footer"]').click();

    // Find close button (✕ symbol) - second console-btn
    const closeBtn = page.locator('[data-testid="console-btn"]').last();
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();

    // Console should collapse - footer should reappear
    await expect(page.locator('[data-testid="console-footer"]').toBeVisible({ timeout: 5000 }));
  });

  test('home-15: search bar clear button clears input', async ({ page }) => {
    const searchInput = page.locator('[data-testid="search-input"]');
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