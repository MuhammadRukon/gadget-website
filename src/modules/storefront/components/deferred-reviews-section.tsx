'use client';

import dynamic from 'next/dynamic';

export const DeferredReviewsSection = dynamic(
  () => import('@/modules/reviews/components/reviews-section').then((mod) => mod.ReviewsSection),
  {
    ssr: false,
    loading: () => <p className="text-sm text-muted-foreground">Loading reviews...</p>,
  },
);
