import Link from 'next/link';

import type { PublicProductSummary } from '@/contracts/catalog';
import { cn, getDiscountPercentString } from '@/lib/utils';
import { Price } from './price';
import { ProductImage } from './product-image';
import { StockMark } from './stock-mark';

interface ProductCardProps {
  product: PublicProductSummary;
  /** Above-the-fold cards load eagerly. */
  priority?: boolean;
  sizes?: string;
  /** Feature cards (one large product in a group) use a landscape photo field. */
  feature?: boolean;
}

export function ProductCard({
  product,
  priority,
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  feature,
}: Readonly<ProductCardProps>) {
  const discount = product.priceCents < product.originalPriceCents;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          brand={product.brand.name}
          sizes={sizes}
          priority={priority}
          className={cn(
            'rounded-md transition-[background-color] duration-300 group-hover:bg-raven-soft',
            feature ? 'aspect-[16/10]' : 'aspect-[4/5]',
          )}
        />
        {discount ? (
          <span className="absolute left-2.5 top-2.5 rounded-sm bg-sale px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
            −
            {getDiscountPercentString(product.priceCents, product.originalPriceCents).replace(
              '~',
              '',
            )}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        {/* Mobile 2-up rows: the spec line takes up spare height and the price block has a fixed height, so rules align. */}
        <p className="text-xs text-ink-2">{product.brand.name}</p>
        <h3
          className={cn(
            'line-clamp-2 font-medium leading-snug text-ink',
            feature ? 'font-display text-xl font-semibold font-stretch-semi-expanded' : 'text-sm',
          )}
        >
          <Link
            href={`/products/${product.slug}`}
            className="outline-none after:absolute after:inset-0 after:rounded-md focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-raven"
          >
            {product.name}
          </Link>
        </h3>
        <p className="h-4 truncate text-xs leading-4 text-ink-2 max-sm:mb-auto">
          {product.specs.join(' · ')}
        </p>
        <div className="flex flex-col gap-1 border-t border-rule pt-2.5 sm:mt-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-x-3">
          <Price
            cents={product.priceCents}
            originalCents={product.originalPriceCents}
            size={feature ? 'md' : 'sm'}
            className="max-sm:min-h-[2.75rem] max-sm:flex-col max-sm:items-start max-sm:justify-start max-sm:gap-0.5"
          />
          <StockMark inStock={product.inStock} />
        </div>
      </div>
    </article>
  );
}
