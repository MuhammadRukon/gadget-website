import { PaymentMethod } from '@prisma/client';

import { bankTransferGateway } from './providers/bank-transfer';
import { bkashGateway } from './providers/bkash';
import { codGateway } from './providers/cod';
import { sslcommerzGateway } from './providers/sslcommerz';
import { hasGatewayCreds } from './gateway-creds';

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

/**
 * True when the method can be offered to customers: COD and bank transfer
 * always, gateways only when their credentials are present (otherwise they
 * would fall back to the self-payable sandbox harness).
 */
export function gatewayConfigured(method: PaymentMethod): boolean {
  return hasGatewayCreds(method, process.env);
}
