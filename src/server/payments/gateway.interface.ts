import type { PaymentMethod, PaymentStatus } from '@prisma/client';

/**
 * Strategy interface for payment providers. Adding a new gateway
 * (e.g. Nagad) is one new file in `providers/` plus a registry entry.
 *
 * Boundary contract: gateways NEVER touch the DB directly. They only
 * translate between the gadget-website domain and the provider's API.
 * `payments.service.ts` owns persistence and idempotency.
 */

export interface PaymentInitInput {
  orderId: string;
  paymentId: string;
  /** Order number used for human-readable references in gateway logs. */
  orderNumber: string;
  amountCents: number;
  customer: { name: string; email: string; phone: string };
  /** Absolute URLs the gateway should redirect the user to. */
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  /** Server-to-server callback URL (IPN). Optional for providers that don't use one. */
  ipnUrl?: string;
}

export interface PaymentInitResult {
  /** URL the customer must be redirected to. */
  redirectUrl: string;
  /**
   * Reference assigned by the gateway during init (e.g. SSLCommerz
   * sessionkey, bKash paymentID). Stored on `Payment.providerRef` so
   * we can correlate callbacks idempotently.
   */
  providerRef?: string;
  /** Optional raw response captured for audit/debug. */
  rawPayload?: unknown;
}

/**
 * Outcome of validating a callback / IPN. The service decides whether
 * to apply the change to the DB; the provider just normalizes data.
 */
export interface CallbackOutcome {
  paymentId: string;
  status: Extract<PaymentStatus, 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'PENDING'>;
  providerRef: string;
  rawPayload: unknown;
}

export interface PaymentGateway {
  readonly method: PaymentMethod;
  init(input: PaymentInitInput): Promise<PaymentInitResult>;
  /**
   * Resolve a callback/IPN payload into a normalised outcome.
   * MUST throw on signature verification failure - callers handle the
   * error and respond with 400 to the gateway.
   */
  parseCallback(payload: unknown): Promise<CallbackOutcome>;
}
