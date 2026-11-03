import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: 'npm run dev -w @quibbi/web',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
