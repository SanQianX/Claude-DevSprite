import { test, expect, Page, Locator } from '@playwright/test';

// Helper function to create a test session
async function createTestSession(page: Page, prefix: string) {
  // Open dialog
  await page.getByRole('button', { name: 'New Chat' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Fill title with a unique, descriptive name
  const titleInput = page.locator('[data-testid="session-title"]');
  const uniqueTitle = `${prefix} - ${Date.now()}`;
  await titleInput.fill(uniqueTitle);

  // Create button should be enabled
  const createBtn = page.getByRole('button', { name: 'Create' });
  await expect(createBtn).toBeEnabled();

  // Click Create
  await createBtn.click();

  // Dialog should close
  await expect(dialog).toBeHidden({ timeout: 5000 });

  // Wait for the new session to appear and return it
  const sessionItem = page.locator('[data-testid="session-item"]').filter({ hasText: uniqueTitle }).first();
  await expect(sessionItem).toBeVisible({ timeout: 5000 });

  return sessionItem;
}

// Helper function to handle delete confirmation dialog
async function clickDeleteAndConfirm(page: Page, deleteBtn: Locator) {
  const dialogPromise = page.expectDialog();
  await deleteBtn.click();
  const confirmDialog = await dialogPromise;
  await confirmDialog.accept();
}

test.describe('Chat Page (/chat)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('load');
  });

  test('chat-01: page loads with session sidebar', async ({ page }) => {
    // Session sidebar should be visible
    const sidebar = page.locator('[data-testid="session-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Should have a "Sessions" heading
    const heading = sidebar.locator('h3');
    await expect(heading).toBeVisible();

    // Should have a "+ New Chat" button
    const newChatBtn = page.getByRole('button', { name: 'New Chat' });
    await expect(newChatBtn).toBeVisible();
  });

  test('chat-02: new chat button opens dialog', async ({ page }) => {
    const newChatBtn = page.getByRole('button', { name: 'New Chat' });
    await expect(newChatBtn).toBeVisible({ timeout: 10000 });
    await newChatBtn.click();

    // Dialog should appear (teleported to body)
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Should have title input
    const titleInput = page.locator('[data-testid="session-title"]');
    await expect(titleInput).toBeVisible();
  });

  test('chat-03: fill title and create session', async ({ page }) => {
    // Use the helper function to create a session
    const fixedTitle = 'Test Session - chat-03';
    const sessionItem = await createTestSession(page, fixedTitle);

    // New session should appear in sidebar (title will contain the prefix)
    await expect(sessionItem).toBeVisible({ timeout: 5000 });

    // Clean up: delete the created session to ensure test isolation
    await sessionItem.hover();
    const deleteBtn = sessionItem.locator('[data-testid="delete-btn"]');
    await expect(deleteBtn).toBeVisible();
    await clickDeleteAndConfirm(page, deleteBtn);
    await expect(sessionItem).toBeHidden({ timeout: 5000 });
  });

  test('chat-04: dialog cancel or X closes dialog', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: 'New Chat' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(dialog).toBeHidden({ timeout: 5000 });
  });

  test('chat-05: sidebar collapse toggle works', async ({ page }) => {
    const sidebar = page.locator('[data-testid="session-sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Click toggle button
    const toggleBtn = page.locator('[data-testid="toggle-btn"]');
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Sidebar should have collapsed class
    await expect(sidebar).toHaveClass(/collapsed/);

    // Click toggle again to expand
    await toggleBtn.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('chat-06: delete session with hover', async ({ page }) => {
    // First create a session to delete using the helper function
    const deletePrefix = 'Delete';
    const sessionItem = await createTestSession(page, deletePrefix);

    // Record the original number of sessions
    const allSessions = page.locator('[data-testid="session-item"]');
    const originalCount = await allSessions.count();

    // Hover to reveal delete button
    await sessionItem.hover();
    // Click delete button
    const deleteBtn = sessionItem.locator('[data-testid="delete-btn"]');
    await expect(deleteBtn).toBeVisible();

    // Handle delete confirmation dialog using helper function
    await clickDeleteAndConfirm(page, deleteBtn);

    // Wait for the delete API response to ensure operation completed
    await page.waitForResponse(response => response.url().includes('/sessions') && response.request().method() === 'DELETE');

    // Verify the session is deleted by checking it's hidden
    await expect(sessionItem).toBeHidden({ timeout: 5000 });

    // Verify the session count has decreased by 1
    await expect(allSessions).toHaveCount(originalCount - 1);
  });

  test('chat-07: type message and click send', async ({ page }) => {
    // Wait for chat input to be ready
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 10000 });

    // Type a message
    await textarea.fill('Hello, this is a test message');

    // Send button should be enabled
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeEnabled();

    // Click send
    await sendBtn.click();

    // Textarea should be cleared after sending
    await expect(textarea).toHaveValue('', { timeout: 5000 });
  });

  test('chat-08: abort button is disabled when no team busy', async ({ page }) => {
    // Note: This test only verifies the disabled state of the abort button when no team is busy.
    // Simulating a busy team in end-to-end tests is complex and may require external state management or mocking, which could introduce flakiness.
    // Therefore, we are only testing the disabled state here to ensure basic functionality. A separate test for the enabled state may be added if simulation becomes feasible.
    const abortBtn = page.getByRole('button', { name: 'Abort' });
    await expect(abortBtn).toBeVisible({ timeout: 10000 });

    // Abort button should be disabled when no team is busy
    await expect(abortBtn).toBeDisabled();
  });
});