const { chromium } = require('playwright');

const TEST_URL = 'http://127.0.0.1:38888/project/Claude-DevSprite?tab=workspace&panels=chat';
const DASHBOARD_URL = 'http://127.0.0.1:38888/project/Claude-DevSprite?tab=dashboard';

async function test() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    console.log('=== DevChat Workspace 会话持久化测试 ===\n');

    // Step 1
    console.log('Step 1: 打开 Workspace Chat 面板');
    await page.goto(TEST_URL);
    await page.waitForTimeout(3000);
    const chatPanel = await page.$('.chat-panel');
    console.log('Chat 面板存在: ' + !!chatPanel);
    const chatInput = await page.$('input.chat-input');
    console.log('聊天输入框存在: ' + !!chatInput);
    const chatMessages = await page.$('.chat-messages');
    console.log('消息列表存在: ' + !!chatMessages);
    const memoryBanner = await page.$('.memory-banner');
    console.log('项目记忆面板存在: ' + !!memoryBanner);

    // Step 2
    console.log('\nStep 2: 检查当前消息数量');
    const messagesBefore = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('当前消息数量: ' + messagesBefore.length);

    // Step 3
    console.log('\nStep 3: 发送测试消息');
    if (chatInput) {
      const testMessage = '持久化测试-' + Date.now();
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
    } else {
      console.log('聊天输入框不存在，跳过消息发送');
    }

    // Step 4
    console.log('\nStep 4: 记录当前状态');
    const messagesBeforeNav = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('切换前消息数量: ' + messagesBeforeNav.length);

    // Step 5
    console.log('\nStep 5: 切换到 Dashboard tab');
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);
    const chatPanelAfterNav = await page.$('.chat-panel');
    console.log('Dashboard 页面上 Chat 面板不存在: ' + !chatPanelAfterNav);

    // Step 6
    console.log('\nStep 6: 切换回 Workspace Chat');
    await page.goto(TEST_URL);
    await page.waitForTimeout(3000);

    // Step 7
    console.log('\nStep 7: 检查消息保留情况');
    const messagesAfterNav = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('切换后消息数量: ' + messagesAfterNav.length);
    if (messagesAfterNav.length >= messagesBeforeNav.length) {
      console.log('✅ 消息保留正常 (Tab 切换)');
    } else {
      console.log('❌ 消息丢失! (Tab 切换)');
      console.log('  切换前: ' + messagesBeforeNav.length + ', 切换后: ' + messagesAfterNav.length);
    }

    // Step 8
    console.log('\nStep 8: 刷新页面');
    await page.reload();
    await page.waitForTimeout(3000);
    const messagesAfterRefresh = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    console.log('刷新后消息数量: ' + messagesAfterRefresh.length);
    if (messagesAfterRefresh.length > 0) {
      console.log('✅ 刷新后消息保留');
    } else {
      console.log('⚠️ 刷新后无消息');
    }

    // Step 9
    console.log('\nStep 9: 检查输入框状态');
    const chatInputAfter = await page.$('input.chat-input');
    console.log('输入框可用: ' + !!chatInputAfter);

    // Step 10
    console.log('\nStep 10: 控制台错误检查');
    const tokenErrors = errors.filter(e => e.includes('tokens') || e.includes('Failed to fetch'));
    const wsErrors = errors.filter(e => e.includes('WebSocket') || e.includes('ws'));
    const otherErrors = errors.filter(e => !e.includes('tokens') && !e.includes('Failed to fetch') && !e.includes('WebSocket') && !e.includes('ws'));
    if (tokenErrors.length > 0) console.log('Token 相关错误 (非核心): ' + tokenErrors.length + ' 个');
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
    await page.screenshot({ path: 'test-devchat-persistence.png', fullPage: true });
    console.log('\n截图已保存: test-devchat-persistence.png');

    // Summary
    console.log('\n=== 测试总结 ===');
    const messagePersist = messagesAfterNav.length >= messagesBeforeNav.length;
    console.log('消息持久化 (Tab 切换): ' + (messagePersist ? '✅ 通过' : '❌ 失败'));
    console.log('消息持久化 (页面刷新): ' + (messagesAfterRefresh.length > 0 ? '✅ 通过' : '⚠️ 需检查'));

  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
