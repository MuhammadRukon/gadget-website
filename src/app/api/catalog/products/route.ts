import { NextResponse } from 'next/server';

import { productListQuerySchema } from '@/contracts/catalog';
import { catalogService } from '@/server/catalog/catalog.service';
import { jsonError } from '@/server/common/http';

export const revalidate = 60;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = productListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const data = await catalogService.listPublicProducts(query);
    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
