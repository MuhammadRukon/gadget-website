'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/fetcher';
import type {
  PublicReview,
  ReviewInput,
  ReviewSummary,
  ReviewableItem,
} from '@/contracts/reviews';

export function useProductReviews(productId: string | null) {
  return useQuery({
    queryKey: ['reviews', 'product', productId],
    queryFn: () =>
      apiFetch<{ items: PublicReview[]; summary: ReviewSummary }>(
        `/api/reviews?productId=${productId}`,
      ),
    enabled: !!productId,
  });
}

export function useReviewableItems() {
  return useQuery({
    queryKey: ['reviews', 'reviewable'],
    queryFn: () => apiFetch<{ items: ReviewableItem[] }>('/api/reviews/reviewable').then((r) => r.items),
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewInput) =>
      apiFetch<{ review: { id: string } }>('/api/reviews', { method: 'POST', body: input }),
    onSuccess: () => {
      toast.success('Review submitted');
      qc.invalidateQueries({ queryKey: ['reviews'] });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : 'Could not submit review'),
  });
}
