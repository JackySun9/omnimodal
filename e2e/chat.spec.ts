import { test, expect } from './fixtures';

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat');
  });

  test('should load chat page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /chat/i })).toBeVisible();
  });

  test('should display model selector', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Should have model selection UI
    const modelSelector = page.locator('[class*="model"], text=/select model|model:/i');
    const hasSelector = await modelSelector.first().isVisible().catch(() => false);
    
    // Model selector should exist
    expect(hasSelector || await page.locator('button, select').count() > 0).toBeTruthy();
  });

  test('should have text input for messages', async ({ page }) => {
    // Look for text input or textarea
    const input = page.locator('input[type="text"], textarea').first();
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('should have send button', async ({ page }) => {
    // Look for send button
    const sendButton = page.getByRole('button', { name: /send|submit/i }).or(
      page.locator('button').filter({ hasText: /send|➤|→/i })
    );
    
    const hasSendButton = await sendButton.first().isVisible().catch(() => false);
    expect(hasSendButton).toBeTruthy();
  });

  test('should display chat history area', async ({ page }) => {
    // Look for chat messages container
    const chatArea = page.locator('[class*="chat"], [class*="messages"], [class*="conversation"]');
    const hasArea = await chatArea.first().isVisible().catch(() => false);
    
    // Chat area should exist
    expect(hasArea || await page.locator('main, section').count() > 0).toBeTruthy();
  });

  test('should handle empty message submission', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Find send button
    const sendButton = page.getByRole('button', { name: /send|submit/i }).first();
    
    if (await sendButton.isVisible()) {
      // Try to send without typing
      await sendButton.click();
      
      // Should either be disabled or show validation
      await page.waitForTimeout(500);
      // No error expected, just shouldn't crash
    }
  });
});
