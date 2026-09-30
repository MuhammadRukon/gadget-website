import { z } from 'zod';

export const checkoutInputSchema = z.object({
  addressId: z.string().min(1),
  paymentMethod: z.enum(['COD', 'SSLCOMMERZ', 'BKASH', 'BANK_TRANSFER']),
  couponCode: z.string().optional(),
  notes: z.string().max(500).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const stockConflictMetaSchema = z.object({
  variantId: z.string(),
  productName: z.string(),
  reason: z.enum(['insufficient_stock', 'unavailable']),
});
export type StockConflictMeta = z.infer<typeof stockConflictMetaSchema>;

export interface CheckoutQuote {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  couponCode: string | null;
}
