'use client';

import { Handshake, Moon, Percent, Sun } from 'lucide-react';
import { JSX, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';

import { HeaderButtonsProps, HeaderSearchProps } from './header.types';
import { IHeaderButton } from '@/interfaces';

import { HeaderButton } from '@/app/common/button/header-button';
import { Container } from '@/app/components/container/container';
import { Menu } from '@/app/components/menu/menu';
import { HeaderAccount } from '@/app/components/header/header-account';
import type { MenuCategory } from '@/app/components/menu/menu.types';
import { removeOccur } from '@/app/utils/helper';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Logo } from '@/app/common/logo/logo.atom';

export interface HeaderProps {
  menu: MenuCategory[];
}

export function Header({ menu }: HeaderProps): JSX.Element {
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
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = search.trim();
    router.push(trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products');
  }

  const headerButtons: IHeaderButton[] = [
    { href: '/deals', title: 'PC Deals', icon: <Handshake size={14} /> },
    { href: '/offers', title: 'Offers', icon: <Percent size={14} /> },
  ];

  return (
    <Container WrapperClassName="bg-[#f9fafc] dark:bg-background border-b border-gray-200 dark:border-[#222223]">
      <div className="flex flex-col gap-y-2 sm:flex-row items-center justify-between sm:h-10">
        <Header.Logo />

        <Header.Search search={search} setSearch={setSearch} onSubmit={submitSearch} />

        <Header.Buttons headerButtons={headerButtons} />

        <HeaderAccount />

        <div className="flex items-center gap-1.5">
          <Sun size={14} className="text-muted-foreground" aria-hidden />
          <Switch
            checked={isDark}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            aria-label="Toggle dark mode"
          />
          <Moon size={14} className="text-muted-foreground" aria-hidden />
        </div>
      </div>
    </Container>
  );
};

Header.Logo = function HeaderLogo(): JSX.Element {
  return (
    <div className="sm:w-24">
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
    <form className="flex-1 sm:mr-4 md:mr-10" onSubmit={onSubmit}>
      <Input
        type="search"
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="dark:placeholder:text-white w-full h-7 placeholder:text-sm text-sm max-w-sm"
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
