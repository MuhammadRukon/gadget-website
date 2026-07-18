import { ProductGrid } from '@/modules/storefront/components/product-grid';
import { StorefrontPagination } from '@/modules/storefront/components/storefront-pagination';

import { ProductFilterWrapper } from '@/modules/storefront/components/product-filter-wrapper';
import { ProductFilters } from '@/modules/storefront/components/product-filters';

import type { IBrandOption, ICategoryOption } from '@/interfaces';

import type { PublicProductPage } from '@/contracts';

import { $Enums } from '@prisma/client';

interface Props {
  brands: IBrandOption[];

  categories: ICategoryOption[];

  brand?: {
    id: string;
    name: string;
    slug: string;
    status: $Enums.PublishStatus;
  };

  page: PublicProductPage;

  title: string;
}

export default function CommonListPage({
  brands,
  categories,
  brand,
  page,
  title,
}: Readonly<Props>) {
  return (
    <ProductFilterWrapper
      filters={
        <ProductFilters brands={brands} categories={categories} lockedBrandSlug={brand?.slug} />
      }
    >
      <section>
        <h1 className="text-2xl font-semibold mb-4">{title}</h1>

        <ProductGrid products={page.items} />

        <StorefrontPagination page={page.page} pageSize={page.pageSize} total={page.total} />
      </section>
    </ProductFilterWrapper>
  );
}
