/**
 * Task Status Management (P1) - UI 测试
 * 测试: 任务状态分组 -> 筛选 -> 统计同步
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';
const PROJECT = 'Claude-DevSprite';

(async () => {
  console.log('=== Task Status Management UI Test ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    // Step 1: 打开 Dashboard
    console.log('Step 1: 打开 Dashboard');
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=dashboard`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 2: 检查任务分组
    console.log('\nStep 2: 检查任务分组');
    const taskGroups = await page.locator('.task-group').count();
    console.log('任务分组数量:', taskGroups);

    const groupHeaders = await page.locator('.task-group-header').allTextContents();
    console.log('分组标题:', groupHeaders.map(h => h.trim().replace(/\s+/g, ' ')));

    // Step 3: 检查每个分组的任务数量
    console.log('\nStep 3: 各分组任务数量');
    for (let i = 0; i < taskGroups; i++) {
      const group = page.locator('.task-group').nth(i);
      const header = await group.locator('.task-group-header').textContent();
      const items = await group.locator('.task-item').count();
      console.log(`  ${header.trim().replace(/\s+/g, ' ')}: ${items} 个任务`);
    }

    // Step 4: 测试分组展开/折叠
    console.log('\nStep 4: 测试分组展开/折叠');
    const firstGroupHeader = page.locator('.task-group-header').first();
    if (await firstGroupHeader.count() > 0) {
      const arrowBefore = await firstGroupHeader.locator('.arrow').textContent();
      console.log('折叠状态箭头:', arrowBefore.trim());

      await firstGroupHeader.click();
      await page.waitForTimeout(300);

      const arrowAfter = await firstGroupHeader.locator('.arrow').textContent();
      console.log('点击后箭头:', arrowAfter.trim());
      console.log('折叠切换正常:', arrowBefore.trim() !== arrowAfter.trim());

      // 再次点击恢复
      await firstGroupHeader.click();
      await page.waitForTimeout(300);
    }

    // Step 5: 检查统计数据
    console.log('\nStep 5: 检查统计数据');
    const statsPercent = await page.locator('.stats-percent').textContent().catch(() => 'N/A');
    console.log('完成百分比:', statsPercent);

    const statsSub = await page.locator('.stats-sub').textContent().catch(() => 'N/A');
    console.log('完成数:', statsSub);

    const statsDetail = await page.locator('.stats-detail').textContent().catch(() => 'N/A');
    console.log('任务详情:', statsDetail);

    // Step 6: 验证进度条
    console.log('\nStep 6: 验证进度条');
    const progressBar = await page.locator('.progress-fill').count();
    console.log('进度条存在:', progressBar > 0);
    if (progressBar > 0) {
      const width = await page.locator('.progress-fill').evaluate(el => el.style.width);
      console.log('进度条宽度:', width);
    }

    // Step 7: 测试添加任务后统计更新
    console.log('\nStep 7: 测试添加任务后统计更新');
    const addBtn = page.locator('.add-btn');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);

      const titleInput = page.locator('.dialog-input');
      if (await titleInput.count() > 0) {
        await titleInput.fill('Status Test Task');
        const confirmBtn = page.locator('.dialog .btn-approve');
        await confirmBtn.click();
        await page.waitForTimeout(1000);

        const statsAfter = await page.locator('.stats-sub').textContent().catch(() => 'N/A');
        console.log('添加后统计:', statsAfter);

        // 清理
        await page.evaluate(async (proj) => {
          const r = await fetch(`/api/projects/${proj}/tasks`);
          const d = await r.json();
          for (const t of d.tasks || []) {
            if (t.title === 'Status Test Task') {
              await fetch(`/api/projects/${proj}/tasks/${t.id}`, { method: 'DELETE' });
            }
          }
        }, PROJECT);
      }
    }

    // Step 8: 检查控制台错误
    console.log('\nStep 8: 控制台错误');
    const coreErrors = errors.filter(e => !e.includes('WebSocket') && !e.includes('Failed to fetch'));
    console.log('核心错误:', coreErrors.length);
    coreErrors.slice(0, 3).forEach(e => console.log('  -', e.substring(0, 120)));

    await page.screenshot({ path: 'test-task-status-result.png', fullPage: true });
    console.log('\n截图已保存');

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
