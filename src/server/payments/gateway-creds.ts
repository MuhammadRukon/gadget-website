import { PaymentMethod } from '@prisma/client';

/**
 * Pure credential-presence check for payment gateways. The providers'
 * `getCreds()` and `gatewayConfigured()` (registry) both go through this
 * so the list of required env vars lives in exactly one place.
 *
 * A gateway without credentials silently falls back to the self-payable
 * sandbox harness, so "configured" must be checked before a gateway is
 * offered to customers.
 */
type EnvLike = Readonly<Record<string, string | undefined>>;

const REQUIRED_ENV: Partial<Record<PaymentMethod, readonly string[]>> = {
  [PaymentMethod.BKASH]: [
    'BKASH_BASE_URL',
    'BKASH_APP_KEY',
    'BKASH_APP_SECRET',
    'BKASH_USERNAME',
    'BKASH_PASSWORD',
  ],
  [PaymentMethod.SSLCOMMERZ]: ['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWORD'],
};

/** Every gateway credential env var (for tests that need a "no credentials" environment). */
export const GATEWAY_ENV_KEYS: readonly string[] = Object.values(REQUIRED_ENV).flat();

/** Methods with no entry above (COD, BANK_TRANSFER) need no credentials. */
export function hasGatewayCreds(method: PaymentMethod, env: EnvLike): boolean {
  const required = REQUIRED_ENV[method];
  if (!required) return true;
  return required.every((key) => Boolean(env[key]));
}
