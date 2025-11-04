# E2E Tests

End-to-end integration tests using Playwright.

## Running Tests

```bash
# From project root

# All tests
pnpm test:e2e

# UI mode (interactive)
pnpm test:e2e:ui

# Debug mode (Playwright Inspector)
pnpm test:e2e:debug

# Specific file
pnpm exec playwright test e2e/dashboard.spec.ts

# Specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit

# Headed mode (see browser)
pnpm exec playwright test --headed

# View report
pnpm test:e2e:report
```

## Test Files

- `fixtures.ts` - Custom test fixtures
- `dashboard.spec.ts` - Dashboard page tests
- `navigation.spec.ts` - Navigation and routing tests
- `models.spec.ts` - Models page tests
- `chat.spec.ts` - Chat interface tests
- `image-generation.spec.ts` - Image generation tests
- `api-integration.spec.ts` - API integration tests

## Writing Tests

### Basic Test Structure

```typescript
import { test, expect } from './fixtures';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/route');
  });

  test('should do something', async ({ page }) => {
    await page.click('text=Button');
    await expect(page).toHaveURL(/\/expected/);
  });
});
```

### API Testing

```typescript
test('should fetch data', async ({ request }) => {
  const response = await request.get('http://localhost:8000/api/v1/endpoint');
  expect(response.ok()).toBeTruthy();
  
  const data = await response.json();
  expect(data).toHaveProperty('expected_key');
});
```

## Prerequisites

E2E tests require:
- Backend server running on `http://localhost:8000`
- Frontend server running on `http://localhost:5173`

The `playwright.config.ts` is configured to start these automatically.

## Debugging

### Playwright Inspector

```bash
pnpm test:e2e:debug
```

This opens the Playwright Inspector for step-by-step debugging.

### Headed Mode

```bash
pnpm exec playwright test --headed
```

See the browser during test execution.

### Slow Motion

```bash
pnpm exec playwright test --headed --slow-mo=1000
```

Slow down test execution to see what's happening.

## Best Practices

1. Use proper wait strategies, not fixed timeouts
2. Test user flows, not implementation details
3. Keep tests independent and isolated
4. Use descriptive test names
5. Handle async operations properly
6. Use data-testid sparingly, prefer semantic selectors

## Configuration

Edit `playwright.config.ts` in the project root to:
- Change browsers to test
- Adjust timeouts
- Configure screenshots/videos
- Set base URL
- Configure web server
