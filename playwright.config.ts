import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'he-IL',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Galaxy S5'],
        // 360x640
      },
    },
    {
      name: 'mobile-large',
      use: {
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-small',
      use: {
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
