'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader } from '@/app/common/loader/loader';
import { apiFetch } from '@/lib/fetcher';
import { formatBDT } from '@/server/common/money';
import type { CartSnapshot } from '@/contracts/cart';
import { useCartMutations, useGuestCartMerge, useServerCart } from '@/modules/cart/hooks';
import { useGuestCart } from '@/modules/cart/guest-cart';

export default function CartPage() {
  const { status } = useSession();
  useGuestCartMerge();

  const serverCart = useServerCart('full');
  const guestLines = useGuestCart((s) => s.lines);
  const [guestSnapshot, setGuestSnapshot] = useState<CartSnapshot | null>(null);
  const [hydratingGuest, setHydratingGuest] = useState(false);

  // Hydrate the guest cart shape against the catalog so the UI shows
  // names, prices, and images even when the user is signed out.
  useEffect(() => {
    if (status !== 'unauthenticated') return;
    let cancelled = false;
    setHydratingGuest(true);
    apiFetch<CartSnapshot>('/api/cart/hydrate', {
      method: 'POST',
      body: { lines: guestLines },
    })
      .then((snapshot) => {
        if (!cancelled) setGuestSnapshot(snapshot);
      })
      .catch(() => {
        if (!cancelled) setGuestSnapshot({ lines: [], subtotalCents: 0, itemCount: 0 });
      })
      .finally(() => {
        if (!cancelled) setHydratingGuest(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, guestLines]);

  const cart = status === 'authenticated' ? serverCart.data : guestSnapshot ?? null;
  const isLoading =
    status === 'loading' ||
    (status === 'authenticated' && serverCart.isLoading) ||
    (status === 'unauthenticated' && hydratingGuest);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-6">
      <h1 className="text-2xl font-semibold lg:col-span-2 ">Your cart</h1>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader />
        </div>
      ) : !cart || cart.lines.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Your cart is empty.{' '}
            <Link href="/products" className="underline">
              Browse products
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {cart.lines.map((line) => (
            <CartRow key={line.itemId} line={line} />
          ))}
        </ul>
      )}

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <CartSummary cart={cart} authenticated={status === 'authenticated'} />
      </aside>
    </section>
  );
}

function CartRow({ line }: Readonly<{ line: CartSnapshot['lines'][number] }>) {
  const { updateItem, removeItem } = useCartMutations();
  return (
    <li>
      <Card>
        <CardContent className="flex gap-4 p-4">
          <div className="relative w-20 h-20 bg-muted overflow-hidden shrink-0">
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
            <p className="text-xs text-muted-foreground">
              {line.variantName ? `${line.variantName} · ` : ''}SKU: {line.sku}
            </p>
            <p className="text-sm mt-1">{formatBDT(line.unitPriceCents)} each</p>
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
            <Input
              type="number"
              min={0}
              max={99}
              value={line.quantity}
              className="w-16 text-center"
              onChange={(e) =>
                updateItem.mutate({
                  itemId: line.itemId,
                  variantId: line.variantId,
                  quantity: Number(e.target.value),
                })
              }
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeItem.mutate({ itemId: line.itemId, variantId: line.variantId })}
            >
              Remove
            </Button>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

function CartSummary({
  cart,
  authenticated,
}: {
  cart: CartSnapshot | null | undefined;
  authenticated: boolean;
}) {
  const itemCount = cart?.itemCount ?? 0;
  const subtotal = cart?.subtotalCents ?? 0;
  const hasInactive = !!cart?.lines.some((l) => !l.isActive || l.quantity > l.stock);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="flex justify-between text-sm">
          <span>Items</span>
          <span>{itemCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatBDT(subtotal)}</span>
        </div>
        <p className="text-xs text-muted-foreground">Shipping & coupons calculated at checkout.</p>
        <Button className="w-full" disabled={itemCount === 0 || hasInactive} asChild>
          {authenticated ? (
            <Link href="/checkout">Proceed to checkout</Link>
          ) : (
            <Link href="/login?callbackUrl=/checkout">Sign in to checkout</Link>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
