import { test, expect } from '@playwright/test';

test.describe('Remote Sync Settings (/settings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('load');
  });

  test('sync-01: Remote Sync tab is visible and clickable', async ({ page }) => {
    // Wait for settings page to load
    await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 10000 });

    // Remote Sync tab should be visible
    const syncTab = page.getByTestId('tab-remote-sync');
    await expect(syncTab).toBeVisible();

    // Click the tab
    await syncTab.click();

    // Tab panel should be visible
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });
  });

  test('sync-02: Remote Sync tab shows enable toggle and config fields', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable toggle should be visible
    const enableToggle = page.getByTestId('sync-enabled');
    await expect(enableToggle).toBeVisible();

    // Save button should be visible
    await expect(page.getByTestId('sync-save')).toBeVisible();
  });

  test('sync-03: Enabling sync reveals detailed config fields', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable sync
    const enableToggle = page.getByTestId('sync-enabled');
    await enableToggle.check();

    // Detailed config fields should appear
    await expect(page.getByTestId('sync-server-url')).toBeVisible();
    await expect(page.getByTestId('sync-interval')).toBeVisible();
    await expect(page.getByTestId('sync-jwt-secret')).toBeVisible();
    await expect(page.getByTestId('sync-agent-token')).toBeVisible();

    // Generate buttons should be visible
    await expect(page.getByTestId('sync-generate-jwt')).toBeVisible();
    await expect(page.getByTestId('sync-generate-token')).toBeVisible();

    // Take screenshot of enabled state
    await page.screenshot({ path: 'test-results/sync-enabled.png', fullPage: true });
  });

  test('sync-04: Generate JWT secret produces a value', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable sync to reveal fields
    await page.getByTestId('sync-enabled').check();
    await expect(page.getByTestId('sync-jwt-secret')).toBeVisible();

    // Click Generate JWT
    await page.getByTestId('sync-generate-jwt').click();

    // JWT secret field should now have a value (64 hex chars)
    const jwtInput = page.getByTestId('sync-jwt-secret');
    const jwtValue = await jwtInput.inputValue();
    expect(jwtValue.length).toBeGreaterThan(0);
    expect(jwtValue).toMatch(/^[0-9a-f]+$/); // hex string
  });

  test('sync-05: Generate agent token produces a value', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable sync to reveal fields
    await page.getByTestId('sync-enabled').check();

    // Click Generate Token
    await page.getByTestId('sync-generate-token').click();

    // Agent token field should now have a value (32 hex chars)
    const tokenInput = page.getByTestId('sync-agent-token');
    const tokenValue = await tokenInput.inputValue();
    expect(tokenValue.length).toBeGreaterThan(0);
    expect(tokenValue).toMatch(/^[0-9a-f]+$/); // hex string
  });

  test('sync-06: Fill in all fields and save sync config', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable sync
    await page.getByTestId('sync-enabled').check();

    // Fill in server URL
    await page.getByTestId('sync-server-url').fill('wss://test-server.example.com:38888');

    // Set sync interval
    await page.getByTestId('sync-interval').fill('15000');

    // Generate secrets
    await page.getByTestId('sync-generate-jwt').click();
    await page.getByTestId('sync-generate-token').click();

    // Take screenshot before save
    await page.screenshot({ path: 'test-results/sync-before-save.png', fullPage: true });

    // Click Save
    await page.getByTestId('sync-save').click();

    // Wait for result to appear
    await expect(page.getByTestId('sync-result')).toBeVisible({ timeout: 10000 });

    // Result should indicate success (restart required message)
    const result = page.getByTestId('sync-result');
    await expect(result).toContainText(/restart|required|saved/i);

    // Take screenshot after save
    await page.screenshot({ path: 'test-results/sync-after-save.png', fullPage: true });
  });

  test('sync-07: Disabling sync hides detail fields', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable sync first
    await page.getByTestId('sync-enabled').check();
    await expect(page.getByTestId('sync-server-url')).toBeVisible();

    // Now disable sync
    await page.getByTestId('sync-enabled').uncheck();

    // Detail fields should be hidden
    await expect(page.getByTestId('sync-server-url')).toBeHidden();
    await expect(page.getByTestId('sync-interval')).toBeHidden();
    await expect(page.getByTestId('sync-jwt-secret')).toBeHidden();
    await expect(page.getByTestId('sync-agent-token')).toBeHidden();
  });

  test('sync-08: Switching between tabs preserves state', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable sync and fill in a value
    await page.getByTestId('sync-enabled').check();
    await page.getByTestId('sync-server-url').fill('wss://my-server.com:38888');

    // Switch to AI tab
    await page.getByTestId('tab-ai-model').click();
    await expect(page.getByTestId('tab-ai-model-panel')).toBeVisible({ timeout: 5000 });

    // Switch back to Remote Sync tab
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // The server URL value should still be there
    const urlValue = await page.getByTestId('sync-server-url').inputValue();
    expect(urlValue).toBe('wss://my-server.com:38888');
  });

  test('sync-09: Info box explains how remote sync works', async ({ page }) => {
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Enable sync to show info box
    await page.getByTestId('sync-enabled').check();

    // Info box should contain "How it works" text
    const infoBox = page.locator('.info-box');
    await expect(infoBox).toBeVisible();
    await expect(infoBox).toContainText('How it works');
    await expect(infoBox).toContainText('claude-dev-sprite agent');

    // Take screenshot of the complete sync panel
    await page.screenshot({ path: 'test-results/sync-full-panel.png', fullPage: true });
  });

  test('sync-10: Page screenshot for visual review', async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('load');

    // Take screenshot of default state (AI tab)
    await page.screenshot({ path: 'test-results/settings-default.png', fullPage: true });

    // Click Remote Sync tab
    await page.getByTestId('tab-remote-sync').click();
    await expect(page.getByTestId('tab-remote-sync-panel')).toBeVisible({ timeout: 5000 });

    // Take screenshot of sync tab (disabled state)
    await page.screenshot({ path: 'test-results/settings-sync-disabled.png', fullPage: true });

    // Enable sync and fill in fields
    await page.getByTestId('sync-enabled').check();
    await page.getByTestId('sync-server-url').fill('wss://cloud.example.com:38888');
    await page.getByTestId('sync-interval').fill('30000');
    await page.getByTestId('sync-generate-jwt').click();
    await page.getByTestId('sync-generate-token').click();

    // Take screenshot of sync tab (enabled state with values)
    await page.screenshot({ path: 'test-results/settings-sync-enabled.png', fullPage: true });
  });
});
