'use client';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { IMenu } from '@/app/interface';
import Link from 'next/link';

export function Menu({ menu }: { menu: IMenu[] }) {
  return (
    <NavigationMenu viewport={false}>
      <NavigationMenuList className="rounded-none w-full flex flex-wrap justify-between">
        {menu.map((category) => (
          <NavigationMenuItem className="rounded-none" key={category.id}>
            {category.brands.length ? (
              <>
                <NavigationMenuTrigger className="rounded-none p-2 h-7">
                  <Link href={`/${category.name.toLowerCase()}`}>{category.name}</Link>
                </NavigationMenuTrigger>
                <NavigationMenuContent className="!rounded-none p-0 z-50">
                  <ul>
                    {category.brands.map((brand) => (
                      <li key={brand.id}>
                        <NavigationMenuLink className="rounded-none pl-3 pr-4 py-1.5" asChild>
                          <Link
                            href={`/${category.name.toLowerCase()}/${brand.name.toLowerCase()}`}
                          >
                            {brand.name}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink asChild className="rounded-none h-full p-2 py-1">
                <Link href={`/${category.name.toLowerCase()}`}>{category.name}</Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
