import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { catalogService } from '@/server/catalog/catalog.service';
import { AppError } from '@/server/common/errors';
import { ProductDetail } from '@/modules/storefront/components/product-detail';

interface PageProps {
  params: Promise<{ slug: string }>;
}
export const revalidate = 120;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await catalogService.getPublicProductMetadataBySlug(slug);
    return {
      title: product.metaTitle ?? product.name,
      description: product.metaDescription ?? undefined,
      openGraph: {
        title: product.metaTitle ?? product.name,
        description: product.metaDescription ?? undefined,
        images: product.imageUrl ? [{ url: product.imageUrl }] : [],
      },
    };
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      return { title: 'Product not found' };
    }
    throw err;
  }
}

export default async function ProductDetailPage({ params }: Readonly<PageProps>) {
  const { slug } = await params;
  let product;
  try {
    product = await catalogService.getPublicProductBySlug(slug);
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      notFound();
    }
    throw err;
  }
  return <ProductDetail product={product} />;
}
