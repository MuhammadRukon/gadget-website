import type { Page, Request } from '@playwright/test';

export const exactPath = (path: string) => (req: Request) => new URL(req.url()).pathname === path;

/** Matches the paths themselves and anything below them (`/api/cart` and `/api/cart/hydrate`). */
export const underPaths = (...prefixes: string[]) => (req: Request) => {
  const { pathname } = new URL(req.url());
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
};

export const isCartPut = (req: Request) => req.method() === 'PUT' && exactPath('/api/cart')(req);

/** Collects "METHOD /path" for every request `match` accepts, from now on. */
export function trackRequests(page: Page, match: (req: Request) => boolean) {
  const seen: string[] = [];
  page.on('request', (req) => {
    if (match(req)) seen.push(`${req.method()} ${new URL(req.url()).pathname}`);
  });
  return seen;
}
