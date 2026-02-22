// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,   // WS server is shared — run serially
  retries: process.env.CI ? 2 : 0,
  workers: 1,             // single worker to avoid WS port conflicts
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // Start both servers before running E2E tests
  webServer: [
    {
      command: 'npx ts-node ../mock-server/server.ts',
      port: 8080,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});