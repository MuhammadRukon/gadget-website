import { PaymentMethod } from '@prisma/client';

import { bankTransferGateway } from './providers/bank-transfer';
import { bkashGateway } from './providers/bkash';
import { codGateway } from './providers/cod';
import { sslcommerzGateway } from './providers/sslcommerz';

import type { PaymentGateway } from './gateway.interface';

const REGISTRY: Record<PaymentMethod, PaymentGateway> = {
  [PaymentMethod.COD]: codGateway,
  [PaymentMethod.SSLCOMMERZ]: sslcommerzGateway,
  [PaymentMethod.BKASH]: bkashGateway,
  [PaymentMethod.BANK_TRANSFER]: bankTransferGateway,
};

export function getGateway(method: PaymentMethod): PaymentGateway {
  return REGISTRY[method];
}
