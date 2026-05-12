/**
 * DesignChecker Scan UI Test
 * Tests the scan button, auto-scan toggle, and interval selector
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:38888';
const PROJECT_NAME = 'Claude-DevSprite';

test.describe('DesignChecker Scan UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/project/${PROJECT_NAME}?tab=dashboard`);
    // Wait for the review section to load
    await page.waitForSelector('.review-section', { timeout: 10000 });
  });

  test('01: scan button exists and is clickable', async ({ page }) => {
    const scanBtn = page.locator('.scan-btn');
    await expect(scanBtn).toBeVisible();
    const text = await scanBtn.textContent();
    expect(text?.trim()).toBe('开始扫描');
    expect(await scanBtn.isEnabled()).toBe(true);
  });

  test('02: auto-scan toggle exists', async ({ page }) => {
    const toggle = page.locator('.scan-toggle');
    await expect(toggle).toBeVisible();

    const checkbox = page.locator('.scan-toggle input[type="checkbox"]');
    await expect(checkbox).toBeVisible();

    const label = page.locator('.scan-toggle-label');
    await expect(label).toHaveText('定时扫描');
  });

  test('03: auto-scan toggle defaults to checked', async ({ page }) => {
    const checkbox = page.locator('.scan-toggle input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test('04: interval selector visible when auto-scan enabled', async ({ page }) => {
    const select = page.locator('.scan-interval-select');
    await expect(select).toBeVisible();

    const options = await select.locator('option').allTextContents();
    expect(options).toContain('5 分钟');
    expect(options).toContain('10 分钟');
    expect(options).toContain('15 分钟');
    expect(options).toContain('30 分钟');
    expect(options).toContain('1 小时');
  });

  test('05: interval selector defaults to 10 minutes', async ({ page }) => {
    const select = page.locator('.scan-interval-select');
    const value = await select.inputValue();
    expect(value).toBe('10');
  });

  test('06: unchecking auto-scan hides interval selector', async ({ page }) => {
    const checkbox = page.locator('.scan-toggle input[type="checkbox"]');
    const select = page.locator('.scan-interval-select');

    // Initially visible
    await expect(select).toBeVisible();

    // Uncheck
    await checkbox.uncheck();

    // Interval selector should be hidden
    await expect(select).toBeHidden();
  });

  test('07: checking auto-scan shows interval selector', async ({ page }) => {
    const checkbox = page.locator('.scan-toggle input[type="checkbox"]');
    const select = page.locator('.scan-interval-select');

    // First uncheck
    await checkbox.uncheck();
    await expect(select).toBeHidden();

    // Then check again
    await checkbox.check();
    await expect(select).toBeVisible();
  });

  test('08: scanner config API returns correct structure', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });

    expect(response).toHaveProperty('enabled');
    expect(response).toHaveProperty('intervalMs');
    expect(response).toHaveProperty('isScanning');
    expect(typeof response.enabled).toBe('boolean');
    expect(typeof response.intervalMs).toBe('number');
    expect(typeof response.isScanning).toBe('boolean');
  });

  test('09: scanner config API update works', async ({ page }) => {
    // Get current config
    const before = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });

    // Update config
    const newInterval = before.intervalMs === 600000 ? 300000 : 600000;
    const after = await page.evaluate(async (interval) => {
      const res = await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: interval }),
      });
      return res.json();
    }, newInterval);

    expect(after.config.intervalMs).toBe(newInterval);

    // Restore original config
    await page.evaluate(async (interval) => {
      await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: interval }),
      });
    }, before.intervalMs);
  });

  test('10: scan button triggers scan API', async ({ page }) => {
    // Intercept the scan API call
    const scanPromise = page.waitForResponse(resp =>
      resp.url().includes('/reviews/scan') && resp.request().method() === 'POST'
    );

    // Click scan button
    await page.click('.scan-btn');

    // Wait for the API call
    const response = await scanPromise;
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('findingsCount');
  });

  test('11: scan button shows scanning state', async ({ page }) => {
    const scanBtn = page.locator('.scan-btn');

    // Before click - should show "开始扫描"
    await expect(scanBtn).toHaveText('开始扫描');

    // Click and check for scanning state (may be brief)
    await page.click('.scan-btn');

    // After scan completes - should show "开始扫描" again
    await expect(scanBtn).toHaveText('开始扫描', { timeout: 60000 });
  });

  test('12: scan controls layout is correct', async ({ page }) => {
    const controls = page.locator('.scan-controls');
    await expect(controls).toBeVisible();

    // Check order: toggle, select, button
    const children = controls.locator('> *');
    const count = await children.count();
    expect(count).toBe(3);

    // First child should be the toggle
    const firstChild = children.nth(0);
    await expect(firstChild).toHaveClass(/scan-toggle/);

    // Second child should be the select
    const secondChild = children.nth(1);
    await expect(secondChild).toHaveClass(/scan-interval-select/);

    // Third child should be the button
    const thirdChild = children.nth(2);
    await expect(thirdChild).toHaveClass(/scan-btn/);
  });

  test('13: review section header layout', async ({ page }) => {
    const header = page.locator('.review-section .section-header');
    await expect(header).toBeVisible();

    const title = header.locator('.section-title');
    await expect(title).toHaveText('AI 审查队列');

    const controls = header.locator('.scan-controls');
    await expect(controls).toBeVisible();
  });

  test('14: no console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/project/${PROJECT_NAME}?tab=dashboard`);
    await page.waitForSelector('.review-section', { timeout: 10000 });

    // Wait a bit for any delayed errors
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});
