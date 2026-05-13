/**
 * Debug script: Test message persistence via API + WebSocket
 * Identifies exactly where persistence fails
 */

const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';
const WORKSPACE_URL = `${BASE_URL}/project/Claude-DevSprite?tab=workspace&panels=chat`;
const DASHBOARD_URL = `${BASE_URL}/project/Claude-DevSprite?tab=dashboard`;

async function debugPersistence() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(`[${msg.type()}] ${text}`);
    if (text.includes('[WS]')) console.log(`  BROWSER: ${text}`);
  });

  try {
    console.log('=== Persistence Debug Test ===\n');

    // Step 1: Open workspace chat
    console.log('Step 1: Opening workspace chat...');
    await page.goto(WORKSPACE_URL);
    await page.waitForTimeout(3000);

    // Get initial session info via API
    const sessionsRes = await page.evaluate(async () => {
      const res = await fetch('/api/sessions?projectPath=D:\\Claude-DevSprite');
      return res.json();
    });
    console.log(`Sessions found: ${sessionsRes.length}`);
    if (sessionsRes.length > 0) {
      const activeSession = sessionsRes[0];
      console.log(`Active session: ${activeSession.id} (${activeSession.title})`);
      console.log(`Message count: ${activeSession.metadata.messageCount}`);

      // Get messages via API
      const msgsRes = await page.evaluate(async (sid) => {
        const res = await fetch(`/api/sessions/${sid}/messages`);
        return res.json();
      }, activeSession.id);
      console.log(`Messages via API: ${msgsRes.length}`);
      msgsRes.forEach(m => console.log(`  [${m.type}] ${m.content.substring(0, 60)}`));
    }

    // Step 2: Send a message
    console.log('\nStep 2: Sending test message...');
    const testMsg = `debug-test-${Date.now()}`;
    const chatInput = await page.$('input.chat-input');
    if (chatInput) {
      await chatInput.click();
      await chatInput.fill(testMsg);
      const sendBtn = await page.$('.chat-send');
      if (sendBtn) {
        await sendBtn.click();
        console.log(`Sent: ${testMsg}`);
      } else {
        await chatInput.press('Enter');
        console.log(`Sent (Enter): ${testMsg}`);
      }
      await page.waitForTimeout(3000); // Wait for agent response
    }

    // Check messages via API after send
    const sessionsAfter = await page.evaluate(async () => {
      const res = await fetch('/api/sessions?projectPath=D:\\Claude-DevSprite');
      return res.json();
    });
    if (sessionsAfter.length > 0) {
      const sid = sessionsAfter[0].id;
      const msgsAfter = await page.evaluate(async (sid) => {
        const res = await fetch(`/api/sessions/${sid}/messages`);
        return res.json();
      }, sid);
      console.log(`\nAfter send - Messages via API: ${msgsAfter.length}`);
      msgsAfter.forEach(m => console.log(`  [${m.type}] seq=${m.sequenceId} ${m.content.substring(0, 60)}`));
      console.log(`Session messageCount: ${sessionsAfter[0].metadata.messageCount}`);
    }

    // Step 3: Check DOM message count
    console.log('\nStep 3: DOM message count before nav...');
    const domCountBefore = await page.$$eval(
      '.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)',
      els => els.length
    );
    console.log(`DOM elements: ${domCountBefore}`);

    // Also check the inner chat-messages
    const innerMsgCount = await page.$$eval(
      '.chat-messages .chat-messages > div:not(.thinking-panel):not(.empty-state)',
      els => els.length
    );
    console.log(`Inner chat-messages divs: ${innerMsgCount}`);

    // Step 4: Navigate away
    console.log('\nStep 4: Navigating to Dashboard...');
    await page.goto(DASHBOARD_URL);
    await page.waitForTimeout(2000);

    // Step 5: Navigate back
    console.log('\nStep 5: Navigating back to Workspace...');
    await page.goto(WORKSPACE_URL);
    await page.waitForTimeout(4000);

    // Check sessions again
    const sessionsBack = await page.evaluate(async () => {
      const res = await fetch('/api/sessions?projectPath=D:\\Claude-DevSprite');
      return res.json();
    });
    if (sessionsBack.length > 0) {
      const sid = sessionsBack[0].id;
      const msgsBack = await page.evaluate(async (sid) => {
        const res = await fetch(`/api/sessions/${sid}/messages`);
        return res.json();
      }, sid);
      console.log(`\nAfter nav back - Messages via API: ${msgsBack.length}`);
      msgsBack.forEach(m => console.log(`  [${m.type}] seq=${m.sequenceId} ${m.content.substring(0, 60)}`));
    }

    // Check DOM
    const domCountAfter = await page.$$eval(
      '.chat-messages > div:not(.memory-banner):not(.thinking-panel):not(.empty-state)',
      els => els.length
    );
    console.log(`\nDOM elements after nav: ${domCountAfter}`);

    const innerMsgCountAfter = await page.$$eval(
      '.chat-messages .chat-messages > div:not(.thinking-panel):not(.empty-state)',
      els => els.length
    );
    console.log(`Inner chat-messages divs after nav: ${innerMsgCountAfter}`);

    // Check the Vue store state
    const storeState = await page.evaluate(() => {
      // Try to access Pinia store
      const app = document.querySelector('#app')?.__vue_app__;
      if (app) {
        const pinia = app.config.globalProperties.$pinia;
        if (pinia) {
          const chatStore = pinia.state.value?.chat;
          if (chatStore) {
            return {
              messages: chatStore.messages?.length || 0,
              activeSessionId: chatStore.activeSessionId,
              sessions: chatStore.sessions?.length || 0,
              isConnected: chatStore.isConnected,
              isAuthenticated: chatStore.isAuthenticated,
            };
          }
        }
      }
      return null;
    });
    console.log(`\nVue store state:`, JSON.stringify(storeState, null, 2));

    // Summary
    console.log('\n=== Summary ===');
    console.log(`API messages after send: ${sessionsAfter[0]?.metadata?.messageCount || 'unknown'}`);
    console.log(`API messages after nav: ${sessionsBack[0]?.metadata?.messageCount || 'unknown'}`);
    console.log(`DOM before nav: ${domCountBefore}`);
    console.log(`DOM after nav: ${domCountAfter}`);
    console.log(`Store messages: ${storeState?.messages || 'unknown'}`);

    if (sessionsAfter[0]?.metadata?.messageCount !== sessionsBack[0]?.metadata?.messageCount) {
      console.log('\n❌ BUG: Messages lost from SERVER between send and nav-back');
    } else if (domCountAfter < domCountBefore) {
      console.log('\n❌ BUG: Messages lost from DOM/STORE after nav (server has them)');
    } else if (domCountAfter >= domCountBefore) {
      console.log('\n✅ Messages persisted correctly');
    }

    // Save screenshot
    await page.screenshot({ path: 'test-persistence-debug.png', fullPage: true });
    console.log('\nScreenshot saved: test-persistence-debug.png');

  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugPersistence().catch(console.error);
