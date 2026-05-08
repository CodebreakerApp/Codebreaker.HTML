import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Codebreaker.Frontend UI tests.
 *
 * By default the test runner starts the Vite dev server automatically.
 * Set PLAYWRIGHT_BASE_URL to point tests at an already-running server instead;
 * when that variable is set, the local webServer is NOT started.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    /* Base URL — override with PLAYWRIGHT_BASE_URL env var if needed. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /**
   * Automatically start the Vite dev server before running tests unless
   * PLAYWRIGHT_BASE_URL is set (which implies a server is already running).
   *
   * Prerequisites: `npm install` must have been run in Codebreaker.Frontend first.
   */
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        cwd: '../Codebreaker.Frontend',
        timeout: 120_000,
      },
});
