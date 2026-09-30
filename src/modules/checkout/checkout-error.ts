import { ApiClientError } from '@/lib/fetcher';

export interface CheckoutErrorDescription {
  message: string;
  refetchCart: boolean;
}

export function describeCheckoutError(err: unknown): CheckoutErrorDescription {
  if (!(err instanceof ApiClientError)) {
    return { message: 'Could not place order', refetchCart: false };
  }

  if (err.status === 409) {
    const meta = err.payload?.meta;
    const productName = typeof meta?.productName === 'string' ? meta.productName : null;
    if (productName) {
      const message =
        meta?.reason === 'unavailable'
          ? `"${productName}" is no longer available. Your cart has been refreshed.`
          : `Not enough stock for "${productName}". Your cart has been refreshed.`;
      return { message, refetchCart: true };
    }
    return { message: err.message, refetchCart: true };
  }

  if (err.status === 400 && err.message === 'Cart is empty') {
    return { message: err.message, refetchCart: true };
  }

  return { message: err.message, refetchCart: false };
}
