import { z } from 'zod';

/**
 * Customer-facing payloads. Admin-facing schemas live in
 * `src/contracts/admin.ts` if/when they grow beyond a single use.
 */

export const submitBankReferenceSchema = z.object({
  paymentId: z.string().min(1),
  bankRef: z.string().min(3).max(80),
});
export type SubmitBankReferenceInput = z.infer<typeof submitBankReferenceSchema>;

export const verifyPaymentSchema = z.object({
  /** Defaults to SUCCEEDED. Admins can also mark a manual transfer as FAILED. */
  outcome: z.enum(['SUCCEEDED', 'FAILED']).default('SUCCEEDED'),
  note: z.string().max(300).optional(),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export interface InitiatedPayment {
  paymentId: string;
  /**
   * Where the client should redirect the user. `null` means the
   * payment is already terminal (e.g. COD auto-confirmed) and the
   * client should go to the order detail page instead.
   */
  redirectUrl: string | null;
}
