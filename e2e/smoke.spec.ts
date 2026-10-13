import { expect, test } from '@playwright/test';

test('[E2E-INFRA-02] home page renders the seeded catalog', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Featured products' })).toBeVisible();
  await expect(page.getByRole('main').locator('a[href^="/products/"]')).toHaveCount(4);
});
