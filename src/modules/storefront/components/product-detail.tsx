import Link from 'next/link';

import type { PublicProductDetail, PublicProductSummary } from '@/contracts/catalog';
import type { PublicReview, ReviewSummary } from '@/contracts/reviews';
import { env } from '@/env';
import type { StorefrontFacts } from '@/server/storefront/storefront-facts.service';
import { ProductDetailGallery } from '@/modules/storefront/components/product-detail-gallery';
import { ProductDetailPurchasePanel } from '@/modules/storefront/components/product-detail-purchase-panel';
import { ProductCard } from '@/modules/storefront/components/product-card';
import { ReviewsSection } from '@/modules/reviews/components/reviews-section';
import {
  CustomBreadcrumb,
  buildBreadcrumbJsonLd,
} from '@/app/components/breadcrumb/custom-breadcrumb';

interface ProductDetailProps {
  product: PublicProductDetail;
  reviewSummary: ReviewSummary;
  initialReviews: PublicReview[];
  facts: StorefrontFacts;
  related: PublicProductSummary[];
}

export function ProductDetail({
  product,
  reviewSummary,
  initialReviews,
  facts,
  related,
}: Readonly<ProductDetailProps>) {
  const initialVariant = product.variants.find((v) => v.inStock) ?? product.variants[0] ?? null;
  const ldJson = buildJsonLd(product, initialVariant, reviewSummary);
  const category = product.categories[0];
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    category
      ? { label: category.name, href: `/category/${category.slug}` }
      : { label: product.brand.name, href: `/brand/${product.brand.slug}` },
    { label: product.name },
  ];
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems, env.NEXT_PUBLIC_APP_URL);

  return (
    <article className="pb-24 pt-5 lg:pb-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <CustomBreadcrumb items={breadcrumbItems} />

      <div className="mt-5 grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ProductDetailGallery
            productName={product.name}
            brand={product.brand.name}
            images={product.images}
          />
        </div>

        <div>
          <header className="space-y-2 border-b border-ink pb-5">
            <Link
              href={`/brand/${product.brand.slug}`}
              className="inline-flex min-h-8 items-center text-sm text-ink-2 hover:text-raven-ink hover:underline"
            >
              {product.brand.name}
            </Link>
            <h1 className="font-display text-[clamp(1.75rem,3.6vw,2.6rem)] font-bold leading-[1.02] tracking-[-0.025em] font-stretch-expanded text-balance">
              {product.name}
            </h1>
            {reviewSummary.count > 0 ? (
              <a
                href="#reviews"
                className="inline-block text-sm text-ink-2 hover:text-ink hover:underline"
              >
                {reviewSummary.average.toFixed(1)} out of 5 · {reviewSummary.count}{' '}
                {reviewSummary.count === 1 ? 'review' : 'reviews'}
              </a>
            ) : null}
          </header>

          <ProductDetailPurchasePanel
            variants={product.variants}
            warrantyMonths={product.warrantyMonths}
            facts={facts}
          />

          {product.description.trim() ? (
            <section aria-labelledby="about" className="mt-10">
              <h2
                id="about"
                className="mb-3 font-display text-lg font-semibold font-stretch-semi-expanded"
              >
                About this product
              </h2>
              <div className="max-w-prose whitespace-pre-line text-[15px] leading-relaxed text-ink/85">
                {product.description}
              </div>
            </section>
          ) : null}

          {product.categories.length > 0 ? (
            <p className="mt-8 text-sm text-ink-2">
              Listed in{' '}
              {product.categories.map((c, idx) => (
                <span key={c.id}>
                  <Link
                    href={`/category/${c.slug}`}
                    className="text-ink underline hover:text-raven-ink"
                  >
                    {c.name}
                  </Link>
                  {idx < product.categories.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>

      <section id="reviews" className="mt-16 scroll-mt-24 border-t border-ink pt-6 md:mt-24">
        <ReviewsSection
          productId={product.id}
          summary={reviewSummary}
          initialReviews={initialReviews}
        />
      </section>

      {related.length > 0 && category ? (
        <section aria-labelledby="related" className="mt-16 md:mt-24">
          <div className="mb-6 flex items-end justify-between gap-4 border-b border-ink pb-3">
            <h2
              id="related"
              className="font-display text-2xl font-bold tracking-[-0.02em] font-stretch-expanded"
            >
              More in {category.name}
            </h2>
            <Link
              href={`/category/${category.slug}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-raven-ink hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:gap-x-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function buildJsonLd(
  product: PublicProductDetail,
  variant: PublicProductDetail['variants'][number] | null,
  reviewSummary: ReviewSummary,
) {
  const offers = variant
    ? {
        '@type': 'Offer',
        priceCurrency: 'BDT',
        price: (variant.priceCents / 100).toFixed(2),
        availability: variant.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        sku: variant.sku,
      }
    : undefined;
  // aggregateRating requires Google's minimum of 1 rating; omit entirely
  // when there are none rather than emitting a misleading 0-star block.
  const aggregateRating =
    reviewSummary.count > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: reviewSummary.average.toFixed(1),
          reviewCount: reviewSummary.count,
        }
      : undefined;
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: { '@type': 'Brand', name: product.brand.name },
    sku: variant?.sku,
    offers,
    aggregateRating,
  };
}
