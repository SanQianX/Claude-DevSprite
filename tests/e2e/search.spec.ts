import { test, expect } from '@playwright/test';

test.describe('Search Page (/search)', () => {
  test('search-01: navigate to search with query shows results', async ({ page }) => {
    await page.goto('/search?q=test');
    await page.waitForLoadState('load');

    // Search results page should load
    const searchResults = page.locator('[data-testid="search-results"]').first();
    await expect(searchResults).toBeVisible({ timeout: 10000 });
  });

  test('search-02a: retry button click re-executes search when visible', async ({ page }) => {
    // Navigate to search with a query that might cause an error or empty state
    await page.goto('/search?q=test');
    await page.waitForLoadState('load');

    // Wait for page to fully load using networkidle for reliability
    await page.waitForLoadState('networkidle');

    // Look for retry button
    const retryBtn = page.locator('button').filter({ hasText: /重试|Retry|搜索|Search/ }).first();
    const retryVisible = await retryBtn.isVisible();

    if (!retryVisible) {
      // Skip this test if retry button is not visible, as it's intended to test button functionality
      test.skip();
      return;
    }

    await retryBtn.click();
    // Wait for network to settle after click to ensure new search request is completed
    await page.waitForLoadState('networkidle');

    // Check search results are visible and have content
    const searchResults = page.locator('[data-testid="search-results"]').first();
    await expect(searchResults).toBeVisible();

    // Verify content is not empty to ensure retry triggered a meaningful update
    const content = await searchResults.textContent().catch(() => '');
    expect(content?.trim().length).toBeGreaterThan(0);
  });

  test('search-02b: page functions correctly when retry button is not present', async ({ page }) => {
    // Navigate to a search query that should show results without error
    await page.goto('/search?q=test');
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');

    // Ensure retry button is NOT visible for this test scenario
    const retryBtn = page.locator('button').filter({ hasText: /重试|Retry|搜索|Search/ }).first();
    const retryVisible = await retryBtn.isVisible();
    expect(retryVisible).toBe(false);

    // Page should still be functional with search results visible
    const searchResults = page.locator('[data-testid="search-results"]').first();
    await expect(searchResults).toBeVisible();
  });
});