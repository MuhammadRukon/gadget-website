import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkoutService } from '@/server/checkout/checkout.service';
import { jsonError, requireSession } from '@/server/common/http';
import { enforceRateLimit } from '@/server/common/rate-limit';

const quoteSchema = z.object({
  addressId: z.string().min(1),
  couponCode: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    await enforceRateLimit(`quote:${user.id}`, { max: 30, windowMs: 60_000 });
    const input = quoteSchema.parse(await request.json());
    const quote = await checkoutService.quote({ userId: user.id, ...input });
    return NextResponse.json(quote);
  } catch (err) {
    return jsonError(err);
  }
}
