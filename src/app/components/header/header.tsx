import Link from 'next/link';
import { JSX } from 'react';

import { Container } from '@/app/components/container/container';
import { Menu } from '@/app/components/menu/menu';
import { HeaderAccount } from '@/app/components/header/header-account';
import { HeaderLogo } from '@/app/components/header/header-logo';
import { HeaderSearch } from '@/app/components/header/header-search';
import { CartPanel } from '@/app/components/cart-panel/cart-panel';
import { CategorySidebar } from '@/components/category-sidebar';
import type { MenuCategory } from '@/app/components/menu/menu.types';

export interface HeaderProps {
  menu: MenuCategory[];
}

/**
 * Server-rendered storefront header shell. Only the interactive leaves ship
 * client JS: HeaderSearch, CartPanel, HeaderAccount, CategorySidebar and the
 * Menu flyout. Search stays visible at every width.
 */
export function Header({ menu }: Readonly<HeaderProps>): JSX.Element {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper">
      <Container>
        <div className="flex h-14 items-center gap-3 md:h-16 md:gap-6">
          <div className="-ml-2 md:hidden">
            <CategorySidebar items={menu} />
          </div>
          <HeaderLogo />

          <div className="hidden flex-1 md:block">
            <HeaderSearch />
          </div>

          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <HeaderAccount />
            <CartPanel />
          </div>
        </div>

        <div className="pb-2.5 md:hidden">
          <HeaderSearch />
        </div>

        <nav aria-label="Categories" className="-mx-3 hidden h-11 items-center md:flex">
          <Link
            href="/products"
            className="flex h-11 items-center px-3 text-sm font-medium text-ink hover:text-solder-ink"
          >
            All products
          </Link>
          <Menu menu={menu} />
        </nav>
      </Container>
    </header>
  );
}
