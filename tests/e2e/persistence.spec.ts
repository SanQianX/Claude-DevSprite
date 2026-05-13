import { test, expect } from '@playwright/test';

test.describe('Session Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('load');
  });

  test('persist-01: session persists after page reload', async ({ page }) => {
    // Wait for session sidebar to be ready
    const sidebar = page.locator('.session-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Create a new session with unique title
    const uniqueTitle = `Persist Test ${Date.now()}`;
    await page.locator('.new-session-btn').click();
    const dialog = page.locator('.dialog-overlay');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.locator('#session-title').fill(uniqueTitle);
    await page.locator('.btn-create').click();
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Verify session appears in sidebar
    const sessionItem = page.locator('.session-item').filter({ hasText: uniqueTitle }).first();
    await expect(sessionItem).toBeVisible({ timeout: 5000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('load');

    // Wait for sidebar to reload
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Verify session still exists after reload
    const persistedSession = page.locator('.session-item').filter({ hasText: uniqueTitle }).first();
    await expect(persistedSession).toBeVisible({ timeout: 10000 });
  });

  test('persist-02: active session selection persists after reload', async ({ page }) => {
    const sidebar = page.locator('.session-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Create a session to select
    const uniqueTitle = `Active Test ${Date.now()}`;
    await page.locator('.new-session-btn').click();
    const dialog = page.locator('.dialog-overlay');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.locator('#session-title').fill(uniqueTitle);
    await page.locator('.btn-create').click();
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Click on the session to make it active
    const sessionItem = page.locator('.session-item').filter({ hasText: uniqueTitle }).first();
    await expect(sessionItem).toBeVisible({ timeout: 5000 });
    await sessionItem.click();

    // Verify it's selected (has active class or similar indicator)
    await page.waitForTimeout(500);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('load');

    // Wait for sidebar to reload
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Verify the session is still selected/active
    const persistedSession = page.locator('.session-item').filter({ hasText: uniqueTitle }).first();
    await expect(persistedSession).toBeVisible({ timeout: 10000 });

    // Check if it has the active class
    const hasActiveClass = await persistedSession.evaluate(el => {
      return el.classList.contains('active') || el.classList.contains('selected');
    });
    expect(hasActiveClass).toBeTruthy();
  });

  test('persist-03: multiple sessions persist after reload', async ({ page }) => {
    const sidebar = page.locator('.session-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Create multiple sessions
    const sessionTitles = [
      `Multi Test 1 ${Date.now()}`,
      `Multi Test 2 ${Date.now()}`,
      `Multi Test 3 ${Date.now()}`
    ];

    for (const title of sessionTitles) {
      await page.locator('.new-session-btn').click();
      const dialog = page.locator('.dialog-overlay');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await page.locator('#session-title').fill(title);
      await page.locator('.btn-create').click();
      await expect(dialog).toBeHidden({ timeout: 5000 });

      // Wait for session to appear
      const sessionItem = page.locator('.session-item').filter({ hasText: title }).first();
      await expect(sessionItem).toBeVisible({ timeout: 5000 });
    }

    // Reload the page
    await page.reload();
    await page.waitForLoadState('load');

    // Wait for sidebar to reload
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Verify all sessions still exist
    for (const title of sessionTitles) {
      const persistedSession = page.locator('.session-item').filter({ hasText: title }).first();
      await expect(persistedSession).toBeVisible({ timeout: 10000 });
    }
  });

  test('persist-04: deleted session does not reappear after reload', async ({ page }) => {
    const sidebar = page.locator('.session-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Create a session to delete
    const uniqueTitle = `Delete Test ${Date.now()}`;
    await page.locator('.new-session-btn').click();
    const dialog = page.locator('.dialog-overlay');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.locator('#session-title').fill(uniqueTitle);
    await page.locator('.btn-create').click();
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Wait for session to appear
    const sessionItem = page.locator('.session-item').filter({ hasText: uniqueTitle }).first();
    await expect(sessionItem).toBeVisible({ timeout: 5000 });

    // Hover to reveal delete button
    await sessionItem.hover();
    await page.waitForTimeout(300);

    // Click delete button
    const deleteBtn = sessionItem.locator('.delete-btn');
    await expect(deleteBtn).toBeVisible();

    // Accept confirmation dialog
    page.on('dialog', d => d.accept());
    await deleteBtn.click();

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('load');

    // Wait for sidebar to reload
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Verify deleted session does not reappear
    const deletedSession = page.locator('.session-item').filter({ hasText: uniqueTitle });
    await expect(deletedSession).toHaveCount(0, { timeout: 5000 });
  });

  test('persist-05: chat messages persist after session reactivation', async ({ page }) => {
    const sidebar = page.locator('.session-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Create a session
    const uniqueTitle = `Msg Persist ${Date.now()}`;
    await page.locator('.new-session-btn').click();
    const dialog = page.locator('.dialog-overlay');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    await page.locator('#session-title').fill(uniqueTitle);
    await page.locator('.btn-create').click();
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Wait for session to appear and select it
    const sessionItem = page.locator('.session-item').filter({ hasText: uniqueTitle }).first();
    await expect(sessionItem).toBeVisible({ timeout: 5000 });
    await sessionItem.click();

    // Send a message
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });
    await textarea.fill('Test persistence message');
    await page.locator('.send-btn').click();

    // Wait for message to appear
    await page.waitForTimeout(1000);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('load');

    // Wait for sidebar to reload
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Select the session again
    const persistedSession = page.locator('.session-item').filter({ hasText: uniqueTitle }).first();
    await expect(persistedSession).toBeVisible({ timeout: 10000 });
    await persistedSession.click();

    // Wait for messages to load
    await page.waitForTimeout(1000);

    // Verify the message is still there
    const message = page.locator('.chat-message').filter({ hasText: 'Test persistence message' });
    await expect(message).toBeVisible({ timeout: 5000 });
  });
});
