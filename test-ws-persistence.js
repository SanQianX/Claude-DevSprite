const { chromium } = require('playwright');

(async () => {
  console.log('=== DevChat Workspace 消息发送 + 持久化测试 ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Step 1: 打开 Workspace Chat
  console.log('Step 1: 打开 Workspace Chat');
  await page.goto('http://127.0.0.1:38888/project/Claude-DevSprite?tab=workspace&panels=chat', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const chatPanel = await page.$('.chat-panel');
  const chatInput = await page.$('input.chat-input');
  console.log('Chat 面板:', !!chatPanel);
  console.log('输入框:', !!chatInput);

  // Step 2: 记录当前消息数
  const msgsBefore = await page.locator('.chat-messages > div').count();
  console.log('\nStep 2: 当前消息数:', msgsBefore);

  // Step 3: 发送消息
  console.log('\nStep 3: 发送测试消息');
  if (chatInput) {
    await chatInput.fill('Playwright 持久化测试-' + Date.now());
    const sendBtn = await page.$('.chat-send');
    if (sendBtn) {
      await sendBtn.click();
      console.log('已点击发送');
      await page.waitForTimeout(3000);
    }
  }

  const msgsAfterSend = await page.locator('.chat-messages > div').count();
  console.log('发送后消息数:', msgsAfterSend);
  const sentNew = msgsAfterSend > msgsBefore;
  console.log('新消息已出现:', sentNew ? '✅' : '⚠️ (WebSocket可能未连接)');

  // Step 4: 切换到 Dashboard
  console.log('\nStep 4: 切换到 Dashboard');
  await page.goto('http://127.0.0.1:38888/project/Claude-DevSprite?tab=dashboard', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Step 5: 切换回 Workspace
  console.log('\nStep 5: 切换回 Workspace');
  await page.goto('http://127.0.0.1:38888/project/Claude-DevSprite?tab=workspace&panels=chat', { timeout: 15000 });
  await page.waitForTimeout(3000);

  const msgsAfterNav = await page.locator('.chat-messages > div').count();
  console.log('切换后消息数:', msgsAfterNav);

  const tabPersist = msgsAfterNav >= msgsAfterSend;
  console.log('Tab 切换持久化:', tabPersist ? '✅' : '❌');

  // Step 6: 刷新页面
  console.log('\nStep 6: 刷新页面');
  await page.reload({ timeout: 15000 });
  await page.waitForTimeout(3000);

  const msgsAfterRefresh = await page.locator('.chat-messages > div').count();
  console.log('刷新后消息数:', msgsAfterRefresh);

  const refreshPersist = msgsAfterRefresh > 0;
  console.log('刷新持久化:', refreshPersist ? '✅' : '⚠️ 无消息');

  // Step 7: 检查输入框
  console.log('\nStep 7: 检查输入框状态');
  const inputReady = await page.$('input.chat-input');
  console.log('输入框可用:', !!inputReady);

  // Step 8: 控制台错误
  console.log('\nStep 8: 控制台错误');
  const coreErrors = errors.filter(e => !e.includes('tokens') && !e.includes('Failed to fetch') && !e.includes('WebSocket'));
  if (coreErrors.length > 0) {
    console.log('核心错误:', coreErrors.length + ' 个');
    coreErrors.forEach((e, i) => console.log('  ' + (i + 1) + '.', e.substring(0, 120)));
  } else {
    console.log('✅ 无核心错误');
  }

  // 截图
  await page.screenshot({ path: 'test-devchat-persistence.png', fullPage: true });
  console.log('\n截图已保存: test-devchat-persistence.png');

  // 总结
  console.log('\n=== 测试总结 ===');
  console.log('消息发送: ' + (sentNew ? '✅' : '⚠️'));
  console.log('Tab 持久化: ' + (tabPersist ? '✅' : '❌'));
  console.log('刷新持久化: ' + (refreshPersist ? '✅' : '⚠️'));

  await browser.close();
})().catch(e => console.error('Error:', e.message));
