import { expect, test } from '@playwright/test';

test('[E2E-PERF-09] home page ships small woff2 fonts and the banner once', async ({ page }) => {
  const requested: string[] = [];
  const fontBytes: number[] = [];
  const pending: Promise<void>[] = [];
  page.on('request', (req) => requested.push(req.url()));
  page.on('response', (res) => {
    if (/\.(woff2?|ttf|otf)(\?|$)/.test(new URL(res.url()).pathname)) {
      pending.push(res.body().then((b) => void fontBytes.push(b.length)));
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);

  const fonts = requested.filter((u) => /\.(woff2?|ttf|otf)(\?|$)/.test(new URL(u).pathname));
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((u) => new URL(u).pathname.endsWith('.woff2'))).toBe(true);
  expect(requested.filter((u) => new URL(u).pathname.endsWith('.ttf'))).toEqual([]);
  expect(fontBytes.reduce((a, b) => a + b, 0)).toBeLessThan(200 * 1024);

  expect(requested.filter((u) => decodeURIComponent(u).includes('banner.webp'))).toHaveLength(1);
});
