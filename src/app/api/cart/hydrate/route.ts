import { NextResponse } from 'next/server';
import { hydrateBodySchema } from '@/contracts/cart';
import { cartService } from '@/server/cart/cart.service';
import { jsonError } from '@/server/common/http';
import { clientIp, enforceRateLimit } from '@/server/common/rate-limit';

export async function POST(request: Request) {
  try {
    // shortcut: fail-open when Redis is down (no Postgres limiter on this hot public path); cost is bounded by the 50-line cap. Upgrade to the Postgres fallback once Redis is always on.
    await enforceRateLimit(`hydrate:${clientIp(request)}`, { max: 60, windowMs: 60_000 }, { fallback: 'none' });
    const { lines } = hydrateBodySchema.parse(await request.json());
    const cart = await cartService.hydrateGuestCart(lines);
    return NextResponse.json(cart);
  } catch (err) {
    return jsonError(err);
  }
}
