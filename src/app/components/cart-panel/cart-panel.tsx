'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';

import { Loader } from '@/app/common/loader/loader';
import { CartLineItem } from '@/app/components/cart/cart-line-item';
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
import { useCart } from '@/modules/cart/hooks';

export function CartPanel() {
  const { cart, isLoading, isAuthenticated } = useCart();
  const isEmpty = !cart || cart.lines.length === 0;
  const itemCount = cart?.itemCount ?? 0;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" aria-label="Open cart" className="relative cursor-pointer">
          <ShoppingCart size={18} />
          {itemCount > 0 && (
            <span
              aria-label={`${itemCount} items in cart`}
              className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            >
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>Cart</SheetTitle>
          <SheetDescription>You cart items.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader />
            </div>
          ) : isEmpty ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Your cart is empty.{' '}
              <SheetClose asChild>
                <Link href="/products" className="underline">
                  Browse products
                </Link>
              </SheetClose>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {cart?.lines.map((line) => (
                <li key={line.itemId}>
                  <CartLineItem line={line} compact />
                </li>
              ))}
            </ul>
          )}
        </div>

        <SheetFooter className="gap-3">
          {isEmpty ? null : <CartSummary cart={cart} authenticated={isAuthenticated} isPanel />}
          <div className="flex w-full gap-2">
            <SheetClose asChild>
              <Button asChild className="flex-1" disabled={isEmpty}>
                <Link href="/checkout">Proceed to checkout</Link>
              </Button>
            </SheetClose>

            <SheetClose asChild>
              <Button asChild variant="outline" className="flex-1" disabled={isEmpty}>
                <Link href="/cart">View cart</Link>
              </Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
