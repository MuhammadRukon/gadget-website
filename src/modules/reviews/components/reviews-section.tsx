'use client';

import { Loader } from '@/app/common/loader/loader';
import { useProductReviews } from '@/modules/reviews/hooks';

import { RatingStars } from './rating-stars';

interface ReviewsSectionProps {
  productId: string;
}

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const reviews = useProductReviews(productId);

  if (reviews.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader />
      </div>
    );
  }

  const items = reviews.data?.items ?? [];
  const summary = reviews.data?.summary ?? { count: 0, average: 0 };

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Customer reviews</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RatingStars value={summary.average} />
          <span>
            {summary.average.toFixed(1)} · {summary.count} review
            {summary.count === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. Be the first to share what you think after your delivery arrives.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <li key={r.id} className="rounded border p-4">
              <div className="flex items-center gap-2">
                <RatingStars value={r.rating} />
                <span className="text-xs text-muted-foreground">
                  by {r.authorName} ·{' '}
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              {r.title ? <p className="mt-1 font-medium">{r.title}</p> : null}
              <p className="mt-1 text-sm whitespace-pre-line">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
