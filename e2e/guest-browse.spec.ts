import { expect, test } from '@playwright/test';
import { formatBDT } from './support/format';
import { IPHONE_PRICE_CENTS, IPHONE_SLUG } from './support/seed';

test('[E2E-BROWSE-01] catalog lists products and the detail page shows the price', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
  const links = page.getByRole('main').locator('a[href^="/products/"]');
  await expect(links).toHaveCount(4);

  await page.locator(`a[href="/products/${IPHONE_SLUG}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/products/${IPHONE_SLUG}$`));
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
  await expect(page.getByTestId('product-price')).toHaveText(formatBDT(IPHONE_PRICE_CENTS));
});

test('[E2E-BROWSE-02] unknown product returns 404', async ({ page }) => {
  const response = await page.goto('/products/does-not-exist');
  expect(response?.status()).toBe(404);
});
