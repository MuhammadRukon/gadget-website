import type { Metadata } from 'next';

import { catalogService } from '@/server/catalog/catalog.service';
import { productListQuerySchema } from '@/contracts/catalog';
import CommonListPage from '@/app/components/common-listpage';

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
    <CommonListPage brands={brands} categories={categories} page={page} title="All products" />
  );
}
