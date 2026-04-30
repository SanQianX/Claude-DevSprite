// e2e-gate-test.js - Comprehensive E2E test suite for all 7 gates
// Usage: node dev-scripts/e2e-gate-test.js

const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:38888';
const PROJECT_DIR = path.join(__dirname, '..');
const TEST_RESULTS = [];

// ANSI color codes
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';

/**
 * Log a test result with PASS/FAIL indicator
 */
function logResult(testName, passed, details = '') {
  const status = passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  const message = `  ${status} ${testName}${details ? ` - ${details}` : ''}`;
  console.log(message);
  // Force flush stdout
  if (process.stdout.write) process.stdout.write('');
  TEST_RESULTS.push({
    gate: currentGate,
    name: testName,
    status: passed ? 'PASS' : 'FAIL',
    details,
    timestamp: new Date().toISOString()
  });
  return passed;
}

let currentGate = '';

/**
 * Flush stdout
 */
function flushStdout() {
  if (process.stdout && typeof process.stdout.flush === 'function') {
    process.stdout.flush();
  }
}

/**
 * Log with flush
 */
function logWithFlush(message) {
  console.log(message);
  flushStdout();
}

/**
 * Check if ANTHROPIC_API_KEY is configured
 */
function hasAnthropicApiKey() {
  try {
    const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.claude-dev-sprite');
    const envFile = path.join(configDir, '.env');
    if (!fs.existsSync(envFile)) return false;

    const envContent = fs.readFileSync(envFile, 'utf-8');
    return envContent.includes('ANTHROPIC_API_KEY=') && !envContent.includes('ANTHROPIC_API_KEY=""');
  } catch (error) {
    return false;
  }
}

/**
 * HTTP GET request
 */
