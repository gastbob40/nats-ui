import { defineConfig, devices } from '@playwright/test';

// The preview server serves the production build on 4173; the app then
// derives its NATS endpoints from the page host, which lands exactly on the
// test servers from docker/docker-compose.test.yml (ws 9222 / http 8222).
const PREVIEW_URL = 'http://localhost:4173';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Real NATS + JetStream round-trips under parallel workers can exceed the
  // 5s default.
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: PREVIEW_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Taller than the device default (720): the KV page stacks stats,
        // bucket chips and the table without a page scrollbar, so rows
        // below the fold would be unreachable for the click actions.
        viewport: { width: 1280, height: 1400 },
      },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: PREVIEW_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
