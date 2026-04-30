import { NextResponse } from 'next/server';
import { catalogService } from '@/server/catalog/catalog.service';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

export async function GET() {
  const items = await catalogService.listPublicBrands();
  return NextResponse.json({ items });
}
