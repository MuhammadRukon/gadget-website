import { z } from 'zod';

export const checkoutInputSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(['COD', 'SSLCOMMERZ', 'BKASH', 'BANK_TRANSFER']),
  couponCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export interface CheckoutQuote {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  couponCode: string | null;
}
