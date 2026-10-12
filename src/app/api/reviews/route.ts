import { NextResponse } from 'next/server';

import { reviewInputSchema } from '@/contracts/reviews';
import { reviewsService } from '@/server/reviews/reviews.service';
import { jsonError, requireSession } from '@/server/common/http';
import { enforceRateLimit } from '@/server/common/rate-limit';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    if (!productId) {
      return NextResponse.json({ items: [] });
    }
    // Summary is rendered server-side on the PDP; the list is all the client needs.
    const items = await reviewsService.listForProduct(productId);
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    await enforceRateLimit(`review:${user.id}`, { max: 10, windowMs: 3_600_000 });
    const input = reviewInputSchema.parse(await request.json());
    const review = await reviewsService.submit(user.id, input);
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
