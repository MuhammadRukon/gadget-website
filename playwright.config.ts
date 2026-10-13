import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, E2E_PORT, serverEnv } from './e2e/support/env';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  // shortcut: retries 0, upgrade only if a root-caused flake cannot be fixed.
  retries: 0,
  // One worker: all specs share one DB and one dev server.
  workers: 1,
  reporter: [['line'], ['html', { open: 'never' }]],
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'infra', testMatch: 'infra.spec.ts' },
    // Not dependent on 'setup': infra stays dependency-free.
    { name: 'setup', testMatch: 'auth.setup.ts', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'chromium-desktop',
      testIgnore: ['infra.spec.ts', 'auth.setup.ts'],
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // shortcut: next dev server, upgrade to build+start if compile time makes tests flaky.
    command: `npm run dev -- -p ${E2E_PORT}`,
    // Playwright starts the server before globalSetup, so probe a DB-free route (`/` would 500 until the DB is seeded).
    url: `${BASE_URL}/api/auth/csrf`,
    // Never attach to a server that may point at another database.
    reuseExistingServer: false,
    env: serverEnv,
    timeout: 120_000,
  },
});
