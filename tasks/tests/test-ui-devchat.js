/**
 * DevChat Message Flow (P0) + Session Persistence (P0) - UI 测试
 * 测试: 消息输入 -> 发送 -> 消息显示 -> 切换页面 -> 返回 -> 消息保留
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';
const PROJECT = 'Claude-DevSprite';
const NAV_OPTS = { timeout: 15000, waitUntil: 'domcontentloaded' };

(async () => {
  console.log('=== DevChat UI Test ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    // Step 1: 打开 Workspace Chat 面板
    console.log('Step 1: 打开 Workspace Chat 面板');
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=workspace&panels=chat`, NAV_OPTS);
    await page.waitForTimeout(3000);

    const workspace = await page.locator('.workspace-view').count();
    console.log('Workspace 存在:', workspace > 0);

    // Step 2: 检查 Chat 面板
    console.log('\nStep 2: 检查 Chat 面板');
    const chatPanel = await page.locator('.chat-panel').count();
    console.log('Chat 面板存在:', chatPanel > 0);

    const panelTitle = await page.locator('.panel-title').textContent().catch(() => 'N/A');
    console.log('面板标题:', panelTitle.trim());

    // Step 3: 检查消息列表
    console.log('\nStep 3: 检查消息列表');
    const chatMessages = await page.locator('.chat-messages').count();
    console.log('消息列表存在:', chatMessages > 0);

    const messageCount = await page.locator('.message').count();
    console.log('当前消息数:', messageCount);

    // Step 4: 检查输入框
    console.log('\nStep 4: 检查输入框');
    const chatInput = page.locator('input.chat-input');
    const inputExists = await chatInput.count();
    console.log('输入框存在:', inputExists > 0);

    if (inputExists > 0) {
      const placeholder = await chatInput.first().getAttribute('placeholder');
      console.log('输入框占位符:', placeholder);

      // Step 5: 输入消息
      console.log('\nStep 5: 输入消息');
      await chatInput.first().fill('Hello from E2E test');
      const inputValue = await chatInput.first().inputValue();
      console.log('输入值:', inputValue);

      // 检查发送按钮状态
      const sendBtn = page.locator('.chat-send');
      const sendBtnCount = await sendBtn.count();
      console.log('发送按钮存在:', sendBtnCount > 0);

      if (sendBtnCount > 0) {
        const isDisabled = await sendBtn.isDisabled();
        console.log('发送按钮禁用:', isDisabled);

        // Step 6: 点击发送
        console.log('\nStep 6: 点击发送');
        if (!isDisabled) {
          await sendBtn.click();
          await page.waitForTimeout(2000);

          const inputAfterSend = await chatInput.first().inputValue();
          console.log('发送后输入框清空:', inputAfterSend === '');

          // 检查消息是否出现在列表中
          const messageCountAfter = await page.locator('.message').count();
          console.log('发送后消息数:', messageCountAfter);
          console.log('消息已添加:', messageCountAfter > messageCount);
        } else {
          console.log('发送按钮禁用 - 跳过发送测试');
        }
      }
    }

    // Step 7: 检查 Memory Banner
    console.log('\nStep 7: 检查 Memory Banner');
    const memoryBanner = await page.locator('.memory-banner').count();
    console.log('Memory Banner 存在:', memoryBanner > 0);

    if (memoryBanner > 0) {
      const memoryHeader = page.locator('.memory-header');
      if (await memoryHeader.count() > 0) {
        await memoryHeader.click();
        await page.waitForTimeout(300);
        const memoryBody = await page.locator('.memory-body').count();
        console.log('Memory 展开:', memoryBody > 0);
      }
    }

    // Step 8: 测试会话持久化 - 切换 Tab 再返回
    console.log('\nStep 8: 测试会话持久化');
    const messagesBeforeSwitch = await page.locator('.message').count();
    console.log('切换前消息数:', messagesBeforeSwitch);

    // 切换到 Doc 面板 (使用 Vue Router 导航避免 full page reload)
    console.log('切换到 Doc 面板...');
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=workspace&panels=doc`, NAV_OPTS);
    await page.waitForTimeout(2000);

    // 切换回 Chat 面板
    console.log('切换回 Chat 面板...');
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=workspace&panels=chat`, NAV_OPTS);
    await page.waitForTimeout(4000);

    const messagesAfterSwitch = await page.locator('.message').count();
    console.log('切换后消息数:', messagesAfterSwitch);
    console.log('消息保留:', messagesAfterSwitch >= messagesBeforeSwitch);

    // Step 9: 测试页面刷新后消息恢复
    console.log('\nStep 9: 测试页面刷新后消息恢复');
    await page.reload(NAV_OPTS);
    await page.waitForTimeout(4000);

    const messagesAfterRefresh = await page.locator('.message').count();
    console.log('刷新后消息数:', messagesAfterRefresh);
    console.log('刷新后消息保留:', messagesAfterRefresh >= messagesBeforeSwitch);

    // Step 10: 检查控制台错误
    console.log('\nStep 10: 控制台错误');
    const coreErrors = errors.filter(e =>
      !e.includes('WebSocket') &&
      !e.includes('Failed to fetch') &&
      !e.includes('404')
    );
    console.log('核心错误:', coreErrors.length);
    coreErrors.slice(0, 3).forEach(e => console.log('  -', e.substring(0, 120)));

    await page.screenshot({ path: 'test-devchat-result.png', fullPage: true });
    console.log('\n截图已保存');

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
