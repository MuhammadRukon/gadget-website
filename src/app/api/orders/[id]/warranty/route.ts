import { NextResponse } from 'next/server';

import { submitWarrantySchema } from '@/contracts/warranty';
import { warrantyService } from '@/server/warranty/warranty.service';
import { jsonError, requireSession } from '@/server/common/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await requireSession();
    const { id } = await params;
    const { reason } = submitWarrantySchema.parse(await request.json());
    const warranty = await warrantyService.submit(user.id, id, reason);
    return NextResponse.json({ warranty }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
