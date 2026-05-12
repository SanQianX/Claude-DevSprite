/**
 * Knowledge Base (P2) - UI 测试
 * 测试: 文档列表 -> 查看文档 -> 文件树切换 -> 搜索
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';
const PROJECT = 'Claude-DevSprite';

(async () => {
  console.log('=== Knowledge Base UI Test ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  try {
    // Step 1: 打开 Workspace (Doc 面板)
    console.log('Step 1: 打开 Workspace Doc 面板');
    await page.goto(`${BASE_URL}/project/${PROJECT}?tab=workspace&panels=doc`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const workspace = await page.locator('.workspace-view').count();
    console.log('Workspace 存在:', workspace > 0);

    // Step 2: 检查文档面板
    console.log('\nStep 2: 检查文档面板');
    const docPanel = await page.locator('.doc-panel').count();
    console.log('文档面板存在:', docPanel > 0);

    // Step 3: 检查文档列表
    console.log('\nStep 3: 检查文档列表');
    const docItems = await page.locator('.doc-item').count();
    console.log('文档数量:', docItems);

    if (docItems > 0) {
      const firstDocName = await page.locator('.doc-name').first().textContent();
      console.log('第一个文档:', firstDocName.trim());

      // Step 4: 点击文档查看
      console.log('\nStep 4: 点击文档查看');
      await page.locator('.doc-item').first().click();
      await page.waitForTimeout(1000);

      const docViewer = await page.locator('.doc-viewer').count();
      console.log('文档查看器显示:', docViewer > 0);

      const docBody = await page.locator('.doc-body').count();
      console.log('文档内容显示:', docBody > 0);

      if (docBody > 0) {
        const contentLength = await page.locator('.doc-body').evaluate(el => el.textContent.length);
        console.log('文档内容长度:', contentLength);
      }

      // Step 5: 测试返回列表
      console.log('\nStep 5: 测试返回列表');
      const backBtn = page.locator('.doc-nav .back-btn');
      if (await backBtn.count() > 0) {
        await backBtn.click();
        await page.waitForTimeout(500);
        const docListAfter = await page.locator('.doc-list').count();
        console.log('返回后文档列表显示:', docListAfter > 0);
      }
    }

    // Step 6: 检查文件树侧边栏
    console.log('\nStep 6: 检查文件树侧边栏');
    const fileTreeSidebar = await page.locator('.file-tree-sidebar').count();
    console.log('文件树侧边栏存在:', fileTreeSidebar > 0);

    if (fileTreeSidebar > 0) {
      // 检查 tab 切换
      const sidebarTabs = await page.locator('.sidebar-tab').allTextContents();
      console.log('侧边栏 Tab:', sidebarTabs.map(t => t.trim()));

      // 点击知识库 tab
      const kbTab = page.locator('.sidebar-tab').filter({ hasText: '知识库' });
      if (await kbTab.count() > 0) {
        await kbTab.click();
        await page.waitForTimeout(500);
        const kbNodes = await page.locator('.node-row').count();
        console.log('知识库文件数:', kbNodes);
      }

      // 点击源码 tab
      const srcTab = page.locator('.sidebar-tab').filter({ hasText: '源码' });
      if (await srcTab.count() > 0) {
        await srcTab.click();
        await page.waitForTimeout(500);
        const srcNodes = await page.locator('.node-row').count();
        console.log('源码文件数:', srcNodes);
      }

      // Step 7: 测试目录展开/折叠
      console.log('\nStep 7: 测试目录展开/折叠');
      const dirArrow = page.locator('.node-arrow').first();
      if (await dirArrow.count() > 0) {
        const arrowBefore = await dirArrow.evaluate(el => el.className);
        await dirArrow.click();
        await page.waitForTimeout(300);
        const arrowAfter = await dirArrow.evaluate(el => el.className);
        console.log('箭头状态变化:', arrowBefore !== arrowAfter);
      }
    }

    // Step 8: 搜索测试
    console.log('\nStep 8: 搜索测试');
    const searchInput = page.locator('.search-input, input[placeholder*="搜索"], input[placeholder*="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');
      await page.waitForTimeout(1000);
      console.log('搜索已触发');
    } else {
      console.log('搜索框不存在 (可能在 Header 中)');
    }

    // Step 9: 控制台错误
    console.log('\nStep 9: 控制台错误');
    const coreErrors = errors.filter(e => !e.includes('WebSocket') && !e.includes('Failed to fetch') && !e.includes('404'));
    console.log('核心错误:', coreErrors.length);
    coreErrors.slice(0, 3).forEach(e => console.log('  -', e.substring(0, 120)));

    await page.screenshot({ path: 'test-knowledge-result.png', fullPage: true });
    console.log('\n截图已保存');

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
