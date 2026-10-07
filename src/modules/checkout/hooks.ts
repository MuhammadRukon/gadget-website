'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/fetcher';
import { queryKeys } from '@/constants/queryKeys';
import type { CheckoutInput } from '@/contracts/checkout';
import type { PublicPaymentConfig } from '@/contracts/payment-settings';
import type { TxnCheckResult } from '@/contracts/payments';
import { checkoutErrorMessage, isPaymentMethodUnavailable } from './checkout-error';

export interface PlaceOrderResult {
  id: string;
  orderNumber: string;
  totalCents: number;
  paymentId: string;
  redirectUrl: string | null;
  /** True when a COD confirmation fee must be verified before the order is confirmed. */
  feeRequired: boolean;
}

/**
 * Enabled payment methods, COD fee rule, QR, contact and note. Never served
 * from cache: the admin can change it at any time, so every mount refetches.
 */
export function usePaymentConfig() {
  return useQuery({
    queryKey: queryKeys.paymentConfig,
    queryFn: () => apiFetch<PublicPaymentConfig>('/api/checkout/config'),
    staleTime: 0,
    refetchOnMount: 'always',
    // One quick retry, then surface the error state instead of spinning.
    retry: 1,
  });
}

/**
 * Whether a transaction id is already attached to a payment. Boolean only
 * (no order info). Call on blur with a format-valid id, never per keystroke.
 */
export function useTxnCheck() {
  return useMutation({
    mutationFn: (txnId: string) =>
      apiFetch<TxnCheckResult>('/api/payments/txn-check', { method: 'POST', body: { txnId } }),
  });
}

/**
 * Places an order. The cart is invalidated on both outcomes: success
 * empties it server-side, and any failure (stock conflict, empty cart)
 * may have left the cached snapshot stale. A "method no longer available"
 * failure also refetches the payment config so the list catches up.
 */
export function usePlaceOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CheckoutInput) =>
      apiFetch<PlaceOrderResult>('/api/checkout', { method: 'POST', body: input }),
    onSuccess: (res) => {
      toast.success(
        res.feeRequired
          ? `Order ${res.orderNumber} placed. It will be confirmed once the confirmation fee is verified.`
          : `Order ${res.orderNumber} placed`,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
    },
    onError: (err) => {
      toast.error(checkoutErrorMessage(err));
      void qc.invalidateQueries({ queryKey: queryKeys.cart });
      if (isPaymentMethodUnavailable(err)) {
        void qc.invalidateQueries({ queryKey: queryKeys.paymentConfig });
      }
    },
  });
}
