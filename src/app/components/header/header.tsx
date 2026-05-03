'use client';

import { JSX, useState } from 'react';
import Image from 'next/image';

import { HeaderButton } from '@/app/common/button/header-button';
import { Container } from '@/app/components/container/container';
import { Menu } from '@/app/components/menu/menu';
import { HeaderAccount } from '@/app/components/header/header-account';
import type { MenuCategory } from '@/app/components/menu/menu.types';
import { removeOccur } from '@/app/utils/helper';
import { IHeaderButton } from '@/interfaces';

import { Input } from '@/components/ui/input';
import { Logo } from '@/app/common/logo/logo.atom';
import { SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { PublicProductPage } from '@/contracts/catalog';
import { formatBDT } from '@/server/common/money';
import { useHeaderSearchPreview } from '@/hooks/use-header-search-preview';
import { CartPanel } from '../cart-panel/cart-panel';

export interface HeaderProps {
  menu: MenuCategory[];
}

export type HeaderSearchProps = {
  search: string;
  setSearch: (search: string) => void;
  showSearchBar: boolean;
  onSubmit: (e: React.FormEvent) => void;
  preview: PublicProductPage | null;
  previewLoading: boolean;
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
  const [showSearchBar, setShowSearchBar] = useState(false);
  //TODO: add score based search.
  const { search, setSearch, preview, previewLoading, submitSearch } = useHeaderSearchPreview();

  return (
    <Container WrapperClassName="bg-[#f9fafc] dark:bg-background border-b border-gray-200 dark:border-[#222223]">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 items-center justify-between sm:h-14">
        <Header.Logo />

        <Header.Search
          search={search}
          setSearch={setSearch}
          onSubmit={submitSearch}
          showSearchBar={showSearchBar}
          preview={preview}
          previewLoading={previewLoading}
        />
        <div className="flex h-full items-center gap-6 justify-end order-2  sm:order-none">
          <CartPanel />
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
  preview,
  previewLoading,
}: HeaderSearchProps): JSX.Element {
  const [searchFocused, setSearchFocused] = useState(false);
  const trimmed = search.trim();
  const showPreviewPanel = searchFocused && trimmed.length > 0;

  return (
    <button
      type="button"
      className={cn(
        'flex-1 col-span-2 w-full h-full py-2 sm:col-span-1 order-3 sm:order-none mb-2 sm:mb-0 duration-300 transition-all relative z-[60]',
        showSearchBar
          ? 'max-sm:translate-y-0 max-sm:z-10'
          : 'max-sm:-translate-y-[1000px] max-sm:absolute max-sm:-z-10',
      )}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setSearchFocused(false);
        }
      }}
    >
      <form className="flex h-full w-full items-center" onSubmit={onSubmit}>
        <Input
          type="search"
          placeholder="Search products"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          autoComplete="off"
          className="dark:placeholder:text-white w-full h-full placeholder:text-sm text-sm"
        />
      </form>

      {showPreviewPanel && (
        <div
          className="absolute left-0 right-0 top-full mt-1 max-h-80 overflow-y-auto border border-gray-200 bg-popover text-popover-foreground shadow-lg dark:border-[#222223]"
          aria-label="Search suggestions"
        >
          {previewLoading && (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</p>
          )}
          {!previewLoading && preview?.items?.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No products found</p>
          )}
          {!previewLoading &&
            preview?.items.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="flex gap-3 px-3 py-2 text-sm hover:bg-muted/80"
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded bg-muted">
                  <Image
                    src={product.imageUrl ?? '/logo.png'}
                    alt={product.name}
                    width={44}
                    height={44}
                    className={cn('h-full w-full object-cover', !product.imageUrl && 'p-2')}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="truncate text-xs text-muted-foreground">{product.brand.name}</p>
                  <p className="truncate font-medium text-xs leading-snug">{product.name}</p>
                  <p className="text-xs font-semibold">{formatBDT(product.priceCents)}</p>
                </div>
              </Link>
            ))}
          {!previewLoading && preview && preview.total > preview.items.length && (
            <Link
              href={`/products?q=${encodeURIComponent(trimmed)}`}
              className="block border-t border-border px-3 py-2 text-center text-sm font-medium text-primary hover:bg-muted/80"
              onMouseDown={(e) => e.preventDefault()}
            >
              View all {preview.total} results
            </Link>
          )}
        </div>
      )}
    </button>
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
