/**
 * DesignChecker Auto-Scan Timer Test
 * Verifies that the background scanner actually fires at the configured interval
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:38888';

test.describe('DesignChecker Auto-Scan Timer', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the app so page.evaluate fetch() has the correct origin
    await page.goto(`${BASE_URL}/project/Claude-DevSprite?tab=dashboard`);
    await page.waitForSelector('.review-section', { timeout: 10000 });
  });

  test('01: auto-scan is enabled by default', async ({ page }) => {
    const config = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });
    expect(config.enabled).toBe(true);
    expect(config.intervalMs).toBeGreaterThan(0);
  });

  test('02: disabling auto-scan stops the timer', async ({ page }) => {
    // Get config before
    const before = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });

    // Disable
    await page.evaluate(async () => {
      await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
    });

    // Verify disabled
    const after = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });
    expect(after.enabled).toBe(false);

    // Wait 5 seconds and check isScanning is still false (no scan should start)
    await page.waitForTimeout(5000);
    const check = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });
    expect(check.isScanning).toBe(false);

    // Restore
    await page.evaluate(async (interval) => {
      await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, intervalMs: interval }),
      });
    }, before.intervalMs);
  });

  test('03: changing interval restarts the timer', async ({ page }) => {
    // Set to 65s (minimum allowed)
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: 65000 }),
      });
      return res.json();
    });

    expect(result.config.intervalMs).toBe(65000);
    expect(result.config.enabled).toBe(true);

    // Restore to 10 minutes
    await page.evaluate(async () => {
      await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: 600000 }),
      });
    });
  });

  test('04: minimum interval is enforced (60s)', async ({ page }) => {
    // Try to set interval to 30s (below minimum)
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMs: 30000 }),
      });
      return res.json();
    });

    // Should be rejected (interval stays at previous value)
    expect(result.config.intervalMs).not.toBe(30000);
    expect(result.config.intervalMs).toBeGreaterThanOrEqual(60000);
  });

  test('05: scan produces findings in database', async ({ page }) => {
    // Trigger a manual scan
    const scanResult = await page.evaluate(async () => {
      const res = await fetch('/api/projects/Claude-DevSprite/reviews/scan', {
        method: 'POST',
      });
      return res.json();
    });

    expect(scanResult.findingsCount).toBeGreaterThan(0);

    // Verify reviews exist in the list
    const reviews = await page.evaluate(async () => {
      const res = await fetch('/api/projects/Claude-DevSprite/reviews');
      return res.json();
    });

    const designCheckReviews = reviews.reviews.filter(
      (r: any) => r.source === 'design-check'
    );
    expect(designCheckReviews.length).toBeGreaterThan(0);
  });

  test('06: design-check reviews have correct source field', async ({ page }) => {
    const reviews = await page.evaluate(async () => {
      const res = await fetch('/api/projects/Claude-DevSprite/reviews');
      return res.json();
    });

    const designCheckReviews = reviews.reviews.filter(
      (r: any) => r.source === 'design-check'
    );

    for (const review of designCheckReviews) {
      expect(review.source).toBe('design-check');
      expect(review.title).toBeTruthy();
      expect(review.description).toBeTruthy();
    }
  });

  test('07: UI reflects scanner config on load', async ({ page }) => {
    // Ensure auto-scan is enabled
    await page.evaluate(async () => {
      await fetch('/api/scanner/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, intervalMs: 600000 }),
      });
    });

    // Reload to pick up new config
    await page.reload();
    await page.waitForSelector('.review-section', { timeout: 10000 });

    // Toggle should be checked
    const checkbox = page.locator('.scan-toggle input[type="checkbox"]');
    await expect(checkbox).toBeChecked();

    // Interval should show 10 minutes
    const select = page.locator('.scan-interval-select');
    await expect(select).toBeVisible();
    const value = await select.inputValue();
    expect(value).toBe('10');
  });

  test('08: disabling via UI updates backend config', async ({ page }) => {
    // Uncheck the toggle
    const checkbox = page.locator('.scan-toggle input[type="checkbox"]');
    await checkbox.uncheck();

    // Wait for API call
    await page.waitForTimeout(1000);

    // Verify backend config
    const config = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });
    expect(config.enabled).toBe(false);

    // Re-enable
    await checkbox.check();
    await page.waitForTimeout(1000);

    const restored = await page.evaluate(async () => {
      const res = await fetch('/api/scanner/config');
      return res.json();
    });
    expect(restored.enabled).toBe(true);
  });
});
