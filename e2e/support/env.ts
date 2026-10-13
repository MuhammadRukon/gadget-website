import { existsSync } from 'node:fs';
import { assertE2eDatabaseUrl } from './db-guard';

// Loaded here (not via dotenv-cli) so a command-line E2E_DATABASE_URL still wins: loadEnvFile never overrides.
if (existsSync('.env.e2e')) process.loadEnvFile('.env.e2e');

export const E2E_PORT = 3100;
export const BASE_URL = `http://localhost:${E2E_PORT}`;

/** Throws at import time, i.e. before Playwright starts any server or touches any database. */
export const e2eDatabaseUrl = assertE2eDatabaseUrl(process.env.E2E_DATABASE_URL);

/** Env for the dev server and every child process. Set explicitly: shell vars beat any `.env` file. */
export const serverEnv: Record<string, string> = {
  DATABASE_URL: e2eDatabaseUrl,
  SHADOW_DATABASE_URL: '',
  NEXTAUTH_URL: BASE_URL,
  NEXT_PUBLIC_APP_URL: BASE_URL,
  NEXTAUTH_SECRET: 'e2e-dummy-secret-not-for-production',
  AUTH_TRUST_HOST: 'true',
  CLOUDINARY_CLOUD_NAME: 'e2e',
  CLOUDINARY_API_KEY: 'e2e',
  CLOUDINARY_API_SECRET: 'e2e',
  // Blank = mailer skips (signup returns devCode), gateways use the sandbox, no Google, no Redis.
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  SSLCOMMERZ_STORE_ID: '',
  SSLCOMMERZ_STORE_PASSWORD: '',
  SSLCOMMERZ_SANDBOX: '',
  BKASH_BASE_URL: '',
  BKASH_APP_KEY: '',
  BKASH_APP_SECRET: '',
  BKASH_USERNAME: '',
  BKASH_PASSWORD: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
  // Pin the documented seed credentials against ambient overrides.
  SEED_ADMIN_EMAIL: 'admin@tecnologia.test',
  SEED_ADMIN_PASSWORD: 'admin12345',
  SEED_CUSTOMER_EMAIL: 'customer@tecnologia.test',
  SEED_CUSTOMER_PASSWORD: 'customer12345',
};
