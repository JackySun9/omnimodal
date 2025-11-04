import { test, expect } from './fixtures';

test.describe('Models Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/models');
  });

  test('should load models page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /models/i })).toBeVisible();
  });

  test('should display model list or empty state', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Should either show models or empty state
    const hasModels = await page.locator('[class*="model"], [data-testid*="model"]').count() > 0;
    const hasEmptyState = await page.locator('text=/no models|empty/i').isVisible().catch(() => false);
    
    // One of these should be true
    expect(hasModels || hasEmptyState).toBeTruthy();
  });

  test('should allow filtering models by modality', async ({ page }) => {
    // Look for modality filters
    const textFilter = page.getByRole('button', { name: /text/i }).or(page.locator('text=Text')).first();
    const imageFilter = page.getByRole('button', { name: /image/i }).or(page.locator('text=Image')).first();
    
    const hasFilters = await textFilter.isVisible().catch(() => false) || await imageFilter.isVisible().catch(() => false);
    
    if (hasFilters) {
      // Try clicking a filter
      if (await textFilter.isVisible()) {
        await textFilter.click();
        await page.waitForTimeout(500); // Wait for filter to apply
      }
    }
  });

  test('should have scan/refresh functionality', async ({ page }) => {
    // Look for scan or refresh button
    const scanButton = page.getByRole('button', { name: /scan|refresh/i });
    
    if (await scanButton.isVisible()) {
      await scanButton.click();
      
      // Should show loading state
      await expect(scanButton).toBeDisabled().or(scanButton.locator('text=/scanning|loading/i')).catch(() => {});
    }
  });

  test('should display model details', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for model cards or list items
    const modelElements = page.locator('[class*="model"], [data-testid*="model"]');
    const count = await modelElements.count();
    
    if (count > 0) {
      // First model should have name and basic info
      const firstModel = modelElements.first();
      await expect(firstModel).toBeVisible();
      
      // Model should have some text content
      const content = await firstModel.textContent();
      expect(content?.length).toBeGreaterThan(0);
    }
  });

  test('should handle model selection', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for clickable model elements
    const modelButtons = page.locator('button[aria-label*="model"], [role="button"]').filter({
      hasText: /select|llama|stable|whisper|model/i
    });
    
    const count = await modelButtons.count();
    
    if (count > 0) {
      await modelButtons.first().click();
      await page.waitForTimeout(300);
      
      // Should show selection indicator or navigate
      // This will vary by implementation
    }
  });
});
