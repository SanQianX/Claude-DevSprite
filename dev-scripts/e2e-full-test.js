// e2e-full-test.js - 完整端到端验证脚本
// 用法: node dev-scripts/e2e-full-test.js

const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:38888';
const RESULTS = [];
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function check(name, fn) {
  try {
    await fn();
    RESULTS.push({ name, status: 'PASS', error: null });
    console.log(`  PASS ${name}`);
  } catch (e) {
    RESULTS.push({ name, status: 'FAIL', error: e.message });
    console.log(`  FAIL ${name}: ${e.message}`);
  }
}

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function httpPost(urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
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
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
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

(async () => {
  console.log('=== Claude-DevSprite 端到端验证 ===\n');
  console.log(`时间: ${new Date().toISOString()}\n`);

  // ==========================================
  // 门禁1: 后端启动验证
  // ==========================================
  console.log('--- 门禁1: 后端启动验证 ---');

  await check('1.1 Health Check', async () => {
    const res = await httpGet('/api/health');
    if (res.status !== 'ok') throw new Error('Health check 返回异常');
  });

  // ==========================================
  // 门禁2: API 功能验证
  // ==========================================
  console.log('\n--- 门禁2: API 功能验证 ---');

  let projectName = null;

  await check('2.1 GET /api/projects', async () => {
    const res = await httpGet('/api/projects');
    if (!res.projects || !Array.isArray(res.projects)) {
      throw new Error('projects 字段缺失或格式错误');
    }
    if (res.projects.length === 0) {
      throw new Error('没有发现任何项目');
    }
    projectName = res.projects[0].name;
    console.log(`     发现项目: ${projectName}`);
  });

  await check('2.2 GET /api/projects/:name/tree', async () => {
    if (!projectName) throw new Error('无项目名，跳过');
    const res = await httpGet(`/api/projects/${projectName}/tree`);
    if (!res.tree) throw new Error('tree 字段缺失');
  });

  await check('2.3 GET /api/projects/:name/file', async () => {
    if (!projectName) throw new Error('无项目名，跳过');
    const treeRes = await httpGet(`/api/projects/${projectName}/tree`);

    function findFirstMd(nodes) {
      for (const node of nodes) {
        if (node.type === 'file' && node.path.endsWith('.md')) return node.path;
        if (node.children) {
          const found = findFirstMd(node.children);
          if (found) return found;
        }
      }
      return null;
    }

    const mdPath = findFirstMd(treeRes.tree);
    if (!mdPath) {
      console.log('      Warning: 没有 .md 文件，跳过此检查');
      return;
    }

    const res = await httpGet(`/api/projects/${projectName}/file?path=${encodeURIComponent(mdPath)}`);
    if (!res.content) throw new Error('content 字段缺失');
  });

  await check('2.4 GET /api/projects/:name/search', async () => {
    if (!projectName) throw new Error('无项目名，跳过');
    const res = await httpGet(`/api/projects/${projectName}/search?q=test`);
    if (!res.results) throw new Error('results 字段缺失');
  });

  // ==========================================
  // 门禁3: Git 检测验证
  // ==========================================
  console.log('\n--- 门禁3: Git 检测验证 ---');

  await check('3.1 Git detector status', async () => {
    const res = await httpGet('/api/git/status');
    if (!res.isRunning) throw new Error('Git detector not running');
    if (!res.activeDetector) throw new Error('No active detector');
  });

  // ==========================================
  // 门禁4: AI 分析验证
  // ==========================================
  console.log('\n--- 门禁4: AI 分析验证 ---');

  await check('4.1 POST /api/projects/:name/analyze', async () => {
    if (!projectName) throw new Error('无项目名，跳过');
    const res = await httpPost(`/api/projects/${projectName}/analyze`, { mode: 'incremental' });
    if (res.status !== 'completed' && res.status !== 'queued') {
      throw new Error(`分析状态异常: ${res.status}`);
    }
  });

  // ==========================================
  // 门禁5: 前端构建验证
  // ==========================================
  console.log('\n--- 门禁5: 前端构建验证 ---');

  await check('5.1 web/dist/index.html exists', async () => {
    const distPath = path.join(__dirname, '..', 'web', 'dist', 'index.html');
    if (!fs.existsSync(distPath)) {
      throw new Error('web/dist/index.html 不存在');
    }
  });

  await check('5.2 Frontend served via backend', async () => {
    const res = await httpGet('/');
    if (typeof res !== 'string' || !res.includes('<!DOCTYPE html>')) {
      throw new Error('前端页面未正确提供');
    }
  });

  // ==========================================
  // 门禁6: 端到端联动验证（HTTP 级别）
  // ==========================================
  console.log('\n--- 门禁6: 端到端联动验证 ---');

  await check('6.1 首页返回HTML', async () => {
    const res = await httpGet('/');
    if (typeof res !== 'string') throw new Error('首页未返回HTML');
    if (!res.includes('<div')) throw new Error('首页内容异常');
  });

  await check('6.2 项目API数据完整', async () => {
    const projects = await httpGet('/api/projects');
    const project = projects.projects[0];

    // 获取树
    const tree = await httpGet(`/api/projects/${project.name}/tree`);
    if (!tree.tree || tree.tree.length === 0) throw new Error('文件树为空');

    // 获取文件内容
    function findFirstMd(nodes) {
      for (const node of nodes) {
        if (node.type === 'file' && node.path.endsWith('.md')) return node.path;
        if (node.children) {
          const found = findFirstMd(node.children);
          if (found) return found;
        }
      }
      return null;
    }

    const mdPath = findFirstMd(tree.tree);
    if (!mdPath) throw new Error('未找到markdown文件');

    const file = await httpGet(`/api/projects/${project.name}/file?path=${encodeURIComponent(mdPath)}`);
    if (!file.content) throw new Error('文件内容为空');

    // 搜索
    const search = await httpGet(`/api/projects/${project.name}/search?q=test`);
    if (!search.results) throw new Error('搜索结果缺失');
  });

  await check('6.3 源码查看', async () => {
    // Find a source file in the project (e.g., package.json or any .ts file)
    const res = await httpGet(`/api/projects/${projectName}/source?path=package.json&start=1&end=5`);
    if (!res.content) throw new Error('源码内容为空');
  });

  // ==========================================
  // 输出结果汇总
  // ==========================================
  console.log('\n========================================');
  console.log('           验证结果汇总');
  console.log('========================================\n');

  const passCount = RESULTS.filter(r => r.status === 'PASS').length;
  const failCount = RESULTS.filter(r => r.status === 'FAIL').length;
  const totalCount = RESULTS.length;

  RESULTS.forEach(r => {
    const icon = r.status === 'PASS' ? 'PASS' : 'FAIL';
    console.log(`${icon} ${r.name}`);
    if (r.error) console.log(`   -> ${r.error}`);
  });

  console.log(`\n------`);
  console.log(`通过: ${passCount}/${totalCount}`);
  console.log(`失败: ${failCount}/${totalCount}`);
  console.log(`------\n`);

  // Write report
  const reportDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: { pass: passCount, fail: failCount, total: totalCount },
    results: RESULTS,
  };

  fs.writeFileSync(
    path.join(reportDir, 'loop3.json'),
    JSON.stringify(report, null, 2)
  );

  if (failCount > 0) {
    console.log('FAIL - 存在未通过项目，Ralph Loop 继续迭代');
    process.exit(1);
  } else {
    console.log('PASS - 所有检查通过！');
    process.exit(0);
  }
})().catch(e => {
  console.error('\nTest script error:', e.message);
  process.exit(1);
});
