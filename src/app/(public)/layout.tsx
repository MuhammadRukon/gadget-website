import { Container } from '../components/container/container';
import { Footer } from '../components/footer/footer';
import { FactsStrip } from '../components/header/facts-strip';
import { Header } from '../components/header/header';
import type { MenuCategory } from '../components/menu/menu.types';

import { catalogService } from '@/server/catalog/catalog.service';
import { storefrontFactsService } from '@/server/storefront/storefront-facts.service';

/**
 * Public storefront shell. Loads navigation data (categories, brands)
 * server-side so the header is rendered with real menu links and is
 * SEO-crawlable. This server fetch is reused across every storefront
 * page render.
 */
async function loadMenu(): Promise<MenuCategory[]> {
  const { categories, brands } = await catalogService.getCatalogShell();

  // For Phase 4 we keep the menu flat: top-level categories with all
  // brands shown as a flyout. Future phases can refine this with
  // category/brand affinity (only show brands that actually have
  // products in that category).
  const popularCategories = categories.filter((c) => c.parentId === null).slice(0, 8);
  return popularCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    brands: brands.slice(0, 12).map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
  }));
}

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [menu, facts] = await Promise.all([loadMenu(), storefrontFactsService.get()]);
  return (
    <div className="sf flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <FactsStrip facts={facts} />
      <Header menu={menu} />
      <main id="main" className="flex-1">
        <Container>{children}</Container>
      </main>
      <Footer menu={menu} facts={facts} />
    </div>
  );
}
