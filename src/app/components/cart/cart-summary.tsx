'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CartSnapshot } from '@/contracts/cart';
import { cn } from '@/lib/utils';
import { formatBDT } from '@/server/common/money';

export interface CartSummaryProps {
  cart: CartSnapshot | null | undefined;
  authenticated: boolean;
  isPanel?: boolean;
}

export function CartSummary({ cart, authenticated, isPanel = false }: Readonly<CartSummaryProps>) {
  const itemCount = cart?.itemCount ?? 0;
  const subtotal = cart?.subtotalCents ?? 0;
  const hasInactive = !!cart?.lines.some((l) => !l.isActive || l.quantity > l.stock);

  const rows = (
    <>
      {isPanel ? null : <h2 className="text-lg font-semibold">Order summary</h2>}
      <div className="flex justify-between text-sm">
        <span>Items</span>
        <span>{itemCount}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatBDT(subtotal)}</span>
      </div>
      {isPanel ? null : (
        <p className="text-xs text-muted-foreground">Shipping & coupons calculated at checkout.</p>
      )}
      {!isPanel && (
        <Button className="w-full" disabled={itemCount === 0 || hasInactive} asChild>
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
