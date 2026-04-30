import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { catalogService } from '@/server/catalog/catalog.service';
import { AppError } from '@/server/common/errors';
import { ProductDetail } from '@/modules/storefront/components/product-detail';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await catalogService.getPublicProductBySlug(slug);
    return {
      title: product.metaTitle ?? product.name,
      description:
        product.metaDescription ?? product.description.slice(0, 200),
      openGraph: {
        title: product.metaTitle ?? product.name,
        description: product.metaDescription ?? product.description.slice(0, 200),
        images: product.images.slice(0, 1).map((img) => ({ url: img.url })),
      },
    };
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      return { title: 'Product not found' };
    }
    throw err;
  }
}

export default async function ProductDetailPage({ params }: PageProps) {
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
