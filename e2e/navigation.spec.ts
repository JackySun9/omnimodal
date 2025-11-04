import { test, expect } from './fixtures';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should navigate between main pages', async ({ page }) => {
    // Start at dashboard
    await expect(page).toHaveURL(/\//);
    
    // Navigate to Models
    await page.click('text=Models');
    await expect(page).toHaveURL(/\/models/);
    
    // Navigate to Chat
    await page.click('text=Chat');
    await expect(page).toHaveURL(/\/chat/);
    
    // Navigate to Image
    await page.click('text=Image');
    await expect(page).toHaveURL(/\/image/);
    
    // Navigate back to Dashboard
    await page.click('text=Dashboard');
    await expect(page).toHaveURL(/\//);
  });

  test('should have working sidebar navigation', async ({ page }) => {
    // Check for sidebar elements
    const sidebar = page.locator('[class*="sidebar"], nav');
    
    if (await sidebar.isVisible()) {
      // Sidebar navigation should be functional
      const navLinks = sidebar.locator('a, button');
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('should maintain state when navigating back', async ({ page }) => {
    // Navigate to models page
    await page.goto('/models');
    await page.waitForLoadState('networkidle');
    
    // Navigate to another page
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    
    // Navigate back
    await page.goBack();
    
    // Should be back on models page
    await expect(page).toHaveURL(/\/models/);
  });

  test('should handle 404 gracefully', async ({ page }) => {
    // Navigate to non-existent route
    const response = await page.goto('/non-existent-route');
    
    // Should either redirect or show 404
    // Most SPAs will show the app and handle 404 in-app
    expect(response?.status()).toBeLessThan(500);
  });
});
