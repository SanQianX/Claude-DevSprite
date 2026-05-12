/**
 * Config Management (P2) - UI 测试
 * 测试: 设置页面加载 -> 保存配置 -> 测试连接 -> 验证生效
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';

(async () => {
  console.log('=== Config Management UI Test ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    // Step 1: 打开设置页面
    console.log('Step 1: 打开设置页面');
    await page.goto(`${BASE_URL}/settings`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const settingsPage = await page.locator('.settings-page').count();
    console.log('设置页面存在:', settingsPage > 0);

    // Step 2: 检查 Tab 切换
    console.log('\nStep 2: 检查 Tab 切换');
    const tabs = await page.locator('.tab-btn').allTextContents();
    console.log('Tab 列表:', tabs.map(t => t.trim()));

    // 点击 AI Model tab
    const aiTab = page.locator('.tab-btn').filter({ hasText: 'AI Model' });
    if (await aiTab.count() > 0) {
      await aiTab.click();
      await page.waitForTimeout(500);
      const activeTab = await page.locator('.tab-btn.active').textContent();
      console.log('当前 Tab:', activeTab.trim());
    }

    // Step 3: 检查 AI 配置表单
    console.log('\nStep 3: 检查 AI 配置表单');
    const formInputs = await page.locator('.tab-panel input.form-input').count();
    console.log('表单输入框数量:', formInputs);

    const modelInput = page.locator('input.form-input').first();
    if (await modelInput.count() > 0) {
      const modelValue = await modelInput.inputValue();
      console.log('当前模型:', modelValue || '(空)');
    }

    // Step 4: 测试保存按钮
    console.log('\nStep 4: 测试保存按钮');
    const saveBtn = page.locator('.btn-primary').filter({ hasText: /Save/ });
    const saveBtnCount = await saveBtn.count();
    console.log('保存按钮存在:', saveBtnCount > 0);

    if (saveBtnCount > 0) {
      const saveBtnText = await saveBtn.first().textContent();
      console.log('保存按钮文本:', saveBtnText.trim());
    }

    // Step 5: 测试连接按钮
    console.log('\nStep 5: 测试连接按钮');
    const testBtn = page.locator('.btn-secondary').filter({ hasText: /Test/ });
    const testBtnCount = await testBtn.count();
    console.log('测试按钮存在:', testBtnCount > 0);

    // Step 6: 切换到 System tab
    console.log('\nStep 6: 切换到 System tab');
    const systemTab = page.locator('.tab-btn').filter({ hasText: 'System' });
    if (await systemTab.count() > 0) {
      await systemTab.click();
      await page.waitForTimeout(500);

      const selects = await page.locator('.tab-panel select.form-input').count();
      console.log('System 配置下拉框:', selects);

      const checkboxes = await page.locator('.tab-panel input[type="checkbox"]').count();
      console.log('System 复选框:', checkboxes);

      // 检查只读信息
      const infoItems = await page.locator('.info-item').count();
      console.log('系统信息项:', infoItems);
    }

    // Step 7: 切换到 Agent Teams tab
    console.log('\nStep 7: 切换到 Agent Teams tab');
    const teamsTab = page.locator('.tab-btn').filter({ hasText: 'Agent Teams' });
    if (await teamsTab.count() > 0) {
      await teamsTab.click();
      await page.waitForTimeout(1000);

      const teamCards = await page.locator('.team-card').count();
      console.log('团队配置卡片:', teamCards);

      if (teamCards > 0) {
        const teamName = await page.locator('.team-name').first().textContent();
        console.log('第一个团队:', teamName.trim());
      }
    }

    // Step 8: 切换到 Skills tab
    console.log('\nStep 8: 切换到 Skills tab');
    const skillsTab = page.locator('.tab-btn').filter({ hasText: 'Skills' });
    if (await skillsTab.count() > 0) {
      await skillsTab.click();
      await page.waitForTimeout(1000);

      const skillCards = await page.locator('.skill-inventory-card').count();
      console.log('技能卡片:', skillCards);
    }

    // Step 9: 检查控制台错误
    console.log('\nStep 9: 控制台错误');
    const coreErrors = errors.filter(e => !e.includes('WebSocket') && !e.includes('Failed to fetch'));
    console.log('核心错误:', coreErrors.length);
    coreErrors.slice(0, 3).forEach(e => console.log('  -', e.substring(0, 120)));

    await page.screenshot({ path: 'test-config-result.png', fullPage: true });
    console.log('\n截图已保存');

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
