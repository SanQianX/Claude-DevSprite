import { test, expect } from '@playwright/test';

test.describe('Project Page (/project/:name)', () => {
  test.describe.configure({ mode: 'serial' });
  const TEST_PROJECT = process.env.TEST_PROJECT || `test-project-${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    // 创建测试项目以确保其存在
    const response = await request.post('/api/projects', {
      data: { name: TEST_PROJECT },
    });
    expect(response.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    // 清理：删除测试项目
    const response = await request.delete(`/api/projects/${TEST_PROJECT}`);
    expect(response.ok()).toBeTruthy();
  });

  // 添加 beforeEach 钩子来统一执行页面导航和等待加载，减少代码重复
  test.beforeEach(async ({ page }) => {
    await page.goto(`/project/${TEST_PROJECT}`);
    await page.waitForLoadState('load');
  });

  test('page loads project view', async ({ page }) => {
    // The test expects the project view to load successfully.
    // If the project doesn't exist, the test should fail, not silently pass.
    const projectView = page.locator('[data-testid="project-view"]');
    await expect(projectView).toBeVisible();
  });

  test('Dashboard tab is active by default', async ({ page }) => {
    // Dashboard tab should be active
    const dashboardTab = page.locator('[data-testid="header-tab"]').filter({ hasText: 'Dashboard' });
    // Expect the tab to be visible; if not, the test fails.
    await expect(dashboardTab).toBeVisible();
    // Now directly assert the class without the silent-pass `if` block.
    await expect(dashboardTab).toHaveClass(/active/);
  });

  test('click Workspace tab switches view', async ({ page }) => {
    // Click Workspace tab
    const workspaceTab = page.locator('[data-testid="header-tab"]').filter({ hasText: 'Workspace' });
    // Expect the tab to be visible; if not, the test fails.
    await expect(workspaceTab).toBeVisible();
    await workspaceTab.click();
    // Wait for URL to contain tab=workspace using Playwright's smart wait mechanism
    await expect(page).toHaveURL(/tab=workspace/);
  });

  test('back button navigates to home', async ({ page }) => {
    // Click back button
    const backBtn = page.locator('[data-testid="back-btn"]');
    // Expect the button to be visible; if not, the test fails.
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await page.waitForURL(new URLPattern({ pathname: '/' }), { timeout: 5000 });
    expect(page.url()).toMatch(/\/$/);
    // 增加断言检查首页内容
    await expect(page.locator('text=项目列表')).toBeVisible();
  });
});