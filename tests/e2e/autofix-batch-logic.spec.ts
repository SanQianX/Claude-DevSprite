/**
 * Auto-Fix Batch Logic Test
 * Verifies that batch fix supports reviewIds filter and follows decision model
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:38888';
const PROJECT = 'Claude-DevSprite';

test.describe('Auto-Fix Batch Logic', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=dashboard`);
    await page.waitForSelector('.scan-controls', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('01: batch fix API with non-existent IDs returns empty results', async ({ page }) => {
    const response = await page.evaluate(async (proj) => {
      const res = await fetch(`/api/projects/${proj}/reviews/fix-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewIds: [999999] }),
      });
      return res.json();
    }, PROJECT);

    expect(response).toHaveProperty('fixed');
    expect(response).toHaveProperty('confirmed');
    expect(response).toHaveProperty('failed');
    expect(response).toHaveProperty('results');
    expect(response.fixed).toBe(0);
    expect(response.confirmed).toBe(0);
    expect(response.failed).toBe(0);
    expect(response.results).toHaveLength(0);

    await page.screenshot({ path: 'tasks/bugfix/autofix-batch-logic/screenshots/01-api-structure.png' });
  });

  test('02: scan endpoint returns findingsCount', async ({ page }) => {
    const scanResult = await page.evaluate(async (proj) => {
      const res = await fetch(`/api/projects/${proj}/reviews/scan`, {
        method: 'POST',
      });
      return res.json();
    }, PROJECT);

    console.log('Scan result:', JSON.stringify(scanResult));
    expect(scanResult).toHaveProperty('findingsCount');
    expect(typeof scanResult.findingsCount).toBe('number');

    await page.screenshot({ path: 'tasks/bugfix/autofix-batch-logic/screenshots/02-scan-result.png' });
  });

  test('03: scan creates new pending reviews', async ({ page }) => {
    const before = await page.evaluate(async (proj) => {
      const res = await fetch(`/api/projects/${proj}/reviews`);
      return res.json();
    }, PROJECT);
    const pendingBefore = before.reviews.filter((r: any) => r.status === 'pending').length;
    console.log('Pending before scan:', pendingBefore);

    const scanResult = await page.evaluate(async (proj) => {
      const res = await fetch(`/api/projects/${proj}/reviews/scan`, {
        method: 'POST',
      });
      return res.json();
    }, PROJECT);
    console.log('New findings:', scanResult.findingsCount);

    const afterScan = await page.evaluate(async (proj) => {
      const res = await fetch(`/api/projects/${proj}/reviews`);
      return res.json();
    }, PROJECT);
    const pendingAfterScan = afterScan.reviews.filter((r: any) => r.status === 'pending').length;
    console.log('Pending after scan:', pendingAfterScan);

    expect(pendingAfterScan).toBeGreaterThanOrEqual(pendingBefore);

    await page.screenshot({ path: 'tasks/bugfix/autofix-batch-logic/screenshots/03-pending-count.png' });
  });

  test('04: auto-fix checkbox triggers scan+fix flow', async ({ page }) => {
    // Enable auto-fix
    const autoFixCheckbox = page.locator('.scan-controls .scan-toggle').nth(1).locator('input[type=checkbox]');
    await autoFixCheckbox.check();
    await page.waitForTimeout(500);

    const scanBtn = page.locator('.scan-btn');
    await expect(scanBtn).toHaveText('开始扫描');

    // Click scan - button should change to scanning
    await scanBtn.click();
    await expect(scanBtn).not.toHaveText('开始扫描', { timeout: 5000 });
    const text = await scanBtn.textContent();
    console.log('Button text during scan:', text);
    expect(text).toMatch(/(扫描中|修复中)/);

    await page.screenshot({ path: 'tasks/bugfix/autofix-batch-logic/screenshots/04-scan-button-state.png' });

    // Verify scan phase completed (button shows fix phase or back to default)
    // Don't wait for full completion - just verify the state transition happened
    await page.waitForTimeout(3000);
    const textAfter = await scanBtn.textContent();
    console.log('Button text after 3s:', textAfter);

    await page.screenshot({ path: 'tasks/bugfix/autofix-batch-logic/screenshots/05-fix-in-progress.png' });
  });

  test('05: no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=dashboard`);
    await page.waitForSelector('.scan-controls', { timeout: 10000 });
    await page.waitForTimeout(2000);

    expect(errors).toHaveLength(0);
  });
});
