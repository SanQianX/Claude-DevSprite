/**
 * 知识库浏览 - 自动测试
 * 测试: 文档列表→查看→搜索
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';

async function main() {
  console.log('=== 知识库浏览 自动测试 ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // Step 1: 打开 Workspace
    console.log('Step 1: 打开 Workspace');
    await page.goto(`${BASE_URL}/project/Claude-DevSprite?tab=workspace&panels=doc`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const workspaceView = await page.$('.workspace-view');
    console.log('Workspace 存在:', !!workspaceView);

    // Step 2: 检查文档面板
    console.log('\nStep 2: 检查文档面板');
    const docPanel = await page.$('.doc-panel, [class*="doc-panel"]');
    console.log('文档面板存在:', !!docPanel);

    // Step 3: 测试知识库文件树 API (正确的端点是 /tree)
    console.log('\nStep 3: 测试知识库文件树 API');
    const kbRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/tree');
        const data = await res.json();
        return { status: res.status, count: data.tree ? data.tree.length : 0, hasTree: Boolean(data.tree) };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('知识库文件树 API:', kbRes);

    // Step 4: 测试源码文件树 API (正确的端点是 /source-tree)
    console.log('\nStep 4: 测试源码文件树 API');
    const treeRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/projects/Claude-DevSprite/source-tree');
        const data = await res.json();
        return { status: res.status, hasData: Boolean(data.tree) };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('源码文件树 API:', treeRes);

    // Step 5: 测试搜索
    console.log('\nStep 5: 测试搜索');
    const searchRes = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/search?q=test&project=Claude-DevSprite');
        const data = await res.json();
        // 改进: 明确检查响应结构，增加验证使意图更明确
        let count = 0;
        if (Array.isArray(data)) {
          count = data.length;
        } else if (data && data.results && Array.isArray(data.results)) {
          count = data.results.length;
        }
        return { status: res.status, count: count, isArray: Array.isArray(data), hasResults: !!(data && data.results) };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('搜索 API:', searchRes);

    // Step 6: 控制台错误
    console.log('\nStep 6: 控制台错误');
    const coreErrors = errors.filter(e => {
      const lowerE = e.toLowerCase();
      // 排除常见无关错误，使过滤更精确
      return !lowerE.includes('token') && 
             !lowerE.includes('fetch') && 
             !lowerE.includes('network') && 
             !lowerE.includes('timeout') && 
             !lowerE.includes('cors');
    });
    if (coreErrors.length > 0) {
      console.log('核心错误:', coreErrors.length);
      coreErrors.slice(0, 5).forEach(e => console.log('  -', e.substring(0, 100)));
    } else {
      console.log('✅ 无核心错误');
    }

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
}

main().catch(e => {
  console.error('测试脚本意外崩溃:', e.message);
  process.exit(1);
});
