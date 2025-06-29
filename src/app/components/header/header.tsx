'use client';

import { Handshake, Percent, User } from 'lucide-react';
import { JSX, useState } from 'react';

import { HeaderButtonsProps, HeaderSearchProps } from './header.types';
import { IHeaderButton } from '@/app/interface';

import { HeaderButton } from '@/app/common/button/header-button';
import { Container } from '@/app/components/container/container';
import { Menu } from '@/app/components/menu/menu';
import { menu } from '@/app/utils/dummy-data';
import { removeOccur } from '@/app/utils/removeOccur';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

import { Logo } from '@/app/common/logo/logo.atom';
import { useTheme } from '@/app/providers/theme-provider';

export function Header(): JSX.Element {
  return (
    <>
      <Header.TopBar />
      <Header.Menu />
    </>
  );
}

Header.TopBar = function TopBar(): JSX.Element {
  const [search, setSearch] = useState('');
  const { theme, setTheme } = useTheme();

  const headerButtons: IHeaderButton[] = [
    {
      href: '/deals',
      title: 'PC Deals',
      icon: <Handshake size={14} />,
    },
    {
      href: '/offers',
      title: 'Offers',
      icon: <Percent size={14} />,
    },
    {
      href: '/login',
      title: 'Login',
      icon: <User size={14} />,
    },
  ];

  return (
    <Container WrapperClassName="bg-[#f9fafc] dark:bg-background border-b border-gray-200 dark:border-[#222223]">
      <div className="flex flex-col sm:flex-row items-center justify-between sm:h-10">
        <Header.Logo />

        <Header.Search search={search} setSearch={setSearch} />

        <Header.Buttons headerButtons={headerButtons} />

        <Switch
          checked={theme === 'dark'}
          onCheckedChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        />
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

Header.Search = function HeaderSearch({ search, setSearch }: HeaderSearchProps): JSX.Element {
  return (
    <div className="flex-1 sm:mr-4 md:mr-10">
      <Input
        type="text"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="dark:placeholder:text-white w-full h-7 placeholder:text-sm text-sm max-w-sm rounded-none"
      />
    </div>
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

Header.Menu = function HeaderMenu(): JSX.Element {
  return (
    <Container WrapperClassName="border-b border-gray-200 dark:border-[#222223]">
      <Menu menu={menu} />
    </Container>
  );
};
