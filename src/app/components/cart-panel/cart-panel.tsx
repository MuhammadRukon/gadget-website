'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';

import { CartLineItem, CartLinesLoading } from '@/app/components/cart/cart-line-item';
import { CartNotices } from '@/app/components/cart/cart-notices';
import { CartSummary } from '@/app/components/cart/cart-summary';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cartAvailability, cartHeaderLabel } from '@/modules/cart/availability';
import { useCart, useCartBadgeCount } from '@/modules/cart/hooks';

export function CartPanel() {
  const itemCount = useCartBadgeCount();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={
            itemCount > 0
              ? `Open cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`
              : 'Open cart'
          }
          className="relative flex h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md px-2.5 text-sm font-medium text-ink transition-colors hover:bg-field data-[state=open]:bg-field"
        >
          <ShoppingCart size={19} aria-hidden />
          <span className="max-sm:hidden" aria-hidden>
            Cart
          </span>
          {itemCount > 0 && (
            <span
              aria-hidden
              key={itemCount}
              className="flex h-5 min-w-5 animate-[sf-pop_320ms_cubic-bezier(0.16,1,0.3,1)] items-center justify-center rounded-full bg-solder px-1.5 text-[11px] font-semibold leading-none text-on-solder tabular-nums max-sm:absolute max-sm:right-0.5 max-sm:top-0.5"
            >
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="sf flex w-full flex-col gap-0 sm:max-w-md">
        <CartPanelContent />
      </SheetContent>
    </Sheet>
  );
}

/** Radix unmounts SheetContent children while closed, so the full cart is only fetched once the panel opens. */
function CartPanelContent() {
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
              <Link href="/products" className="text-sm font-medium text-solder-ink underline">
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
