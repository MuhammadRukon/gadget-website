'use client';

import Link from 'next/link';

import { IBrand, IMenu } from '@/interfaces';

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
      <NavigationMenuList className=" w-full flex flex-wrap justify-start">
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
    <NavigationMenuItem className="">
      <NavigationMenuLink asChild className=" h-full px-3 py-1.5">
        <Link href={`/${encodeURIComponent(category.name.toLowerCase())}`}>{category.name}</Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

Menu.ItemWithBrand = function MenuItemWithBrand({ category }: MenuItemProps) {
  return (
    <NavigationMenuItem className="">
      <NavigationMenuTrigger className="p-2.5 h-8">
        <Link href={`/${encodeURIComponent(category.name.toLowerCase())}`}>{category.name}</Link>
      </NavigationMenuTrigger>
      <NavigationMenuContent className="absolute p-0 z-50">
        <ul>
          {category.brands.map((brand) => {
            const path = `/${encodeURIComponent(category.name.toLowerCase())}/${encodeURIComponent(
              brand.name.toLowerCase(),
            )}`;

            return <ListItem key={brand.id} category={category} brand={brand} href={path} />;
          })}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

function ListItem(
  props: React.ComponentPropsWithoutRef<'li'> & { href: string; category: IMenu; brand: IBrand },
) {
  return (
    <li {...props}>
      <NavigationMenuLink className=" pl-3 pr-4 py-1.5" asChild>
        <Link
          href={`/${encodeURIComponent(props.category.name.toLowerCase())}/${encodeURIComponent(
            props.brand.name.toLowerCase(),
          )}`}
        >
          {props.brand.name}
        </Link>
      </NavigationMenuLink>
    </li>
  );
}
