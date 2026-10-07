import { NextResponse } from 'next/server';

import { txnCheckSchema, type TxnCheckResult } from '@/contracts/payments';
import { jsonError, requireSession } from '@/server/common/http';
import { clientIp, enforceRateLimit } from '@/server/common/rate-limit';
import { paymentsService } from '@/server/payments/payments.service';

/**
 * Tells a customer whether a transaction id is already in use. Boolean-only
 * by design (no order id/number): auth + rate limit make it a poor
 * enumeration oracle.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    await enforceRateLimit(`txn-check:${user.id}:${clientIp(request)}`, {
      max: 10,
      windowMs: 10 * 60 * 1000,
    });
    // Per-user cap as well: the user+IP bucket alone is evaded by rotating IPs.
    await enforceRateLimit(`txn-check-user:${user.id}`, {
      max: 30,
      windowMs: 10 * 60 * 1000,
    });
    const { txnId } = txnCheckSchema.parse(await request.json());
    const body: TxnCheckResult = { exists: await paymentsService.txnIdExists(txnId) };
    return NextResponse.json(body);
  } catch (err) {
    return jsonError(err);
  }
}
