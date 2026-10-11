import { NextResponse } from 'next/server';
import { z } from 'zod';

import { guestCartLineSchema } from '@/contracts/cart';
import { cartService } from '@/server/cart/cart.service';
import { jsonError } from '@/server/common/http';

const bodySchema = z.object({ lines: z.array(guestCartLineSchema) });

export async function POST(request: Request) {
  try {
    const { lines } = bodySchema.parse(await request.json());
    const cart = await cartService.hydrateGuestCart(lines);
    return NextResponse.json(cart);
  } catch (err) {
    return jsonError(err);
  }
}
