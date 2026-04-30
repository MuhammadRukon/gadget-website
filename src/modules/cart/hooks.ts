'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/fetcher';
import { queryKeys } from '@/constants/queryKeys';
import type { CartSnapshot, CartSummary } from '@/contracts/cart';
import { useGuestCart } from './guest-cart';

const CART_URL = '/api/cart';

function explainError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function useServerCart(view: 'full'): ReturnType<typeof useQuery<CartSnapshot>>;
export function useServerCart(view: 'summary'): ReturnType<typeof useQuery<CartSummary>>;
export function useServerCart(
  view: 'full' | 'summary' = 'full',
): ReturnType<typeof useQuery<CartSnapshot | CartSummary>> {
  const { status } = useSession();
  return useQuery({
    queryKey: view === 'summary' ? queryKeys.cartSummary : queryKeys.cart,
    queryFn: async () => {
      if (view === 'summary') {
        return apiFetch<CartSummary>(`${CART_URL}?view=summary`);
      }
      return apiFetch<CartSnapshot>(CART_URL);
    },
    enabled: status === 'authenticated',
  });
}

export function useCartMutations() {
  const qc = useQueryClient();
  const { status } = useSession();
  const guest = useGuestCart();
  const syncCartCache = (snapshot: CartSnapshot | null) => {
    if (!snapshot) return;
    qc.setQueryData(queryKeys.cart, snapshot);
    qc.setQueryData(queryKeys.cartSummary, {
      subtotalCents: snapshot.subtotalCents,
      itemCount: snapshot.itemCount,
      hasIssues: snapshot.lines.some((line) => !line.isActive || line.quantity > line.stock),
    } satisfies CartSummary);
  };

  const addItem = useMutation({
    mutationFn: async (input: { variantId: string; quantity: number }) => {
      if (status !== 'authenticated') {
        guest.add(input.variantId, input.quantity);
        return null;
      }
      return apiFetch<CartSnapshot>(CART_URL, { method: 'POST', body: input });
    },
    onSuccess: (snapshot) => {
      syncCartCache(snapshot);
      toast.success('Added to cart');
    },
    onError: (err) => toast.error(explainError(err, 'Could not add to cart')),
  });

  const updateItem = useMutation({
    mutationFn: async (input: {
      itemId: string;
      variantId: string;
      quantity: number;
    }) => {
      if (status !== 'authenticated') {
        guest.setQuantity(input.variantId, input.quantity);
        return null;
      }
      return apiFetch<CartSnapshot>(`${CART_URL}/${input.itemId}`, {
        method: 'PATCH',
        body: { quantity: input.quantity },
      });
    },
    onSuccess: (snapshot) => syncCartCache(snapshot),
    onError: (err) => toast.error(explainError(err, 'Could not update quantity')),
  });

  const removeItem = useMutation({
    mutationFn: async (input: { itemId: string; variantId: string }) => {
      if (status !== 'authenticated') {
        guest.remove(input.variantId);
        return null;
      }
      return apiFetch<CartSnapshot>(`${CART_URL}/${input.itemId}`, { method: 'DELETE' });
    },
    onSuccess: (snapshot) => syncCartCache(snapshot),
    onError: (err) => toast.error(explainError(err, 'Could not remove item')),
  });

  return { addItem, updateItem, removeItem };
}

/**
 * Merges the persisted guest cart into the server cart immediately
 * after the user authenticates. Idempotent; safe to mount multiple
 * times (the merge call is no-op when the store is empty).
 */
export function useGuestCartMerge() {
  const { status } = useSession();
  const qc = useQueryClient();
  const lines = useGuestCart((s) => s.lines);
  const clear = useGuestCart((s) => s.clear);

  useEffect(() => {
    if (status !== 'authenticated' || lines.length === 0) return;
    void apiFetch<CartSnapshot>(CART_URL, {
      method: 'PUT',
      body: { lines },
    })
      .then(() => {
        clear();
        qc.invalidateQueries({ queryKey: queryKeys.cart });
        qc.invalidateQueries({ queryKey: queryKeys.cartSummary });
      })
      .catch(() => {
        // We swallow the error so the login flow is never blocked by
        // a transient merge failure. The guest cart stays around so a
        // retry on the next render will succeed.
      });
  }, [status, lines, clear, qc]);
}
