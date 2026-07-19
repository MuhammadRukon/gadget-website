'use client';

import { SearchIcon, ShoppingCart } from 'lucide-react';

import { useMobileSearch } from '../../../stores/mobile-search.store';

/**
 * Mobile-only button that reveals the collapsible search bar. Lives in the
 * header's right-hand cluster; the search bar itself reads the same store.
 */
export function MobileSearchToggle() {
  const toggle = useMobileSearch((state) => state.toggle);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle search"
      className="relative cursor-pointer sm:hidden h-full"
    >
      <SearchIcon size={18} />
    </button>
  );
}
