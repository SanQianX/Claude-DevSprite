/**
 * Auto-Fix State Persistence Bug Test
 * Tests that auto-fix checkbox and scanning state persist across page refresh
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:38888';
const PROJECT = 'Claude-DevSprite';

test.describe('Auto-Fix State Persistence', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=dashboard`);
    await page.waitForSelector('.scan-controls', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('01: auto-fix checkbox is visible', async ({ page }) => {
    const autoFixLabel = page.locator('text=自动修复');
    await expect(autoFixLabel).toBeVisible();

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/01-auto-fix-visible.png' });
  });

  test('02: auto-fix checkbox persists after refresh (checked)', async ({ page }) => {
    // Find the auto-fix checkbox (second scan-toggle in the controls)
    const autoFixCheckbox = page.locator('.scan-controls .scan-toggle').nth(1).locator('input[type=checkbox]');

    // Initially unchecked
    const initial = await autoFixCheckbox.isChecked();
    console.log('Initial state:', initial);

    // Check it
    await autoFixCheckbox.check();
    await expect(autoFixCheckbox).toBeChecked();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/02-checkbox-checked.png' });

    // Refresh the page
    await page.reload();
    await page.waitForSelector('.scan-controls', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify checkbox is still checked
    const afterRefresh = page.locator('.scan-controls .scan-toggle').nth(1).locator('input[type=checkbox]');
    await expect(afterRefresh).toBeChecked();
    console.log('After refresh:', await afterRefresh.isChecked());

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/03-checkbox-persisted.png' });
  });

  test('03: auto-fix checkbox persists after refresh (unchecked)', async ({ page }) => {
    const autoFixCheckbox = page.locator('.scan-controls .scan-toggle').nth(1).locator('input[type=checkbox]');

    // Ensure unchecked
    await autoFixCheckbox.uncheck();
    await expect(autoFixCheckbox).not.toBeChecked();
    await page.waitForTimeout(500);

    // Refresh
    await page.reload();
    await page.waitForSelector('.scan-controls', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify still unchecked
    const afterRefresh = page.locator('.scan-controls .scan-toggle').nth(1).locator('input[type=checkbox]');
    await expect(afterRefresh).not.toBeChecked();

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/04-uncheck-persisted.png' });
  });

  test('04: scanning state shows when backend is scanning', async ({ page }) => {
    // Check scanner config - if isScanning is true, button should show scanning text
    const config = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });

    const scanBtn = page.locator('.scan-btn');
    if (config.isScanning) {
      // Button should show scanning text
      const text = await scanBtn.textContent();
      expect(text).not.toBe('开始扫描');
      console.log('Scanning state displayed:', text);
    } else {
      // Button should show default text
      await expect(scanBtn).toHaveText('开始扫描');
      console.log('Not scanning, button shows default');
    }

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/05-scan-button-state.png' });
  });

  test('05: scan button text changes during scan', async ({ page }) => {
    const scanBtn = page.locator('.scan-btn');
    await expect(scanBtn).toHaveText('开始扫描');

    // Click scan button
    await scanBtn.click();

    // Button should change to scanning text
    await expect(scanBtn).not.toHaveText('开始扫描', { timeout: 5000 });
    const text = await scanBtn.textContent();
    console.log('Button text during scan:', text);

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/06-scanning-state.png' });

    // Wait for scan to complete (button returns to default)
    await expect(scanBtn).toHaveText('开始扫描', { timeout: 120000 });

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/07-scan-complete.png' });
  });

  test('06: refresh during scan shows scanning state', async ({ page }) => {
    const scanBtn = page.locator('.scan-btn');
    await expect(scanBtn).toHaveText('开始扫描');

    // Start scan
    await scanBtn.click();
    await expect(scanBtn).not.toHaveText('开始扫描', { timeout: 5000 });

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/08-scan-started.png' });

    // Refresh during scan
    await page.reload();
    await page.waitForSelector('.scan-controls', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Button should show scanning state (from backend isScanning)
    const config = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });

    const scanBtnAfter = page.locator('.scan-btn');
    if (config.isScanning) {
      const text = await scanBtnAfter.textContent();
      expect(text).not.toBe('开始扫描');
      console.log('After refresh during scan:', text);
    } else {
      console.log('Scan completed before refresh');
    }

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/09-refresh-during-scan.png' });
  });

  test('07: no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=dashboard`);
    await page.waitForSelector('.scan-controls', { timeout: 10000 });
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);

    await page.screenshot({ path: 'tasks/bugfix/autofix-state-persistence/screenshots/10-no-errors.png' });
  });
});
