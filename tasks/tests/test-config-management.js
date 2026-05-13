/**
 * 配置管理 - 自动测试
 * 测试: 保存→测试→生效
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';

(async () => {
  console.log('=== 配置管理 自动测试 ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // Step 1: 打开设置页面
    console.log('Step 1: 打开设置页面');
    await page.goto(`${BASE_URL}/settings`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const settingsView = await page.$('.settings-view, [class*="settings"]');
    console.log('设置页面存在:', !!settingsView);

    // Step 2: 检查配置表单
    console.log('\nStep 2: 检查配置表单');
    const forms = await page.$$('input, select, textarea');
    console.log('表单元素数量:', forms.length);

    // Step 3: 测试配置 API
    console.log('\nStep 3: 测试配置 API');
    const configRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        return { status: res.status, keys: Object.keys(data || {}) };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('配置 API:', configRes);

    // Step 4: 测试保存配置
    console.log('\nStep 4: 测试保存配置');
    const saveRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return { status: res.status };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('保存配置:', saveRes);

    // Step 5: 测试 AI 连接
    console.log('\nStep 5: 测试 AI 连接');
    const aiTest = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/config/ai-test', { method: 'POST' });
        return { status: res.status };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('AI 测试:', aiTest);

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
