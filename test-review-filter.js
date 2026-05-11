/**
 * AI 审查队列严重性筛选 - UI 测试
 * 测试修复前的行为
 */

const { chromium } = require('playwright');

async function testReviewFilter() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 监听控制台输出
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Console Error] ${msg.text()}`);
    }
  });

  try {
    // 1. 打开项目 Dashboard
    console.log('=== Step 1: 打开 Dashboard ===');
    await page.goto('http://127.0.0.1:38888/project/Claude-DevSprite?tab=dashboard');
    await page.waitForTimeout(2000);

    // 2. 检查 AI 审查队列是否显示
    console.log('\n=== Step 2: 检查审查队列 ===');
    const reviewSection = await page.$('.review-section');
    console.log(`审查队列区域存在: ${!!reviewSection}`);

    // 3. 获取审查项数量
    const reviewItems = await page.$$('.review-item');
    console.log(`审查项数量: ${reviewItems.length}`);

    // 4. 检查筛选器
    console.log('\n=== Step 3: 检查筛选器 ===');
    const statusFilter = await page.$('.filter-select:first-child');
    const severityFilter = await page.$('.filter-select:nth-child(2)');
    console.log(`状态筛选器存在: ${!!statusFilter}`);
    console.log(`严重性筛选器存在: ${!!severityFilter}`);

    // 5. 测试严重性筛选
    console.log('\n=== Step 4: 测试严重性筛选 ===');

    // 选择 critical 筛选
    await page.selectOption('.filter-select:nth-child(2)', 'critical');
    await page.waitForTimeout(500);

    const criticalFilteredItems = await page.$$('.review-item');
    console.log(`选择 critical 后，显示的审查项: ${criticalFilteredItems.length}`);

    // 检查每个审查项的严重性
    for (let i = 0; i < Math.min(3, criticalFilteredItems.length); i++) {
      const severityBadge = await criticalFilteredItems[i].$('.severity-badge');
      if (severityBadge) {
        const severity = await severityBadge.textContent();
        console.log(`  审查项 ${i + 1} 严重性: ${severity.trim()}`);
      }
    }

    // 测试 warning 筛选
    await page.selectOption('.filter-select:nth-child(2)', 'warning');
    await page.waitForTimeout(500);

    const warningFilteredItems = await page.$$('.review-item');
    console.log(`选择 warning 后，显示的审查项: ${warningFilteredItems.length}`);

    // 重置筛选
    await page.selectOption('.filter-select:nth-child(2)', 'all');
    await page.waitForTimeout(500);

    const allItems = await page.$$('.review-item');
    console.log(`重置后，显示的审查项: ${allItems.length}`);

    // 6. 测试 Approve 按钮
    console.log('\n=== Step 5: 测试 Approve 按钮 ===');

    // 找到第一个待审批的审查项
    const firstReviewItem = await page.$('.review-item');
    if (firstReviewItem) {
      const approveBtn = await firstReviewItem.$('.btn-approve');
      if (approveBtn) {
        console.log('找到批准按钮，点击...');

        // 记录点击前的数量
        const beforeCount = (await page.$$('.review-item')).length;
        console.log(`点击前审查项数量: ${beforeCount}`);

        // 点击批准按钮
        await approveBtn.click();
        await page.waitForTimeout(1000);

        // 记录点击后的数量
        const afterCount = (await page.$$('.review-item')).length;
        console.log(`点击后审查项数量: ${afterCount}`);

        if (afterCount < beforeCount) {
          console.log('❌ Bug 确认: 审查项在批准后消失!');
        } else {
          console.log('✅ 修复有效: 审查项在批准后保留');
        }
      }
    }

    // 7. 测试统计数字
    console.log('\n=== Step 6: 检查统计数字 ===');
    const reviewCounts = await page.$('.review-counts');
    if (reviewCounts) {
      const countsText = await reviewCounts.textContent();
      console.log(`统计显示: ${countsText.trim()}`);
    }

    // 8. 测试重置按钮
    console.log('\n=== Step 7: 测试重置按钮 ===');
    await page.selectOption('.filter-select:first-child', 'pending');
    await page.waitForTimeout(500);

    const resetBtn = await page.$('.filter-reset-btn');
    console.log(`重置按钮存在: ${!!resetBtn}`);

    if (resetBtn) {
      await resetBtn.click();
      await page.waitForTimeout(500);
      console.log('点击重置按钮后，筛选已重置');
    }

    // 9. 截图保存
    await page.screenshot({ path: 'test-review-filter-result.png', fullPage: true });
    console.log('\n=== 截图已保存 ===');

  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    await browser.close();
  }
}

// 运行测试
testReviewFilter().catch(console.error);
