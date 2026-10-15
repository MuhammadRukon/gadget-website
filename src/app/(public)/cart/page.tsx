'use client';

import Link from 'next/link';

import { CartLineItem, CartLinesLoading } from '@/app/components/cart/cart-line-item';
import { CartNotices } from '@/app/components/cart/cart-notices';
import { CartSummary } from '@/app/components/cart/cart-summary';
import { cartAvailability, cartHeaderLabel } from '@/modules/cart/availability';
import { useCart } from '@/modules/cart/hooks';

export default function CartPage() {
  const { cart, isLoading, isPriceLoading, isAuthenticated } = useCart();

  return (
    <section className="grid grid-cols-1 gap-6 pb-8 pt-6 lg:grid-cols-[1fr_340px] lg:gap-10">
      <h1 className="font-display text-[clamp(1.9rem,4.5vw,3rem)] font-bold leading-none tracking-[-0.025em] font-stretch-expanded lg:col-span-2">
        Your cart
      </h1>
      <div className="lg:col-span-2 space-y-1 empty:hidden">
        {cart && cart.lines.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {cartHeaderLabel(cartAvailability(cart.lines))}
          </p>
        ) : null}
        <CartNotices lines={cart?.lines} />
      </div>
      {isLoading ? (
        <CartLinesLoading authenticated={isAuthenticated} />
      ) : !cart || cart.lines.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border-y border-border py-12">
          <p className="font-display text-xl font-semibold font-stretch-semi-expanded">
            Your cart is empty
          </p>
          <p className="text-sm text-muted-foreground">
            Items you add from a product page will show up here.
          </p>
          <Link href="/products" className="text-sm font-medium text-solder-ink underline">
            Browse all products
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {cart.lines.map((line) => (
            <li key={line.itemId}>
              <CartLineItem line={line} priceLoading={isPriceLoading} />
            </li>
          ))}
        </ul>
      )}

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <CartSummary cart={cart} authenticated={isAuthenticated} priceLoading={isPriceLoading} />
      </aside>
    </section>
  );
}
