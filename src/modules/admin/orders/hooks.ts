'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Order, OrderEvent, OrderItem, OrderStatus, Payment } from '@prisma/client';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/fetcher';

interface AdminOrderListItem extends Order {
  items: OrderItem[];
  payments: Payment[];
  user: { id: string; name: string | null; email: string | null } | null;
}

interface AdminOrderDetail extends Order {
  items: OrderItem[];
  payments: Payment[];
  events: OrderEvent[];
  user: { id: string; name: string | null; email: string | null } | null;
}

const KEY = ['admin', 'orders'] as const;

export function useAdminOrdersList() {
  return useQuery({
    queryKey: [...KEY, 'list'],
    queryFn: () =>
      apiFetch<{ items: AdminOrderListItem[] }>('/api/admin/orders').then((r) => r.items),
  });
}

export function useAdminOrderDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () =>
      apiFetch<{ order: AdminOrderDetail }>(`/api/admin/orders/${id}`).then((r) => r.order),
    enabled: !!id,
  });
}

export function useTransitionOrder(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ status, note }: { status: OrderStatus; note?: string }) =>
      apiFetch<{ order: Order }>(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: { status, note },
      }),
    onSuccess: () => {
      toast.success('Order updated');
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not update order'),
  });
}
