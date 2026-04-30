import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { catalogService } from '@/server/catalog/catalog.service';
import { productListQuerySchema } from '@/contracts/catalog';
import { ProductFilters } from '@/modules/storefront/components/product-filters';
import { ProductGrid } from '@/modules/storefront/components/product-grid';
import { StorefrontPagination } from '@/modules/storefront/components/storefront-pagination';
import { prisma } from '@/lib/prisma';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) return { title: 'Category not found' };
  return {
    title: cat.name,
    description: `Browse all ${cat.name} products in our catalog.`,
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!category || category.status !== 'PUBLISHED') notFound();

  const query = productListQuerySchema.parse({ ...sp, categorySlug: slug });

  const [page, brands, categories] = await Promise.all([
    catalogService.listPublicProducts(query),
    catalogService.listPublicBrands(),
    catalogService.listPublicCategories(),
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 py-6">
      <aside className="md:sticky md:top-4 md:self-start">
        <ProductFilters
          brands={brands}
          categories={categories}
          lockedCategorySlug={category.slug}
        />
      </aside>
      <section>
        <h1 className="text-2xl font-semibold mb-4">{category.name}</h1>
        <ProductGrid products={page.items} />
        <StorefrontPagination page={page.page} pageSize={page.pageSize} total={page.total} />
      </section>
    </div>
  );
}
