import { expect, test } from '@playwright/test';
import { IPHONE_SKU, variantStock } from './support/db';
import { formatBDT } from './support/format';

test.use({ storageState: 'e2e/.auth/customer.json' });

test('[E2E-CHECKOUT-01] customer places a COD order through the UI', async ({ page, request }) => {
  // Start from an empty server cart so the order holds exactly the iphone.
  expect((await request.delete('/api/cart')).ok()).toBe(true);

  await page.goto('/products/iphone-15-pro');
  // While the session is still loading, "Add to cart" writes to the guest store, and the merge on /checkout can then
  // run twice (a navigation aborts the first PUT after the server applied it): quantity 2. Wait for the account menu.
  await expect(page.locator('header button[aria-haspopup="menu"]')).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
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
  await expect(page.getByTestId('checkout-subtotal')).toHaveText(formatBDT(16500000));
  await expect(page.getByTestId('checkout-total')).toHaveText(formatBDT(16500000));
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
  expect((await request.delete('/api/cart')).ok()).toBe(true);

  await page.goto('/checkout');
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place order', disabled: false })).toHaveCount(0);
});
