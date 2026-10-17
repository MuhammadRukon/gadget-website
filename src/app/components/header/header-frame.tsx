'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Search, X } from 'lucide-react';

import { Container } from '@/app/components/container/container';
import dynamic from 'next/dynamic';

import type { QuickLink } from '@/app/components/header/header-search';

// The search sheet's code (field, results, preview fetching) loads on first use, not with every page.
const loadHeaderSearch = () =>
  import('@/app/components/header/header-search').then((m) => m.HeaderSearch);
const HeaderSearch = dynamic(loadHeaderSearch, {
  ssr: false,
  loading: () => <div className="h-12 md:h-14" aria-hidden />,
});

interface HeaderState {
  quickLinks: QuickLink[];
  searchOpen: boolean;
  /** True for the short exit animation after closing; the sheet is still mounted. */
  searchClosing: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const HeaderContext = createContext<HeaderState>({
  quickLinks: [],
  searchOpen: false,
  searchClosing: false,
  openSearch: () => {},
  closeSearch: () => {},
});

/** Scroll distance before the header may tuck in, and the deltas that count as intent. */
const TOP_ZONE = 80;
const COMPACT_AFTER = 160;
const DOWN_INTENT = 6;
const UP_INTENT = 10;
const SEARCH_INPUT_ID = 'header-search';
/** Matches the exit animation duration on the sheet and backdrop. */
const SEARCH_EXIT_MS = 220;
const SEARCH_TOGGLE_ID = 'header-search-toggle';
const SEARCH_PANEL_ID = 'header-search-panel';
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Sticky storefront header bar. Scrolling down tucks it into a slimmer row
 * (the wordmark folds into the raven mark); scrolling up restores it. The
 * <header> box keeps its full height in the page flow and only the painted
 * bar shrinks, so content never jumps. It never tucks in while search is open.
 *
 * Children style themselves off `data-compact` / `data-search` with
 * Tailwind's `group-data-[…]/h:` variants.
 */
export function HeaderFrame({
  children,
  quickLinks = [],
}: Readonly<{ children: ReactNode; quickLinks?: QuickLink[] }>) {
  const [compact, setCompact] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchClosing, setSearchClosing] = useState(false);
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchOpen;
  const exitTimer = useRef<number | undefined>(undefined);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const dy = y - last;
        last = y;
        if (y < TOP_ZONE) setCompact(false);
        else if (dy > DOWN_INTENT && y > COMPACT_AFTER && !searchOpenRef.current) setCompact(true);
        else if (dy < -UP_INTENT) setCompact(false);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const openSearch = useCallback(() => {
    window.clearTimeout(exitTimer.current);
    setSearchClosing(false);
    setCompact(false);
    setSearchOpen(true);
  }, []);
  const closeSearch = useCallback(() => {
    if (!searchOpenRef.current) return;
    setSearchOpen(false);
    setSearchClosing(true);
    exitTimer.current = window.setTimeout(() => setSearchClosing(false), SEARCH_EXIT_MS);
  }, []);

