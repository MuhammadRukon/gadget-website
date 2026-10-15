'use client';

import { useId, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';

import { formatBDT } from '@/server/common/money';
import { MIN_PREVIEW_CHARS, useHeaderSearchPreview } from '@/hooks/use-header-search-preview';

export interface QuickLink {
  label: string;
  href: string;
}

interface HeaderSearchProps {
  inputId?: string;
  /** Called when the visitor leaves for a result or the results page. */
  onNavigate?: () => void;
  /** Shown before anything is typed. */
  quickLinks?: QuickLink[];
}

/**
 * Search inside the header panel: one large borderless field, quick links
 * while it is empty, live product matches once three characters are in.
 * Enter goes to the full results page.
 */
export function HeaderSearch({
  inputId,
  onNavigate,
  quickLinks = [],
}: Readonly<HeaderSearchProps>) {
  const { search, setSearch, preview, previewLoading, submitSearch } = useHeaderSearchPreview();
  const trimmed = search.trim();
  const searching = trimmed.length >= MIN_PREVIEW_CHARS;
  const listRef = useRef<HTMLDivElement>(null);
  const statusId = useId();

  const status = !searching
    ? ''
    : previewLoading
      ? 'Searching'
      : preview?.total
        ? `${preview.total} ${preview.total === 1 ? 'product' : 'products'} found. Use the down arrow to browse.`
        : `No products found for ${trimmed}`;

  /** Arrow keys move between the field and the links below it. */
  function moveFocus(e: React.KeyboardEvent, from: 'input' | 'list') {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []);
    if (links.length === 0) return;
    e.preventDefault();
    if (from === 'input') {
      if (e.key === 'ArrowDown') links[0].focus();
      return;
    }
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === 'ArrowDown') links[Math.min(i + 1, links.length - 1)].focus();
    else if (i <= 0) document.getElementById(inputId ?? '')?.focus();
    else links[i - 1].focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitSearch(e);
    onNavigate?.();
  }

  return (
    <div className="w-full">
      <form role="search" className="flex items-center gap-3 md:gap-4" onSubmit={handleSubmit}>
        <Search aria-hidden className="size-5 shrink-0 text-ink-2 md:size-6" strokeWidth={1.75} />
        <input
          id={inputId}
          type="search"
          aria-label="Search products"
          placeholder="Search Ravyntech"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={statusId}
          onKeyDown={(e) => moveFocus(e, 'input')}
          maxLength={100}
          className="h-12 w-full min-w-0 border-0 bg-transparent p-0 font-display text-2xl font-semibold tracking-[-0.02em] text-ink caret-raven outline-none font-stretch-semi-expanded placeholder:text-ink-2/50 focus:outline-none! focus-visible:outline-none! md:h-14 md:text-[32px] [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      <p id={statusId} role="status" className="sr-only">
        {status}
      </p>

      <div ref={listRef} onKeyDown={(e) => moveFocus(e, 'list')} className="mt-6 md:mt-8 md:pl-10">
        {!searching ? (
          quickLinks.length > 0 ? (
            <>
              <p id={`${statusId}-quick`} className="mb-2 text-xs text-ink-2">
                Quick links
              </p>
              <ul aria-labelledby={`${statusId}-quick`}>
                {quickLinks.map((l, i) => (
                  <li
                    key={l.href + l.label}
                    className="animate-in fade-in-0 slide-in-from-top-1 fill-mode-both duration-300"
                    style={{ animationDelay: `${60 + i * 35}ms` }}
                  >
                    <Link
                      href={l.href}
                      onClick={onNavigate}
                      className="group flex min-h-10 items-center gap-2.5 text-[15px] font-medium text-ink transition-colors hover:text-raven"
                    >
                      <ArrowRight
                        aria-hidden
                        className="size-3.5 text-ink-2 transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null
        ) : (
          <>
            <p aria-hidden className="mb-2 text-xs text-ink-2">
              {previewLoading ? 'Searching…' : preview?.total ? 'Products' : 'No matches'}
            </p>

            {!previewLoading && preview?.items.length === 0 ? (
              <p className="text-[15px] text-ink-2">
                Nothing matches “{trimmed}”. Try a brand or a shorter name.
              </p>
            ) : null}

            {!previewLoading && preview?.items.length ? (
              <ul
                aria-label="Matching products"
                className="max-h-[50dvh] overflow-y-auto overscroll-contain"
              >
                {preview.items.map((product, i) => (
                  <li
                    key={product.id}
                    className="animate-in fade-in-0 fill-mode-both duration-300"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <Link
                      href={`/products/${product.slug}`}
                      onClick={onNavigate}
                      className="group flex items-center gap-3.5 py-2"
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-field">
                        {product.imageUrl ? (
                          <Image
                            src={product.imageUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="size-full object-contain p-1 mix-blend-multiply dark:mix-blend-normal"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium leading-snug transition-colors group-hover:text-raven">
                          {product.name}
                        </p>
                        <p className="truncate text-xs text-ink-2">{product.brand.name}</p>
                      </div>
                      <p className="shrink-0 whitespace-nowrap text-sm tabular-nums text-ink-2">
                        {formatBDT(product.priceCents)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {!previewLoading && preview && preview.total > preview.items.length ? (
              <Link
                href={`/products?q=${encodeURIComponent(trimmed)}`}
                prefetch={false}
                onClick={onNavigate}
                className="group mt-3 inline-flex min-h-10 items-center gap-2 text-[15px] font-medium text-raven-ink"
              >
                See all {preview.total} results
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform duration-300 group-hover:translate-x-0.5"
                />
              </Link>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
