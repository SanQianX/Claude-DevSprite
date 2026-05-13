const { chromium } = require('playwright');

const TEST_URL = 'http://127.0.0.1:38888/project/Claude-DevSprite?tab=workspace&panels=chat';
const DASHBOARD_URL = 'http://127.0.0.1:38888/project/Claude-DevSprite?tab=dashboard';
const TEST_ID = '1778524074226';

async function test() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    console.log(`=== DevChat Workspace 会话持久化测试 [${TEST_ID}] ===\n`);

    // Step 1: 打开 Workspace Chat
    console.log('Step 1: 打开 Workspace Chat 面板');
    await page.goto(TEST_URL);
    await page.waitForTimeout(3000);
    console.log('Chat panel: ' + !!(await page.$('.chat-panel')));
    console.log('Chat input: ' + !!(await page.$('input.chat-input')));
    console.log('Messages list: ' + !!(await page.$('.chat-messages')));

    // Step 2: 检查当前消息数量
    console.log('\nStep 2: 检查当前消息数量');
    const messagesBefore = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('当前消息数量: ' + messagesBefore.length);

    // Step 3: 发送测试消息
    console.log('\nStep 3: 发送测试消息');
    const chatInput = await page.$('input.chat-input');
    if (chatInput) {
      const testMessage = `持久化测试-${TEST_ID}`;
      await chatInput.click();
      await chatInput.fill(testMessage);
      console.log('已输入: ' + testMessage);
      const sendBtn = await page.$('.chat-send');
      if (sendBtn) {
        await sendBtn.click();
        console.log('已点击发送按钮');
      } else {
        await chatInput.press('Enter');
        console.log('已按 Enter 发送');
      }
      await page.waitForTimeout(2000);
      const msgs = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
      console.log('发送后消息数量: ' + msgs.length);
    }

    // Step 4: 记录当前状态
    console.log('\nStep 4: 记录当前状态');
    const messagesBeforeNav = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('切换前消息数量: ' + messagesBeforeNav.length);

    // Step 5: 切换到 Dashboard tab
    console.log('\nStep 5: 切换到 Dashboard tab');
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);

    // Step 6: 切换回 Workspace Chat
    console.log('\nStep 6: 切换回 Workspace Chat');
    await page.goto(TEST_URL);
    await page.waitForTimeout(3000);

    // Step 7: 检查消息保留情况
    console.log('\nStep 7: 检查消息保留情况');
    const messagesAfterNav = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('切换后消息数量: ' + messagesAfterNav.length);
    const tabSwitchPass = messagesAfterNav.length >= messagesBeforeNav.length;
    console.log(tabSwitchPass ? '✅ 消息保留正常 (Tab 切换)' : '❌ 消息丢失! (Tab 切换)');

    // Step 8: 刷新页面
    console.log('\nStep 8: 刷新页面');
    await page.reload();
    await page.waitForTimeout(3000);
    const messagesAfterRefresh = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('刷新后消息数量: ' + messagesAfterRefresh.length);
    const refreshPass = messagesAfterRefresh.length > 0;
    console.log(refreshPass ? '✅ 刷新后消息保留' : '⚠️ 刷新后无消息');

    // Step 9: 检查输入框状态
    console.log('\nStep 9: 检查输入框状态');
    console.log('输入框可用: ' + !!(await page.$('input.chat-input')));

    // Step 10: 控制台错误检查
    console.log('\nStep 10: 控制台错误检查');
    const wsErrors = errors.filter(e => e.includes('WebSocket') || e.includes('ws'));
    const otherErrors = errors.filter(e => !e.includes('tokens') && !e.includes('Failed to fetch') && !e.includes('WebSocket') && !e.includes('ws'));
    if (wsErrors.length > 0) {
      console.log('WebSocket 错误: ' + wsErrors.length + ' 个');
      wsErrors.slice(0, 3).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 100)));
    }
    if (otherErrors.length > 0) {
      console.log('其他错误: ' + otherErrors.length + ' 个');
      otherErrors.slice(0, 5).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 120)));
    }
    if (errors.length === 0) console.log('✅ 无控制台错误');

    // Screenshot
    await page.screenshot({ path: `test-persistence-${TEST_ID}.png`, fullPage: true });
    console.log(`\n截图已保存: test-persistence-${TEST_ID}.png`);

    // Summary
    console.log('\n=== 测试总结 ===');
    console.log(`测试 ID: ${TEST_ID}`);
    console.log('消息持久化 (Tab 切换): ' + (tabSwitchPass ? '✅ 通过' : '❌ 失败') + ` (${messagesBeforeNav.length} -> ${messagesAfterNav.length})`);
    console.log('消息持久化 (页面刷新): ' + (refreshPass ? '✅ 通过' : '⚠️ 需检查') + ` (${messagesAfterRefresh.length} msgs)`);
    console.log('输入框状态: ' + !!(await page.$('input.chat-input')) ? '✅ 正常' : '⚠️ 异常');

  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
