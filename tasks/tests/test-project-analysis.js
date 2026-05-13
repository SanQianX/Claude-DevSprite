/**
 * 项目分析 - 自动测试
 * 测试: 触发分析→进度→结果→日志
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';

(async () => {
  console.log('=== 项目分析 自动测试 ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // Step 1: 打开项目页面
    console.log('Step 1: 打开项目页面');
    await page.goto(`${BASE_URL}/project/Claude-DevSprite?tab=dashboard`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 2: 检查项目状态
    console.log('\nStep 2: 检查项目状态');
    const projectStatus = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects');
        const data = await res.json();
        return data;
      } catch (e) {
        return { error: e.message };
      }
    });

    if (projectStatus.error) {
      console.log('❌ 项目 API 错误:', projectStatus.error);
    } else if (Array.isArray(projectStatus)) {
      console.log('项目数量:', projectStatus.length);
      projectStatus.forEach(p => {
        console.log(`  - ${p.name}: status=${p.status || 'unknown'}`);
      });
    }

    // Step 3: 测试分析 API
    console.log('\nStep 3: 测试分析 API 可用性');
    const analyzeCheck = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/analyze', { method: 'POST' });
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('分析 API:', analyzeCheck);

    // Step 4: 检查分析日志
    console.log('\nStep 4: 检查分析日志');
    const logsCheck = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/logs?limit=10');
        const data = await res.json();
        return { status: res.status, count: Array.isArray(data) ? data.length : 0 };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('日志 API:', logsCheck);

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
