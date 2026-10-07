import { NextResponse } from 'next/server';

import { submitCustomerTxnIdSchema } from '@/contracts/payments';
import { jsonError, requireSession } from '@/server/common/http';
import { enforceUserRateLimits } from '@/server/common/rate-limit';
import { paymentsService } from '@/server/payments/payments.service';

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    // Per-user cap as well as user+IP: the IP bucket alone is evaded by rotating IPs.
    await enforceUserRateLimits('txn-id', user.id, request);
    const { paymentId, txnId } = submitCustomerTxnIdSchema.parse(await request.json());
    const payment = await paymentsService.submitCustomerTxnId(user.id, paymentId, txnId);
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
