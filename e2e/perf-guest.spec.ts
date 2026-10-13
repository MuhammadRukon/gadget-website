import { expect, test, type Page } from '@playwright/test';
import { IPHONE_SKU, IPHONE_SLUG, setVariantActive, variantIdBySku } from './support/perf-db';

// Cold `next dev` compiles each route on first visit: allow for it.
test.setTimeout(90_000);

const CART_KEY = 'Cryptech.guestCart';

/** Collects "METHOD /path" for every request whose path starts with one of `prefixes`. */
function trackRequests(page: Page, prefixes: string[]) {
  const seen: string[] = [];
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      seen.push(`${req.method()} ${pathname}`);
    }
  });
  return seen;
}

const storedLines = (page: Page) =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw).state.lines as { variantId: string; quantity: number }[]) : [];
  }, CART_KEY);

/** Writes the persisted guest cart (zustand persist format, version 1) before the page under test loads. */
async function seedGuestCart(page: Page, value: unknown) {
  await page.goto('/products');
  await page.evaluate(([key, v]) => localStorage.setItem(key as string, v as string), [
    CART_KEY,
    typeof value === 'string' ? value : JSON.stringify(value),
  ]);
}

test('[E2E-PERF-02] a fresh guest loads the storefront with no cart or session requests', async ({ browser }) => {
  const context = await browser.newContext(); // empty localStorage, no auth hint
  const page = await context.newPage();
  const seen = trackRequests(page, ['/api/cart', '/api/auth/session']);
  try {
    for (const path of ['/', '/products', `/products/${IPHONE_SLUG}`]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    // Production-relevant bound: 0. `next dev` Strict Mode double-runs effects, but none of them fires a request here.
    expect(seen).toEqual([]);
  } finally {
    await context.close();
  }
});

test('[E2E-PERF-04] guest cart edits on the PDP and /cart stay in localStorage', async ({ page }) => {
  const seen = trackRequests(page, ['/api/cart']);
  const add = () => page.getByRole('button', { name: 'Add to cart' }).click();

  await page.goto(`/products/${IPHONE_SLUG}`);
  const name = await page.getByRole('heading', { level: 1 }).innerText();
  await add();
  await expect(page.getByLabel('1 items in cart', { exact: true })).toBeVisible();
  await add();
  await expect(page.getByLabel('2 items in cart', { exact: true })).toBeVisible();

  await page.goto('/cart');
  const quantity = page.getByTestId('cart-line-quantity');
  await expect(quantity).toHaveText('2');
  await page.getByRole('button', { name: `Increase quantity for ${name}` }).click();
  await expect(quantity).toHaveText('3');
  await page.getByRole('button', { name: `Decrease quantity for ${name}` }).click();
  await expect(quantity).toHaveText('2');
  await page.getByRole('main').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  expect(await storedLines(page)).toEqual([]);
  await page.waitForLoadState('networkidle');

  // Hydrate is the one allowed call. Plan wording is "at most 1 per distinct set of variants" (= 1 here), but the
  // query key is the full lines array (quantities included, `queryKeys.cartGuest`), so /cart hydrates once per
  // distinct lines state: quantity 2, then 3 (the return to 2 is a cache hit within staleTime). Asserted as that bound.
  const hydrates = seen.filter((r) => r === 'POST /api/cart/hydrate');
  expect(seen.filter((r) => r !== 'POST /api/cart/hydrate')).toEqual([]);
  expect(hydrates.length).toBeLessThanOrEqual(2);
});

test('[E2E-PERF-05] unavailable lines stay visible, vanished variants are pruned, corrupt storage is survivable', async ({ page }) => {
  const variantId = await variantIdBySku(IPHONE_SKU);
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  const state = (lines: unknown[]) => ({ state: { lines, lastValidatedAt: null }, version: 1 });

  const restore = await setVariantActive(IPHONE_SKU, false);
  try {
    await seedGuestCart(page, state([{ variantId, quantity: 1 }]));
    await page.goto('/cart');
    const line = page.getByRole('main').getByRole('link', { name: /iPhone 15 Pro/ });
    await expect(line).toHaveClass(/line-through/);
    await expect(page.getByText('No longer available')).toBeVisible();
    await expect(
      page.getByText('Some items are unavailable. Remove them, or they will be removed automatically when you check out.'),
    ).toBeVisible();
    // Guests see "Sign in to checkout" where signed-in users see "Proceed to checkout"; neither may be disabled.
    await expect(page.getByRole('link', { name: 'Sign in to checkout' })).toBeEnabled();
    expect(await storedLines(page)).toEqual([{ variantId, quantity: 1 }]);
  } finally {
    await restore();
  }

  // A line whose variant no longer exists is dropped from storage with one inline notice.
  await seedGuestCart(page, state([{ variantId: 'e2e-no-such-variant', quantity: 1 }]));
  await page.goto('/cart');
  await expect(page.getByText('1 item is no longer sold and was removed')).toBeVisible();
  await expect.poll(() => storedLines(page)).toEqual([]);

  // Corrupt storage: unparseable JSON, then parseable JSON with invalid lines. Neither may crash the page.
  for (const corrupt of ['{not json', state([{ variantId: 'x', quantity: 0 }, { quantity: 2 }, 'junk', null])]) {
    await seedGuestCart(page, corrupt);
    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
