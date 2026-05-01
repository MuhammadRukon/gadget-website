import type { Metadata } from 'next';

import { catalogService } from '@/server/catalog/catalog.service';
import { productListQuerySchema } from '@/contracts/catalog';
import { ProductGrid } from '@/modules/storefront/components/product-grid';
import { ProductFilters } from '@/modules/storefront/components/product-filters';
import { StorefrontPagination } from '@/modules/storefront/components/storefront-pagination';

export const metadata: Metadata = {
  title: 'All products',
  description: 'Browse all gadgets and electronics in the catalog.',
};
export const revalidate = 60;

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: Readonly<PageProps>) {
  const sp = await searchParams;
  const query = productListQuerySchema.parse(sp);

  const [page, brands, categories] = await Promise.all([
    catalogService.listPublicProducts(query),
    catalogService.listPublicBrands(),
    catalogService.listPublicCategories(),
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 py-6">
      <aside className="md:sticky md:top-4 md:self-start">
        <ProductFilters brands={brands} categories={categories} />
      </aside>
      <section>
        <h1 className="text-2xl font-semibold mb-4">All products</h1>
        <ProductGrid products={page.items} />
        <StorefrontPagination page={page.page} pageSize={page.pageSize} total={page.total} />
      </section>
    </div>
  );
}
