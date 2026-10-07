import { NextResponse } from 'next/server';

import { submitCustomerTxnIdSchema } from '@/contracts/payments';
import { jsonError, requireSession } from '@/server/common/http';
import { clientIp, enforceRateLimit } from '@/server/common/rate-limit';
import { paymentsService } from '@/server/payments/payments.service';

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    await enforceRateLimit(`txn-id:${user.id}:${clientIp(request)}`, {
      max: 10,
      windowMs: 10 * 60 * 1000,
    });
    // Per-user cap as well: the user+IP bucket alone is evaded by rotating IPs.
    await enforceRateLimit(`txn-id-user:${user.id}`, {
      max: 30,
      windowMs: 10 * 60 * 1000,
    });
    const { paymentId, txnId } = submitCustomerTxnIdSchema.parse(await request.json());
    const payment = await paymentsService.submitCustomerTxnId(user.id, paymentId, txnId);
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
