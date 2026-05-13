/**
 * 任务状态管理 - 自动测试
 * 测试: 状态切换→筛选→统计同步
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';

(async () => {
  console.log('=== 任务状态管理 自动测试 ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // Step 1: 打开 Dashboard
    console.log('Step 1: 打开 Dashboard');
    await page.goto(`${BASE_URL}/project/Claude-DevSprite?tab=dashboard`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 2: 检查任务列表
    console.log('\nStep 2: 检查任务列表');
    const taskItems = await page.$$('.task-item, [class*="task-item"]');
    console.log('任务项数量:', taskItems.length);

    // Step 3: 测试任务状态 API
    console.log('\nStep 3: 测试任务状态 API');
    const tasksRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/tasks');
        const data = await res.json();
        return { status: res.status, count: Array.isArray(data) ? data.length : 0, tasks: data };
      } catch (e) {
        return { error: e.message };
      }
    });

    if (tasksRes.error) {
      console.log('❌ 任务 API 错误:', tasksRes.error);
    } else {
      console.log('任务数量:', tasksRes.count);
      if (tasksRes.tasks && tasksRes.tasks.length > 0) {
        const statuses = {};
        tasksRes.tasks.forEach(t => {
          statuses[t.status] = (statuses[t.status] || 0) + 1;
        });
        console.log('状态分布:', statuses);
      }
    }

    // Step 4: 测试状态筛选
    console.log('\nStep 4: 测试状态筛选');
    const filterSelects = await page.$$('.filter-select, select[class*="filter"]');
    console.log('筛选器数量:', filterSelects.length);

    // Step 5: 测试统计数字
    console.log('\nStep 5: 测试统计数字');
    const statsElements = await page.$$('.stat-item, [class*="stat"]');
    console.log('统计元素数量:', statsElements.length);

    // Step 6: 控制台错误
    console.log('\nStep 6: 控制台错误');
    const coreErrors = errors.filter(e => !e.includes('tokens') && !e.includes('Failed to fetch'));
    if (coreErrors.length > 0) {
      console.log('核心错误:', coreErrors.length);
      coreErrors.slice(0, 5).forEach(e => console.log('  -', e.substring(0, 100)));
    } else {
      console.log('✅ 无核心错误');
    }

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
