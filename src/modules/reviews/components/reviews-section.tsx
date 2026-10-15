import type { PublicReview, ReviewSummary } from '@/contracts/reviews';

import { RatingStars } from './rating-stars';
import { ReviewItem } from './review-item';
import { ShowAllReviews } from './show-all-reviews';

interface ReviewsSectionProps {
  productId: string;
  /** Server-rendered summary from the PDP; avoids a second summary query. */
  summary: ReviewSummary;
  /** Newest reviews rendered into the ISR HTML; the full list loads only on request. */
  initialReviews: PublicReview[];
}

export function ReviewsSection({ productId, summary, initialReviews }: ReviewsSectionProps) {
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-bold tracking-[-0.02em] font-stretch-expanded">
          Customer reviews
        </h2>
        {summary.count > 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RatingStars value={summary.average} />
            <span className="tabular-nums">
              {summary.average.toFixed(1)} · {summary.count} review
              {summary.count === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}
      </header>

      {initialReviews.length === 0 ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          No reviews yet. Be the first to share what you think after your delivery arrives.
        </p>
      ) : (
        <ul className="space-y-4">
          {initialReviews.map((r) => (
            <ReviewItem key={r.id} review={r} />
          ))}
        </ul>
      )}

      {summary.count > initialReviews.length ? (
        <ShowAllReviews productId={productId} initialReviews={initialReviews} />
      ) : null}
    </section>
  );
}
