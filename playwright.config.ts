import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.join(configDir, '.env');

loadEnv({ path: envFilePath, override: false });

const configuredBaseUrl = process.env.BASE_URL?.trim();
const baseURL = configuredBaseUrl || 'https://main.d1gak7oijss0a0.amplifyapp.com/';

export default defineConfig({
  testDir: './e2e',
  /** Per-test timeout: 60 s is enough for login + navigation + a single Amplify mutation. */
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
  ],
  /** Raise the default assertion (expect) timeout so UI updates after Amplify API
   *  calls have enough time to propagate before the assertion gives up. */
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    /** Per-action timeout (clicks, fills, etc.): 15 s covers auth round-trips. */
    actionTimeout: 15_000,
  },
  ...(configuredBaseUrl || process.env.CI
    ? {}
    : {
        webServer: {
          command: 'npm run dev -- --host 127.0.0.1 --port 4321',
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
  outputDir: 'test-results/',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: ['**/mobile.spec.ts'],
    },
    {
      name: 'Mobile Safari – iPhone 13',
      use: { ...devices['iPhone 13'] },
      testMatch: ['**/mobile.spec.ts'],
    },
    {
      name: 'Mobile Chrome – Pixel 5',
      use: { ...devices['Pixel 5'] },
      testMatch: ['**/mobile.spec.ts'],
    },
  ],
});
