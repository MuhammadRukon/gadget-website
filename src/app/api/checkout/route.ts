import { NextResponse } from 'next/server';

import { checkoutInputSchema } from '@/contracts/checkout';
import { checkoutService } from '@/server/checkout/checkout.service';
import { jsonError, requireSession } from '@/server/common/http';
import { clientIp, enforceRateLimit } from '@/server/common/rate-limit';
import { paymentsService } from '@/server/payments/payments.service';

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    enforceRateLimit(`checkout:${user.id}:${clientIp(request)}`, {
      max: 10,
      windowMs: 60 * 1000,
    });
    const input = checkoutInputSchema.parse(await request.json());
    const { order, paymentId } = await checkoutService.placeOrder(user.id, input);

    const origin = new URL(request.url).origin;
    const initiated = await paymentsService.kickoff(paymentId, { origin });

    return NextResponse.json(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
        paymentId: initiated.paymentId,
        redirectUrl: initiated.redirectUrl,
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err);
  }
}
