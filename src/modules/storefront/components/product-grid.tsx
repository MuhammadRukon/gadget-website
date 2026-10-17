import Link from 'next/link';

import { ProductCard } from './product-card';
import type { PublicProductSummary } from '@/contracts/catalog';
import { cn } from '@/lib/utils';

interface ProductGridProps {
  products: PublicProductSummary[];
  /** Where "clear filters" should lead in the empty state; omit to hide the link. */
  clearHref?: string;
  /** Number of leading cards to load eagerly. */
  priorityCount?: number;
  className?: string;
}

export function ProductGrid({
  products,
  clearHref,
  priorityCount = 0,
  className,
}: Readonly<ProductGridProps>) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 border-y border-rule py-12">
        <p className="font-display text-xl font-semibold font-stretch-semi-expanded">
          No products found
        </p>
        <p className="max-w-md text-sm text-ink-2">
          Check the spelling, try a shorter name, or loosen filters such as price, brand and stock.
        </p>
        {clearHref ? (
          <Link href={clearHref} className="text-sm font-medium text-raven-ink underline">
            Clear search and filters
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6',
        className,
      )}
    >
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}
