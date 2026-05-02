'use client';

import { JSX, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HeaderButton } from '@/app/common/button/header-button';
import { Container } from '@/app/components/container/container';
import { Menu } from '@/app/components/menu/menu';
import { HeaderAccount } from '@/app/components/header/header-account';
import type { MenuCategory } from '@/app/components/menu/menu.types';
import { removeOccur } from '@/app/utils/helper';
import { IHeaderButton } from '@/interfaces';

import { Input } from '@/components/ui/input';
import { Logo } from '@/app/common/logo/logo.atom';
import { SearchIcon, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export interface HeaderProps {
  menu: MenuCategory[];
}

export type HeaderSearchProps = {
  search: string;
  setSearch: (search: string) => void;
  showSearchBar: boolean;
  onSubmit: (e: React.FormEvent) => void;
};

export type HeaderButtonsProps = {
  headerButtons: IHeaderButton[];
};

export function Header({ menu }: Readonly<HeaderProps>): JSX.Element {
  return (
    <header className="sticky top-0 z-50">
      <Header.TopBar />
      <Header.Menu menu={menu} />
    </header>
  );
}

Header.TopBar = function TopBar(): JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = search.trim();
    router.push(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products');
  }

  return (
    <Container WrapperClassName="bg-[#f9fafc] dark:bg-background border-b border-gray-200 dark:border-[#222223]">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 items-center justify-between sm:h-14">
        <Header.Logo />

        <Header.Search
          search={search}
          setSearch={setSearch}
          onSubmit={submitSearch}
          showSearchBar={showSearchBar}
        />
        <div className="flex h-full items-center gap-6 justify-end order-2  sm:order-none">
          <Link href="/cart">
            <ShoppingCart size={18} />
          </Link>
          <SearchIcon
            size={18}
            className="sm:hidden"
            onClick={() => setShowSearchBar((prev) => !prev)}
          />
          <HeaderAccount />
        </div>
      </div>
    </Container>
  );
};

Header.Logo = function HeaderLogo(): JSX.Element {
  return (
    <div className="w-10 h-10 py-1 sm:py-0 order-1 sm:order-none">
      <Logo src="/logo.png" alt="logo" className="w-full h-full object-contain" />
    </div>
  );
};

Header.Search = function HeaderSearch({
  search,
  setSearch,
  onSubmit,
  showSearchBar,
}: HeaderSearchProps): JSX.Element {
  return (
    <form
      className={cn(
        'flex-1 col-span-2 h-full w-full py-2 sm:col-span-1 order-3 sm:order-none mb-2 sm:mb-0 duration-300 transition-all',
        showSearchBar
          ? 'max-sm:translate-y-0 max-sm:z-10'
          : 'max-sm:-translate-y-[1000px] max-sm:absolute max-sm:-z-10',
      )}
      onSubmit={onSubmit}
    >
      <Input
        type="search"
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="dark:placeholder:text-white w-full h-full placeholder:text-sm text-sm"
      />
    </form>
  );
};

Header.Buttons = function HeaderButtons({ headerButtons }: HeaderButtonsProps): JSX.Element {
  return (
    <div className="flex items-center flex-1 h-full mr-4">
      {headerButtons.map((button) => (
        <HeaderButton key={`${removeOccur(button.href, '/')}-button`} button={button} />
      ))}
    </div>
  );
};

Header.Menu = function HeaderMenu({ menu }: { menu: MenuCategory[] }): JSX.Element {
  return (
    <Container WrapperClassName="border-b border-gray-200 dark:border-[#222223] bg-white dark:bg-background">
      <Menu menu={menu} />
    </Container>
  );
};
