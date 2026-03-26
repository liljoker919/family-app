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
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
  ],
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
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
    },
  ],
});
