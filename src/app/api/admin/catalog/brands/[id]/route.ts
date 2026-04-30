import { NextResponse } from 'next/server';

import { brandInputSchema } from '@/contracts/catalog';
import { catalogService } from '@/server/catalog/catalog.service';
import { jsonError, requireAdminSession } from '@/server/common/http';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    await requireAdminSession();
    const { id } = await ctx.params;
    const input = brandInputSchema.parse(await request.json());
    const brand = await catalogService.updateBrand(id, input);
    return NextResponse.json({ brand });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_: Request, ctx: Ctx) {
  try {
    await requireAdminSession();
    const { id } = await ctx.params;
    await catalogService.deleteBrand(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
