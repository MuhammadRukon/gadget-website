import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatBDT } from '@/server/common/money';
import type { PublicProductSummary } from '@/contracts/catalog';

export function ProductCard({ product }: { product: PublicProductSummary }) {
  const hasDiscount = product.priceCents < product.originalPriceCents;

  return (
    <Link href={`/products/${product.slug}`} className="block group">
      <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
        <div className="relative aspect-square bg-muted">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              No image
            </div>
          )}
          {!product.inStock ? (
            <Badge variant="secondary" className="absolute top-2 left-2">
              Out of stock
            </Badge>
          ) : null}
        </div>
        <CardContent className="space-y-1 p-4">
          <p className="text-xs text-muted-foreground">{product.brand.name}</p>
          <h3 className="text-sm font-medium line-clamp-2 leading-snug">{product.name}</h3>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">{formatBDT(product.priceCents)}</span>
            {hasDiscount ? (
              <span className="text-xs text-muted-foreground line-through">
                {formatBDT(product.originalPriceCents)}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
