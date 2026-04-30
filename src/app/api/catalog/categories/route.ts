import { NextResponse } from 'next/server';
import { catalogService } from '@/server/catalog/catalog.service';

export const revalidate = 60;

export async function GET() {
  const items = await catalogService.listPublicCategories();
  return NextResponse.json({ items });
}
