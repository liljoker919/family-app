import { test, expect } from '@playwright/test';

/**
 * Smoke test – verifies the app serves a response.
 * Requires the dev server (or a deployed URL set via BASE_URL env var).
 */
const baseUrl = process.env.BASE_URL ?? 'http://localhost:4321';

test('app loads and returns a response', async ({ page }) => {
  const response = await page.goto(baseUrl);
  expect(response?.status()).toBeLessThan(500);
});

test('page title is present', async ({ page }) => {
  await page.goto(baseUrl);
  const title = await page.title();
  expect(title).toBeTruthy();
});
