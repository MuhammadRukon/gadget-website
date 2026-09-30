import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/lib/fetcher';
import { describeCheckoutError } from '../checkout-error';

function apiErr(status: number, message: string, meta?: Record<string, unknown>) {
  return new ApiClientError(status, message, { code: 'CONFLICT', message, meta } as never);
}

describe('describeCheckoutError', () => {
  it('names the product on 409 insufficient_stock and refetches the cart', () => {
    const r = describeCheckoutError(
      apiErr(409, 'conflict', {
        variantId: 'v1',
        productName: 'Foo',
        reason: 'insufficient_stock',
      }),
    );
    expect(r.message).toContain('"Foo"');
    expect(r.message).toBe('Not enough stock for "Foo". Your cart has been refreshed.');
    expect(r.refetchCart).toBe(true);
  });

  it('names the product on 409 unavailable and refetches the cart', () => {
    const r = describeCheckoutError(
      apiErr(409, 'conflict', { variantId: 'v1', productName: 'Foo', reason: 'unavailable' }),
    );
    expect(r.message).toBe('"Foo" is no longer available. Your cart has been refreshed.');
    expect(r.refetchCart).toBe(true);
  });

  it('uses the server message on 409 without meta', () => {
    const r = describeCheckoutError(apiErr(409, 'Your cart changed, please review and try again'));
    expect(r).toEqual({
      message: 'Your cart changed, please review and try again',
      refetchCart: true,
    });
  });

  it('refetches the cart on 400 Cart is empty', () => {
    const r = describeCheckoutError(apiErr(400, 'Cart is empty'));
    expect(r).toEqual({ message: 'Cart is empty', refetchCart: true });
  });

  it('passes through other API errors without refetching', () => {
    const r = describeCheckoutError(apiErr(500, 'Boom'));
    expect(r).toEqual({ message: 'Boom', refetchCart: false });
  });

  it('falls back for non-API errors', () => {
    expect(describeCheckoutError(new Error('x'))).toEqual({
      message: 'Could not place order',
      refetchCart: false,
    });
  });
});
