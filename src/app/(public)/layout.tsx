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
  const { categories, brands, categoryBrands } = await catalogService.getCatalogShell();

  // Each top-level category lists only brands that have a published product
  // in it or in one of its subcategories.
  const topLevel = categories.filter((c) => c.parentId === null).slice(0, 8);
  const brandIdsByCategory = new Map<string, Set<string>>();
  for (const { categoryId, brandId } of categoryBrands) {
    const set = brandIdsByCategory.get(categoryId) ?? new Set<string>();
    set.add(brandId);
    brandIdsByCategory.set(categoryId, set);
  }
  return topLevel.map((c) => {
    const ids = new Set(brandIdsByCategory.get(c.id));
    for (const child of categories) {
      if (child.parentId !== c.id) continue;
      brandIdsByCategory.get(child.id)?.forEach((id) => ids.add(id));
    }
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      brands: brands
        .filter((b) => ids.has(b.id))
        .slice(0, 12)
        .map((b) => ({ id: b.id, name: b.name, slug: b.slug })),
    };
  });
}

export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const menu = await loadMenu();
  // const [menu, facts] = await Promise.all([loadMenu(), storefrontFactsService.get()]);
  return (
    <div className="sf flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      {/* <FactsStrip facts={facts} /> */}
      <Header menu={menu} />
      <main id="main" className="flex-1">
        <Container>{children}</Container>
      </main>
      <Footer menu={menu} />
    </div>
  );
}
