/**
 * Comprehensive E2E Test - Tests actual functionality, not just API status codes
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';
const PROJECT = 'Claude-DevSprite';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${BASE_URL}/`, { timeout: 10000 });
  await page.waitForTimeout(2000);

  let totalTests = 0;
  let passed = 0;
  let failed = 0;

  function test(name, result, detail) {
    totalTests++;
    if (result) {
      passed++;
      console.log(`  PASS: ${name}`);
    } else {
      failed++;
      console.log(`  FAIL: ${name} - ${detail || ''}`);
    }
  }

  // === Task Sync (P0) ===
  console.log('\n=== Task Sync (P0) ===');

  const createRes = await page.evaluate(async (proj) => {
    const r = await fetch(`/api/projects/${proj}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'E2E Test Task', description: 'Test', status: 'backlog', priority: 'medium' })
    });
    return { status: r.status, data: await r.json() };
  }, PROJECT);
  test('Task creation returns 201', createRes.status === 201, `got ${createRes.status}`);
  test('Task has ID', Boolean(createRes.data?.id), JSON.stringify(createRes.data).substring(0, 100));

  const listRes = await page.evaluate(async (proj) => {
    const r = await fetch(`/api/projects/${proj}/tasks`);
    const d = await r.json();
    return { status: r.status, count: d.tasks?.length || 0, tasks: d.tasks || [] };
  }, PROJECT);
  test('Task list returns 200', listRes.status === 200, `got ${listRes.status}`);
  test('Task appears in list', listRes.tasks.some(t => t.title === 'E2E Test Task'), `count: ${listRes.count}`);

  // Update task
  if (createRes.data?.id) {
    const updateRes = await page.evaluate(async (proj, id) => {
      const r = await fetch(`/api/projects/${proj}/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' })
      });
      return { status: r.status, data: await r.json() };
    }, PROJECT, createRes.data.id);
    test('Task status update returns 200', updateRes.status === 200, `got ${updateRes.status}`);
    test('Status changed to in_progress', updateRes.data?.status === 'in_progress', `got ${updateRes.data?.status}`);

    // Delete test task
    await page.evaluate(async (proj, id) => {
      await fetch(`/api/projects/${proj}/tasks/${id}`, { method: 'DELETE' });
    }, PROJECT, createRes.data.id);
  }

  // === Task Status Management (P1) ===
  console.log('\n=== Task Status Management (P1) ===');

  // Create tasks with different statuses
  const taskIds = [];
  for (const status of ['backlog', 'in_progress', 'done']) {
    const res = await page.evaluate(async (proj, s) => {
      const r = await fetch(`/api/projects/${proj}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Status Test ${s}`, status: s, priority: 'low' })
      });
      return { status: r.status, data: await r.json() };
    }, PROJECT, status);
    if (res.data?.id) taskIds.push(res.data.id);
  }
  test('Created 3 test tasks', taskIds.length === 3, `got ${taskIds.length}`);

  // Verify status filtering
  const filteredRes = await page.evaluate(async (proj) => {
    const r = await fetch(`/api/projects/${proj}/tasks?status=backlog`);
    const d = await r.json();
    return { count: d.tasks?.length || 0, statuses: d.tasks?.map(t => t.status) || [] };
  }, PROJECT);
  test('Status filter works', filteredRes.count >= 1, `count: ${filteredRes.count}`);

  // Clean up
  for (const id of taskIds) {
    await page.evaluate(async (proj, id) => {
      await fetch(`/api/projects/${proj}/tasks/${id}`, { method: 'DELETE' });
    }, PROJECT, id);
  }

  // === Reviews (P0) ===
  console.log('\n=== Reviews (P0) ===');

  const revRes = await page.evaluate(async (proj) => {
    const r = await fetch(`/api/projects/${proj}/reviews`);
    const d = await r.json();
    return {
      status: r.status,
      total: d.reviews?.length || 0,
      pending: d.reviews?.filter(r => r.status === 'pending').length || 0,
      approved: d.reviews?.filter(r => r.status === 'approved').length || 0
    };
  }, PROJECT);
  test('Reviews API returns 200', revRes.status === 200, `got ${revRes.status}`);
  test('Has reviews', revRes.total > 0, `total: ${revRes.total}`);

  // Test approve action (if pending reviews exist)
  if (revRes.pending > 0) {
    const firstReview = await page.evaluate(async (proj) => {
      const r = await fetch(`/api/projects/${proj}/reviews`);
      const d = await r.json();
      return d.reviews?.find(r => r.status === 'pending');
    }, PROJECT);

    if (firstReview) {
      const approveRes = await page.evaluate(async (proj, id) => {
        const r = await fetch(`/api/projects/${proj}/reviews/${id}/approve`, { method: 'POST' });
        return { status: r.status, data: await r.json() };
      }, PROJECT, firstReview.id);
      test('Approve review returns 200', approveRes.status === 200, `got ${approveRes.status}`);
      test('Review status changed', approveRes.data?.status === 'approved', `got ${approveRes.data?.status}`);

      // Restore to pending
      await page.evaluate(async (proj, id) => {
        await fetch(`/api/projects/${proj}/reviews/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending' })
        });
      }, PROJECT, firstReview.id);
    }
  }

  // === Config Management (P2) ===
  console.log('\n=== Config Management (P2) ===');

  const cfgGet = await page.evaluate(async () => {
    const r = await fetch('/api/config');
    return { status: r.status, data: await r.json() };
  });
  test('Config GET returns 200', cfgGet.status === 200, `got ${cfgGet.status}`);
  test('Config has server section', Boolean(cfgGet.data?.server), JSON.stringify(Object.keys(cfgGet.data || {})));

  // Test config save
  const cfgPut = await page.evaluate(async () => {
    const r = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ server: { port: 38888, host: 'localhost' } })
    });
    return { status: r.status };
  });
  test('Config PUT returns 200', cfgPut.status === 200, `got ${cfgPut.status}`);

  // Verify save persisted
  const cfgVerify = await page.evaluate(async () => {
    const r = await fetch('/api/config');
    const d = await r.json();
    return { port: d.server?.port, host: d.server?.host };
  });
  test('Config persisted', cfgVerify.port === 38888, `port: ${cfgVerify.port}`);

  // === Project Analysis (P1) ===
  console.log('\n=== Project Analysis (P1) ===');

  const analyzeRes = await page.evaluate(async (proj) => {
    const r = await fetch(`/api/projects/${proj}/analyze`, { method: 'POST' });
    return { status: r.status, ok: r.ok };
  }, PROJECT);
  test('Analyze endpoint exists', analyzeRes.status !== 404, `got ${analyzeRes.status}`);

  // === Knowledge Base (P2) ===
  console.log('\n=== Knowledge Base (P2) ===');

  const treeRes = await page.evaluate(async (proj) => {
    const r = await fetch(`/api/projects/${proj}/tree`);
    const d = await r.json();
    return { status: r.status, count: d.tree?.length || 0, hasData: d.tree?.length > 0 };
  }, PROJECT);
  test('Knowledge tree returns 200', treeRes.status === 200, `got ${treeRes.status}`);
  test('Knowledge tree has data', treeRes.hasData, `count: ${treeRes.count}`);

  const srcTreeRes = await page.evaluate(async (proj) => {
    const r = await fetch(`/api/projects/${proj}/source-tree`);
    const d = await r.json();
    return { status: r.status, hasData: Boolean(d.tree) };
  }, PROJECT);
  test('Source tree returns 200', srcTreeRes.status === 200, `got ${srcTreeRes.status}`);
  test('Source tree has data', srcTreeRes.hasData, '');

  // === DevChat (P0) ===
  console.log('\n=== DevChat Message Flow (P0) ===');

  await page.goto(`${BASE_URL}/project/${PROJECT}?tab=workspace&panels=chat`, { timeout: 15000 });
  await page.waitForTimeout(3000);

  const chatPanel = await page.locator('.chat-panel').count();
  test('Chat panel exists', chatPanel > 0, `count: ${chatPanel}`);

  const chatInput = await page.locator('input.chat-input, textarea.chat-input').count();
  test('Chat input exists', chatInput > 0, `count: ${chatInput}`);

  const msgList = await page.locator('.chat-messages, .message-list').count();
  test('Message list exists', msgList > 0, `count: ${msgList}`);

  // === Summary ===
  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${totalTests}, Passed: ${passed}, Failed: ${failed}`);

  const coreErrors = errors.filter(e => e.includes('WebSocket') === false);
  if (coreErrors.length > 0) {
    console.log('Console errors:', coreErrors.length);
    coreErrors.slice(0, 5).forEach(e => console.log('  -', e.substring(0, 120)));
  }

  await browser.close();
})().catch(e => console.error('Test failed:', e.message));
