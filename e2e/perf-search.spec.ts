import { expect, test } from '@playwright/test';

// Cold `next dev` compiles each route on first visit: allow for it.
test.setTimeout(90_000);

test('[E2E-PERF-08] header search waits for 3 characters and caches the result', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  let previewRequests = 0;
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/catalog/products') previewRequests += 1;
  });
  const search = page.getByPlaceholder('Search products');
  // The hook debounces 400 ms; wait comfortably past it before asserting "nothing was sent".
  const pastDebounce = () => page.waitForTimeout(900);

  await search.click();
  await search.pressSequentially('ip', { delay: 50 });
  await pastDebounce();
  expect(previewRequests).toBe(0);

  // Cold start: the first request compiles /api/catalog/products in `next dev`, so wait generously for it to
  // finish. Clearing the input mid-flight aborts the fetch, which would skip the cache write and fake a miss below.
  const firstResponse = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/catalog/products',
    { timeout: 60_000 },
  );
  await search.pressSequentially('h', { delay: 50 });
  await firstResponse;
  // The cache is written before the panel renders the result, so a visible result means the entry exists.
  await expect(page.locator(`header a[href="/products/iphone-15-pro"]`)).toBeVisible({ timeout: 30_000 });
  await pastDebounce();
  expect(previewRequests).toBe(1);

  // Same query again within 60 s is served from the in-memory cache.
  await search.fill('');
  await search.pressSequentially('iph', { delay: 50 });
  await pastDebounce();
  expect(previewRequests).toBe(1);
});
