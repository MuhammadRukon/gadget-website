import { expect, test } from '@playwright/test';
import { exactPath, trackRequests } from './support/network';
import { IPHONE_SLUG } from './support/seed';

const PREVIEW_API = exactPath('/api/catalog/products');

test('[E2E-PERF-08] header search waits for 3 characters and caches the result', async ({ page }) => {
  await page.goto('/');
  const search = page.getByPlaceholder('Search products');
  await expect(search).toBeVisible();
  const previews = trackRequests(page, PREVIEW_API);
  // The hook debounces 400 ms; wait comfortably past it before asserting "nothing was sent".
  const pastDebounce = () => page.waitForTimeout(600);

  // Below 640 px (Pixel 7) the search bar is collapsed behind a toggle: open it like a user would.
  const toggle = page.getByLabel('Toggle search');
  if (await toggle.isVisible()) await toggle.click();
  await search.click();
  await search.pressSequentially('ip', { delay: 50 });
  await pastDebounce();
  expect(previews).toHaveLength(0);

  // Clearing the input mid-flight would abort the fetch, skip the cache write and fake a miss below: let it finish.
  const firstResponse = page.waitForResponse((res) => PREVIEW_API(res.request()));
  await search.pressSequentially('h', { delay: 50 });
  await firstResponse;
  // The cache is written before the panel renders the result, so a visible result means the entry exists.
  await expect(page.locator(`header a[href="/products/${IPHONE_SLUG}"]`)).toBeVisible();
  await pastDebounce();
  expect(previews).toHaveLength(1);

  // Same query again within 60 s is served from the in-memory cache.
  await search.fill('');
  await search.pressSequentially('iph', { delay: 50 });
  await pastDebounce();
  expect(previews).toHaveLength(1);
});
