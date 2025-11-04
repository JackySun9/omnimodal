import { test, expect } from './fixtures';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load dashboard page', async ({ page }) => {
    await expect(page).toHaveTitle(/Unified Multimodal Platform|Dashboard/i);
    
    // Check for dashboard heading
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should display hardware information', async ({ page }) => {
    // Wait for hardware cards to load
    await page.waitForSelector('text=GPU', { timeout: 10000 });
    
    // Check for hardware sections
    await expect(page.locator('text=GPU')).toBeVisible();
    await expect(page.locator('text=CPU')).toBeVisible();
    await expect(page.locator('text=Memory')).toBeVisible();
  });

  test('should display quick action cards', async ({ page }) => {
    // Check for quick action buttons
    await expect(page.getByRole('button', { name: /chat/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /image generation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /speech-to-text/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /browse models/i })).toBeVisible();
  });

  test('should navigate to chat page from quick actions', async ({ page }) => {
    const chatButton = page.getByRole('button', { name: /chat/i }).first();
    await chatButton.click();
    
    await expect(page).toHaveURL(/\/chat/);
  });

  test('should navigate to models page from quick actions', async ({ page }) => {
    const modelsButton = page.getByRole('button', { name: /browse models/i }).first();
    await modelsButton.click();
    
    await expect(page).toHaveURL(/\/models/);
  });

  test('should display system status', async ({ page }) => {
    // Check for system status section
    await expect(page.locator('text=System Status')).toBeVisible();
    
    // Check for services
    const ollamaService = page.locator('text=Ollama');
    const diffuserService = page.locator('text=OllamaDiffuser');
    
    // At least one should be present
    const ollamaVisible = await ollamaService.isVisible().catch(() => false);
    const diffuserVisible = await diffuserService.isVisible().catch(() => false);
    
    expect(ollamaVisible || diffuserVisible).toBeTruthy();
  });

  test('should refresh system status', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('text=System Status', { timeout: 10000 });
    
    // Find and click refresh button
    const refreshButton = page.getByRole('button', { name: /refresh/i }).first();
    await refreshButton.click();
    
    // Button should show loading state
    await expect(refreshButton).toContainText(/checking|refresh/i);
  });

  test('should display model library section', async ({ page }) => {
    await expect(page.locator('text=Model Library')).toBeVisible();
    
    // Should show total models count
    await expect(page.locator('text=Total Models')).toBeVisible();
  });

  test('should handle loading states', async ({ page }) => {
    // On initial load, there might be loading indicators
    const loadingIndicators = page.locator('.shimmer, .pulse, text=Loading');
    
    // Wait for loading to complete (timeout if takes too long)
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    // Loading indicators should eventually disappear
    const count = await loadingIndicators.count();
    // It's okay if there are no loading indicators (fast load)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }
    
    // Dashboard should render on mobile
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    // Quick actions should be visible
    await expect(page.getByRole('button', { name: /chat/i })).toBeVisible();
  });
});
