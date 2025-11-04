import { test as base } from '@playwright/test';

/**
 * Custom fixtures for E2E tests
 */
type CustomFixtures = {
  // Add custom fixtures here if needed
};

export const test = base.extend<CustomFixtures>({
  // Custom fixture implementations can go here
});

export { expect } from '@playwright/test';
