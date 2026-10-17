'use client';

import dynamic from 'next/dynamic';
import { ShoppingCart } from 'lucide-react';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useCartBadgeCount } from '@/modules/cart/hooks';

// The cart body (lines, summary, price fetching) loads when the panel is first opened.
const CartPanelContent = dynamic(
  () => import('./cart-panel-content').then((m) => m.CartPanelContent),
  { ssr: false, loading: () => <div className="flex-1 px-4" aria-busy="true" /> },
);

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
          className="relative flex size-11 cursor-pointer items-center justify-center rounded-md text-ink transition-colors hover:text-raven"
        >
          <ShoppingCart size={19} aria-hidden />
          {itemCount > 0 && (
            <span
              aria-hidden
              key={itemCount}
              className="flex animate-[sf-pop_320ms_cubic-bezier(0.16,1,0.3,1)] items-center justify-center rounded-full bg-eye text-xs font-semibold leading-none text-ink tabular-nums absolute right-0 top-0.5 h-[18px] min-w-[18px] px-1"
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
