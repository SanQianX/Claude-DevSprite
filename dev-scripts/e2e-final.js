const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:38888';
const results = [];

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, text: data }); }
      });
    }).on('error', reject);
  });
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  PASS ${name}`);
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
    console.log(`  FAIL ${name}: ${e.message}`);
  }
}

async function runTests() {
  console.log('\n=== Claude-DevSprite E2E Gate Tests ===\n');

  // Gate 1: Backend Start
  console.log('--- Gate 1: Backend Start ---');
  await check('1.1 Health check', async () => {
    const r = await httpGet('/api/health');
    if (r.json?.status !== 'ok') throw new Error(`Got ${JSON.stringify(r.json)}`);
  });

  // Gate 2: API Functions
  console.log('\n--- Gate 2: API Functions ---');
  await check('2.1 GET /api/projects', async () => {
    const r = await httpGet('/api/projects');
    if (!r.json?.projects?.length) throw new Error('No projects');
    if (!r.json.projects.find(p => p.name === 'Claude-DevSprite')) throw new Error('Claude-DevSprite not found');
  });
  await check('2.2 GET /api/projects/:name/tree', async () => {
    const r = await httpGet('/api/projects/Claude-DevSprite/tree');
    if (!r.json?.tree?.length) throw new Error('No tree nodes');
    const hasBackslash = JSON.stringify(r.json).includes('\\\\');
    if (hasBackslash) throw new Error('Has backslash paths');
  });
  await check('2.3 GET /api/projects/:name/file', async () => {
    const r = await httpGet('/api/projects/Claude-DevSprite/file?path=README.md');
    if (!r.json?.content) throw new Error('No content');
  });
  await check('2.4 GET /api/projects/:name/source', async () => {
    const r = await httpGet('/api/projects/Claude-DevSprite/source?path=package.json');
    if (!r.json?.content) throw new Error('No source content');
    if (!r.json?.language) throw new Error('No language');
  });
  await check('2.5 GET /api/projects/:name/search', async () => {
    const r = await httpGet('/api/projects/Claude-DevSprite/search?q=DevSprite');
    if (r.json?.results === undefined && r.json?.error) throw new Error(r.json.error);
  });

  // Gate 3: Git Detection
  console.log('\n--- Gate 3: Git Detection ---');
  await check('3.1 GET /api/git/status', async () => {
    const r = await httpGet('/api/git/status');
    if (!r.json?.isRunning) throw new Error('Detector not running');
  });
  await check('3.2 Post-commit hook exists', async () => {
    const hookPath = path.join(__dirname, '..', '.git', 'hooks', 'post-commit');
    if (!fs.existsSync(hookPath)) throw new Error('No post-commit hook');
  });

  // Gate 4: AI Analysis (verify infrastructure)
  console.log('\n--- Gate 4: AI Analysis ---');
  await check('4.1 AI auth configured (ANTHROPIC_AUTH_TOKEN via daemon)', async () => {
    const workerEnv = path.join(__dirname, 'worker-env.json');
    if (!fs.existsSync(workerEnv)) throw new Error('No worker-env.json');
    const env = JSON.parse(fs.readFileSync(workerEnv, 'utf-8'));
    if (!env.ANTHROPIC_AUTH_TOKEN && !env.ANTHROPIC_API_KEY) throw new Error('No auth token');
  });
  await check('4.2 Claude CLI found', async () => {
    const claudePath = path.join(require('os').homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd');
    if (!fs.existsSync(claudePath)) throw new Error('Claude CLI not found');
  });
  await check('4.3 Analysis endpoint works', async () => {
    const r = await httpGet('/api/projects/Claude-DevSprite/analysis-status');
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
  });
  await check('4.4 Knowledge base has real content', async () => {
    const kbDir = path.join(__dirname, '..', 'knowledge', 'project-overview');
    if (!fs.existsSync(kbDir)) throw new Error('No knowledge directory');
    const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.md'));
    if (files.length < 3) throw new Error(`Only ${files.length} docs`);
    // Check that content is meaningful (>200 chars)
    const content = fs.readFileSync(path.join(kbDir, files[0]), 'utf-8');
    if (content.length < 200) throw new Error('Content too short');
  });

  // Gate 5: Frontend Build
  console.log('\n--- Gate 5: Frontend Build ---');
  await check('5.1 web/dist/index.html exists', async () => {
    const indexPath = path.join(__dirname, '..', 'web', 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) throw new Error('No index.html');
  });

  // Gate 6: E2E Integration (Playwright)
  console.log('\n--- Gate 6: E2E Integration (Browser) ---');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await check('6.1 Home page shows project card', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    if (!text.includes('DevSprite Knowledge Base')) throw new Error('No title');
    if (!text.includes('Claude-DevSprite')) throw new Error('No project card');
  });

  await check('6.2 Project page shows file tree', async () => {
    await page.goto(`${BASE}/project/Claude-DevSprite`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    if (text.includes('Cannot GET')) throw new Error('SPA fallback failed');
    if (!text.includes('project-overview') && !text.includes('README')) throw new Error('No file tree');
  });

  await check('6.3 Document view renders markdown', async () => {
    await page.goto(`${BASE}/project/Claude-DevSprite/doc/project-overview/02-architecture.md`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    if (text.includes('Cannot GET')) throw new Error('SPA fallback failed');
    if (!text.includes('架构') && !text.includes('architecture') && !text.includes('Document')) throw new Error('No document content');
  });

  await check('6.4 Source viewer API works', async () => {
    const r = await httpGet('/api/projects/Claude-DevSprite/source?path=src/config.ts');
    if (!r.json?.content) throw new Error('No source content');
    if (r.json?.language !== 'typescript') throw new Error(`Wrong language: ${r.json?.language}`);
  });

  await browser.close();

  // Gate 7: Regression (re-run Gate 6 key tests)
  console.log('\n--- Gate 7: Regression ---');
  const browser2 = await chromium.launch();
  const page2 = await browser2.newPage({ viewport: { width: 1400, height: 900 } });
  let consoleErrors = 0;
  page2.on('console', msg => { if (msg.type() === 'error') consoleErrors++; });

  await check('7.1 Regression: Home page', async () => {
    await page2.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
    await page2.waitForTimeout(2000);
    const text = await page2.textContent('body');
    if (!text.includes('Claude-DevSprite')) throw new Error('Project card missing');
  });

  await check('7.2 Regression: Project page', async () => {
    await page2.goto(`${BASE}/project/Claude-DevSprite`, { waitUntil: 'networkidle', timeout: 15000 });
    await page2.waitForTimeout(2000);
    const text = await page2.textContent('body');
    if (text.includes('Cannot GET')) throw new Error('SPA failed');
  });

  await check('7.3 No console errors', async () => {
    if (consoleErrors > 5) throw new Error(`${consoleErrors} console errors`);
  });

  await browser2.close();

  // Summary
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`\n=== Results: ${passed} PASS, ${failed} FAIL out of ${results.length} tests ===`);

  // Write report
  const report = `# E2E Test Results\n\nDate: ${new Date().toISOString()}\n\n` +
    results.map(r => `- ${r.pass ? 'PASS' : 'FAIL'} ${r.name}${r.error ? ': ' + r.error : ''}`).join('\n') +
    `\n\nTotal: ${passed}/${results.length}`;

  const resultsDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, 'loop5.md'), report);
  console.log(`Report written to test-results/loop5.md`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error('Fatal:', e); process.exit(1); });
