import { test, expect } from '@playwright/test';

/**
 * Smoke test – verifies the app serves a response.
 * baseURL is configured in playwright.config.ts.
 */
test('app loads and returns a response', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(500);
});

test('page title is present', async ({ page }) => {
  await page.goto('/');
  const title = await page.title();
  expect(title).toBeTruthy();
});
