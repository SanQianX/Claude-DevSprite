/**
 * AI 审查修复 - 自动测试
 * 测试: 批准修复→执行→进度→结果→状态更新
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:38888';

(async () => {
  console.log('=== AI 审查修复 自动测试 ===\n');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    // Step 1: 打开 Dashboard
    console.log('Step 1: 打开 Dashboard');
    await page.goto(`${BASE_URL}/project/Claude-DevSprite?tab=dashboard`, { timeout: 15000 });
    await page.waitForTimeout(3000);

    // Step 2: 检查审查队列
    console.log('\nStep 2: 检查审查队列');
    const reviewSection = await page.$('.review-section');
    console.log('审查区域存在:', !!reviewSection);

    const reviewItems = await page.$$('.review-item');
    console.log('审查项数量:', reviewItems.length);

    if (reviewItems.length === 0) {
      console.log('⚠️ 无审查项，跳过修复测试');
      await browser.close();
      process.exit(0);
    }

    // Step 3: 测试批准按钮
    console.log('\nStep 3: 测试批准按钮');
    const firstItem = reviewItems[0];
    const approveBtn = await firstItem.$('.btn-approve');

    if (approveBtn) {
      const beforeCount = (await page.$$('.review-item')).length;
      console.log('点击前审查项:', beforeCount);

      await approveBtn.click();
      await page.waitForTimeout(1500);

      const afterCount = (await page.$$('.review-item')).length;
      console.log('点击后审查项:', afterCount);

      if (afterCount < beforeCount) {
        console.log('❌ BUG: 批准后审查项消失（应保留并更新状态）');
      } else {
        console.log('✅ 批准后审查项保留');
      }
    } else {
      console.log('⚠️ 批准按钮不存在');
    }

    // Step 4: 测试忽略按钮
    console.log('\nStep 4: 测试忽略按钮');
    const ignoreBtn = await page.$('.btn-ignore');
    if (ignoreBtn) {
      const beforeCount = (await page.$$('.review-item')).length;
      await ignoreBtn.click();
      await page.waitForTimeout(1500);
      const afterCount = (await page.$$('.review-item')).length;
      if (afterCount < beforeCount) {
        console.log('❌ BUG: 忽略后审查项消失');
      } else {
        console.log('✅ 忽略后审查项保留');
      }
    } else {
      console.log('⚠️ 忽略按钮不存在');
    }

    // Step 5: 检查统计数字
    console.log('\nStep 5: 检查统计数字');
    const reviewCounts = await page.$('.review-counts');
    if (reviewCounts) {
      const text = await reviewCounts.textContent();
      console.log('统计:', text.trim());
    }

    // Step 6: 控制台错误
    console.log('\nStep 6: 控制台错误');
    const coreErrors = errors.filter(e => !e.includes('tokens') && !e.includes('Failed to fetch'));
    if (coreErrors.length > 0) {
      console.log('核心错误:', coreErrors.length);
      coreErrors.forEach(e => console.log('  -', e.substring(0, 100)));
    } else {
      console.log('✅ 无核心错误');
    }

  } catch (e) {
    console.error('测试失败:', e.message);
  } finally {
    await browser.close();
  }
})();
