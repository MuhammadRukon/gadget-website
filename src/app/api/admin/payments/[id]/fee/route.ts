import { NextResponse } from 'next/server';

import { verifyCodFeeSchema } from '@/contracts/payments';
import { jsonError, requireAdminSession } from '@/server/common/http';
import { paymentsService } from '@/server/payments/payments.service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;
    const { outcome, note } = verifyCodFeeSchema.parse(await request.json());
    const payment = await paymentsService.verifyCodFee(admin.id, id, outcome, note);
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
