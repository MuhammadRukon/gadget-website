import { expect, test, type Page, type Response } from '@playwright/test';
import { activateVariant, setVariantActive, variantId, variantStock } from './support/db';
import { AUTH_HINT_KEY, guestCartJson, guestCartStorage, guestLines } from './support/guest-cart';
import { isCartPut, trackRequests } from './support/network';
import { clearCart, createAddress, customerRequest, ok } from './support/orders';
import { AUTH_FILE, DELL_SKU, IPHONE_SKU, MACBOOK_SKU, SEED } from './support/seed';
import { accountMenu, logIn } from './support/ui';

test.afterAll(() => activateVariant(IPHONE_SKU));

const hint = (page: Page) => page.evaluate((k) => localStorage.getItem(k), AUTH_HINT_KEY);
const isSummary = (r: Response) => {
  const u = new URL(r.url());
  return u.pathname === '/api/cart' && u.searchParams.get('view') === 'summary';
};

test('[E2E-PERF-03] auth hint is set on login, drives the summary request, and is cleared on logout', async ({ browser, playwright }) => {
  const api = await customerRequest(playwright);
  const context = await browser.newContext(); // fresh: no storage state
  const page = await context.newPage();
  try {
    // Server cart of 2 so the badge proves the count came from the server.
    await clearCart(api);
    await ok(await api.post('/api/cart', { data: { variantId: await variantId(IPHONE_SKU), quantity: 2 } }));

    await page.goto('/login'); // any app page will do to read the hint before login
    expect(await hint(page)).toBeNull();
    await logIn(page, SEED.customer.email, SEED.customer.password);
    await expect(page).toHaveURL('/');
    await expect.poll(() => hint(page)).toBe('1');

    const summary = page.waitForResponse(isSummary);
    await page.reload();
    expect((await summary).status()).toBe(200);
    await expect(page.getByLabel('2 items in cart', { exact: true })).toBeVisible();

    await accountMenu(page).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page.getByText('Logged out successfully')).toBeVisible();
    await expect.poll(() => hint(page)).toBeNull();
  } finally {
    await context.close();
    await api.delete('/api/cart');
    await api.dispose();
  }
});

test('[E2E-PERF-03] a forged hint as a guest gets 401 on the summary request and is cleared quietly', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Toasts live ~2 s, so a single check after networkidle could miss one: record every toast that ever mounts.
  const toasts: string[] = [];
  await page.exposeFunction('reportToast', (text: string) => void toasts.push(text));
  await page.addInitScript(() => {
    const selector = '[data-sonner-toast]';
    new MutationObserver((records) => {
      for (const node of records.flatMap((r) => [...r.addedNodes])) {
        if (!(node instanceof Element)) continue;
        const toast = node.matches(selector) ? node : node.querySelector(selector);
        if (toast) (window as unknown as { reportToast(t: string): void }).reportToast(toast.textContent ?? '');
      }
    }).observe(document, { childList: true, subtree: true });
  });
  try {
    await page.goto('/products');
    await page.evaluate((k) => localStorage.setItem(k, '1'), AUTH_HINT_KEY);

    const summary = page.waitForResponse(isSummary);
    await page.reload();
    expect((await summary).status()).toBe(401);
    await expect.poll(() => hint(page)).toBeNull();

    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/products$/); // no redirect to /login
    await expect(page.locator('[data-sonner-toast]')).toHaveCount(0); // no error toast now ...
    expect(toasts).toEqual([]); // ... and none ever appeared
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible(); // still a guest, header intact
  } finally {
    await context.close();
  }
});

test('[E2E-PERF-06] logging in merges the guest cart: clamped server cart, cleared store, adjustments toast', async ({ browser, playwright }) => {
  const iphoneId = await variantId(IPHONE_SKU);
  const dellId = await variantId(DELL_SKU);
  const dellStock = await variantStock(DELL_SKU);
  const requested = dellStock + 5; // over stock
  // The guest cart is in localStorage before the first page loads, so no page load is spent seeding it.
  const lines = [{ variantId: iphoneId, quantity: 1 }, { variantId: dellId, quantity: requested }];
  const context = await browser.newContext({ storageState: guestCartStorage(guestCartJson(lines)) });
  const page = await context.newPage();
  const api = await customerRequest(playwright);
  try {
    await clearCart(api);

    const puts = trackRequests(page, isCartPut);
    const merge = page.waitForResponse((r) => isCartPut(r.request()));
    await logIn(page, SEED.customer.email, SEED.customer.password);
    const body = await (await merge).json();

    // Response body: only the over-stock line is adjusted; the valid line is not listed.
    expect(body.adjustments).toEqual([expect.objectContaining({ variantId: dellId, requested, applied: dellStock })]);
    // The toast text is singular for N=1.
    await expect(page.getByText('1 item was removed or reduced because of stock')).toBeVisible();

    const cart = (await (await api.get('/api/cart')).json()) as { lines: { variantId: string; quantity: number }[] };
    expect(Object.fromEntries(cart.lines.map((l) => [l.variantId, l.quantity]))).toEqual({
      [iphoneId]: 1,
      [dellId]: dellStock,
    });
    await expect.poll(() => guestLines(page)).toEqual([]);
    expect(puts).toHaveLength(1); // a second PUT would double the quantities
  } finally {
    await context.close();
    await api.delete('/api/cart');
    await api.dispose();
  }
});

test('[E2E-PERF-07] checkout is never blocked by an unavailable line: it is removed and the form still renders', async ({ browser, playwright }) => {
  const api = await customerRequest(playwright);
  const context = await browser.newContext({ storageState: AUTH_FILE.customer });
  const page = await context.newPage();
  let restore: (() => Promise<void>) | undefined;
  try {
    await createAddress(api, 'E2E PERF-07'); // so "Place order" can only be disabled by the cart issue

    // Lines are added while active (the API rejects inactive variants), then the iphone is deactivated.
    // A second, valid line is required: with the iphone alone, the cart ends up empty and /checkout shows
    // "Your cart is empty." (with the same notice) instead of the form.
    await clearCart(api);
    for (const sku of [IPHONE_SKU, MACBOOK_SKU]) {
      await ok(await api.post('/api/cart', { data: { variantId: await variantId(sku), quantity: 1 } }));
    }
    restore = await setVariantActive(IPHONE_SKU, false);

    await page.goto('/checkout');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await expect(page.getByText('We removed iPhone 15 Pro.')).toBeVisible();
    // The normal form, not a blocking card.
    await expect(page.getByText('Delivery address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Place order' })).toBeEnabled();

    const cart = (await (await api.get('/api/cart')).json()) as { lines: { sku: string }[] };
    expect(cart.lines.map((l) => l.sku)).toEqual([MACBOOK_SKU]);
  } finally {
    await restore?.();
    await context.close();
    await api.delete('/api/cart');
    await api.dispose();
  }
});
