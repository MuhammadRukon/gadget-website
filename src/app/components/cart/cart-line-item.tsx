'use client';

import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CartLine } from '@/contracts/cart';
import { cn } from '@/lib/utils';
import { useCartMutations } from '@/modules/cart/hooks';
import { formatBDT } from '@/server/common/money';

export interface CartLineItemProps {
  line: CartLine;
  /**
   * Compact mode renders without the wrapping `<Card>` and uses
   * tighter spacing / a smaller thumbnail. Used in the cart panel
   * where vertical space is constrained.
   */
  compact?: boolean;
}

export function CartLineItem({ line, compact = false }: Readonly<CartLineItemProps>) {
  const { updateItem, removeItem } = useCartMutations();
  const changeQuantity = (nextQuantity: number) =>
    updateItem.mutate({
      itemId: line.itemId,
      variantId: line.variantId,
      quantity: Math.max(0, Math.min(99, nextQuantity)),
    });

  const inner = (
    <>
      <div
        className={cn(
          'relative bg-muted overflow-hidden shrink-0',
          compact ? 'w-14 h-14' : 'w-20 h-20',
        )}
      >
        {line.imageUrl ? (
          <Image
            src={line.imageUrl}
            alt={line.productName}
            fill
            className="object-cover"
            sizes="(max-width: 200px) 100vw, 50vw"
          />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/products/${line.productSlug}`}
          className="font-medium hover:underline line-clamp-1"
        >
          {line.productName}
        </Link>
        {compact ? null : (
          <p className="text-xs text-muted-foreground">
            {line.variantName ? `${line.variantName} · ` : ''}SKU: {line.sku}
          </p>
        )}
        <p className={cn('mt-1', compact ? 'text-xs' : 'text-sm')}>
          {formatBDT(line.unitPriceCents)} each
        </p>
        {!line.isActive ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            This product is no longer available.
          </p>
        ) : line.quantity > line.stock ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Only {line.stock} in stock.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(compact ? 'h-7 w-7' : 'h-8 w-8')}
            onClick={() => changeQuantity(line.quantity - 1)}
            aria-label={`Decrease quantity for ${line.productName}`}
          >
            -
          </Button>
          <span className={cn('w-8 text-center text-sm', compact ? 'text-xs' : 'text-sm')}>
            {line.quantity}
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(compact ? 'h-7 w-7' : 'h-8 w-8')}
            onClick={() => changeQuantity(line.quantity + 1)}
            aria-label={`Increase quantity for ${line.productName}`}
          >
            +
          </Button>
        </div>
        <Button
          variant="ghost"
          className="font-normal text-xs p-0 hover:bg-transparent cursor-pointer text-stone-500"
          size="sm"
          onClick={() => removeItem.mutate({ itemId: line.itemId, variantId: line.variantId })}
        >
          Remove
        </Button>
      </div>
    </>
  );

  if (compact) {
    return <div className="flex gap-3 p-2 border-b last:border-b-0">{inner}</div>;
  }

  return (
    <Card>
      <CardContent className="flex gap-4 p-4">{inner}</CardContent>
    </Card>
  );
}
