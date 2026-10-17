'use client';

import Link from 'next/link';

import { CartLineItem, CartLinesLoading } from '@/app/components/cart/cart-line-item';
import { CartNotices } from '@/app/components/cart/cart-notices';
import { CartSummary } from '@/app/components/cart/cart-summary';
import { Button } from '@/components/ui/button';
import {
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cartAvailability, cartHeaderLabel } from '@/modules/cart/availability';
import { useCart } from '@/modules/cart/hooks';

/** Radix unmounts SheetContent children while closed, so the full cart is only fetched once the panel opens. */
export function CartPanelContent() {
  const { cart, isLoading, isPriceLoading, isAuthenticated } = useCart();
  const isEmpty = !cart || cart.lines.length === 0;

  return (
    <>
      <SheetHeader>
        <SheetTitle>Cart</SheetTitle>
        <SheetDescription>
          {isEmpty ? 'Nothing added yet.' : cartHeaderLabel(cartAvailability(cart.lines))}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4">
        <CartNotices lines={cart?.lines} />
        {isLoading ? (
          <CartLinesLoading authenticated={isAuthenticated} compact />
        ) : isEmpty ? (
          <div className="flex flex-col items-start gap-3 border-y border-rule py-10">
            <p className="font-display text-lg font-semibold font-stretch-semi-expanded">
              Your cart is empty
            </p>
            <SheetClose asChild>
              <Link href="/products" className="text-sm font-medium text-raven-ink underline">
                Browse all products
              </Link>
            </SheetClose>
          </div>
        ) : (
          <ul className="divide-y divide-rule">
            {cart?.lines.map((line) => (
              <li key={line.itemId}>
                <CartLineItem line={line} compact priceLoading={isPriceLoading} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <SheetFooter className="gap-3">
        {isEmpty ? null : (
          <CartSummary
            cart={cart}
            authenticated={isAuthenticated}
            isPanel
            priceLoading={isPriceLoading}
          />
        )}
        {isEmpty ? null : (
          <div className="flex w-full flex-col gap-2">
            <SheetClose asChild>
              <Button asChild size="lg" className="h-12 w-full">
                <Link href="/checkout">Checkout</Link>
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button asChild variant="outline" size="lg" className="h-11 w-full">
                <Link href="/cart">View full cart</Link>
              </Button>
            </SheetClose>
          </div>
        )}
      </SheetFooter>
    </>
  );
}
