import { NextResponse } from 'next/server';

import { productListQuerySchema } from '@/contracts/catalog';
import { catalogService } from '@/server/catalog/catalog.service';
import { jsonError } from '@/server/common/http';
import { clientIp, enforceRateLimit } from '@/server/common/rate-limit';

export const revalidate = 60;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    // shortcut: only text search is limited, and it fails open when Redis is down (q is capped at 100 chars); upgrade to the Postgres fallback once Redis is always on.
    if (url.searchParams.get('q')) {
      await enforceRateLimit(`catalog-q:${clientIp(request)}`, { max: 120, windowMs: 60_000 }, { fallback: 'none' });
    }
    const query = productListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const data = await catalogService.listPublicProducts(query);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
  } catch (err) {
    return jsonError(err);
  }
}
