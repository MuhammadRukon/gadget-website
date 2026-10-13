'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

import { queryKeys } from '@/constants/queryKeys';
import type { CartSnapshot } from '@/contracts/cart';
import { apiFetch } from '@/lib/fetcher';
import { useCartMutations } from '@/modules/cart/hooks';
import { cleanupNotice, planCartCleanup } from './cart-cleanup';

/**
 * On checkout entry with cart issues: removes inactive/out-of-stock lines and
 * clamps lines above stock through the existing cart endpoints, then reports
 * what changed. `cleaning` is true until the first attempt ends (the form waits).
 * A failure ends the attempt silently: placeOrder still validates every line.
 */
export function useCheckoutCartCleanup(hasIssues: boolean): {
  cleaning: boolean;
  notice: string | null;
} {
  const { status } = useSession();
  const qc = useQueryClient();
  const { removeItem, updateItem } = useCartMutations();
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    // Re-arms once the issues are gone, so a later stock race is cleaned up too.
    if (!hasIssues) running.current = false;
    // The cart mutations act on the guest store unless the session is authenticated.
    if (!hasIssues || running.current || status !== 'authenticated') return;
    running.current = true;
    void (async () => {
      try {
        const cart = await qc.fetchQuery({
          queryKey: queryKeys.cart,
          queryFn: () => apiFetch<CartSnapshot>('/api/cart'),
        });
        // Names are captured here, before the lines disappear.
        const plan = planCartCleanup(cart.lines);
        for (const { itemId, variantId } of plan.remove) {
          await removeItem.mutateAsync({ itemId, variantId });
        }
        for (const { line, quantity } of plan.reduce) {
          await updateItem.mutateAsync({
            itemId: line.itemId,
            variantId: line.variantId,
            quantity,
          });
        }
        setNotice(cleanupNotice(plan));
      } catch {
        void qc.invalidateQueries({ queryKey: queryKeys.cart });
      } finally {
        setAttempted(true);
      }
    })();
  }, [hasIssues, status, qc, removeItem, updateItem]);

  return { cleaning: hasIssues && !attempted, notice };
}
