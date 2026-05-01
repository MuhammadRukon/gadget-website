import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import type { PublicProductDetail } from '@/contracts/catalog';
import { ProductDetailGallery } from '@/modules/storefront/components/product-detail-gallery';
import { ProductDetailPurchasePanel } from '@/modules/storefront/components/product-detail-purchase-panel';
import { DeferredReviewsSection } from '@/modules/storefront/components/deferred-reviews-section';

interface ProductDetailProps {
  product: PublicProductDetail;
}

export function ProductDetail({ product }: Readonly<ProductDetailProps>) {
  const initialVariant = product.variants.find((v) => v.inStock) ?? product.variants[0] ?? null;
  const ldJson = buildJsonLd(product, initialVariant);

  return (
    <article className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />

      <section>
        <ProductDetailGallery productName={product.name} images={product.images} />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link
              className="underline-offset-2 hover:underline"
              href={`/brand/${product.brand.slug}`}
            >
              {product.brand.name}
            </Link>
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold">{product.name}</h1>
        </div>

        <ProductDetailPurchasePanel
          variants={product.variants}
          warrantyMonths={product.warrantyMonths}
        />

        <Card>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none p-4 whitespace-pre-line">
            {product.description}
          </CardContent>
        </Card>

        {product.categories.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Categories:{' '}
            {product.categories.map((c, idx) => (
              <span key={c.id}>
                <Link href={`/category/${c.slug}`} className="underline-offset-2 hover:underline">
                  {c.name}
                </Link>
                {idx < product.categories.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        ) : null}
      </section>

      <section className="md:col-span-2 mt-6">
        <DeferredReviewsSection productId={product.id} />
      </section>
    </article>
  );
}

function buildJsonLd(
  product: PublicProductDetail,
  variant: PublicProductDetail['variants'][number] | null,
) {
  const offers = variant
    ? {
        '@type': 'Offer',
        priceCurrency: 'BDT',
        price: (variant.priceCents / 100).toFixed(2),
        availability: variant.inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        sku: variant.sku,
      }
    : undefined;
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.images.map((i) => i.url),
    brand: { '@type': 'Brand', name: product.brand.name },
    sku: variant?.sku,
    offers,
  };
}
