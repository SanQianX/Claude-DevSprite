/**
 * AI 审查队列严重性筛选 - UI 测试
 * 测试修复后的行为
 */

const { chromium } = require('playwright');

async function resetFilters(page) {
  // 重置状态筛选器为所有状态
  await page.selectOption('.filter-select:first-child', 'all');
  // 重置严重性筛选器为所有严重性
  await page.selectOption('.filter-select:nth-child(2)', 'all');
  await page.waitForTimeout(500);
}

async function testSeverityFilter(page) {
  console.log('=== 测试严重性筛选 ===');

  // 重置筛选器
  await resetFilters(page);

  // 测试 critical 筛选
  console.log('\n--- 测试 critical 筛选 ---');
  await page.selectOption('.filter-select:nth-child(2)', 'critical');
  await page.waitForTimeout(500);
  const criticalFilteredItems = await page.$$('.review-item');
  console.log(`选择 critical 后，显示的审查项: ${criticalFilteredItems.length}`);
  for (let i = 0; i < Math.min(3, criticalFilteredItems.length); i++) {
    const severityBadge = await criticalFilteredItems[i].$('.severity-badge');
    if (severityBadge) {
      const severity = await severityBadge.textContent();
      console.log(`  审查项 ${i + 1} 严重性: ${severity.trim()}`);
    }
  }

  // 测试 warning 筛选
  console.log('\n--- 测试 warning 筛选 ---');
  await page.selectOption('.filter-select:nth-child(2)', 'warning');
  await page.waitForTimeout(500);
  const warningFilteredItems = await page.$$('.review-item');
  console.log(`选择 warning 后，显示的审查项: ${warningFilteredItems.length}`);
  for (let i = 0; i < Math.min(3, warningFilteredItems.length); i++) {
    const severityBadge = await warningFilteredItems[i].$('.severity-badge');
    if (severityBadge) {
      const severity = await severityBadge.textContent();
      console.log(`  审查项 ${i + 1} 严重性: ${severity.trim()}`);
    }
  }

  // 重置筛选
  console.log('\n--- 测试重置筛选 ---');
  await resetFilters(page);
  const allItems = await page.$$('.review-item');
  console.log(`重置后，显示的审查项: ${allItems.length}`);
}

async function testApproveButton(page) {
  console.log('=== 测试 Approve 按钮 ===');

  // 确保从重置状态开始
  await resetFilters(page);

  // 找到第一个待审批的审查项
  const firstReviewItem = await page.$('.review-item');
  if (firstReviewItem) {
    const approveBtn = await firstReviewItem.$('.btn-approve');
    if (approveBtn) {
      console.log('找到批准按钮，点击...');
      const beforeCount = (await page.$$('.review-item')).length;
      console.log(`点击前审查项数量: ${beforeCount}`);

      await approveBtn.click();
      await page.waitForTimeout(1000);

      const afterCount = (await page.$$('.review-item')).length;
      console.log(`点击后审查项数量: ${afterCount}`);

      if (afterCount < beforeCount) {
        console.log('❌ Bug 确认: 审查项在批准后消失!');
      } else {
        console.log('✅ 修复有效: 审查项在批准后保留');
      }
    } else {
      console.log('未找到批准按钮');
    }
  } else {
    console.log('未找到审查项');
  }
}

async function testReviewCounts(page) {
  console.log('=== 测试统计数字 ===');
  const reviewCounts = await page.$('.review-counts');
  if (reviewCounts) {
    const countsText = await reviewCounts.textContent();
    console.log(`统计显示: ${countsText.trim()}`);
  } else {
    console.log('未找到统计数字区域');
  }
}

async function testResetButton(page) {
  console.log('=== 测试重置按钮 ===');

  // 先设置一个筛选状态
  await page.selectOption('.filter-select:first-child', 'pending');
  await page.waitForTimeout(500);

  const resetBtn = await page.$('.filter-reset-btn');
  console.log(`重置按钮存在: ${!!resetBtn}`);

  if (resetBtn) {
    await resetBtn.click();
    await page.waitForTimeout(500);
    console.log('点击重置按钮后，筛选已重置');
  }
}

async function testReviewFilter() {
  const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:38888';
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
    // 打开项目 Dashboard
    console.log('=== 打开 Dashboard ===');
    await page.goto(`${baseUrl}/project/Claude-DevSprite?tab=dashboard`);
    await page.waitForTimeout(2000);

    // 检查 AI 审查队列是否显示
    console.log('\n=== 检查审查队列 ===');
    const reviewSection = await page.$('.review-section');
    console.log(`审查队列区域存在: ${!!reviewSection}`);

    const reviewItems = await page.$$('.review-item');
    console.log(`审查项数量: ${reviewItems.length}`);

    // 运行各个独立测试
    await testSeverityFilter(page);
    await testApproveButton(page);
    await testReviewCounts(page);
    await testResetButton(page);

    // 截图保存
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