function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve({ statusCode: res.statusCode, body: data, json: JSON.parse(data) }); }
          catch { resolve({ statusCode: res.statusCode, body: data, json: null }); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * HTTP POST request
 */
function httpPost(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const postData = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve({ statusCode: res.statusCode, body: data, json: JSON.parse(data) }); }
          catch { resolve({ statusCode: res.statusCode, body: data, json: null }); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Wait for a specified time
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get project name from API
 */
async function getProjectName() {
  const res = await httpGet('/api/projects');
  if (!res.json || !res.json.projects || res.json.projects.length === 0) {
    throw new Error('No projects found');
  }
  return res.json.projects[0].name;
}

/**
 * Find first .md file in tree
 */
function findFirstMdFile(tree) {
  function search(nodes) {
    for (const node of nodes) {
      if (node.type === 'file' && node.path.endsWith('.md')) {
        return node.path;
      }
      if (node.children) {
        const found = search(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return search(tree);
}

/**
 * Check if knowledge has real content
 */
function hasRealKnowledgeContent(knowledgeDir) {
  if (!fs.existsSync(knowledgeDir)) return false;

  const files = getAllMarkdownFiles(knowledgeDir);
  if (files.length === 0) return false;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    // Remove frontmatter
    const body = content.replace(/^---[\s\S]*?---\n?/, '');
    // Check if content is meaningful (more than 200 chars and not just placeholders)
    if (body.length > 200 &&
        !body.includes('TODO') &&
        !body.includes('[Coming soon]') &&
        !body.includes('[To be added]') &&
        !body.trim().length < 50) {
      return true;
    }
  }
  return false;
}

/**
 * Get all markdown files recursively
 */
function getAllMarkdownFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Run a command and return exit code
 */
function runCommand(cmd, cwd = PROJECT_DIR) {
  try {
    execSync(cmd, { cwd, stdio: 'pipe' });
    return 0;
  } catch (error) {
    return error.status || 1;
  }
}

/**
 * Gate 1: Backend Start
 */
async function testGate1() {
  currentGate = 'Gate 1: Backend Start';
  logWithFlush(`\n${CYAN}--- ${currentGate} ---${RESET}`);

  // Test 1.1: Build compiles without errors
  const exitCode = runCommand('npm run build');
  logResult('1.1 Build compiles without errors', exitCode === 0, `exit code: ${exitCode}`);

  // Test 1.2: Daemon health check
  try {
    const res = await httpGet('/api/health');
    const passed = res.json && res.json.status === 'ok';
    logResult('1.2 Daemon health check', passed, res.json ? JSON.stringify(res.json) : 'Invalid response');
  } catch (error) {
    logResult('1.2 Daemon health check', false, error.message);
  }
}

/**
 * Gate 2: API Functions
 */
async function testGate2() {
  currentGate = 'Gate 2: API Functions';
  logWithFlush(`\n${CYAN}--- ${currentGate} ---${RESET}`);

  let projectName = null;

  // Test 2.1: GET /api/projects
  try {
    const res = await httpGet('/api/projects');
    const passed = res.json && res.json.projects &&
                   Array.isArray(res.json.projects) &&
                   res.json.projects.some(p => p.name === 'Claude-DevSprite');
    projectName = res.json?.projects?.find(p => p.name === 'Claude-DevSprite')?.name ||
                  res.json?.projects?.[0]?.name;
    logResult('2.1 GET /api/projects returns projects array with Claude-DevSprite', passed,
              `found ${res.json?.projects?.length || 0} projects`);
  } catch (error) {
    logResult('2.1 GET /api/projects returns projects array with Claude-DevSprite', false, error.message);
  }

  if (!projectName) {
    logWithFlush(`${YELLOW}  Skipping remaining Gate 2 tests - no project found${RESET}`);
    return;
  }

  // Test 2.2: GET /api/projects/:name/tree
  try {
    const res = await httpGet(`/api/projects/${projectName}/tree`);
    const passed = res.json && res.json.tree && Array.isArray(res.json.tree);
    // Check for backslashes
    const treeStr = JSON.stringify(res.json?.tree || '');
    const hasBackslash = treeStr.includes('\\');
    logResult('2.2 GET /api/projects/:name/tree returns tree with forward slashes', passed && !hasBackslash,
              hasBackslash ? 'Found backslashes!' : 'All forward slashes');
  } catch (error) {
    logResult('2.2 GET /api/projects/:name/tree returns tree with forward slashes', false, error.message);
  }

  // Test 2.3: GET /api/projects/:name/file
  try {
    const treeRes = await httpGet(`/api/projects/${projectName}/tree`);
    const mdPath = findFirstMdFile(treeRes.json?.tree || []);
    if (mdPath) {
      const res = await httpGet(`/api/projects/${projectName}/file?path=${encodeURIComponent(mdPath)}`);
      const passed = res.json && res.json.content !== undefined;
      logResult('2.3 GET /api/projects/:name/file returns content', passed, `file: ${mdPath}`);
    } else {
      logResult('2.3 GET /api/projects/:name/file returns content', false, 'No .md file found');
    }
  } catch (error) {
    logResult('2.3 GET /api/projects/:name/file returns content', false, error.message);
  }

  // Test 2.4: GET /api/projects/:name/source
  try {
    const res = await httpGet(`/api/projects/${projectName}/source?path=package.json`);
    const passed = res.json && res.json.language && res.json.content !== undefined;
    logResult('2.4 GET /api/projects/:name/source returns language and content', passed,
              `language: ${res.json?.language}`);
  } catch (error) {
    logResult('2.4 GET /api/projects/:name/source returns language and content', false, error.message);
  }

  // Test 2.5: GET /api/projects/:name/search
  try {
    const res = await httpGet(`/api/projects/${projectName}/search?q=DevSprite`);
    const passed = res.json && res.json.results && Array.isArray(res.json.results);
    logResult('2.5 GET /api/projects/:name/search returns results', passed,
              `found ${res.json?.results?.length || 0} results`);
  } catch (error) {
    logResult('2.5 GET /api/projects/:name/search returns results', false, error.message);
  }
}

/**
 * Gate 3: Git Detection
 */
async function testGate3() {
  currentGate = 'Gate 3: Git Detection';
  logWithFlush(`\n${CYAN}--- ${currentGate} ---${RESET}`);

  // Test 3.1: Git detector status
  try {
    const res = await httpGet('/api/git/status');
    const passed = res.json && (res.json.isRunning !== undefined || res.json.detector);
    logResult('3.1 GET /api/git/status returns detector info', passed,
              res.json ? JSON.stringify(res.json) : 'Invalid response');
  } catch (error) {
    logResult('3.1 GET /api/git/status returns detector info', false, error.message);
  }

  // Test 3.2: Post-commit hook exists
  const hookPath = path.join(PROJECT_DIR, '.git', 'hooks', 'post-commit');
  const hookExists = fs.existsSync(hookPath);
  logResult('3.2 .git/hooks/post-commit exists', hookExists, hookPath);
}

/**
 * Gate 4: AI Analysis
 */
async function testGate4() {
  currentGate = 'Gate 4: AI Analysis';
  logWithFlush(`\n${CYAN}--- ${currentGate} ---${RESET}`);

  // Check if ANTHROPIC_API_KEY is configured
  if (!hasAnthropicApiKey()) {
    logWithFlush(`${YELLOW}  WARNING: ANTHROPIC_API_KEY not configured in ~/.claude-dev-sprite/.env${RESET}`);
    logWithFlush(`${YELLOW}  Skipping Gate 4 tests${RESET}`);
    TEST_RESULTS.push({
      gate: currentGate,
      name: 'Gate 4 Skipped',
      status: 'SKIPPED',
      details: 'ANTHROPIC_API_KEY not configured',
      timestamp: new Date().toISOString()
    });
    return;
  }

  let projectName = null;
  try {
    const res = await httpGet('/api/projects');
    projectName = res.json?.projects?.find(p => p.name === 'Claude-DevSprite')?.name ||
                  res.json?.projects?.[0]?.name;
  } catch (error) {
    logResult('4.1 Trigger full analysis', false, `Cannot get project name: ${error.message}`);
    return;
  }

  if (!projectName) {
    logResult('4.1 Trigger full analysis', false, 'No project found');
    return;
  }

  // Test 4.1: Trigger full analysis
  try {
    const res = await httpPost(`/api/projects/${projectName}/analyze/full`, {});
    const passed = res.statusCode >= 200 && res.statusCode < 300;
    logResult('4.1 POST /api/projects/:name/analyze/full triggers analysis', passed,
              `status: ${res.statusCode}`);
  } catch (error) {
    logResult('4.1 POST /api/projects/:name/analyze/full triggers analysis', false, error.message);
  }

  // Test 4.2: Wait for completion (up to 5 minutes)
  logWithFlush(`  ${CYAN}Waiting for AI analysis to complete (up to 5 minutes)...${RESET}`);
  const startTime = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes
  let analysisComplete = false;

  while (Date.now() - startTime < timeout) {
    await wait(5000); // Check every 5 seconds
    try {
      const res = await httpGet(`/api/projects/${projectName}`);
      const status = res.json?.analysisStatus;
      logWithFlush(`    Analysis status: ${status || 'unknown'}`);

      if (status === 'idle' || status === 'completed') {
        analysisComplete = true;
        break;
      }
    } catch (error) {
      // Ignore errors during polling
    }
  }

  if (!analysisComplete) {
    logResult('4.2 Analysis completes within timeout', false, 'Timed out after 5 minutes');
    return;
  }

  logResult('4.2 Analysis completes within timeout', true, `completed in ${((Date.now() - startTime) / 1000).toFixed(0)}s`);

  // Test 4.3: Knowledge directory has documents with real content
  const knowledgeDir = path.join(PROJECT_DIR, 'knowledge');
  const hasRealContent = hasRealKnowledgeContent(knowledgeDir);
  logResult('4.3 knowledge/ directory has documents with real content', hasRealContent,
            hasRealContent ? 'Found meaningful content' : 'No meaningful content found');

  // Test 4.4: At least one document has >200 characters
  if (hasRealContent) {
    const files = getAllMarkdownFiles(knowledgeDir);
    let maxContentLength = 0;
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const body = content.replace(/^---[\s\S]*?---\n?/, '');
      if (body.length > maxContentLength) {
        maxContentLength = body.length;
      }
    }
    logResult('4.4 At least one document has >200 characters of meaningful content',
              maxContentLength > 200, `max content length: ${maxContentLength}`);
  }
}

/**
 * Gate 5: Frontend Build
 */
async function testGate5() {
  currentGate = 'Gate 5: Frontend Build';
  logWithFlush(`\n${CYAN}--- ${currentGate} ---${RESET}`);

  const webDir = path.join(PROJECT_DIR, 'web');

  // Test 5.1: Frontend build succeeds
  const exitCode = runCommand('cd web && npx vite build', PROJECT_DIR);
  logResult('5.1 cd web && npx vite build succeeds', exitCode === 0, `exit code: ${exitCode}`);

  // Test 5.2: web/dist/index.html exists
  const distPath = path.join(webDir, 'dist', 'index.html');
  const exists = fs.existsSync(distPath);
  logResult('5.2 web/dist/index.html exists', exists, distPath);
}

/**
 * Gate 6: E2E Integration (Playwright browser tests)
 */
async function testGate6() {
  currentGate = 'Gate 6: E2E Integration';
  logWithFlush(`\n${CYAN}--- ${currentGate} ---${RESET}`);

  let browser;
  let page;
  const screenshotDir = path.join(PROJECT_DIR, 'test-results', 'screenshots');

  // Create screenshot directory
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    // Test 6.1: Home page shows title and project card
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await wait(2000);
    const homeText = await page.textContent('body');
    const hasTitle = homeText.includes('DevSprite Knowledge Base');
    const hasProject = homeText.includes('Claude-DevSprite');
    await page.screenshot({ path: path.join(screenshotDir, 'gate6-home.png'), fullPage: true });
    logResult('6.1 Home page shows "DevSprite Knowledge Base" title and project card',
              hasTitle && hasProject, `title: ${hasTitle}, project: ${hasProject}`);

    // Test 6.2: Click project card → navigate to project page
    try {
      const projectCard = await page.$('text=Claude-DevSprite');
      if (projectCard) {
        await projectCard.click();
        await wait(2000);
        const url = page.url();
        const navigated = url.includes('/project/');
        logResult('6.2 Click project card → navigates to project page', navigated, `URL: ${url}`);
      } else {
        logResult('6.2 Click project card → navigates to project page', false, 'Project card not found');
      }
    } catch (error) {
      logResult('6.2 Click project card → navigates to project page', false, error.message);
    }

    // Test 6.3: Project page file tree visible with nodes
    await page.goto(`${BASE_URL}/project/Claude-DevSprite`, { waitUntil: 'networkidle', timeout: 15000 });
    await wait(2000);
    const treeNodes = await page.$$('.tree-node');
    await page.screenshot({ path: path.join(screenshotDir, 'gate6-project.png'), fullPage: true });
    logResult('6.3 Project page file tree visible with nodes', treeNodes.length > 0,
              `found ${treeNodes.length} tree nodes`);

    // Test 6.4: Expand directory in file tree
    try {
      const dirNode = await page.$('.tree-node-content');
      if (dirNode) {
        await dirNode.click();
        await wait(500);
        const expandedNodes = await page.$$('.tree-node');
        await page.screenshot({ path: path.join(screenshotDir, 'gate6-expanded.png'), fullPage: true });
        logResult('6.4 Expand directory in file tree', true,
                  `nodes before: ${treeNodes.length}, after: ${expandedNodes.length}`);
      } else {
        logResult('6.4 Expand directory in file tree', false, 'No directory node found');
      }
    } catch (error) {
      logResult('6.4 Expand directory in file tree', false, error.message);
    }

    // Test 6.5: Click .md file → navigate to document view
    let docNavWorked = false;
    try {
      const fileNodes = await page.$$('.tree-node-content');
      for (const node of fileNodes) {
        const text = await node.textContent();
        if (text && text.includes('.md')) {
          await node.click();
          await wait(2000);
          const url = page.url();
          docNavWorked = url.includes('/doc/');
          if (docNavWorked) {
            await page.screenshot({ path: path.join(screenshotDir, 'gate6-document.png'), fullPage: true });
            const docText = await page.textContent('body');
            const renders = !docText.includes('Cannot GET') && docText.length > 50;
            logResult('6.5 Click .md file → navigates to document view', docNavWorked && renders,
                      `URL: ${url}, content length: ${docText.length}`);
          }
          break;
        }
      }
      if (!docNavWorked) {
        logResult('6.5 Click .md file → navigates to document view', false, 'No .md file clicked');
      }
    } catch (error) {
      logResult('6.5 Click .md file → navigates to document view', false, error.message);
    }

    // Test 6.6: Document view renders markdown content
    if (docNavWorked) {
      try {
        const docText = await page.textContent('body');
        const rendersMarkdown = docText.includes('#') || docText.includes('##') || docText.length > 100;
        logResult('6.6 Document view renders markdown content', rendersMarkdown,
                  `content length: ${docText.length}`);
      } catch (error) {
        logResult('6.6 Document view renders markdown content', false, error.message);
      }
    } else {
      logResult('6.6 Document view renders markdown content', false, 'No document loaded');
    }

    // Test 6.7: Direct URL navigation works (SPA fallback)
    await page.goto(`${BASE_URL}/project/Claude-DevSprite/doc/README.md`, {
      waitUntil: 'networkidle',
      timeout: 15000
    });
    await wait(2000);
    const directDocText = await page.textContent('body');
    const spaWorks = !directDocText.includes('Cannot GET');
    await page.screenshot({ path: path.join(screenshotDir, 'gate6-direct-url.png'), fullPage: true });
    logResult('6.7 Direct URL navigation works (SPA fallback)', spaWorks,
              spaWorks ? 'Page loaded' : 'Cannot GET error');

    // Test 6.8: Source viewer returns data
    try {
      const res = await httpGet('/api/projects/Claude-DevSprite/source?path=package.json');
      const hasData = res.json && res.json.language && res.json.content;
      logResult('6.8 Source viewer returns data', hasData,
                hasData ? `language: ${res.json.language}` : 'No data');
    } catch (error) {
      logResult('6.8 Source viewer returns data', false, error.message);
    }

  } catch (error) {
    logResult('Browser test error', false, error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Gate 7: Regression (run Gate 6 tests again)
 */
async function testGate7() {
  currentGate = 'Gate 7: Regression';
  logWithFlush(`\n${CYAN}--- ${currentGate} ---${RESET}`);

  logWithFlush(`  ${CYAN}Re-running Gate 6 browser tests...${RESET}`);

  let browser;
  let page;
  const screenshotDir = path.join(PROJECT_DIR, 'test-results', 'screenshots');

  try {
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    const regressionResults = [];

    // Test 7.1: Home page regression
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await wait(2000);
    const homeText = await page.textContent('body');
    const hasTitle = homeText.includes('DevSprite Knowledge Base');
    const hasProject = homeText.includes('Claude-DevSprite');
    regressionResults.push(hasTitle && hasProject);
    logResult('7.1 REGRESSION: Home page shows title and project card',
              hasTitle && hasProject, `title: ${hasTitle}, project: ${hasProject}`);

    // Test 7.2: Project page regression
    await page.goto(`${BASE_URL}/project/Claude-DevSprite`, { waitUntil: 'networkidle', timeout: 15000 });
    await wait(2000);
    const treeNodes = await page.$$('.tree-node');
    regressionResults.push(treeNodes.length > 0);
    logResult('7.2 REGRESSION: Project page file tree visible', treeNodes.length > 0,
              `found ${treeNodes.length} tree nodes`);

    // Test 7.3: Document view regression
    try {
      const fileNodes = await page.$$('.tree-node-content');
      let docNavWorked = false;
      for (const node of fileNodes) {
        const text = await node.textContent();
        if (text && text.includes('.md')) {
          await node.click();
          await wait(2000);
          const url = page.url();
          docNavWorked = url.includes('/doc/');
          if (docNavWorked) {
            const docText = await page.textContent('body');
            const renders = !docText.includes('Cannot GET') && docText.length > 50;
            regressionResults.push(docNavWorked && renders);
            logResult('7.3 REGRESSION: Document view renders', docNavWorked && renders,
                      `URL: ${url}, content length: ${docText.length}`);
          }
          break;
        }
      }
      if (!docNavWorked) {
        regressionResults.push(false);
        logResult('7.3 REGRESSION: Document view renders', false, 'No document loaded');
      }
    } catch (error) {
      regressionResults.push(false);
      logResult('7.3 REGRESSION: Document view renders', false, error.message);
    }

    // Test 7.4: Direct URL regression
    await page.goto(`${BASE_URL}/project/Claude-DevSprite/doc/README.md`, {
      waitUntil: 'networkidle',
      timeout: 15000
    });
    await wait(2000);
    const directDocText = await page.textContent('body');
    const spaWorks = !directDocText.includes('Cannot GET');
    regressionResults.push(spaWorks);
    logResult('7.4 REGRESSION: Direct URL navigation works', spaWorks,
              spaWorks ? 'Page loaded' : 'Cannot GET error');

    // Test 7.5: Results must be identical (all pass)
    const allPassed = regressionResults.every(r => r);
    logResult('7.5 REGRESSION: All regression tests pass', allPassed,
              `${regressionResults.filter(r => r).length}/${regressionResults.length} passed`);

  } catch (error) {
    logResult('Regression test error', false, error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Write test results summary
 */
function writeResultsSummary() {
  const resultsDir = path.join(PROJECT_DIR, 'test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const summaryPath = path.join(resultsDir, 'loop5.md');

  const passCount = TEST_RESULTS.filter(r => r.status === 'PASS').length;
  const failCount = TEST_RESULTS.filter(r => r.status === 'FAIL').length;
  const skipCount = TEST_RESULTS.filter(r => r.status === 'SKIPPED').length;
  const totalCount = TEST_RESULTS.length;

  // Group by gate
  const byGate = {};
  TEST_RESULTS.forEach(r => {
    if (!byGate[r.gate]) byGate[r.gate] = [];
    byGate[r.gate].push(r);
  });

  let content = `# Claude-DevSprite E2E Test Results - Loop 5\n\n`;
  content += `**Timestamp:** ${new Date().toISOString()}\n\n`;
  content += `## Summary\n\n`;
  content += `- **Total Tests:** ${totalCount}\n`;
  content += `- **Passed:** ${passCount}\n`;
  content += `- **Failed:** ${failCount}\n`;
  content += `- **Skipped:** ${skipCount}\n`;
  content += `- **Success Rate:** ${totalCount > 0 ? ((passCount / totalCount) * 100).toFixed(1) : 0}%\n\n`;

  content += `## Results by Gate\n\n`;

  for (const [gate, results] of Object.entries(byGate)) {
    content += `### ${gate}\n\n`;
    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✅' : (r.status === 'SKIPPED' ? '⚠️' : '❌');
      content += `${icon} **${r.name}**\n`;
      if (r.details) {
        content += `   - Details: ${r.details}\n`;
      }
      content += `\n`;
    });
  }

  content += `## Detailed Results\n\n`;
  content += `| Gate | Test | Status | Details |\n`;
  content += `|------|------|--------|---------|\n`;
  TEST_RESULTS.forEach(r => {
    const status = r.status === 'PASS' ? 'PASS' : (r.status === 'SKIPPED' ? 'SKIP' : 'FAIL');
    const details = (r.details || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    content += `| ${r.gate} | ${r.name} | ${status} | ${details} |\n`;
  });

  fs.writeFileSync(summaryPath, content);
  logWithFlush(`\n${CYAN}Test results written to: ${summaryPath}${RESET}`);
}

/**
 * Main test runner
 */
async function main() {
  logWithFlush(`${CYAN}========================================${RESET}`);
  logWithFlush(`${CYAN}  Claude-DevSprite E2E Test Suite${RESET}`);
  logWithFlush(`${CYAN}========================================${RESET}`);
  logWithFlush(`Timestamp: ${new Date().toISOString()}\n`);

  try {
    // Run all gates
    await testGate1();
    await testGate2();
    await testGate3();
    await testGate4();
    await testGate5();
    await testGate6();
    await testGate7();

    // Print summary
    logWithFlush(`\n${CYAN}========================================${RESET}`);
    logWithFlush(`${CYAN}           Test Summary${RESET}`);
    logWithFlush(`${CYAN}========================================${RESET}\n`);

    const passCount = TEST_RESULTS.filter(r => r.status === 'PASS').length;
    const failCount = TEST_RESULTS.filter(r => r.status === 'FAIL').length;
    const skipCount = TEST_RESULTS.filter(r => r.status === 'SKIPPED').length;
    const totalCount = TEST_RESULTS.length;

    // Group by gate for cleaner output
    const byGate = {};
    TEST_RESULTS.forEach(r => {
      if (!byGate[r.gate]) byGate[r.gate] = [];
      byGate[r.gate].push(r);
    });

    for (const [gate, results] of Object.entries(byGate)) {
      logWithFlush(`${CYAN}${gate}:${RESET}`);
      results.forEach(r => {
        const icon = r.status === 'PASS' ? `${GREEN}PASS${RESET}` :
                     (r.status === 'SKIPPED' ? `${YELLOW}SKIP${RESET}` : `${RED}FAIL${RESET}`);
        console.log(`  ${icon} ${r.name}`);
        if (r.details && r.status !== 'PASS') {
          logWithFlush(`      ${r.details}`);
        }
      });
      logWithFlush('');
    }

    logWithFlush(`------`);
    logWithFlush(`Total: ${totalCount} tests`);
    logWithFlush(`${GREEN}Passed: ${passCount}${RESET}`);
    logWithFlush(`${RED}Failed: ${failCount}${RESET}`);
    logWithFlush(`${YELLOW}Skipped: ${skipCount}${RESET}`);
    logWithFlush(`------\n`);

    // Write summary to file
    writeResultsSummary();

    // Exit with appropriate code
    if (failCount > 0) {
      logWithFlush(`${RED}FAIL - Some tests failed${RESET}`);
      process.exit(1);
    } else {
      logWithFlush(`${GREEN}PASS - All tests passed!${RESET}`);
      process.exit(0);
    }

  } catch (error) {
    logWithFlush(`\n${RED}FATAL ERROR:${RESET} ${error.message}`);
    logWithFlush(error.stack);
    process.exit(1);
  }
}

// Run tests
main();
