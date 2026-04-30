import { PaymentMethod } from '@prisma/client';

import type { PaymentGateway } from '../gateway.interface';

/**
 * Cash on Delivery provider. The "init" step has no remote call - we
 * simply tell the client there's nothing to redirect to. The actual
 * payment is collected when the courier hands over the parcel; admin
 * marks the order as paid via `/api/admin/payments/[id]/verify`.
 *
 * We still implement the strategy interface so the rest of the system
 * can treat every method uniformly.
 */
export const codGateway: PaymentGateway = {
  method: PaymentMethod.COD,
  async init() {
    return { redirectUrl: '' };
  },
  async parseCallback() {
    throw new Error('COD does not use callbacks');
  },
};
