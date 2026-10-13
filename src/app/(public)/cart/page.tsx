'use client';

import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { Loader } from '@/app/common/loader/loader';
import { CartLineItem, CartLineSkeleton } from '@/app/components/cart/cart-line-item';
import { CartNotices } from '@/app/components/cart/cart-notices';
import { CartSummary } from '@/app/components/cart/cart-summary';
import { cartAvailability, cartHeaderLabel } from '@/modules/cart/availability';
import { useGuestCart } from '@/modules/cart/guest-cart';
import { useCart } from '@/modules/cart/hooks';

export default function CartPage() {
  const { cart, isLoading, isPriceLoading, isAuthenticated } = useCart();
  const guestLineCount = useGuestCart((s) => s.lines.length);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-6">
      <h1 className="text-2xl font-semibold lg:col-span-2 ">Your cart</h1>
      <div className="lg:col-span-2 space-y-1 empty:hidden">
        {cart && cart.lines.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {cartHeaderLabel(cartAvailability(cart.lines))}
          </p>
        ) : null}
        <CartNotices lines={cart?.lines} />
      </div>
      {isLoading && !isAuthenticated && guestLineCount > 0 ? (
        <div>
          {Array.from({ length: guestLineCount }, (_, i) => (
            <CartLineSkeleton key={i} />
          ))}
        </div>
      ) : isLoading ? (
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
            <li key={line.itemId}>
              <CartLineItem line={line} priceLoading={isPriceLoading} />
            </li>
          ))}
        </ul>
      )}

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <CartSummary cart={cart} authenticated={isAuthenticated} priceLoading={isPriceLoading} />
      </aside>
    </section>
  );
}
