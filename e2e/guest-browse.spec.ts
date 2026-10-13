import { expect, test } from '@playwright/test';
import { formatBDT } from './support/format';

test('[E2E-BROWSE-01] catalog lists products and the detail page shows the price', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
  const links = page.getByRole('main').locator('a[href^="/products/"]');
  await expect(links).toHaveCount(4);

  await page.locator('a[href="/products/iphone-15-pro"]').click();
  await expect(page).toHaveURL(/\/products\/iphone-15-pro$/);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(page.getByTestId('product-price')).toHaveText(formatBDT(16500000));
});

test('[E2E-BROWSE-02] unknown product returns 404', async ({ page }) => {
  const response = await page.goto('/products/does-not-exist');
  expect(response?.status()).toBe(404);
});
