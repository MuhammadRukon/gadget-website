'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  name: string;
  slug: string;
}

export interface ListingFilterProps {
  brands: Option[];
  categories: Option[];
  /** Set on /category/[slug]: the category is the page itself, not a filter. */
  lockedCategorySlug?: string;
  /** Set on /brand/[slug]. */
  lockedBrandSlug?: string;
}

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
] as const;

/** URL is the filter state. Prices travel in paisa, the unit the catalog query compares against. */
function useListingParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function push(sp: URLSearchParams) {
    sp.delete('page');
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params);
    if (value) sp.set(key, value);
    else sp.delete(key);
    push(sp);
  }

  function setParams(entries: Record<string, string | null>) {
    const sp = new URLSearchParams(params);
    for (const [k, v] of Object.entries(entries)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    push(sp);
  }

  function clearAll() {
    const sp = new URLSearchParams();
    const q = params.get('q');
    if (q) sp.set('q', q);
    push(sp);
  }

  const toTaka = (v: string | null) =>
    v && /^\d+$/.test(v) ? String(Math.round(Number(v) / 100)) : '';

  return {
    pending,
    setParam,
    setParams,
    clearAll,
    q: params.get('q') ?? '',
    sort: params.get('sort') ?? 'newest',
    inStock: params.get('inStock') === 'true',
    minTaka: toTaka(params.get('minPrice')),
    maxTaka: toTaka(params.get('maxPrice')),
    categorySlug: params.get('categorySlug') ?? '',
    brandSlug: params.get('brandSlug') ?? '',
  };
}

function takaToParam(v: string): string | null {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? String(n * 100) : null;
}

/** Desktop sidebar body and mobile sheet body share these fields. */
function FilterFields({
  brands,
  categories,
  lockedCategorySlug,
  lockedBrandSlug,
}: Readonly<ListingFilterProps>) {
  const f = useListingParams();

  return (
    <div className="space-y-7">
      {!lockedCategorySlug && categories.length > 0 ? (
        <OptionGroup
          legend="Category"
          options={categories}
          selected={f.categorySlug}
          onSelect={(slug) => f.setParam('categorySlug', slug)}
        />
      ) : null}

      {!lockedBrandSlug && brands.length > 0 ? (
        <OptionGroup
          legend="Brand"
          options={brands}
          selected={f.brandSlug}
          onSelect={(slug) => f.setParam('brandSlug', slug)}
        />
      ) : null}

      <PriceRange
        key={`${f.minTaka}-${f.maxTaka}`}
        minTaka={f.minTaka}
        maxTaka={f.maxTaka}
        onApply={(min, max) =>
          f.setParams({ minPrice: takaToParam(min), maxPrice: takaToParam(max) })
        }
      />

      <div className="flex items-center justify-between gap-4 border-t border-rule pt-5">
        <label htmlFor="filter-in-stock" className="text-sm font-medium">
          In stock only
        </label>
        <Switch
          id="filter-in-stock"
          checked={f.inStock}
          onCheckedChange={(v) => f.setParam('inStock', v ? 'true' : null)}
        />
      </div>
    </div>
  );
}

function OptionGroup({
  legend,
  options,
  selected,
  onSelect,
}: Readonly<{
  legend: string;
  options: Option[];
  selected: string;
  onSelect: (slug: string | null) => void;
}>) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold text-ink-2">{legend}</legend>
      <ul className="-mx-2">
        <li>
          <OptionButton active={!selected} onClick={() => onSelect(null)}>
            Any {legend.toLowerCase()}
          </OptionButton>
        </li>
        {options.map((o) => (
          <li key={o.id}>
            <OptionButton
              active={selected === o.slug}
              onClick={() => onSelect(selected === o.slug ? null : o.slug)}
            >
              {o.name}
            </OptionButton>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex min-h-11 w-full items-center gap-2.5 rounded-sm px-2 text-left text-sm transition-colors hover:bg-field',
        active ? 'font-medium text-ink' : 'text-ink-2',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full border',
          active ? 'border-solder bg-solder' : 'border-rule-strong',
        )}
      />
      {children}
    </button>
  );
}

