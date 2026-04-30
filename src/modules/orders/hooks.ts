'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/fetcher';
import type { Order, OrderEvent, OrderItem, Payment, Address } from '@prisma/client';

type OrderListItem = Order & { items: OrderItem[]; payments: Payment[] };
type OrderWithDetails = Order & {
  items: OrderItem[];
  payments: Payment[];
  events: OrderEvent[];
  address: Address | null;
};

export type { OrderWithDetails };

export function useMyOrders() {
  return useQuery({
    queryKey: ['orders', 'me'],
    queryFn: () => apiFetch<{ items: OrderListItem[] }>('/api/orders').then((r) => r.items),
  });
}

export function useOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () =>
      apiFetch<{ order: OrderWithDetails }>(`/api/orders/${id}`).then((r) => r.order),
    enabled: !!id,
  });
}

export function useCancelOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch<{ order: OrderWithDetails }>(`/api/orders/${id}?action=cancel`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      toast.success('Order cancelled');
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not cancel order'),
  });
}
