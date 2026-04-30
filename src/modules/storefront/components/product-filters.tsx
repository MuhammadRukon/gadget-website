'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface BrandOption {
  id: string;
  name: string;
  slug: string;
}
interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  brands: BrandOption[];
  categories: CategoryOption[];
  /** Hide the filter when locked by route, e.g. on /[category] route. */
  lockedCategorySlug?: string;
  lockedBrandSlug?: string;
}

const ANY = '__any__';

export function ProductFilters({
  brands,
  categories,
  lockedCategorySlug,
  lockedBrandSlug,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string | null) {
    const sp = new URLSearchParams(params);
    if (value === null || value === '') sp.delete(key);
    else sp.set(key, value);
    sp.delete('page');
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  function clearAll() {
    startTransition(() => router.push(pathname));
  }

  const sort = params.get('sort') ?? 'newest';
  const inStock = params.get('inStock') === 'true';
  const q = params.get('q') ?? '';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const categorySlug = lockedCategorySlug ?? params.get('categorySlug') ?? '';
  const brandSlug = lockedBrandSlug ?? params.get('brandSlug') ?? '';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          defaultValue={q}
          placeholder="Search products"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setParam('q', (e.target as HTMLInputElement).value);
            }
          }}
        />
      </div>

      {!lockedCategorySlug ? (
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={categorySlug || ANY}
            onValueChange={(v) => setParam('categorySlug', v === ANY ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.slug}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {!lockedBrandSlug ? (
        <div className="space-y-2">
          <Label>Brand</Label>
          <Select
            value={brandSlug || ANY}
            onValueChange={(v) => setParam('brandSlug', v === ANY ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.slug}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label>Sort</Label>
        <Select value={sort} onValueChange={(v) => setParam('sort', v === 'newest' ? null : v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_asc">Price (low to high)</SelectItem>
            <SelectItem value="price_desc">Price (high to low)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="minPrice">Min ৳</Label>
          <Input
            id="minPrice"
            inputMode="numeric"
            defaultValue={minPrice}
            onBlur={(e) => setParam('minPrice', e.target.value || null)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxPrice">Max ৳</Label>
          <Input
            id="maxPrice"
            inputMode="numeric"
            defaultValue={maxPrice}
            onBlur={(e) => setParam('maxPrice', e.target.value || null)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="inStock">In stock only</Label>
        <Switch
          id="inStock"
          checked={inStock}
          onCheckedChange={(c) => setParam('inStock', c ? 'true' : null)}
        />
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={clearAll}>
        Clear filters
      </Button>
    </div>
  );
}
