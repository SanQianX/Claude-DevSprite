/**
 * Task Sync (P0) - UI 测试
 * 测试: 通过 UI 创建任务 -> 列表同步 -> 统计更新
 * 参考: review-severity-filter 的测试模式
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';
const PROJECT = 'Claude-DevSprite';

(async () => {
  console.log('=== Task Sync UI Test ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    // Step 1: 打开 Dashboard
    console.log('Step 1: 打开 Dashboard');
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=dashboard`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const dashboard = await page.locator('.dashboard-view').count();
    console.log('Dashboard 存在:', dashboard > 0);

    // Step 2: 检查任务区域
    console.log('\nStep 2: 检查任务区域');
    const taskSection = await page.locator('.section-title').filter({ hasText: '项目计划' }).count();
    console.log('任务区域存在:', taskSection > 0);

    const taskItemsBefore = await page.locator('.task-item').count();
    console.log('当前任务数量:', taskItemsBefore);

    // Step 3: 点击"添加任务"按钮
    console.log('\nStep 3: 点击添加任务按钮');
    const addBtn = page.locator('.add-btn');
    const addBtnExists = await addBtn.count();
    console.log('添加按钮存在:', addBtnExists > 0);

    if (addBtnExists > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);

      // 检查对话框是否弹出
      const dialog = await page.locator('.dialog').count();
      console.log('对话框弹出:', dialog > 0);

      // Step 4: 输入任务标题
      console.log('\nStep 4: 输入任务标题');
      const titleInput = page.locator('.dialog-input');
      const inputExists = await titleInput.count();
      console.log('标题输入框存在:', inputExists > 0);

      if (inputExists > 0) {
        await titleInput.fill('E2E UI Test Task');
        const inputValue = await titleInput.inputValue();
        console.log('输入值:', inputValue);

        // Step 5: 点击"添加"确认按钮
        console.log('\nStep 5: 点击添加确认按钮');
        const confirmBtn = page.locator('.dialog .btn-approve');
        await confirmBtn.click();
        await page.waitForTimeout(1000);

        // Step 6: 验证任务出现在列表中
        console.log('\nStep 6: 验证任务出现在列表中');
        const taskItemsAfter = await page.locator('.task-item').count();
        console.log('添加后任务数量:', taskItemsAfter);
        console.log('任务已添加:', taskItemsAfter > taskItemsBefore);

        // 查找新添加的任务
        const newTask = await page.locator('.task-item').filter({ hasText: 'E2E UI Test Task' }).count();
        console.log('新任务在列表中:', newTask > 0);

        // Step 7: 验证统计更新
        console.log('\nStep 7: 验证统计更新');
        const statsSub = await page.locator('.stats-sub').textContent().catch(() => 'N/A');
        console.log('完成统计:', statsSub);

        const statsDetail = await page.locator('.stats-detail').textContent().catch(() => 'N/A');
        console.log('任务详情:', statsDetail);

        // Step 8: 清理 - 删除测试任务
        console.log('\nStep 8: 清理测试任务');
        const testTask = page.locator('.task-item').filter({ hasText: 'E2E UI Test Task' });
        if (await testTask.count() > 0) {
          // 通过 API 删除
          await page.evaluate(async (proj) => {
            const r = await fetch(`/api/projects/${proj}/tasks`);
            const d = await r.json();
            for (const t of d.tasks || []) {
              if (t.title === 'E2E UI Test Task') {
                await fetch(`/api/projects/${proj}/tasks/${t.id}`, { method: 'DELETE' });
              }
            }
          }, PROJECT);
          console.log('测试任务已清理');
        }
      }
    }

    // Step 9: 检查对话框取消功能
    console.log('\nStep 9: 测试对话框取消');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);
      const cancelBtn = page.locator('.dialog .btn-ignore');
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
        const dialogAfterCancel = await page.locator('.dialog').count();
        console.log('取消后对话框关闭:', dialogAfterCancel === 0);
      }
    }

    // Step 10: 检查控制台错误
    console.log('\nStep 10: 控制台错误');
    const coreErrors = errors.filter(e => !e.includes('WebSocket') && !e.includes('Failed to fetch'));
    console.log('核心错误:', coreErrors.length);
    coreErrors.slice(0, 3).forEach(e => console.log('  -', e.substring(0, 120)));

    // 截图
    await page.screenshot({ path: 'test-task-sync-result.png', fullPage: true });
    console.log('\n截图已保存');

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
