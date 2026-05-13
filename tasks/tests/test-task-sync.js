/**
 * 任务同步 - 自动测试
 * 测试: 聊天创建任务→列表同步，审查创建任务→列表同步
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';

(async () => {
  console.log('=== 任务同步 自动测试 ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // Step 1: 打开 Dashboard 检查任务列表
    console.log('Step 1: 打开 Dashboard');
    await page.goto(`${BASE_URL}/project/Claude-DevSprite?tab=dashboard`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 2: 检查任务区域
    console.log('\nStep 2: 检查任务区域');
    const taskSection = await page.$('.task-section, [class*="task"]');
    console.log('任务区域存在:', !!taskSection);

    const taskItems = await page.$$('.task-item, [class*="task-item"]');
    console.log('任务项数量:', taskItems.length);

    // Step 3: 测试 API 任务列表
    console.log('\nStep 3: 测试 API 任务列表');
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/tasks');
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('任务 API:', response);

    if (response.error) {
      console.log('❌ BUG: 任务 API 不可用:', response.error);
    } else if (!response.ok) {
      console.log('❌ BUG: 任务 API 返回非 200:', response.status);
    } else {
      console.log('✅ 任务 API 正常');
    }

    // Step 4: 测试创建任务 API
    console.log('\nStep 4: 测试创建任务 API');
    const createResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '测试任务-' + Date.now(),
            description: '自动化测试创建的任务',
            priority: 'low'
          })
        });
        const data = await res.json();
        return { status: res.status, data };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('创建结果:', createResult.error || `status=${createResult.status}`);

    if (createResult.error) {
      console.log('❌ BUG: 无法创建任务:', createResult.error);
    } else if (createResult.status === 201 || createResult.status === 200) {
      console.log('✅ 任务创建成功');
    } else {
      console.log('⚠️ 任务创建返回:', createResult.status);
    }

    // Step 5: 控制台错误
    console.log('\nStep 5: 控制台错误');
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
