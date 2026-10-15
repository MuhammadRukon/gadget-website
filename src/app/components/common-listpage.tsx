import { Suspense } from 'react';

import { ProductGrid } from '@/modules/storefront/components/product-grid';
import { StorefrontPagination } from '@/modules/storefront/components/storefront-pagination';
import { ListingSidebar, ListingToolbar } from '@/modules/storefront/components/product-filters';

import type { IBrandOption, ICategoryOption } from '@/interfaces';
import type { PublicProductPage } from '@/contracts';

import { env } from '@/env';
import {
  CustomBreadcrumb,
  buildBreadcrumbJsonLd,
  type BreadcrumbItem,
} from '@/app/components/breadcrumb/custom-breadcrumb';

interface Props {
  brands: IBrandOption[];
  categories: ICategoryOption[];
  /** The page's own scope: a category or brand page hides that filter. */
  scope?: { kind: 'category' | 'brand'; slug: string };
  page: PublicProductPage;
  title: string;
  /** Path of this listing without query, for "clear filters" links. */
  basePath: string;
  breadcrumbItems: BreadcrumbItem[];
}

export default function CommonListPage({
  brands,
  categories,
  scope,
  page,
  title,
  basePath,
  breadcrumbItems,
}: Readonly<Props>) {
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems, env.NEXT_PUBLIC_APP_URL);
  const filterProps = {
    brands,
    categories,
    lockedCategorySlug: scope?.kind === 'category' ? scope.slug : undefined,
    lockedBrandSlug: scope?.kind === 'brand' ? scope.slug : undefined,
  };

  return (
    <div className="pb-8 pt-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <CustomBreadcrumb items={breadcrumbItems} />

      <h1 className="mb-6 mt-3 font-display text-[clamp(1.9rem,4.5vw,3rem)] font-bold leading-none tracking-[-0.025em] font-stretch-expanded">
        {title}
      </h1>

      <div className="grid gap-x-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* useSearchParams needs narrow Suspense boundaries on static routes, otherwise the page bails out to client rendering. */}
        <Suspense>
          <ListingSidebar {...filterProps} />
        </Suspense>

        <section aria-label={`${title} results`}>
          <Suspense fallback={<div className="mb-6 h-[53px] border-b border-rule" />}>
            <ListingToolbar total={page.total} {...filterProps} />
          </Suspense>

          <ProductGrid
            products={page.items}
            clearHref={basePath}
            priorityCount={4}
            className="lg:grid-cols-3"
          />

          <Suspense>
            <StorefrontPagination page={page.page} pageSize={page.pageSize} total={page.total} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
