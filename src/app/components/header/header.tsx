'use client';

import { JSX, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HeaderButtonsProps, HeaderSearchProps } from './header.types';

import { HeaderButton } from '@/app/common/button/header-button';
import { Container } from '@/app/components/container/container';
import { Menu } from '@/app/components/menu/menu';
import { HeaderAccount } from '@/app/components/header/header-account';
import type { MenuCategory } from '@/app/components/menu/menu.types';
import { removeOccur } from '@/app/utils/helper';

import { Input } from '@/components/ui/input';
import { Logo } from '@/app/common/logo/logo.atom';

export interface HeaderProps {
  menu: MenuCategory[];
}

export function Header({ menu }: Readonly<HeaderProps>): JSX.Element {
  return (
    <>
      <Header.TopBar />
      <Header.Menu menu={menu} />
    </>
  );
}

Header.TopBar = function TopBar(): JSX.Element {
  const router = useRouter();
  const [search, setSearch] = useState('');

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = search.trim();
    router.push(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products');
  }

  return (
    <Container WrapperClassName="bg-[#f9fafc] dark:bg-background border-b border-gray-200 dark:border-[#222223]">
      <div className="grid grid-cols-2 xs:grid-cols-3 gap-y-2 items-center justify-between xs:h-14">
        <Header.Logo />

        <Header.Search search={search} setSearch={setSearch} onSubmit={submitSearch} />
        <div className="flex h-full items-center gap-1 justify-end order-2 xs:order-none">
          <HeaderAccount />
        </div>
      </div>
    </Container>
  );
};

Header.Logo = function HeaderLogo(): JSX.Element {
  return (
    <div className="xs:w-18 order-1 xs:order-none">
      <Logo src="/logo.png" alt="logo" className="w-10 h-10" />
    </div>
  );
};

interface HeaderSearchPropsWithSubmit extends HeaderSearchProps {
  onSubmit: (e: React.FormEvent) => void;
}

Header.Search = function HeaderSearch({
  search,
  setSearch,
  onSubmit,
}: HeaderSearchPropsWithSubmit): JSX.Element {
  return (
    <form
      className="flex-1 col-span-2 w-full xs:col-span-1 order-3 xs:order-none mb-2 xs:mb-0"
      onSubmit={onSubmit}
    >
      <Input
        type="search"
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="dark:placeholder:text-white w-full h-8 placeholder:text-sm text-sm"
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
    <Container WrapperClassName="border-b border-gray-200 dark:border-[#222223]">
      <Menu menu={menu} />
    </Container>
  );
};
