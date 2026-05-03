'use client';

import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { Loader } from '@/app/common/loader/loader';
import { CartLineItem } from '@/app/components/cart/cart-line-item';
import { CartSummary } from '@/app/components/cart/cart-summary';
import { useCart } from '@/modules/cart/hooks';

export default function CartPage() {
  const { cart, isLoading, isAuthenticated } = useCart();

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
            <li key={line.itemId}>
              <CartLineItem line={line} />
            </li>
          ))}
        </ul>
      )}

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <CartSummary cart={cart} authenticated={isAuthenticated} />
      </aside>
    </section>
  );
}
