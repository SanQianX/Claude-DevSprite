import { test, expect } from '@playwright/test';

// Constants for skill names to reduce text coupling in selectors
const SKILL_TEST_E2E = 'test-skill-e2e';
const SKILL_REMOVABLE = 'removable-skill';
const SKILL_SAVE = 'save-test-skill';

test.describe('Settings Page (/settings)', () => {
  // Helper function: Switch to Agent Teams tab
  async function switchToAgentTeamsTab(page: any) {
    await page.getByTestId('tab-agent-teams').click();
    // Wait for the Agent Teams section heading to become visible, indicating the tab has switched.
    await expect(page.getByTestId('heading-agent-teams')).toBeVisible({ timeout: 5000 });
  }

  // Helper function: Switch to Skills tab
  async function switchToSkillsTab(page: any) {
    await page.getByTestId('tab-skills').click();
    await expect(page.getByTestId('section-installed-skills')).toBeVisible({ timeout: 5000 });
  }

  // Helper function: Switch to System tab
  async function switchToSystemTab(page: any) {
    await page.getByTestId('tab-system').click();
    await expect(page.getByTestId('section-system-config')).toBeVisible({ timeout: 5000 });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('load');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: Ensure test skills are removed from the first team card.
    // This cleanup is defensive: if the required elements are absent (e.g., no teams exist),
    // we log a warning but do not fail the test. This is acceptable because cleanup failures
    // should not mask the actual test result.
    try {
      // Navigate to Agent Teams tab using helper function
      await switchToAgentTeamsTab(page);

      const teamCard = page.getByTestId('team-card').first();
      // Attempt to wait for team card visibility, but continue if it doesn't appear
      await teamCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

      // Remove test skills using constants to reduce text coupling
      const skillsToRemove = [SKILL_TEST_E2E, SKILL_REMOVABLE, SKILL_SAVE];
      for (const skillText of skillsToRemove) {
        const skillTag = teamCard.getByTestId('skill-tag').filter({ hasText: skillText });
        const removeBtn = skillTag.getByTestId('skill-remove');
        // Attempt to click remove button; if element doesn't exist, ignore error
        await removeBtn.click().catch(() => {});
        // Instead of a fixed timeout, wait for the skill tag to become hidden deterministically
        await expect(skillTag).toBeHidden({ timeout: 3000 }).catch(() => {});
      }
    } catch (error) {
      // If cleanup fails, log but don't fail the test
      console.warn('Cleanup failed:', error);
    }
  });

  test('settings-01: page loads with AI Model tab active by default', async ({ page }) => {
    // Settings page should load
    await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 10000 });

    // AI Model tab should be active by default
    const aiTab = page.getByTestId('tab-ai-model');
    await expect(aiTab).toHaveClass(/active/);

    // AI config section should be visible
    await expect(page.getByTestId('section-ai-provider-config')).toBeVisible();
  });

  test('settings-02: click Agent Teams tab', async ({ page }) => {
    await page.getByTestId('tab-agent-teams').click();

    // Agent Teams section heading should be visible
    await expect(page.getByTestId('heading-agent-teams')).toBeVisible({ timeout: 5000 });

    // Tab should be active
    const teamsTab = page.getByTestId('tab-agent-teams');
    await expect(teamsTab).toHaveClass(/active/);
  });

  test('settings-03: click Skills tab', async ({ page }) => {
    await page.getByTestId('tab-skills').click();

    // Skills section should be visible
    await expect(page.getByTestId('section-installed-skills')).toBeVisible({ timeout: 5000 });
  });

  test('settings-04: click System tab', async ({ page }) => {
    await page.getByTestId('tab-system').click();

    // System config section should be visible
    await expect(page.getByTestId('section-system-config')).toBeVisible({ timeout: 5000 });
  });

  test('settings-05: Show/Hide API key toggles visibility', async ({ page }) => {
    // Find the API key input
    const apiKeyInput = page.getByTestId('api-key-input');
    await expect(apiKeyInput).toBeVisible({ timeout: 5000 });

    // Get the initial type to avoid assuming it's 'password'
    const initialType = await apiKeyInput.getAttribute('type');

    // Click Show/Hide button (assuming it toggles visibility)
    const toggleBtn = page.locator('[data-testid="input-with-btn"] button').first();
    await toggleBtn.click();

    // Should now be the opposite type
    const expectedTypeAfterToggle = initialType === 'password' ? 'text' : 'password';
    await expect(apiKeyInput).toHaveAttribute('type', expectedTypeAfterToggle);

    // Click the button again to toggle back
    await toggleBtn.click();

    // Should be back to initial type
    await expect(apiKeyInput).toHaveAttribute('type', initialType);
  });

  test('settings-06: Save AI Config button works', async ({ page }) => {
    const saveBtn = page.getByTestId('btn-save-ai-config');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    // Click save
    await saveBtn.click();

    // Wait for the save operation to complete by checking the button's state.
    await expect(saveBtn).toBeEnabled({ timeout: 10000 });
    await expect(saveBtn).toHaveText('Save AI Config', { timeout: 5000 });

    // Verify save operation was successful by checking for success feedback.
    // Assert that a success toast is visible.
    const successToast = page.getByTestId('toast-success');
    await expect(successToast).toBeVisible({ timeout: 5000 });
    // Ensure no error toast is visible.
    const errorToast = page.getByTestId('toast-error');
    await expect(errorToast).toBeHidden({ timeout: 2000 });
  });

  test('settings-07: Test Connection button works', async ({ page }) => {
    const testBtn = page.getByTestId('btn-test-connection');
    await expect(testBtn).toBeVisible({ timeout: 5000 });

    // Click test
    await testBtn.click();

    // Wait for the test result element to appear
    const result = page.getByTestId('test-connection-result');
    await expect(result).toBeVisible({ timeout: 15000 });
    
    // Verify the result contains specific success text to ensure connection was successful
    await expect(result).toContainText('Connection successful');
  });

  test('settings-08: clicking test button on team card triggers connection test', async ({ page }) => {
    // Switch to Agent Teams tab using helper function
    await switchToAgentTeamsTab(page);

    // Assert that a team card exists; if not, the test will fail.
    const teamCard = page.getByTestId('team-card').first();
    await expect(teamCard).toBeVisible({ timeout: 2000 });

    // Find first team card's Test button
    const testBtn = teamCard.getByTestId('btn-test-team');
    await expect(testBtn).toBeVisible({ timeout: 5000 }); // Assert Test button exists

    await testBtn.click();
    // Wait for test to complete by waiting for the button to be re-enabled.
    // Assumes the button becomes disabled during testing and re-enabled upon completion.
    await expect(testBtn).toBeEnabled({ timeout: 10000 });

    // Assert test result element appears with success indication.
    // This follows the pattern from settings-07 (Test Connection button).
    const result = page.getByTestId('test-team-result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText('Test successful');
  });

  test('settings-09: add skill to team', async ({ page }) => {
    await switchToAgentTeamsTab(page);

    // Assert that a team card exists; if not, the test will fail.
    const teamCard = page.getByTestId('team-card').first();
    await expect(teamCard).toBeVisible({ timeout: 2000 });

    // Find first team card's skill input
    const skillInput = teamCard.getByTestId('skill-input');
    await expect(skillInput).toBeVisible({ timeout: 5000 }); // Assert skill input exists

    await skillInput.fill(SKILL_TEST_E2E);

    // Click Add button
    const addBtn = teamCard.locator('[data-testid="add-skill-row"] [data-testid="btn-add-skill"]');
    await addBtn.click();

    // Skill tag should appear
    const skillTag = teamCard.getByTestId('skill-tag').filter({ hasText: SKILL_TEST_E2E });
    await expect(skillTag).toBeVisible({ timeout: 3000 });

    // Verify input is cleared after adding the skill
    await expect(skillInput).toHaveValue('');
  });

  test('settings-10: remove skill from team', async ({ page }) => {
    await switchToAgentTeamsTab(page);

    // Assert that a team card exists; if not, the test will fail.
    const teamCard = page.getByTestId('team-card').first();
    await expect(teamCard).toBeVisible({ timeout: 2000 });

    // First add a skill to remove
    const skillInput = teamCard.getByTestId('skill-input');
    await expect(skillInput).toBeVisible({ timeout: 5000 }); // Assert skill input exists

    await skillInput.fill(SKILL_REMOVABLE);
    await teamCard.locator('[data-testid="add-skill-row"] [data-testid="btn-add-skill"]').click();
    // Wait for skill tag to appear deterministically
    const skillTag = teamCard.getByTestId('skill-tag').filter({ hasText: SKILL_REMOVABLE });
    await expect(skillTag).toBeVisible({ timeout: 5000 }); // Assert skill tag exists

    // Find and click the remove button on the skill tag
    const removeBtn = skillTag.getByTestId('skill-remove');
    await removeBtn.click();

    // Skill should be removed
    await expect(skillTag).toBeHidden({ timeout: 3000 });
  });

  test('settings-11: Save team config', async ({ page }) => {
    await switchToAgentTeamsTab(page);

    // Assert that a team card exists; if not, the test will fail.
    const teamCard = page.getByTestId('team-card').first();
    await expect(teamCard).toBeVisible({ timeout: 2000 });

    // Modify a config: add a skill to test saving
    const skillInput = teamCard.getByTestId('skill-input');
    await expect(skillInput).toBeVisible({ timeout: 5000 }); // Assert skill input exists
    await skillInput.fill(SKILL_SAVE);
    const addBtn = teamCard.locator('[data-testid="add-skill-row"] [data-testid="btn-add-skill"]');
    await addBtn.click();
    // Wait for skill tag to appear
    const skillTag = teamCard.getByTestId('skill-tag').filter({ hasText: SKILL_SAVE });
    await expect(skillTag).toBeVisible({ timeout: 3000 });

    // Now save the config
    const saveBtn = teamCard.getByTestId('btn-save-team');
    await expect(saveBtn).toBeVisible({ timeout: 5000 }); // Assert save button exists
    await saveBtn.click();

    // Button should be re-enabled after saving
    await expect(saveBtn).toBeEnabled();

    // Verify the skill is still present after save, indicating successful save
    await expect(skillTag).toBeVisible({ timeout: 5000 });
  });

  test('settings-12: clicking test skill button initiates skill verification', async ({ page }) => {
    await switchToSkillsTab(page);

    const testSkillBtn = page.getByTestId('btn-test-skill');
    await expect(testSkillBtn).toBeVisible({ timeout: 5000 }); // Assert Test Skill button exists

    await testSkillBtn.click();
    // Wait for test to complete by waiting for the button to be re-enabled.
    // Assumes the button becomes disabled during testing and re-enabled upon completion.
    await expect(testSkillBtn).toBeEnabled({ timeout: 10000 });

    // Assert test result element appears with success indication.
    // This follows the pattern from settings-07 (Test Connection button).
    const result = page.getByTestId('test-skill-result');
    await expect(result).toBeVisible({ timeout: 5000 });
    await expect(result).toContainText('Test successful');
  });

  test('settings-13: Save System Config', async ({ page }) => {
    await switchToSystemTab(page);

    const saveBtn = page.getByTestId('btn-save-system-config');
    await expect(saveBtn).toBeVisible({ timeout: 5000 });

    await saveBtn.click();
    // Wait for the save operation to complete by checking the button's state.
    await expect(saveBtn).toBeEnabled({ timeout: 10000 });
    await expect(saveBtn).toHaveText('Save System Config', { timeout: 5000 });

    // Verify save operation was successful by checking for success feedback.
    const successToast = page.getByTestId('toast-success');
    await expect(successToast).toBeVisible({ timeout: 5000 });
    // Ensure no error toast is visible.
    const errorToast = page.getByTestId('toast-error');
    await expect(errorToast).toBeHidden({ timeout: 2000 });
  });
});
