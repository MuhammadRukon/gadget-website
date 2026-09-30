'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/fetcher';
import { queryKeys } from '@/constants/queryKeys';
import type { CheckoutInput } from '@/contracts/checkout';
import { checkoutErrorMessage } from './checkout-error';

export interface PlaceOrderResult {
  id: string;
  orderNumber: string;
  redirectUrl: string | null;
}

/**
 * Places an order. The cart is invalidated on both outcomes: success
 * empties it server-side, and any failure (stock conflict, empty cart)
 * may have left the cached snapshot stale.
 */
export function usePlaceOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckoutInput) =>
      apiFetch<PlaceOrderResult>('/api/checkout', { method: 'POST', body: input }),
    onSuccess: (res) => {
      toast.success(`Order ${res.orderNumber} placed`);
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
    },
    onError: (err) => {
      toast.error(checkoutErrorMessage(err));
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
    },
  });
}
