import { expect, type APIRequestContext, type APIResponse, type PlaywrightWorkerArgs } from '@playwright/test';
import { variantId } from './db';
import { BASE_URL } from './env';
import { AUTH_FILE, IPHONE_SKU } from './seed';

/** Asserts a 2xx and returns the response; the failure message carries `msg` (default: the URL), status and body. */
export async function ok(res: APIResponse, msg = res.url()) {
  expect(res.ok(), `${msg} -> ${res.status()} ${await res.text()}`).toBe(true);
  return res;
}

/** Empties the server cart of the user behind `request`. */
export async function clearCart(request: APIRequestContext) {
  await ok(await request.delete('/api/cart'));
}

/** Creates a shipping address for the user behind `request` and returns its id. */
export async function createAddress(request: APIRequestContext, recipientName = 'E2E API') {
  const res = await ok(
    await request.post('/api/addresses', {
      data: { recipientName, recipientPhone: '01700000000', line1: '1 Test Road', city: 'Dhaka', country: 'BD' },
    }),
  );
  return ((await res.json()) as { address: { id: string } }).address.id;
}

/** An API context logged in as the seeded customer (for specs whose browser runs as someone else). */
export const customerRequest = (playwright: PlaywrightWorkerArgs['playwright']) =>
  playwright.request.newContext({ baseURL: BASE_URL, storageState: AUTH_FILE.customer });

/**
 * Places a COD order for 1 iphone-15-pro through the API as the user behind `request`:
 * new address, emptied cart, add the variant, POST /api/checkout.
 */
export async function createCodOrder(request: APIRequestContext) {
  const addressId = await createAddress(request);
  // A leftover line from another spec would change the order; start from an empty cart.
  await clearCart(request);
  await ok(await request.post('/api/cart', { data: { variantId: await variantId(IPHONE_SKU), quantity: 1 } }));

  const res = await ok(await request.post('/api/checkout', { data: { addressId, paymentMethod: 'COD' } }));
  return (await res.json()) as { id: string; orderNumber: string };
}

/** `createCodOrder` as the seeded customer, for specs whose own browser or API context is the admin. */
export async function orderAsCustomer(playwright: PlaywrightWorkerArgs['playwright']) {
  const customer = await customerRequest(playwright);
  try {
    return await createCodOrder(customer);
  } finally {
    await customer.dispose();
  }
}
