const { chromium } = require('playwright');
(async () => {
  console.log('=== Knowledge Base Quick Test ===');
  let b;
  try {
    b = await chromium.launch({headless:true});
    const p = await b.newPage();

    // Test workspace
    await p.goto('http://127.0.0.1:38888/project/Claude-DevSprite?tab=workspace&panels=doc', {timeout:10000});
    await p.waitForTimeout(2000);
    const ws = await p.$('.workspace-view');
    console.log('Workspace:', !!ws);

    // Test knowledge tree API (correct endpoint: /tree)
    const kbRes = await p.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/tree');
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('Knowledge Tree API:', kbRes);

    // Test source tree API (correct endpoint: /source-tree)
    const treeRes = await p.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/source-tree');
        return { status: res.status, ok: res.ok };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('Source Tree API:', treeRes);

    console.log('Done');
  } finally {
    if (b) {
      await b.close();
    }
  }
})().catch(e => console.error(e.message));