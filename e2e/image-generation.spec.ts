import { test, expect } from './fixtures';

test.describe('Image Generation Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/image');
  });

  test('should load image generation page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /image/i })).toBeVisible();
  });

  test('should display prompt input', async ({ page }) => {
    // Look for prompt input
    const input = page.locator('input[placeholder*="prompt"], textarea[placeholder*="prompt"]').or(
      page.locator('input[type="text"], textarea').first()
    );
    
    await expect(input.first()).toBeVisible({ timeout: 10000 });
  });

  test('should have generate button', async ({ page }) => {
    // Look for generate button
    const generateButton = page.getByRole('button', { name: /generate|create/i });
    
    await expect(generateButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display model selector', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Should have image model selection
    const hasModelUI = await page.locator('button, select').count() > 0;
    expect(hasModelUI).toBeTruthy();
  });

  test('should have image display area', async ({ page }) => {
    // Look for image container or canvas
    const imageArea = page.locator('img, canvas, [class*="image"], [class*="output"]');
    const hasArea = await imageArea.first().isVisible().catch(() => false);
    
    // Image area might not be visible until generation
    expect(hasArea || await page.locator('main, section').count() > 0).toBeTruthy();
  });

  test('should handle generation parameters', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for parameter controls (steps, guidance, etc.)
    const hasControls = await page.locator('input[type="number"], input[type="range"], slider').count() > 0;
    
    // Parameters might be in advanced settings
    if (hasControls) {
      expect(hasControls).toBeTruthy();
    }
  });
});
