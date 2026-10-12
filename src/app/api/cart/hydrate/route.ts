import { NextResponse } from 'next/server';
import { hydrateBodySchema } from '@/contracts/cart';
import { cartService } from '@/server/cart/cart.service';
import { jsonError } from '@/server/common/http';
import { clientIp, enforceRateLimit } from '@/server/common/rate-limit';

export async function POST(request: Request) {
  try {
    // shortcut: fails open when Redis is absent/failing; cost bounded by caps (q max 100, hydrate lines max 50); upgrade to a per-instance in-memory fixed window when Redis is always on.
    await enforceRateLimit(`hydrate:${clientIp(request)}`, { max: 120, windowMs: 60_000 }, { fallback: 'none' });
    const { lines } = hydrateBodySchema.parse(await request.json());
    const cart = await cartService.hydrateGuestCart(lines);
    return NextResponse.json(cart);
  } catch (err) {
    return jsonError(err);
  }
}
