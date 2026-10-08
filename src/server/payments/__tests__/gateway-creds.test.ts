import { PaymentMethod } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { gatewayConfigured, hasGatewayCreds } from '../gateway-creds';

const BKASH_ENV = {
  BKASH_BASE_URL: 'https://example.invalid',
  BKASH_APP_KEY: 'key',
  BKASH_APP_SECRET: 'secret',
  BKASH_USERNAME: 'user',
  BKASH_PASSWORD: 'pass',
};

const SSLCOMMERZ_ENV = {
  SSLCOMMERZ_STORE_ID: 'store',
  SSLCOMMERZ_STORE_PASSWORD: 'pwd',
};

describe('hasGatewayCreds', () => {
  it('is false for BKASH and SSLCOMMERZ with an empty env', () => {
    expect(hasGatewayCreds(PaymentMethod.BKASH, {})).toBe(false);
    expect(hasGatewayCreds(PaymentMethod.SSLCOMMERZ, {})).toBe(false);
  });

  it('is true for SSLCOMMERZ with store id and password', () => {
    expect(hasGatewayCreds(PaymentMethod.SSLCOMMERZ, SSLCOMMERZ_ENV)).toBe(true);
  });

  it('is false for SSLCOMMERZ when either variable is missing or empty', () => {
    expect(
      hasGatewayCreds(PaymentMethod.SSLCOMMERZ, { SSLCOMMERZ_STORE_ID: 'store' }),
    ).toBe(false);
    expect(
      hasGatewayCreds(PaymentMethod.SSLCOMMERZ, { ...SSLCOMMERZ_ENV, SSLCOMMERZ_STORE_PASSWORD: '' }),
    ).toBe(false);
  });

  it('is true for BKASH only when all five variables are set', () => {
    expect(hasGatewayCreds(PaymentMethod.BKASH, BKASH_ENV)).toBe(true);
    for (const key of Object.keys(BKASH_ENV)) {
      const partial: Record<string, string | undefined> = { ...BKASH_ENV };
      delete partial[key];
      expect(hasGatewayCreds(PaymentMethod.BKASH, partial), `missing ${key}`).toBe(false);
    }
  });

  it('is always true for COD and BANK_TRANSFER', () => {
    expect(hasGatewayCreds(PaymentMethod.COD, {})).toBe(true);
    expect(hasGatewayCreds(PaymentMethod.BANK_TRANSFER, {})).toBe(true);
  });
});

describe('gatewayConfigured', () => {
  it('is true for COD and BANK_TRANSFER regardless of the process env', () => {
    expect(gatewayConfigured(PaymentMethod.COD)).toBe(true);
    expect(gatewayConfigured(PaymentMethod.BANK_TRANSFER)).toBe(true);
  });
});
