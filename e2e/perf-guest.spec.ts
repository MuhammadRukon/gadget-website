import { expect, test } from '@playwright/test';
import { activateVariant, setVariantActive, variantId } from './support/db';
import { guestCartJson, guestLines, seedGuestCart } from './support/guest-cart';
import { trackRequests, underPaths } from './support/network';
import { IPHONE_SKU, IPHONE_SLUG } from './support/seed';
import { addToCart, productName } from './support/ui';

test.afterAll(() => activateVariant(IPHONE_SKU));

test('[E2E-PERF-02] a fresh guest loads the storefront with no cart or session requests', async ({ browser }) => {
  const context = await browser.newContext(); // empty localStorage, no auth hint
  const page = await context.newPage();
  const seen = trackRequests(page, underPaths('/api/cart', '/api/auth/session'));
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
  const seen = trackRequests(page, underPaths('/api/cart'));

  await page.goto(`/products/${IPHONE_SLUG}`);
  const name = await productName(page);
  await addToCart(page);
  await expect(page.getByLabel('1 items in cart', { exact: true })).toBeVisible();
  await addToCart(page);
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
  expect(await guestLines(page)).toEqual([]);
  await page.waitForLoadState('networkidle');

  // Hydrate is the one allowed call. The query key is the full lines array (`queryKeys.cartGuest`), so /cart hydrates
  // once per distinct lines state: quantity 2, then 3 (the return to 2 is a cache hit within staleTime).
  const hydrates = seen.filter((r) => r === 'POST /api/cart/hydrate');
  expect(seen.filter((r) => r !== 'POST /api/cart/hydrate')).toEqual([]);
  expect(hydrates.length).toBeLessThanOrEqual(2);
});

test('[E2E-PERF-05] unavailable lines stay visible, vanished variants are pruned, corrupt storage is survivable', async ({ page }) => {
  const iphoneId = await variantId(IPHONE_SKU);
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));

  await page.goto('/products'); // the app origin, so localStorage can be seeded below
  const restore = await setVariantActive(IPHONE_SKU, false);
  try {
    await seedGuestCart(page, guestCartJson([{ variantId: iphoneId, quantity: 1 }]));
    await page.goto('/cart');
    const line = page.getByRole('main').getByRole('link', { name: /iPhone 15 Pro/ });
    await expect(line).toHaveClass(/line-through/);
    await expect(page.getByText('No longer available')).toBeVisible();
    await expect(
      page.getByText('Some items are unavailable. Remove them, or they will be removed automatically when you check out.'),
    ).toBeVisible();
    // Guests see "Sign in to checkout" where signed-in users see "Proceed to checkout"; neither may be disabled.
    const signIn = page.getByRole('link', { name: 'Sign in to checkout' });
    await expect(signIn).toBeEnabled();
    await expect(signIn).toHaveAttribute('href', '/login?callbackUrl=/checkout');
    expect(await guestLines(page)).toEqual([{ variantId: iphoneId, quantity: 1 }]);
  } finally {
    await restore();
  }

  // A line whose variant no longer exists is dropped from storage with one inline notice.
  await seedGuestCart(page, guestCartJson([{ variantId: 'e2e-no-such-variant', quantity: 1 }]));
  await page.goto('/cart');
  await expect(page.getByText('1 item is no longer sold and was removed')).toBeVisible();
  await expect.poll(() => guestLines(page)).toEqual([]);

  // Corrupt storage: unparseable JSON, then parseable JSON with invalid lines. Neither may crash the page.
  const invalidLines = guestCartJson([{ variantId: 'x', quantity: 0 }, { quantity: 2 }, 'junk', null]);
  for (const corrupt of ['{not json', invalidLines]) {
    await seedGuestCart(page, corrupt);
    await page.goto('/cart');
    await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
