import { z } from 'zod';

export const cartItemInputSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});
export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export interface CartLine {
  itemId: string;
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantName: string | null;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  originalUnitPriceCents: number;
  quantity: number;
  /** Variant stock at fetch time. UI shows insufficiency when quantity > stock. */
  stock: number;
  isActive: boolean;
}

export interface CartSnapshot {
  lines: CartLine[];
  subtotalCents: number;
  itemCount: number;
}

export interface CartSummary {
  subtotalCents: number;
  itemCount: number;
  hasIssues: boolean;
}

export const guestCartLineSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().min(1).max(99),
});
export type GuestCartLine = z.infer<typeof guestCartLineSchema>;
