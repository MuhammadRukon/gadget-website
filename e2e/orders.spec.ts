import { expect, test } from '@playwright/test';
import { variantStock } from './support/db';
import { createCodOrder } from './support/orders';
import { AUTH_FILE, IPHONE_SKU } from './support/seed';

test.use({ storageState: AUTH_FILE.customer });

test('[E2E-ORDER-01] customer cancels an order and the stock is restored', async ({ page, request }) => {
  const stockBefore = await variantStock(IPHONE_SKU);
  const order = await createCodOrder(request);
  expect(await variantStock(IPHONE_SKU)).toBe(stockBefore - 1);

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByTestId('order-status')).toHaveText('Confirmed');
  const cancel = page.getByRole('button', { name: 'Cancel order' });
  await expect(cancel).toBeDisabled();
  await page.getByPlaceholder("Tell us why you'd like to cancel").fill('e2e test');
  await expect(cancel).toBeEnabled();
  await cancel.click();

  await expect(page.getByText('Order cancelled', { exact: true })).toBeVisible();
  await expect(page.getByTestId('order-status')).toHaveText('Cancelled');
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  await expect(page.getByText('Cancelled by customer: e2e test')).toBeVisible();
  expect(await variantStock(IPHONE_SKU)).toBe(stockBefore);
});
