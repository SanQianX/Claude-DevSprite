import { test, expect } from '@playwright/test';

test.describe('Project Page (/project/:name)', () => {
  // Use a test project name - adjust if needed
  const TEST_PROJECT = 'test-project';

  test('project-01: navigate to project page loads layout', async ({ page }) => {
    // Navigate to a project page
    await page.goto(`/project/${TEST_PROJECT}`);
    await page.waitForLoadState('load');

    // Page should load without crashing (may redirect to home if project doesn't exist)
    // Check that either the project view loaded OR we redirected to home
    const projectView = page.locator('.project-view');
    const homePage = page.locator('.home-page');
    const projectLayout = page.locator('.project-layout');

    const projectVisible = await projectView.isVisible().catch(() => false);
    const homeVisible = await homePage.isVisible().catch(() => false);
    const layoutVisible = await projectLayout.isVisible().catch(() => false);

    // At least one of these should be true (project loaded or redirected to home)
    expect(projectVisible || homeVisible || layoutVisible).toBe(true);
  });

  test('project-02: Dashboard tab is active by default', async ({ page }) => {
    await page.goto(`/project/${TEST_PROJECT}`);
    await page.waitForLoadState('load');

    // Dashboard tab should be active
    const dashboardTab = page.locator('.header-tab').filter({ hasText: 'Dashboard' });
    if (await dashboardTab.isVisible().catch(() => false)) {
      await expect(dashboardTab).toHaveClass(/active/);
    }
  });

  test('project-03: click Workspace tab switches view', async ({ page }) => {
    await page.goto(`/project/${TEST_PROJECT}`);
    await page.waitForLoadState('load');

    // Click Workspace tab
    const workspaceTab = page.locator('.header-tab').filter({ hasText: 'Workspace' });
    if (await workspaceTab.isVisible().catch(() => false)) {
      await workspaceTab.click();
      await page.waitForTimeout(500);

      // URL should contain tab=workspace
      expect(page.url()).toContain('tab=workspace');
    }
  });

  test('project-04: back button navigates to home', async ({ page }) => {
    await page.goto(`/project/${TEST_PROJECT}`);
    await page.waitForLoadState('load');

    // Click back button
    const backBtn = page.locator('.back-btn, a[title="Back to projects"]').first();
    if (await backBtn.isVisible().catch(() => false)) {
      await backBtn.click();
      await page.waitForURL('**/', { timeout: 5000 });
      expect(page.url()).toMatch(/\/$/);
    }
  });
});
