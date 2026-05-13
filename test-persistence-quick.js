const { chromium } = require('playwright');

const TEST_URL = 'http://127.0.0.1:38888/project/Claude-DevSprite?tab=workspace&panels=chat';
const DASHBOARD_URL = 'http://127.0.0.1:38888/project/Claude-DevSprite?tab=dashboard';

const results = [];
function log(msg) {
  results.push(msg);
  process.stdout.write(msg + '\n');
}

async function main() {
  log('=== DevChat Persistence Test ===\n');

  log('1. Launching browser...');
  const browser = await chromium.launch({ headless: true });
  log('2. Browser launched');

  const page = await browser.newPage();
  log('3. New page created');

  page.on('console', msg => {
    if (msg.type() === 'error') log('  [CONSOLE ERROR] ' + msg.text().substring(0, 120));
  });

  log('4. Navigating to Workspace Chat...');
  await page.goto(TEST_URL, { timeout: 15000, waitUntil: 'domcontentloaded' });
  log('5. Page loaded');
  await page.waitForTimeout(3000);

  // Check UI elements
  const chatPanel = await page.$('.chat-panel');
  const chatInput = await page.$('input.chat-input');
  const chatMessages = await page.$('.chat-messages');
  log('6. UI Check - chat-panel: ' + !!chatPanel + ', input: ' + !!chatInput + ', messages: ' + !!chatMessages);

  // Count messages before
  const msgsBefore = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
  log('7. Messages before: ' + msgsBefore.length);

  // Send test message
  if (chatInput) {
    const testMsg = 'persistence-message-1778522965458';
    await chatInput.click();
    await chatInput.fill(testMsg);
    const sendBtn = await page.$('.chat-send');
    if (sendBtn) {
      await sendBtn.click();
      log('8. Message sent via button');
    } else {
      await chatInput.press('Enter');
      log('8. Message sent via Enter');
    }
    await page.waitForTimeout(2000);
    const afterSend = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
    log('9. Messages after send: ' + afterSend.length);
  } else {
    log('8. No chat input found, skipping send');
  }

  // Record count before navigation
  const beforeNav = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
  const beforeCount = beforeNav.length;
  log('10. Before nav count: ' + beforeCount);

  // Navigate to dashboard
  log('11. Navigating to Dashboard...');
  await page.goto(DASHBOARD_URL, { timeout: 10000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Navigate back to workspace
  log('12. Navigating back to Workspace Chat...');
  await page.goto(TEST_URL, { timeout: 15000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Count messages after nav
  const afterNav = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
  log('13. After nav count: ' + afterNav.length);
  const tabSwitchPass = afterNav.length >= beforeCount;
  log('14. Tab switch persistence: ' + (tabSwitchPass ? 'PASS' : 'FAIL'));

  // Page refresh
  log('15. Page refresh...');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const afterRefresh = await page.$$('.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)');
  log('16. After refresh count: ' + afterRefresh.length);
  const refreshPass = afterRefresh.length > 0;
  log('17. Page refresh persistence: ' + (refreshPass ? 'PASS' : 'WARN'));

  // Screenshot
  await page.screenshot({ path: 'test-devchat-persistence.png', fullPage: true });
  log('18. Screenshot saved');

  // Summary
  log('\n=== Summary ===');
  log('Tab switch: ' + (tabSwitchPass ? 'PASS' : 'FAIL') + ' (' + beforeCount + ' -> ' + afterNav.length + ')');
  log('Page refresh: ' + (refreshPass ? 'PASS' : 'WARN') + ' (' + afterRefresh.length + ' msgs)');

  await browser.close();
  log('Done');
}

main().catch(e => {
  process.stderr.write('ERROR: ' + e.message + '\n' + e.stack + '\n');
  process.exit(1);
}).then(() => process.exit(0));