function PriceRange({
  minTaka,
  maxTaka,
  onApply,
}: Readonly<{ minTaka: string; maxTaka: string; onApply: (min: string, max: string) => void }>) {
  const [min, setMin] = useState(minTaka);
  const [max, setMax] = useState(maxTaka);
  const invalid = min !== '' && max !== '' && Number(min) > Number(max);

  return (
    <div role="group" aria-labelledby="filter-price" className="border-t border-rule pt-5">
      <p id="filter-price" className="mb-2 text-xs font-semibold text-ink-2">
        Price (Tk)
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!invalid) onApply(min, max);
        }}
      >
        <div className="flex items-center gap-2">
          <input
            aria-label="Minimum price in Taka"
            inputMode="numeric"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ''))}
            className="h-11 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-3 text-sm tabular-nums outline-none focus-visible:border-solder focus-visible:ring-2 focus-visible:ring-solder/25"
          />
          <span aria-hidden className="text-ink-2">
            –
          </span>
          <input
            aria-label="Maximum price in Taka"
            inputMode="numeric"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ''))}
            aria-invalid={invalid}
            className="h-11 w-full min-w-0 rounded-md border border-rule-strong bg-surface px-3 text-sm tabular-nums outline-none focus-visible:border-solder focus-visible:ring-2 focus-visible:ring-solder/25 aria-invalid:border-sale"
          />
        </div>
        {invalid ? <p className="text-xs text-sale">Minimum is higher than maximum.</p> : null}
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-11 w-full"
          disabled={invalid}
        >
          Apply price
        </Button>
      </form>
    </div>
  );
}

export function ListingSidebar(props: Readonly<ListingFilterProps>) {
  return (
    <aside aria-label="Filters" className="hidden lg:block">
      <div className="sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto pb-6 pr-2">
        <FilterFields {...props} />
      </div>
    </aside>
  );
}

/**
 * Result count, sort, active-filter chips and (below lg) the filter sheet.
 * Every chip removes exactly one filter.
 */
export function ListingToolbar({
  total,
  ...props
}: Readonly<ListingFilterProps & { total: number }>) {
  const f = useListingParams();
  const [sheetOpen, setSheetOpen] = useState(false);
  const nameOf = (list: Option[], slug: string) => list.find((o) => o.slug === slug)?.name ?? slug;

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (f.q) chips.push({ key: 'q', label: `“${f.q}”`, clear: () => f.setParam('q', null) });
  if (f.categorySlug && !props.lockedCategorySlug)
    chips.push({
      key: 'c',
      label: nameOf(props.categories, f.categorySlug),
      clear: () => f.setParam('categorySlug', null),
    });
  if (f.brandSlug && !props.lockedBrandSlug)
    chips.push({
      key: 'b',
      label: nameOf(props.brands, f.brandSlug),
      clear: () => f.setParam('brandSlug', null),
    });
  if (f.minTaka || f.maxTaka)
    chips.push({
      key: 'p',
      label: `Tk ${f.minTaka || '0'} – ${f.maxTaka ? `Tk ${f.maxTaka}` : 'any'}`,
      clear: () => f.setParams({ minPrice: null, maxPrice: null }),
    });
  if (f.inStock)
    chips.push({ key: 's', label: 'In stock', clear: () => f.setParam('inStock', null) });

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3 border-b border-rule pb-3">
        <p className="mr-auto text-sm text-ink-2 tabular-nums" aria-live="polite">
          {f.pending ? 'Updating…' : `${total} ${total === 1 ? 'product' : 'products'}`}
        </p>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 gap-2 lg:hidden">
              <SlidersHorizontal aria-hidden className="size-4" />
              Filters
              {chips.length > 0 ? (
                <span className="rounded-full bg-solder px-1.5 text-[11px] text-on-solder tabular-nums">
                  {chips.length}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="sf max-h-[85dvh] gap-0 rounded-t-lg p-0">
            <SheetHeader className="border-b border-rule">
              <SheetTitle className="font-display text-lg font-semibold font-stretch-semi-expanded">
                Filters
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 py-5">
              <FilterFields {...props} />
            </div>
            <SheetFooter className="border-t border-rule">
              <Button className="h-12" onClick={() => setSheetOpen(false)}>
                Show {total} {total === 1 ? 'product' : 'products'}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-2 max-sm:sr-only">Sort</span>
          <select
            value={f.sort}
            onChange={(e) =>
              f.setParam('sort', e.target.value === 'newest' ? null : e.target.value)
            }
            className="h-11 rounded-md border border-rule-strong bg-surface px-3 text-sm outline-none focus-visible:border-solder focus-visible:ring-2 focus-visible:ring-solder/25"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={c.clear}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-rule-strong bg-surface pl-3 pr-2 text-sm hover:border-ink-2"
              >
                {c.label}
                <X aria-hidden className="size-3.5 text-ink-2" />
                <span className="sr-only">Remove filter</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={f.clearAll}
              className="h-11 px-2 text-sm font-medium text-solder-ink underline"
            >
              Clear all
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
