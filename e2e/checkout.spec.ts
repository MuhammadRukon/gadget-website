import { expect, test } from '@playwright/test';
import { variantStock } from './support/db';
import { formatBDT } from './support/format';
import { clearCart } from './support/orders';
import { AUTH_FILE, IPHONE_PRICE_CENTS, IPHONE_SKU, IPHONE_SLUG } from './support/seed';
import { accountMenu, addToCart } from './support/ui';

test.use({ storageState: AUTH_FILE.customer });

test('[E2E-CHECKOUT-01] customer places a COD order through the UI', async ({ page, request }) => {
  // Start from an empty server cart so the order holds exactly the iphone.
  await clearCart(request);

  await page.goto(`/products/${IPHONE_SLUG}`);
  // While the session is still loading, "Add to cart" writes to the guest store, and the merge on /checkout can then
  // run twice (a navigation aborts the first PUT after the server applied it): quantity 2. Wait for the account menu.
  await expect(accountMenu(page)).toBeVisible();
  await addToCart(page);
  await expect(page.getByText('Added to cart')).toBeVisible();

  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Add new address' }).click();
  await page.getByLabel('Recipient name').fill(`E2E ${Date.now()}`);
  await page.getByLabel('Phone').fill('01700000000');
  await page.getByLabel('Address line 1').fill('1 Test Road');
  await page.getByLabel('City').fill('Dhaka');
  await page.getByRole('button', { name: 'Add address' }).click();
  await expect(page.getByText('Address saved')).toBeVisible();

  await expect(page.getByRole('radio', { name: 'Cash on delivery (COD)' })).toBeChecked();
  // Free shipping above Tk 5,000, so the total equals the subtotal.
  await expect(page.getByTestId('checkout-subtotal')).toHaveText(formatBDT(IPHONE_PRICE_CENTS));
  await expect(page.getByTestId('checkout-total')).toHaveText(formatBDT(IPHONE_PRICE_CENTS));
  const placeOrder = page.getByRole('button', { name: 'Place order' });
  await expect(placeOrder).toBeEnabled();

  const stockBefore = await variantStock(IPHONE_SKU);
  await placeOrder.click();

  await expect(page).toHaveURL(/\/orders\/[a-z0-9]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Order T-[0-9A-Z]+-[0-9A-F]{6}$/);
  await expect(page.getByTestId('order-status')).toHaveText('Confirmed');
  await expect(page.getByText('Payment: COD')).toBeVisible();
  expect(await variantStock(IPHONE_SKU)).toBe(stockBefore - 1);
});

test('[E2E-CHECKOUT-02] empty cart shows no way to place an order', async ({ page, request }) => {
  await clearCart(request);

  await page.goto('/checkout');
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  // The empty-cart card renders no form, so assert the empty state positively (a way back to the catalog) and the
  // button's absence in any state (no disabled/enabled filter a rename could hide behind).
  await expect(page.getByRole('link', { name: 'Browse products' })).toHaveAttribute('href', '/products');
  await expect(page.getByRole('button', { name: /place order/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toHaveCount(0);
});
