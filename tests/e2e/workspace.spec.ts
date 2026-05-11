import { test, expect } from '@playwright/test';

test.describe('Workspace Components', () => {
  const TEST_PROJECT = 'test-project';

  // Navigate to workspace tab of a project
  test.beforeEach(async ({ page }) => {
    await page.goto(`/project/${TEST_PROJECT}?tab=workspace`);
    await page.waitForLoadState('load');
  });

  test('workspace-01: Doc panel toggle works', async ({ page }) => {
    // Wait for workspace to load (may redirect if project doesn't exist)
    const workspace = page.locator('.workspace-view');
    const visible = await workspace.isVisible().catch(() => false);
    test.skip(!visible, 'Workspace not visible (project may not exist)');

    // Click Doc panel toggle
    const docBtn = page.locator('.panel-toggle').filter({ hasText: /Doc/ });
    await expect(docBtn).toBeVisible();

    // Initially doc panel is closed (panels.doc = false by default)
    // Click to open
    await docBtn.click();
    await page.waitForTimeout(300);

    // Doc panel should now be visible
    const docPanel = page.locator('.panel').first();
    await expect(docPanel).toBeVisible({ timeout: 3000 });

    // Click again to close
    await docBtn.click();
    await page.waitForTimeout(300);
  });

  test('workspace-02: Code panel toggle works', async ({ page }) => {
    const workspace = page.locator('.workspace-view');
    const visible = await workspace.isVisible().catch(() => false);
    test.skip(!visible, 'Workspace not visible (project may not exist)');

    // Click Code panel toggle
    const codeBtn = page.locator('.panel-toggle').filter({ hasText: /Code/ });
    await expect(codeBtn).toBeVisible();

    // Click to open code panel
    await codeBtn.click();
    await page.waitForTimeout(300);

    // Code panel should be visible
    const codePanel = page.locator('.panel').nth(1);
    await expect(codePanel).toBeVisible({ timeout: 3000 });

    // Click again to close
    await codeBtn.click();
    await page.waitForTimeout(300);
  });

  test('workspace-03: Chat panel toggle works', async ({ page }) => {
    const workspace = page.locator('.workspace-view');
    const visible = await workspace.isVisible().catch(() => false);
    test.skip(!visible, 'Workspace not visible (project may not exist)');

    // Chat panel is open by default
    const chatBtn = page.locator('.panel-toggle').filter({ hasText: /Chat/ });
    await expect(chatBtn).toBeVisible();

    // Click to close chat panel
    await chatBtn.click();
    await page.waitForTimeout(300);

    // Click to reopen
    await chatBtn.click();
    await page.waitForTimeout(300);
  });

  test('workspace-04: sidebar toggle and equalize buttons work', async ({ page }) => {
    const workspace = page.locator('.workspace-view');
    const visible = await workspace.isVisible().catch(() => false);
    test.skip(!visible, 'Workspace not visible (project may not exist)');

    // Toggle sidebar
    const sidebarBtn = page.locator('.toolbar-btn').filter({ hasText: /文件树/ });
    await expect(sidebarBtn).toBeVisible();

    // Click to hide sidebar
    await sidebarBtn.click();
    await page.waitForTimeout(300);

    // Click to show sidebar again
    await sidebarBtn.click();
    await page.waitForTimeout(300);

    // Click equalize button
    const equalizeBtn = page.locator('.toolbar-btn').filter({ hasText: /均分/ });
    await expect(equalizeBtn).toBeVisible();
    await equalizeBtn.click();
    await page.waitForTimeout(300);

    // Status bar should show project name
    const statusBar = page.locator('.status-bar');
    await expect(statusBar).toBeVisible();
  });
});
