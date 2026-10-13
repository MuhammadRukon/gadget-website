import { expect, test, type Page, type Response } from '@playwright/test';
import { variantId, variantStock } from './support/db';
import { customerRequest } from './support/orders';
import { IPHONE_SKU, setVariantActive } from './support/perf-db';

const HINT_KEY = 'Cryptech.authHint';
const CART_KEY = 'Cryptech.guestCart';
const DELL_SKU = 'DEL-XPS15-32'; // seed stock 8
const MACBOOK_SKU = 'APL-MBA-M3-512';

// First visits compile routes in `next dev`: generous timeouts, not the 5 s default.
const SLOW = 60_000;

const hint = (page: Page) => page.evaluate((k) => localStorage.getItem(k), HINT_KEY);
const isSummary = (r: Response) => {
  const u = new URL(r.url());
  return u.pathname === '/api/cart' && u.searchParams.get('view') === 'summary';
};

async function logInCustomer(page: Page) {
  await page.goto('/login', { timeout: SLOW });
  await page.getByLabel('Email').fill('customer@tecnologia.test');
  await page.getByLabel('Password').fill('customer12345');
  await page.getByRole('button', { name: 'Login' }).click();
}

test('[E2E-PERF-03] auth hint is set on login, drives the summary request, and is cleared on logout', async ({ browser, playwright }) => {
  test.setTimeout(180_000);
  const api = await customerRequest(playwright);
  const context = await browser.newContext(); // fresh: no storage state
  const page = await context.newPage();
  try {
    // Server cart of 2 so the badge proves the count came from the server.
    expect((await api.delete('/api/cart')).ok()).toBe(true);
    const add = await api.post('/api/cart', { data: { variantId: await variantId(IPHONE_SKU), quantity: 2 } });
    expect(add.ok()).toBe(true);

    await page.goto('/', { timeout: SLOW });
    expect(await hint(page)).toBeNull();
    await logInCustomer(page);
    await expect(page).toHaveURL('/', { timeout: SLOW });
    await expect.poll(() => hint(page), { timeout: SLOW }).toBe('1');

    const summary = page.waitForResponse(isSummary, { timeout: SLOW });
    await page.reload();
    expect((await summary).status()).toBe(200);
    await expect(page.getByLabel('2 items in cart', { exact: true })).toBeVisible({ timeout: SLOW });

    // The only menu trigger in the header is the account menu.
    await page.locator('header button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page.getByText('Logged out successfully')).toBeVisible({ timeout: SLOW });
    await expect.poll(() => hint(page)).toBeNull();
  } finally {
    await context.close();
    await api.delete('/api/cart');
    await api.dispose();
  }
});

test('[E2E-PERF-03] a forged hint as a guest gets 401 on the summary request and is cleared quietly', async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('/products', { timeout: SLOW });
    await page.evaluate((k) => localStorage.setItem(k, '1'), HINT_KEY);

    const summary = page.waitForResponse(isSummary, { timeout: SLOW });
    await page.reload();
    expect((await summary).status()).toBe(401);
    await expect.poll(() => hint(page)).toBeNull();

    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/products$/); // no redirect to /login
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0); // no error toast
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible(); // still a guest, header intact
  } finally {
    await context.close();
  }
});

test('[E2E-PERF-06] logging in merges the guest cart: clamped server cart, cleared store, adjustments toast', async ({ browser, playwright }) => {
  test.setTimeout(180_000);
  const api = await customerRequest(playwright);
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    expect((await api.delete('/api/cart')).ok()).toBe(true);
    const iphoneId = await variantId(IPHONE_SKU);
    const dellId = await variantId(DELL_SKU);
    const dellStock = await variantStock(DELL_SKU);
    const requested = dellStock + 5; // over stock

    // Same persisted shape as the zustand store (version 1), written before the login page loads.
    await page.goto('/products', { timeout: SLOW });
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [
        CART_KEY,
        JSON.stringify({
          state: { lines: [{ variantId: iphoneId, quantity: 1 }, { variantId: dellId, quantity: requested }], lastValidatedAt: null },
          version: 1,
        }),
      ],
    );

    const puts: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'PUT' && new URL(r.url()).pathname === '/api/cart') puts.push(r.url());
    });
    const merge = page.waitForResponse((r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/cart', {
      timeout: SLOW,
    });
    await logInCustomer(page);
    const body = await (await merge).json();

    // Response body: only the over-stock line is adjusted; the valid line is not listed.
    expect(body.adjustments).toEqual([expect.objectContaining({ variantId: dellId, requested, applied: dellStock })]);
    // Plan says "N items were removed or reduced because of stock"; real text is singular for N=1.
    await expect(page.getByText('1 item was removed or reduced because of stock')).toBeVisible({ timeout: SLOW });

    const cart = (await (await api.get('/api/cart')).json()) as { lines: { variantId: string; quantity: number }[] };
    expect(Object.fromEntries(cart.lines.map((l) => [l.variantId, l.quantity]))).toEqual({
      [iphoneId]: 1,
      [dellId]: dellStock,
    });
    await expect
      .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{"state":{"lines":[]}}').state.lines, CART_KEY))
      .toEqual([]);
    expect(puts).toHaveLength(1); // a second PUT would double the quantities
  } finally {
    await context.close();
    await api.delete('/api/cart');
    await api.dispose();
  }
});

test('[E2E-PERF-07] checkout is never blocked by an unavailable line: it is removed and the form still renders', async ({ browser, playwright }) => {
  test.setTimeout(180_000);
  const api = await customerRequest(playwright);
  const context = await browser.newContext({ storageState: 'e2e/.auth/customer.json' });
  const page = await context.newPage();
  let restore: (() => Promise<void>) | undefined;
  try {
    // An address, so "Place order" can only be disabled by the cart issue.
    const address = await api.post('/api/addresses', {
      data: { recipientName: 'E2E PERF-07', recipientPhone: '01700000000', line1: '1 Test Road', city: 'Dhaka', country: 'BD' },
    });
    expect(address.ok()).toBe(true);

    // Lines are added while active (the API rejects inactive variants), then the iphone is deactivated.
    // A second, valid line is required: with the iphone alone, the cart ends up empty and /checkout shows
    // "Your cart is empty." (with the same notice) instead of the form.
    expect((await api.delete('/api/cart')).ok()).toBe(true);
    for (const sku of [IPHONE_SKU, MACBOOK_SKU]) {
      expect((await api.post('/api/cart', { data: { variantId: await variantId(sku), quantity: 1 } })).ok()).toBe(true);
    }
    restore = await setVariantActive(IPHONE_SKU, false);

    await page.goto('/checkout', { timeout: SLOW });
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible({ timeout: SLOW });
    await expect(page.getByText('We removed iPhone 15 Pro.')).toBeVisible({ timeout: SLOW });
    // The normal form, not a blocking card.
    await expect(page.getByText('Delivery address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Place order' })).toBeEnabled({ timeout: SLOW });

    const cart = (await (await api.get('/api/cart')).json()) as { lines: { sku: string }[] };
    expect(cart.lines.map((l) => l.sku)).toEqual([MACBOOK_SKU]);
  } finally {
    await restore?.();
    await context.close();
    await api.delete('/api/cart');
    await api.dispose();
  }
});
