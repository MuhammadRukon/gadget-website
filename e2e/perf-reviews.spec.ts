import { expect, test } from '@playwright/test';
import { IPHONE_SLUG, reviewAuthor, reviewBody, seedReviews } from './support/perf-db';

let removeReviews: () => Promise<void>;
test.beforeAll(async () => {
  removeReviews = await seedReviews();
});
// Reviews and their reviewers must not leak into later specs.
test.afterAll(async () => {
  await removeReviews?.();
});

test('[E2E-PERF-01] reviews are in the HTML, the full list loads on one click', async ({ page, request }) => {
  const html = await (await request.get(`/products/${IPHONE_SLUG}`)).text();
  expect(html).toContain(reviewBody(1));
  expect(html).toContain(reviewBody(10));
  expect(html).not.toContain(reviewBody(11));

  const reviewRequests: string[] = [];
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (pathname === '/api/reviews') reviewRequests.push(`${req.method()} ${req.url()}`);
  });

  await page.goto(`/products/${IPHONE_SLUG}`);
  await expect(page.getByText(reviewBody(10))).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(reviewRequests).toEqual([]);
  await expect(page.getByText('Loading reviews')).toHaveCount(0);

  // "First L." for a two-word name, the first name only for a single-word name.
  const items = page.getByRole('listitem').filter({ hasText: 'perf-review-' });
  await expect(items.filter({ hasText: `by ${reviewAuthor(1)} ·` })).toHaveCount(5);
  await expect(items.filter({ hasText: `by ${reviewAuthor(2)} ·` })).toHaveCount(5);
  await expect(page.getByText('Rahman')).toHaveCount(0);

  await page.getByRole('button', { name: 'Show all reviews' }).click();
  await expect(page.getByText(reviewBody(11))).toBeVisible();
  await expect(page.getByText(reviewBody(12))).toBeVisible();
  expect(reviewRequests).toHaveLength(1);
  expect(reviewRequests[0]).toMatch(/^GET /);
});
