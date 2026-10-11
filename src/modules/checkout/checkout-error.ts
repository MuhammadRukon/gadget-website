import { ApiClientError } from '@/lib/fetcher';
import { stockConflictMetaSchema } from '@/contracts/checkout';

export function checkoutErrorMessage(err: unknown): string {
  if (!(err instanceof ApiClientError)) return 'Could not place order';

  if (err.status === 409) {
    const meta = stockConflictMetaSchema.safeParse(err.payload?.meta);
    if (meta.success) {
      const { productName, reason } = meta.data;
      return reason === 'unavailable'
        ? `"${productName}" is no longer available. Your cart has been refreshed.`
        : `Not enough stock for "${productName}". Your cart has been refreshed.`;
    }
  }

  return err.message;
}
