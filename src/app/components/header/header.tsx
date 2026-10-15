import Link from 'next/link';
import { JSX } from 'react';

import { Container } from '@/app/components/container/container';
import { Menu } from '@/app/components/menu/menu';
import { HeaderAccount } from '@/app/components/header/header-account';
import { HeaderFrame, SearchToggle } from '@/app/components/header/header-frame';
import { HeaderLogo } from '@/app/components/header/header-logo';
import { CartPanel } from '@/app/components/cart-panel/cart-panel';
import { CategorySidebar } from '@/components/category-sidebar';
import type { MenuCategory } from '@/app/components/menu/menu.types';

export interface HeaderProps {
  menu: MenuCategory[];
}

/**
 * One-row storefront header: logo, categories (desktop), then icon-only
 * search, account and cart. Search opens as a panel below the bar (click,
 * "/" or Ctrl/Cmd+K). Scrolling down slims the bar and folds the wordmark
 * into the raven mark; scrolling up restores it (see HeaderFrame).
 */
export function Header({ menu }: Readonly<HeaderProps>): JSX.Element {
  const quickLinks = [
    { label: 'All products', href: '/products' },
    ...menu.slice(0, 4).map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
    { label: 'Track an order', href: '/account/orders' },
    { label: 'Delivery and returns', href: '/refund-policy' },
  ];
  return (
    <HeaderFrame quickLinks={quickLinks}>
      <Container>
        <div className="flex h-14 items-center gap-2 transition-[height] duration-300 ease-out group-data-[compact=true]/h:h-12 md:h-16 md:gap-6">
          <div className="-ml-2 lg:hidden">
            <CategorySidebar items={menu} />
          </div>
          <HeaderLogo />

          <nav aria-label="Categories" className="hidden h-full items-center lg:flex">
            <Link
              href="/products"
              className="flex h-11 items-center px-3 text-sm font-medium text-ink hover:text-raven-ink"
            >
              All products
            </Link>
            <Menu menu={menu} />
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <SearchToggle />
            <HeaderAccount />
            <CartPanel />
          </div>
        </div>
      </Container>
    </HeaderFrame>
  );
}
