import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { catalogService } from '@/server/catalog/catalog.service';
import { productListQuerySchema } from '@/contracts/catalog';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';
import CommonListPage from '@/app/components/common-listpage';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}
export const revalidate = 60;

const getBrandBySlug = cache(async (slug: string) => {
  return prisma.brand.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, status: true },
  });
});
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);
  if (!brand) return { title: 'Brand not found' };
  return {
    title: brand.name ?? '',
    description: `Browse all ${brand.name} products.`,
  };
}

export default async function BrandPage({ params, searchParams }: Readonly<PageProps>) {
  const { slug } = await params;
  const sp = await searchParams;

  const brand = await getBrandBySlug(slug);
  if (brand?.status !== 'PUBLISHED') notFound();

  const query = productListQuerySchema.parse({ ...sp, brandSlug: slug });

  const [page, brands, categories] = await Promise.all([
    catalogService.listPublicProducts(query),
    catalogService.listPublicBrands(),
    catalogService.listPublicCategories(),
  ]);

  return (
    <CommonListPage
      brands={brands}
      categories={categories}
      brand={brand}
      page={page}
      title={brand.name}
    />
  );
}
