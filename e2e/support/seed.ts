import { serverEnv } from './env';

// Seed facts from prisma/seed.ts. Credentials come from the SEED_* values env.ts pins for the seed run, so they cannot drift.
export const IPHONE_SKU = 'APL-IP15P-256';
export const IPHONE_SLUG = 'iphone-15-pro';
export const IPHONE_PRICE_CENTS = 16_500_000;
export const DELL_SKU = 'DEL-XPS15-32'; // seed stock 8
export const MACBOOK_SKU = 'APL-MBA-M3-512';

export const SEED = {
  admin: { email: serverEnv.SEED_ADMIN_EMAIL, password: serverEnv.SEED_ADMIN_PASSWORD },
  customer: { email: serverEnv.SEED_CUSTOMER_EMAIL, password: serverEnv.SEED_CUSTOMER_PASSWORD },
};

/** Logged-in storage states written by `auth.setup.ts`. */
export const AUTH_FILE = { admin: 'e2e/.auth/admin.json', customer: 'e2e/.auth/customer.json' };
