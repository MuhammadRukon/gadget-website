import { expect, type APIRequestContext, type PlaywrightWorkerArgs } from '@playwright/test';
import { IPHONE_SKU, variantId } from './db';
import { BASE_URL } from './env';

/** An API context logged in as the seeded customer (for specs whose browser runs as someone else). */
export const customerRequest = (playwright: PlaywrightWorkerArgs['playwright']) =>
  playwright.request.newContext({ baseURL: BASE_URL, storageState: 'e2e/.auth/customer.json' });

/**
 * Places a COD order for 1 iphone-15-pro through the API as the user behind `request`:
 * new address, emptied cart, add the variant, POST /api/checkout.
 */
export async function createCodOrder(request: APIRequestContext) {
  const ok = async (res: Awaited<ReturnType<APIRequestContext['get']>>) => {
    expect(res.ok(), `${res.url()} -> ${res.status()} ${await res.text()}`).toBe(true);
    return res;
  };

  const address = await ok(
    await request.post('/api/addresses', {
      data: { recipientName: 'E2E API', recipientPhone: '01700000000', line1: '1 Test Road', city: 'Dhaka', country: 'BD' },
    }),
  );
  const { address: { id: addressId } } = (await address.json()) as { address: { id: string } };

  // A leftover line from another spec would change the order; start from an empty cart.
  await ok(await request.delete('/api/cart'));
  await ok(await request.post('/api/cart', { data: { variantId: await variantId(IPHONE_SKU), quantity: 1 } }));

  const res = await ok(await request.post('/api/checkout', { data: { addressId, paymentMethod: 'COD' } }));
  return (await res.json()) as { id: string; orderNumber: string };
}
