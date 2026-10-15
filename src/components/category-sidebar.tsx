'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, ChevronRight, ChevronDown } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

import { Button } from '@/components/ui/button';
import { slugify } from '@/server/common/slug';
import type { MenuBrand, MenuCategory } from '@/app/components/menu/menu.types';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  items: MenuCategory[];
}

function categoryHref(category: MenuCategory) {
  return `/category/${category.slug ?? slugify(category.name)}`;
}

function brandHref(brand: MenuBrand) {
  return `/brand/${brand.slug ?? slugify(brand.name)}`;
}

export function CategorySidebar({ items }: AppSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          className="size-11 hover:bg-field"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="sf w-[85vw] max-w-80 gap-0 p-0">
        <SheetHeader className="border-b border-rule px-4 py-4">
          <SheetTitle className="font-display text-lg font-semibold font-stretch-semi-expanded">
            Shop by category
          </SheetTitle>
        </SheetHeader>

        <nav aria-label="Categories" className="overflow-y-auto py-2">
          <SheetClose asChild>
            <Link
              href="/products"
              className="flex h-12 items-center px-4 text-[15px] font-medium hover:bg-field"
            >
              All products
            </Link>
          </SheetClose>
          {items.map((category) => (
            <CategoryItem key={category.id} category={category} />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function CategoryItem({ category }: Readonly<{ category: MenuCategory }>) {
  const [open, setOpen] = useState(false);

  const hasChildren = category.brands.length > 0;

  return (
    <div>
      <div className="flex items-center">
        <SheetClose asChild>
          <Link
            href={categoryHref(category)}
            className="flex h-12 flex-1 items-center px-4 text-[15px] hover:bg-field"
          >
            {category.name}
          </Link>
        </SheetClose>

        {hasChildren && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex size-12 items-center justify-center text-ink-2 hover:bg-field"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} ${category.name} brands`}
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        )}
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-4 border-l border-rule">
            {category.brands.map((brand) => (
              <SheetClose asChild key={brand.id}>
                <Link
                  href={brandHref(brand)}
                  className="flex h-11 items-center px-4 text-sm text-ink-2 hover:bg-field hover:text-ink"
                >
                  {brand.name}
                </Link>
              </SheetClose>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