  // While search is open it behaves as a modal sheet: the page behind cannot
  // scroll or take focus, Tab stays inside the sheet (plus the close toggle),
  // and closing returns focus to the toggle.
  useEffect(() => {
    if (!searchOpen) return;
    const header = headerRef.current;
    document.getElementById(SEARCH_INPUT_ID)?.focus({ preventScroll: true });
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const prev = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    root.style.overflow = 'hidden';
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;

    const outside = header?.parentElement
      ? Array.from(header.parentElement.children).filter(
          (el): el is HTMLElement =>
            el !== header && el instanceof HTMLElement && !el.hasAttribute('data-search-backdrop'),
        )
      : [];
    outside.forEach((el) => (el.inert = true));

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const panel = document.getElementById(SEARCH_PANEL_ID);
      const toggle = document.getElementById(SEARCH_TOGGLE_ID);
      const items = [
        ...(panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)) : []),
        ...(toggle ? [toggle] : []),
      ];
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? i <= 0
          ? items.length - 1
          : i - 1
        : i === items.length - 1
          ? 0
          : i + 1;
      e.preventDefault();
      items[i === -1 ? 0 : next].focus();
    };
    document.addEventListener('keydown', onTab);

    return () => {
      root.style.overflow = prev.overflow;
      root.style.paddingRight = prev.paddingRight;
      outside.forEach((el) => (el.inert = false));
      document.removeEventListener('keydown', onTab);
      // Back to where the visitor started, unless they followed a link elsewhere.
      if (header?.contains(document.activeElement) || document.activeElement === document.body) {
        document.getElementById(SEARCH_TOGGLE_ID)?.focus({ preventScroll: true });
      }
    };
  }, [searchOpen]);

  // "/" or Ctrl/Cmd+K opens search from anywhere that is not already a text field; Esc closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'Escape' && searchOpenRef.current) {
        closeSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSearch, closeSearch]);

  return (
    <HeaderContext.Provider
      value={{ quickLinks, searchOpen, searchClosing, openSearch, closeSearch }}
    >
      <header
        ref={headerRef}
        data-compact={compact}
        data-search={searchOpen}
        className="group/h pointer-events-none sticky top-0 z-50 h-14 md:h-16"
      >
        <div className="pointer-events-auto relative border-b border-rule bg-paper transition-[box-shadow,border-color] duration-300 group-data-[search=true]/h:border-transparent group-data-[compact=true]/h:shadow-[0_10px_30px_-18px_oklch(0.2_0.02_255/0.35)]">
          {children}
          <SearchPanel />
        </div>
      </header>
      {searchOpen || searchClosing ? (
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          data-search-backdrop
          onClick={closeSearch}
          className={
            searchClosing
              ? 'pointer-events-none fixed inset-0 z-40 bg-ink/25 backdrop-blur-[6px] animate-out fade-out-0 fill-mode-forwards duration-200 ease-in'
              : 'fixed inset-0 z-40 cursor-default bg-ink/25 backdrop-blur-[6px] animate-in fade-in-0 duration-300'
          }
        />
      ) : null}
    </HeaderContext.Provider>
  );
}

/** Icon button in the header row that opens the search panel. */
export function SearchToggle() {
  const { searchOpen, openSearch, closeSearch } = useContext(HeaderContext);
  return (
    <button
      type="button"
      id={SEARCH_TOGGLE_ID}
      aria-label={searchOpen ? 'Close search' : 'Search products'}
      aria-expanded={searchOpen}
      aria-controls={SEARCH_PANEL_ID}
      aria-haspopup="dialog"
      aria-keyshortcuts="/ Control+K"
      title="Search (/)"
      onClick={searchOpen ? closeSearch : openSearch}
      onPointerEnter={() => void loadHeaderSearch()}
      onFocus={() => void loadHeaderSearch()}
      className="flex size-11 items-center justify-center rounded-md cursor-pointer text-ink transition-colors hover:text-raven"
    >
      {searchOpen ? <X size={19} aria-hidden /> : <Search size={19} aria-hidden />}
    </button>
  );
}

/**
 * Search drops down out of the bar as one continuous sheet: a large
 * borderless field, then quick links or live matches. Closes on Esc, the
 * backdrop, the toggle, or choosing a result.
 */
function SearchPanel() {
  const { quickLinks, searchOpen, searchClosing, closeSearch } = useContext(HeaderContext);
  if (!searchOpen && !searchClosing) return null;
  return (
    <div
      id={SEARCH_PANEL_ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby="header-search-title"
      inert={searchClosing}
      className={`absolute inset-x-0 top-full border-b border-rule bg-paper pb-10 pt-4 shadow-[0_30px_60px_-40px_oklch(0.2_0.02_255/0.45)] md:pb-14 md:pt-6 ${
        searchClosing
          ? 'animate-out fade-out-0 slide-out-to-top-3 fill-mode-forwards duration-200 ease-in'
          : 'animate-in fade-in-0 slide-in-from-top-3 duration-300 ease-out'
      }`}
    >
      <Container>
        <div className="mx-auto max-w-3xl">
          <h2 id="header-search-title" className="sr-only">
            Search Ravntech
          </h2>
          <HeaderSearch
            inputId={SEARCH_INPUT_ID}
            onNavigate={closeSearch}
            quickLinks={quickLinks}
          />
        </div>
      </Container>
    </div>
  );
}
