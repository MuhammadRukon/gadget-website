'use client';

import Link from 'next/link';

import { IMenu } from '@/app/interface';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { MenuItemProps } from './menu.types';

export function Menu({ menu }: { menu: IMenu[] }) {
  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList className="rounded-none w-full flex flex-wrap justify-start">
        {menu.map((category) => {
          const hasBrand = category.brands.length;

          if (hasBrand) return <Menu.ItemWithBrand key={category.id} category={category} />;
          return <Menu.Item key={category.id} category={category} />;
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

Menu.Item = function MenuItem({ category }: MenuItemProps) {
  return (
    <NavigationMenuItem className="rounded-none">
      <NavigationMenuLink asChild className="rounded-none h-full px-3 py-1.5">
        <Link href={`/${encodeURIComponent(category.name.toLowerCase())}`}>{category.name}</Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

Menu.ItemWithBrand = function MenuItemWithBrand({ category }: MenuItemProps) {
  return (
    <NavigationMenuItem className="rounded-none">
      <NavigationMenuTrigger className="rounded-none p-2.5 h-8">
        <Link href={`/${encodeURIComponent(category.name.toLowerCase())}`}>{category.name}</Link>
      </NavigationMenuTrigger>
      <NavigationMenuContent className="!rounded-none p-0 z-50">
        <ul>
          {category.brands.map((brand) => (
            <li key={brand.id}>
              <NavigationMenuLink className="rounded-none pl-3 pr-4 py-1.5" asChild>
                <Link
                  href={`/${encodeURIComponent(category.name.toLowerCase())}/${encodeURIComponent(
                    brand.name.toLowerCase(),
                  )}`}
                >
                  {brand.name}
                </Link>
              </NavigationMenuLink>
            </li>
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};
