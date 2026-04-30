'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Payment } from '@prisma/client';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/fetcher';

interface PendingPayment extends Payment {
  order: {
    id: string;
    orderNumber: string;
    totalCents: number;
    shipRecipient: string;
    shipPhone: string;
    shipCity: string;
    createdAt: string | Date;
    user: { id: string; name: string | null; email: string | null } | null;
  };
}

export function useAdminPendingPayments() {
  return useQuery({
    queryKey: ['admin', 'payments', 'pending'],
    queryFn: () =>
      apiFetch<{ items: PendingPayment[] }>('/api/admin/payments').then((r) => r.items),
  });
}

export function useVerifyPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      outcome,
      note,
    }: {
      id: string;
      outcome: 'SUCCEEDED' | 'FAILED';
      note?: string;
    }) =>
      apiFetch<{ payment: Payment }>(`/api/admin/payments/${id}/verify`, {
        method: 'POST',
        body: { outcome, note },
      }),
    onSuccess: (_data, vars) => {
      toast.success(vars.outcome === 'SUCCEEDED' ? 'Payment verified' : 'Payment rejected');
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not update payment'),
  });
}
