import { expect, test } from '@playwright/test';

test.describe('anonymous', () => {
  test('[E2E-GUARD-01] guarded pages redirect to /login, admin API returns 401', async ({ page, request }) => {
    await page.goto('/account');
    await expect(page).toHaveURL('/login?callbackUrl=%2Faccount');
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login?callbackUrl=%2Fdashboard');
    // /checkout is guarded server-side (not by proxy.ts), so its callbackUrl is not percent-encoded.
    await page.goto('/checkout');
    await expect(page).toHaveURL('/login?callbackUrl=/checkout');

    const res = await request.get('/api/admin/orders');
    expect(res.status()).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

test.describe('customer', () => {
  test.use({ storageState: 'e2e/.auth/customer.json' });

  test('[E2E-GUARD-02] customer cannot reach admin pages or API', async ({ page, request }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login?callbackUrl=%2Fdashboard');

    const res = await request.get('/api/admin/orders');
    expect(res.status()).toBe(401);
  });
});
