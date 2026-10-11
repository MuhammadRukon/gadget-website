import { NextResponse } from 'next/server';

import { brandInputSchema } from '@/contracts/catalog';
import { catalogService } from '@/server/catalog/catalog.service';
import { jsonError, requireAdminSession } from '@/server/common/http';

export async function GET() {
  try {
    await requireAdminSession();
    const brands = await catalogService.listBrands();
    return NextResponse.json({ items: brands });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();
    const input = brandInputSchema.parse(await request.json());
    const brand = await catalogService.createBrand(input);
    return NextResponse.json({ brand }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
