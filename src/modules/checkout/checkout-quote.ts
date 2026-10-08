import type { PaymentMethod } from '@prisma/client';

/** What a checkout quote depends on; also the identity of its cache entry. */
export interface CheckoutQuoteParams {
  addressId: string;
  /** The applied coupon, or null when none. */
  couponCode: string | null;
  /** The effective selection, or null while none is chosen (or the config has not loaded). */
  paymentMethod: PaymentMethod | null;
}

/**
 * Request body of `POST /api/checkout/quote`. Null becomes undefined so the
 * key is omitted from the JSON, exactly as the route's optional fields expect.
 */
export function buildQuoteBody({ addressId, couponCode, paymentMethod }: CheckoutQuoteParams) {
  return {
    addressId,
    couponCode: couponCode ?? undefined,
    paymentMethod: paymentMethod ?? undefined,
  };
}
