import { NextResponse } from 'next/server';
import { catalogService } from '@/server/catalog/catalog.service';

export const revalidate = 60;

export async function GET() {
  const items = await catalogService.listPublicBrands();
  return NextResponse.json({ items }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
}
