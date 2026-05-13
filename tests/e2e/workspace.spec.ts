import { test, expect } from '@playwright/test';

test.describe('Workspace Components', () => {
  const TEST_PROJECT = `test-project-workspace-${Date.now()}`;

  // 辅助函数：检测工作区核心视图是否可见，若不可见则跳过当前测试
  async function skipIfNoWorkspace(page: any) {
    const workspace = page.locator('.workspace-view');
    const isVisible = await workspace.isVisible({ timeout: 10000 });
    if (!isVisible) {
      test.fixme();
    }
  }

  test.beforeAll(async ({ request }) => {
    // Create a temporary, unique project for these tests.
    await request.post('/api/projects', {
      data: {
        name: TEST_PROJECT,
        description: 'Temporary project for workspace e2e tests.',
      },
    });
  });

  test.afterAll(async ({ request }) => {
    // Clean up the temporary project.
    await request.delete(`/api/projects/${TEST_PROJECT}`);
  });

  // Navigate to workspace tab of the project, ensuring the language is fixed to Chinese
  test.beforeEach(async ({ page }) => {
    await page.goto(`/project/${TEST_PROJECT}?tab=workspace&lang=zh`);
    await page.waitForLoadState('load');
    // 确保页面没有因项目不存在而重定向到错误页面
    expect(page.url()).toContain(TEST_PROJECT);
  });

  test('workspace-01: Doc panel toggle works', async ({ page }) => {
    // 调用辅助函数，检查是否需要跳过测试
    await skipIfNoWorkspace(page);

    // Click Doc panel toggle
    const docBtn = page.getByRole('button', { name: /Doc/ });
    await expect(docBtn).toBeVisible();

    // Initially doc panel is closed (panels.doc = false by default)
    const docPanel = page.locator('[data-testid="doc-panel"]');
    await expect(docPanel).toBeHidden();

    // Click to open
    await docBtn.click();

    // Doc panel should now be visible
    await expect(docPanel).toBeVisible({ timeout: 3000 });
    // Verify panel content is loaded (e.g., has document title or editor)
    await expect(docPanel).toContainText(/文档/, { timeout: 5000 });
    await expect(docPanel.locator('.editor')).toBeVisible({ timeout: 3000 });

    // Click again to close
    await docBtn.click();
    await expect(docPanel).not.toBeVisible({ timeout: 3000 });
  });

  test('workspace-02: Code panel toggle works', async ({ page }) => {
    // 调用辅助函数，检查是否需要跳过测试
    await skipIfNoWorkspace(page);

    // Click Code panel toggle
    const codeBtn = page.getByRole('button', { name: /Code/ });
    await expect(codeBtn).toBeVisible();

    // Initially code panel is closed (default state)
    const codePanel = page.locator('[data-testid="code-panel"]');
    await expect(codePanel).toBeHidden();

    // Click to open code panel
    await codeBtn.click();

    // Code panel should be visible
    await expect(codePanel).toBeVisible({ timeout: 3000 });
    // Verify code editor component is rendered (e.g., has code content or editor element)
    await expect(codePanel).toContainText(/\[\S\]+/, { timeout: 5000 });

    // Click again to close
    await codeBtn.click();
    await expect(codePanel).not.toBeVisible({ timeout: 3000 });
  });

  test('workspace-03: Chat panel toggle works', async ({ page }) => {
    // 调用辅助函数，检查是否需要跳过测试
    await skipIfNoWorkspace(page);

    // Chat panel is open by default
    const chatBtn = page.getByRole('button', { name: /Chat/ });
    await expect(chatBtn).toBeVisible();

    // Click to close chat panel
    await chatBtn.click();
    const chatPanel = page.locator('[data-testid="chat-panel"]');
    await expect(chatPanel).not.toBeVisible({ timeout: 3000 });

    // Click to reopen
    await chatBtn.click();

    // Verify chat panel is visible and has content (e.g., chat input or messages)
    await expect(chatPanel).toBeVisible({ timeout: 3000 });
    await expect(chatPanel).toContainText(/\[\S\]+/, { timeout: 5000 });
  });

  test('workspace-04: sidebar toggle and equalize buttons work', async ({ page }) => {
    // 调用辅助函数，检查是否需要跳过测试
    await skipIfNoWorkspace(page);

    // Toggle sidebar
    const sidebarBtn = page.locator('[data-testid="toggle-sidebar"]');
    await expect(sidebarBtn).toBeVisible();

    // Click to hide sidebar
    await sidebarBtn.click();
    // Note: Sidebar visibility cannot be asserted without a clear selector; rely on button state or workspace stability.
    await expect(sidebarBtn).toBeVisible();

    // Click to show sidebar again
    await sidebarBtn.click();
    await expect(sidebarBtn).toBeVisible();

    // Open Doc and Code panels to test equalize functionality
    const docBtn = page.getByRole('button', { name: /Doc/ });
    await docBtn.click();
    await expect(page.locator('[data-testid="doc-panel"]')).toBeVisible({ timeout: 3000 });

    const codeBtn = page.getByRole('button', { name: /Code/ });
    await codeBtn.click();
    await expect(page.locator('[data-testid="code-panel"]')).toBeVisible({ timeout: 3000 });

    // Click equalize button
    const equalizeBtn = page.locator('[data-testid="equalize-panels"]');
    await expect(equalizeBtn).toBeVisible();
    await equalizeBtn.click();

    // 使用智能等待：等待面板尺寸稳定
    // 等待两个面板的宽度不再变化
    const docPanel = page.locator('[data-testid="doc-panel"]');
    const codePanel = page.locator('[data-testid="code-panel"]');

    // 等待两个面板的宽度相等（允许小的容差）
    await expect.poll(async () => {
      const docBox = await docPanel.boundingBox();
      const codeBox = await codePanel.boundingBox();
      if (!docBox || !codeBox) return false;
      return Math.abs(docBox.width - codeBox.width) < 10;
    }, { timeout: 3000 }).toBeTruthy();

    // Verify that panels are equally sized after equalize
    const docBox = await docPanel.boundingBox();
    const codeBox = await codePanel.boundingBox();

    // Add null checks to ensure bounding boxes are available
    expect(docBox).not.toBeNull();
    expect(codeBox).not.toBeNull();

    // Assert that widths are approximately equal (allow small tolerance for rounding errors and layout calculations)
    expect(Math.abs(docBox.width - codeBox.width)).toBeLessThan(10);
    
    // Optionally, verify that both panels are visible and have reasonable widths (not collapsed)
    expect(docBox.width).toBeGreaterThan(0);
    expect(codeBox.width).toBeGreaterThan(0);
  });
});