import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/constants/queryKeys';
import { buildQuoteBody } from '../checkout-quote';

describe('buildQuoteBody', () => {
  it('sends only the address when no coupon or method is chosen', () => {
    const body = buildQuoteBody({ addressId: 'a1', couponCode: null, paymentMethod: null });
    expect(JSON.parse(JSON.stringify(body))).toEqual({ addressId: 'a1' });
  });

  it('sends the coupon and method when present', () => {
    const body = buildQuoteBody({ addressId: 'a1', couponCode: 'SAVE10', paymentMethod: 'COD' });
    expect(JSON.parse(JSON.stringify(body))).toEqual({
      addressId: 'a1',
      couponCode: 'SAVE10',
      paymentMethod: 'COD',
    });
  });
});

describe('queryKeys.checkoutQuote', () => {
  const base = { addressId: 'a1', couponCode: null, paymentMethod: 'COD' as const };

  it('is equal for equal selections', () => {
    expect(queryKeys.checkoutQuote(base)).toEqual(queryKeys.checkoutQuote({ ...base }));
  });

  it('differs when any part of the selection differs', () => {
    const key = JSON.stringify(queryKeys.checkoutQuote(base));
    expect(JSON.stringify(queryKeys.checkoutQuote({ ...base, addressId: 'a2' }))).not.toBe(key);
    expect(JSON.stringify(queryKeys.checkoutQuote({ ...base, couponCode: 'X' }))).not.toBe(key);
    expect(JSON.stringify(queryKeys.checkoutQuote({ ...base, paymentMethod: 'BKASH' }))).not.toBe(
      key,
    );
    expect(JSON.stringify(queryKeys.checkoutQuote({ ...base, paymentMethod: null }))).not.toBe(key);
  });
});
