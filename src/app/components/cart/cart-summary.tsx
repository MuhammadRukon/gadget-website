'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { CartSnapshot } from '@/contracts/cart';
import { cn } from '@/lib/utils';
import { cartAvailability } from '@/modules/cart/availability';
import { FREE_THRESHOLD } from '@/server/checkout/shipping';
import { formatBDT } from '@/server/common/money';

export interface CartSummaryProps {
  cart: CartSnapshot | null | undefined;
  authenticated: boolean;
  isPanel?: boolean;
  /** Guest prices are being hydrated: show a skeleton for the subtotal. */
  priceLoading?: boolean;
}

export function CartSummary({
  cart,
  authenticated,
  isPanel = false,
  priceLoading = false,
}: Readonly<CartSummaryProps>) {
  // Unavailable lines stay in the cart but are not counted or priced.
  const { itemCount, subtotalCents: subtotal } = cartAvailability(cart?.lines ?? []);

  const toFree = Math.max(0, FREE_THRESHOLD - subtotal);
  const progress = Math.min(100, Math.round((subtotal / FREE_THRESHOLD) * 100));

  const rows = (
    <>
      {isPanel ? null : (
        <h2 className="font-display text-lg font-semibold font-stretch-semi-expanded">
          Order summary
        </h2>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Items</span>
        <span className="tabular-nums">{itemCount}</span>
      </div>
      <div className="flex items-baseline justify-between border-t border-border pt-3">
        <span className="text-sm">Subtotal</span>
        {priceLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <span className="font-display text-lg font-semibold tabular-nums font-stretch-semi-expanded">
            {formatBDT(subtotal)}
          </span>
        )}
      </div>
      {itemCount > 0 && !priceLoading ? (
        <div className="space-y-1.5">
          <div
            className="h-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Progress to free delivery"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {toFree === 0
              ? 'This order qualifies for free delivery.'
              : `Add ${formatBDT(toFree)} more for free delivery.`}
          </p>
        </div>
      ) : null}
      {isPanel ? null : (
        <p className="text-xs text-muted-foreground">
          Delivery fee and coupons are applied at checkout.
        </p>
      )}
      {!isPanel && (
        <Button className="h-12 w-full" disabled={!cart || cart.lines.length === 0} asChild>
          {authenticated ? (
            <Link href="/checkout">Proceed to checkout</Link>
          ) : (
            <Link href="/login?callbackUrl=/checkout">Sign in to checkout</Link>
          )}
        </Button>
      )}
    </>
  );

  if (isPanel) return <div className={cn('space-y-3')}>{rows}</div>;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">{rows}</CardContent>
    </Card>
  );
}
