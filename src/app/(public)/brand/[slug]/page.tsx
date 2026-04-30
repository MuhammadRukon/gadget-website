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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return { title: 'Brand not found' };
  return {
    title: brand.name,
    description: `Browse all ${brand.name} products.`,
  };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;

  const brand = await prisma.brand.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });
  if (!brand || brand.status !== 'PUBLISHED') notFound();

  const query = productListQuerySchema.parse({ ...sp, brandSlug: slug });

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
          lockedBrandSlug={brand.slug}
        />
      </aside>
      <section>
        <h1 className="text-2xl font-semibold mb-4">{brand.name}</h1>
        <ProductGrid products={page.items} />
        <StorefrontPagination page={page.page} pageSize={page.pageSize} total={page.total} />
      </section>
    </div>
  );
}
