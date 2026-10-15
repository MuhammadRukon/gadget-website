'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatBDT } from '@/server/common/money';
import { MIN_PREVIEW_CHARS, useHeaderSearchPreview } from '@/hooks/use-header-search-preview';

/**
 * Storefront search island: debounced product preview, submit-to-results,
 * click-outside and Escape dismissal. Rendered once per breakpoint by the
 * header (only one is ever displayed).
 */
export function HeaderSearch() {
  const { search, setSearch, preview, previewLoading, submitSearch } = useHeaderSearchPreview();
  const [searchFocused, setSearchFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const trimmed = search.trim();
  const showPreviewPanel = searchFocused && trimmed.length >= MIN_PREVIEW_CHARS;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearchFocused(false);
    submitSearch(e);
  }

  function closePreview() {
    setSearchFocused(false);
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-xl">
      <form
        role="search"
        className="relative flex h-11 w-full items-center md:h-10"
        onSubmit={handleSubmit}
      >
        <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-ink-2" />
        <input
          type="search"
          aria-label="Search products"
          placeholder="Search phones, laptops, brands"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closePreview();
          }}
          autoComplete="off"
          maxLength={100}
          aria-expanded={showPreviewPanel}
          aria-controls={showPreviewPanel ? listId : undefined}
          className="h-full w-full rounded-md border border-rule-strong bg-surface pl-9 pr-3 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-2 hover:border-ink-2 focus-visible:border-solder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solder/25 md:text-sm"
        />
      </form>

      {showPreviewPanel && (
        <div
          id={listId}
          className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-md border border-rule bg-surface text-ink shadow-[0_12px_32px_-12px_oklch(0.2_0.02_165/0.25)]"
        >
          {previewLoading && <p className="px-3 py-3 text-sm text-ink-2">Searching…</p>}

          {!previewLoading && preview?.items?.length === 0 && (
            <p className="px-3 py-3 text-sm text-ink-2">
              No products match “{trimmed}”. Try a brand or a shorter name.
            </p>
          )}

          {!previewLoading &&
            preview?.items.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                onClick={closePreview}
                className="flex items-center gap-3 border-b border-rule px-3 py-2.5 text-sm last:border-b-0 hover:bg-field focus-visible:bg-field"
              >
                <div className="relative size-11 shrink-0 overflow-hidden rounded-sm bg-field">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt=""
                      width={44}
                      height={44}
                      className="size-full object-contain p-1 mix-blend-multiply dark:mix-blend-normal"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-ink-2">{product.brand.name}</p>
                  <p className="truncate font-medium leading-snug">{product.name}</p>
                </div>
                <p className="shrink-0 whitespace-nowrap font-display text-sm font-semibold tabular-nums font-stretch-semi-expanded">
                  {formatBDT(product.priceCents)}
                </p>
              </Link>
            ))}

          {!previewLoading && preview && preview.total > preview.items.length && (
            <Link
              href={`/products?q=${encodeURIComponent(trimmed)}`}
              prefetch={false}
              onClick={closePreview}
              className={cn(
                'block border-t border-rule px-3 py-2.5 text-center text-sm font-medium text-solder-ink hover:bg-field',
              )}
            >
              See all {preview.total} results
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
