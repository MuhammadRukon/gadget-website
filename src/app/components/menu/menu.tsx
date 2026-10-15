'use client';

import Link from 'next/link';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { slugify } from '@/server/common/slug';
import type { MenuBrand, MenuCategory, MenuItemProps } from './menu.types';

function categoryHref(category: MenuCategory): string {
  return `/category/${category.slug ?? slugify(category.name)}`;
}

function brandHref(brand: MenuBrand): string {
  return `/brand/${brand.slug ?? slugify(brand.name)}`;
}

export function Menu({ menu }: Readonly<{ menu: MenuCategory[] }>) {
  if (menu.length === 0) return null;
  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList>
        {menu.map((category) =>
          category.brands.length > 0 ? (
            <Menu.ItemWithBrand key={category.id} category={category} />
          ) : (
            <Menu.Item key={category.id} category={category} />
          ),
        )}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

Menu.Item = function MenuItem({ category }: MenuItemProps) {
  return (
    <NavigationMenuItem>
      <NavigationMenuLink
        asChild
        className="h-11 rounded-none bg-transparent px-3 text-sm font-medium text-ink hover:bg-transparent hover:text-solder-ink focus:bg-transparent"
      >
        <Link href={categoryHref(category)}>{category.name}</Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
};

Menu.ItemWithBrand = function MenuItemWithBrand({ category }: MenuItemProps) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger
        className="h-11 rounded-none bg-transparent px-3 text-sm font-medium text-ink hover:bg-transparent hover:text-solder-ink focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:text-solder-ink"
        asChild
      >
        <Link href={categoryHref(category)}>{category.name}</Link>
      </NavigationMenuTrigger>
      <NavigationMenuContent className="sf absolute z-50 min-w-fit rounded-md border border-rule bg-surface p-1.5">
        <p className="px-3 pb-1 pt-1.5 text-xs text-ink-2">Brands</p>
        <ul className="min-w-fit sm:min-w-[180px]">
          {category.brands.map((brand) => (
            <ListItem key={brand.id} brand={brand} />
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
};

function ListItem({ brand }: Readonly<{ brand: MenuBrand }>) {
  return (
    <li>
      <NavigationMenuLink className="rounded-sm px-3 py-2 text-sm hover:bg-field" asChild>
        <Link href={brandHref(brand)}>{brand.name}</Link>
      </NavigationMenuLink>
    </li>
  );
}
