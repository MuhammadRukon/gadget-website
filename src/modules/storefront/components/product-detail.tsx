'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatBDT } from '@/server/common/money';
import { AddToCartButton } from '@/modules/cart/components/add-to-cart-button';
import { ReviewsSection } from '@/modules/reviews/components/reviews-section';
import type { PublicProductDetail, PublicProductVariant } from '@/contracts/catalog';

function variantLabel(v: PublicProductVariant): string {
  if (v.name) return v.name;
  const attrs = Object.entries(v.attributes);
  if (attrs.length > 0) return attrs.map(([, val]) => val).join(' / ');
  return v.sku;
}

interface ProductDetailProps {
  product: PublicProductDetail;
}

export function ProductDetail({ product }: ProductDetailProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants.find((v) => v.inStock)?.id ?? product.variants[0]?.id ?? null,
  );
  const [activeImage, setActiveImage] = useState(0);

  const variant = useMemo(
    () => product.variants.find((v) => v.id === selectedVariantId) ?? null,
    [product.variants, selectedVariantId],
  );

  const hasMultipleVariants = product.variants.length > 1;
  const inStock = !!variant && variant.inStock;
  const ldJson = useMemo(() => buildJsonLd(product, variant), [product, variant]);

  return (
    <article className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
      />

      <section>
        <div className="relative aspect-square bg-muted rounded overflow-hidden">
          {product.images[activeImage] ? (
            <Image
              src={product.images[activeImage].url}
              alt={product.images[activeImage].alt ?? product.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              No image
            </div>
          )}
        </div>
        {product.images.length > 1 ? (
          <div className="grid grid-cols-5 gap-2 mt-3">
            {product.images.map((img, idx) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setActiveImage(idx)}
                className={`relative aspect-square rounded overflow-hidden border ${
                  activeImage === idx ? 'border-primary' : 'border-transparent'
                }`}
              >
                <Image src={img.url} alt={img.alt ?? ''} fill className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link className="underline-offset-2 hover:underline" href={`/brand/${product.brand.slug}`}>
              {product.brand.name}
            </Link>
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold">{product.name}</h1>
        </div>

        <div className="flex items-baseline gap-3">
          {variant ? (
            <>
              <span className="text-2xl font-semibold">{formatBDT(variant.priceCents)}</span>
              {variant.priceCents < variant.originalPriceCents ? (
                <span className="text-sm text-muted-foreground line-through">
                  {formatBDT(variant.originalPriceCents)}
                </span>
              ) : null}
              {!variant.inStock ? <Badge variant="secondary">Out of stock</Badge> : null}
            </>
          ) : (
            <Badge variant="secondary">Unavailable</Badge>
          )}
        </div>

        {hasMultipleVariants ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Choose variant</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <Button
                  key={v.id}
                  type="button"
                  variant={selectedVariantId === v.id ? 'default' : 'outline'}
                  size="sm"
                  disabled={!v.inStock}
                  onClick={() => setSelectedVariantId(v.id)}
                  className="text-left h-auto py-2"
                >
                  <span className="flex flex-col items-start">
                    <span className="text-xs uppercase tracking-wide">{variantLabel(v)}</span>
                    <span className="text-[10px] text-muted-foreground">SKU: {v.sku}</span>
                  </span>
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <AddToCartButton
            variantId={variant?.id ?? null}
            disabled={!inStock}
            className="flex-1"
            label={inStock ? 'Add to cart' : 'Out of stock'}
          />
          <Button size="lg" variant="outline" disabled={!inStock} asChild>
            <a href="/cart">Go to cart</a>
          </Button>
        </div>

        {product.warrantyMonths > 0 ? (
          <p className="text-sm text-muted-foreground">
            Includes {product.warrantyMonths}-month warranty.
          </p>
        ) : null}

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
        <ReviewsSection productId={product.id} />
      </section>
    </article>
  );
}

function buildJsonLd(product: PublicProductDetail, variant: PublicProductVariant | null) {
  const offers = variant
    ? {
        '@type': 'Offer',
        priceCurrency: 'BDT',
        price: (variant.priceCents / 100).toFixed(2),
        availability: variant.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
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
