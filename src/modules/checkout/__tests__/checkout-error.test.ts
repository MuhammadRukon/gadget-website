import { describe, expect, it } from 'vitest';

import { ApiClientError } from '@/lib/fetcher';
import { checkoutErrorMessage } from '../checkout-error';

function apiErr(status: number, message: string, meta?: Record<string, unknown>) {
  return new ApiClientError(status, message, { code: 'CONFLICT', message, meta } as never);
}

describe('checkoutErrorMessage', () => {
  it('names the product on 409 insufficient_stock', () => {
    const msg = checkoutErrorMessage(
      apiErr(409, 'conflict', {
        variantId: 'v1',
        productName: 'Foo',
        reason: 'insufficient_stock',
      }),
    );
    expect(msg).toBe('Not enough stock for "Foo". Your cart has been refreshed.');
  });

  it('names the product on 409 unavailable', () => {
    const msg = checkoutErrorMessage(
      apiErr(409, 'conflict', { variantId: 'v1', productName: 'Foo', reason: 'unavailable' }),
    );
    expect(msg).toBe('"Foo" is no longer available. Your cart has been refreshed.');
  });

  it('uses the server message on 409 without meta', () => {
    const msg = checkoutErrorMessage(apiErr(409, 'Your cart changed, please review and try again'));
    expect(msg).toBe('Your cart changed, please review and try again');
  });

  it('uses the server message on 409 with invalid meta', () => {
    expect(
      checkoutErrorMessage(apiErr(409, 'conflict msg', { productName: 'Foo', reason: 'weird' })),
    ).toBe('conflict msg');
    expect(checkoutErrorMessage(apiErr(409, 'conflict msg', { reason: 'unavailable' }))).toBe(
      'conflict msg',
    );
  });

  it('passes through other API errors', () => {
    expect(checkoutErrorMessage(apiErr(500, 'Boom'))).toBe('Boom');
    expect(checkoutErrorMessage(apiErr(400, 'Cart is empty'))).toBe('Cart is empty');
  });

  it('ignores stock meta on non-409 API errors', () => {
    const msg = checkoutErrorMessage(
      apiErr(422, 'Invalid', { variantId: 'v1', productName: 'Foo', reason: 'unavailable' }),
    );
    expect(msg).toBe('Invalid');
  });

  it('falls back for non-API errors', () => {
    expect(checkoutErrorMessage(new Error('x'))).toBe('Could not place order');
  });
});
