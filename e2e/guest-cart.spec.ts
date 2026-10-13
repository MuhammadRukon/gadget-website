import { expect, test } from '@playwright/test';
import { guestLines } from './support/guest-cart';
import { IPHONE_SLUG } from './support/seed';
import { addToCart, productName } from './support/ui';

test('[E2E-CART-01] guest adds twice, cart persists across reload', async ({ page }) => {
  await page.goto(`/products/${IPHONE_SLUG}`);

  await addToCart(page);
  // Sonner toasts live about 2 s: assert right after the click.
  await expect(page.getByText('Added to cart')).toBeVisible();
  await expect(page.getByLabel('1 items in cart', { exact: true })).toBeVisible();
  expect(await guestLines(page)).toEqual([expect.objectContaining({ quantity: 1 })]);

  await addToCart(page);
  await expect(page.getByLabel('2 items in cart', { exact: true })).toBeVisible();
  expect(await guestLines(page)).toEqual([expect.objectContaining({ quantity: 2 })]);

  await page.goto('/cart');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
  await expect(page.getByTestId('cart-line-quantity')).toHaveText('2');
  await expect(page.getByRole('link', { name: 'Sign in to checkout' })).toHaveAttribute(
    'href',
    '/login?callbackUrl=/checkout',
  );
});

test('[E2E-CART-02] guest increases then removes a cart line', async ({ page }) => {
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

  await page.getByRole('main').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Your cart is empty.')).toBeVisible();
  expect(await guestLines(page)).toEqual([]);
});
