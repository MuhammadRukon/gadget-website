import { expect, test, type Request } from '@playwright/test';

const FONT = /\.(woff2?|ttf|otf)$/;

test('[E2E-PERF-09] home page ships small woff2 fonts and the banner once', async ({ page }) => {
  const requests: Request[] = [];
  page.on('request', (req) => requests.push(req));

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Any .ttf/.otf request lands in this list too, so the woff2 check below fails on it.
  const fonts = requests.filter((req) => FONT.test(new URL(req.url()).pathname));
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((req) => new URL(req.url()).pathname.endsWith('.woff2'))).toBe(true);
  const sizes = await Promise.all(fonts.map(async (req) => (await (await req.response())!.body()).length));
  expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(200 * 1024);

  expect(requests.filter((req) => decodeURIComponent(req.url()).includes('banner.webp'))).toHaveLength(1);
});
