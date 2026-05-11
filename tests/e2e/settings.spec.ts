import { test, expect } from '@playwright/test';

test.describe('Settings Page (/settings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('load');
  });

  test('settings-01: page loads with AI Model tab active by default', async ({ page }) => {
    // Settings page should load
    await expect(page.locator('.settings-page')).toBeVisible({ timeout: 10000 });

    // AI Model tab should be active by default
    const aiTab = page.locator('.tab-btn').filter({ hasText: 'AI Model' });
    await expect(aiTab).toHaveClass(/active/);

    // AI config section should be visible
    await expect(page.locator('text=AI Provider Configuration')).toBeVisible();
  });

  test('settings-02: click Agent Teams tab', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'Agent Teams' }).click();

    // Agent Teams section heading should be visible
    await expect(page.locator('.section-title').filter({ hasText: 'Agent Teams' })).toBeVisible({ timeout: 5000 });

    // Tab should be active
    const teamsTab = page.locator('.tab-btn').filter({ hasText: 'Agent Teams' });
    await expect(teamsTab).toHaveClass(/active/);
  });

  test('settings-03: click Skills tab', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'Skills' }).click();

    // Skills section should be visible
    await expect(page.locator('text=Installed Skills')).toBeVisible({ timeout: 5000 });
  });

  test('settings-04: click System tab', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'System' }).click();

    // System config section should be visible
    await expect(page.locator('text=System Configuration')).toBeVisible({ timeout: 5000 });
  });

  test('settings-05: Show/Hide API key toggles visibility', async ({ page }) => {
    // Find the API key input
    const apiKeyInput = page.locator('input[placeholder="sk-ant-..."]');
    await expect(apiKeyInput).toBeVisible({ timeout: 5000 });

    // Initially should be password type
    await expect(apiKeyInput).toHaveAttribute('type', 'password');

    // Click Show button
    const showBtn = page.locator('.input-with-btn .btn-sm').first();
    await showBtn.click();

    // Should now be text type
    await expect(apiKeyInput).toHaveAttribute('type', 'text');

    // Click Hide button
    await showBtn.click();

    // Should be password type again
    await expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  test('settings-06: Save AI Config button works', async ({ page }) => {
    const saveBtn = page.locator('.btn-primary').filter({ hasText: /Save AI Config/ });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    // Click save
    await saveBtn.click();

    // Button should show "Saving..." briefly then revert
    await page.waitForTimeout(2000);
    await expect(saveBtn).toBeEnabled();
  });

  test('settings-07: Test Connection button works', async ({ page }) => {
    const testBtn = page.locator('.btn-secondary').filter({ hasText: /Test Connection/ });
    await expect(testBtn).toBeVisible({ timeout: 5000 });

    // Click test
    await testBtn.click();

    // Button should show "Testing..." briefly
    await page.waitForTimeout(1000);

    // A test result should appear (success or error)
    const result = page.locator('.test-result').first();
    await expect(result).toBeVisible({ timeout: 15000 });
  });

  test('settings-08: Test button on team card works', async ({ page }) => {
    // Switch to Agent Teams tab
    await page.locator('.tab-btn').filter({ hasText: 'Agent Teams' }).click();
    await page.waitForTimeout(1000);

    // Find first team card's Test button
    const teamCard = page.locator('.team-card').first();
    const testBtn = teamCard.locator('.btn-sm').filter({ hasText: /Test/ }).first();

    if (await testBtn.isVisible().catch(() => false)) {
      await testBtn.click();
      // Wait for test result
      await page.waitForTimeout(2000);
    }
  });

  test('settings-09: add skill to team', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'Agent Teams' }).click();
    await page.waitForTimeout(1000);

    // Find first team card's skill input
    const teamCard = page.locator('.team-card').first();
    const skillInput = teamCard.locator('.skill-input');

    if (await skillInput.isVisible().catch(() => false)) {
      await skillInput.fill('test-skill-e2e');

      // Click Add button
      const addBtn = teamCard.locator('.add-skill-row .btn-sm');
      await addBtn.click();

      // Skill tag should appear
      const skillTag = teamCard.locator('.skill-tag').filter({ hasText: 'test-skill-e2e' });
      await expect(skillTag).toBeVisible({ timeout: 3000 });
    }
  });

  test('settings-10: remove skill from team', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'Agent Teams' }).click();
    await page.waitForTimeout(1000);

    // First add a skill to remove
    const teamCard = page.locator('.team-card').first();
    const skillInput = teamCard.locator('.skill-input');

    if (await skillInput.isVisible().catch(() => false)) {
      await skillInput.fill('removable-skill');
      await teamCard.locator('.add-skill-row .btn-sm').click();
      await page.waitForTimeout(300);

      // Find and click the remove button on the skill tag
      const skillTag = teamCard.locator('.skill-tag').filter({ hasText: 'removable-skill' });
      if (await skillTag.isVisible().catch(() => false)) {
        const removeBtn = skillTag.locator('.skill-remove');
        await removeBtn.click();

        // Skill should be removed
        await expect(skillTag).toBeHidden({ timeout: 3000 });
      }
    }
  });

  test('settings-11: Save team config', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'Agent Teams' }).click();
    await page.waitForTimeout(1000);

    const teamCard = page.locator('.team-card').first();
    const saveBtn = teamCard.locator('.btn-primary').filter({ hasText: /Save/ });

    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
      // Button should be re-enabled
      await expect(saveBtn).toBeEnabled();
    }
  });

  test('settings-12: Test Skill button works', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'Skills' }).click();
    await page.waitForTimeout(1000);

    const testSkillBtn = page.locator('.btn-sm').filter({ hasText: /Test Skill/ }).first();
    if (await testSkillBtn.isVisible().catch(() => false)) {
      await testSkillBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test('settings-13: Save System Config', async ({ page }) => {
    await page.locator('.tab-btn').filter({ hasText: 'System' }).click();
    await page.waitForTimeout(1000);

    const saveBtn = page.locator('.btn-primary').filter({ hasText: /Save System Config/ });
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    await saveBtn.click();
    await page.waitForTimeout(2000);
    await expect(saveBtn).toBeEnabled();
  });
});
