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

const getCategoryBySlug = cache(async (slug: string) => {
  return prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getCategoryBySlug(slug);
  if (!cat) return { title: 'Category not found' };
  return {
    title: cat.name ?? '',
    description: `Browse all ${cat.name ?? ''} products in our catalog.`,
  };
}

export default async function CategoryPage({ params, searchParams }: Readonly<PageProps>) {
  const { slug } = await params;
  const sp = await searchParams;

  const category = await getCategoryBySlug(slug);
  if (category?.status !== 'PUBLISHED') notFound();

  const query = productListQuerySchema.parse({ ...sp, categorySlug: slug });

  const [page, brands, categories] = await Promise.all([
    catalogService.listPublicProducts(query),
    catalogService.listPublicBrands(),
    catalogService.listPublicCategories(),
  ]);

  return (
    <CommonListPage
      brands={brands}
      categories={categories}
      brand={category}
      page={page}
      title={category.name}
    />
  );
}
