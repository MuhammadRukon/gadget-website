'use client';

import { JSX, useEffect, useState } from 'react';
import { applyTheme, getSavedTheme, toggleTheme } from '../utils/theme';

import { HeaderButton } from '../common/button/header-button';
import { Input } from '../common/input/input.atom';
import { Logo } from '../common/logo/logo.atom';
import { Container } from './container/container';
import { Menu } from './menu/menu';
import { Handshake, Percent, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { IMenu } from '../interface';
import { removeOccurrence } from '../utils/removeOccurence';

export function Header(): JSX.Element {
  const menu: IMenu[] = [
    {
      id: '1',
      name: 'Phones',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [
        { id: '1', name: 'Apple', isActive: true, isDeleted: false, isPopular: false },
        { id: '2', name: 'Samsung', isActive: true, isDeleted: false, isPopular: false },
      ],
    },
    {
      id: '2',
      name: 'Laptops',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [
        { id: '1', name: 'Macbook', isActive: true, isDeleted: false, isPopular: false },
        { id: '2', name: 'Surface', isActive: true, isDeleted: false, isPopular: false },
      ],
    },
    {
      id: '3',
      name: 'Tablets',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '4',
      name: 'Desktops',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [
        { id: '1', name: 'Macbook', isActive: true, isDeleted: false, isPopular: false },
        { id: '2', name: 'Surface', isActive: true, isDeleted: false, isPopular: false },
      ],
    },
    {
      id: '5',
      name: 'Accessories',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '6',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '7',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '8',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '9',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '10',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '11',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '12',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '13',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
    {
      id: '14',
      name: 'Gaming',
      isActive: true,
      isDeleted: false,
      isPopular: false,
      brands: [],
    },
  ];

  return (
    <>
      <Container
        WrapperClassName={`bg-[#f9fafc] dark:bg-background border-b border-gray-200 dark:border-gray-800`}
      >
        <Header.TopBar />
      </Container>
      <Container WrapperClassName={`border-b border-gray-200 dark:border-gray-800`}>
        <Menu menu={menu} />
      </Container>
    </>
  );
}

Header.TopBar = function TopBar() {
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    applyTheme(getSavedTheme());
    setTheme(getSavedTheme());
  }, []);

  const headerButtons = [
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
    <div className="flex flex-col sm:flex-row items-center justify-between sm:h-10">
      <div className="sm:w-24">
        <Logo src="/logo.png" alt="logo" className="w-10 h-10" />
      </div>

      <div className="flex-1 sm:mr-4 md:mr-10">
        <Input
          value={search}
          onChange={(value: string) => setSearch(value)}
          placeholder="Search"
          className="dark:placeholder:text-white w-full h-7 placeholder:text-sm text-sm max-w-sm rounded-none"
        />
      </div>

      <div className="flex items-center flex-1 h-full mr-4">
        {headerButtons.map((button) => (
          <HeaderButton key={`${removeOccurrence(button.href, '/')}-button`} button={button} />
        ))}
      </div>

      <Switch checked={theme === 'dark'} onCheckedChange={() => setTheme(toggleTheme())} />
    </div>
  );
};
