import { NextResponse } from 'next/server';

import { reviewInputSchema } from '@/contracts/reviews';
import { reviewsService } from '@/server/reviews/reviews.service';
import { jsonError, requireSession } from '@/server/common/http';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    if (!productId) {
      return NextResponse.json({ items: [] });
    }
    const [items, summary] = await Promise.all([
      reviewsService.listForProduct(productId),
      reviewsService.summaryForProduct(productId),
    ]);
    return NextResponse.json({ items, summary });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const input = reviewInputSchema.parse(await request.json());
    const review = await reviewsService.submit(user.id, input);
    return NextResponse.json({ review }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
