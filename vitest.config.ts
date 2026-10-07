import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

/**
 * The PaymentSettings table is a shared singleton in the live test DB.
 * Files that mutate it, or whose assertions depend on its defaults
 * (placeOrder / quote / settings / the routes that read it), must never run
 * concurrently with each other, so they run in one project on a single
 * forked worker (files one at a time). Everything else stays parallel.
 *
 * Adding a test that calls placeOrder/quote or the settings service? List it
 * in SETTINGS_SERIAL_FILES.
 */
const SETTINGS_SERIAL_FILES = [
  'src/server/checkout/__tests__/checkout.service.test.ts',
  'src/server/checkout/__tests__/checkout.fee.test.ts',
  'src/server/settings/__tests__/payment-settings.service.test.ts',
  'src/server/payments/__tests__/payment-routes.test.ts',
  'src/server/settings/__tests__/settings-routes.test.ts',
];

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: false,
    globalSetup: ['./vitest.global-setup.ts'],
    // Never let tests send real email: the mailer skips when these are empty
    // (Prisma loads .env into process.env but does not override set vars).
    env: { RESEND_API_KEY: '', EMAIL_FROM: '' },
    projects: [
      {
        extends: true,
        test: {
          name: 'parallel',
          include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
          exclude: ['**/node_modules/**', ...SETTINGS_SERIAL_FILES],
        },
      },
      {
        extends: true,
        test: {
          name: 'settings-serial',
          include: SETTINGS_SERIAL_FILES,
          // One forked worker runs these files one at a time.
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});
