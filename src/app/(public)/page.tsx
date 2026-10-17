import { ArrowRight, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { preload } from 'react-dom';

import { PAYMENT_METHOD_SHORT_LABEL } from '@/modules/checkout/payment-methods';
import type { PublicProductSummary } from '@/contracts/catalog';
import { cn } from '@/lib/utils';
import { catalogService } from '@/server/catalog/catalog.service';
import { formatBDT } from '@/server/common/money';
import { storefrontFactsService } from '@/server/storefront/storefront-facts.service';
import { Price } from '@/modules/storefront/components/price';
import { ProductCard } from '@/modules/storefront/components/product-card';
import { ProductImage } from '@/modules/storefront/components/product-image';
import { StockMark } from '@/modules/storefront/components/stock-mark';
import { BrandMarquee } from '@/modules/home/components/brand-marquee';
import { BuyingSteps } from '@/modules/home/components/buying-steps';
import { CategoryBento } from '@/modules/home/components/category-bento';
import { HomeBanner } from '@/modules/home/components/home-banner';
import { HomeClosing } from '@/modules/home/components/home-closing';
import { HomeMotion } from '@/modules/home/components/home-motion';
import { ScrollStory } from '@/modules/home/components/scroll-story';
import {
  HOME_BANNER,
  HOME_CLOSING,
  HOME_STEPS,
  HOME_STORY,
  HOME_TILES,
} from '@/modules/home/home-content';

export const metadata = {
  title: { absolute: 'Ravntech - gadgets & electronics in Bangladesh' },
  description: 'A short list of phones, laptops and accessories, delivered across Bangladesh.',
  alternates: { canonical: '/' },
};

export const revalidate = 120;

async function loadHome() {
  const [newest, shell, facts] = await Promise.all([
    catalogService.listPublicProducts({ sort: 'newest', limit: 12 }),
    catalogService.getCatalogShell(),
    storefrontFactsService.get(),
  ]);
  const topCategories = shell.categories.filter((c) => c.parentId === null).slice(0, 6);
  const categoryPages = await Promise.all(
    topCategories.map((c) => catalogService.listPublicProducts({ categorySlug: c.slug, limit: 4 })),
  );
  const categories = topCategories.map((c, i) => ({ ...c, page: categoryPages[i] }));
  // A route is only offered when it leads somewhere: a category with products, or a search that matches.
  const searchTerms = [...HOME_TILES.map((t) => t.href), HOME_STORY.cta.href]
    .map((h) => (h.startsWith('/products?q=') ? decodeURIComponent(h.split('q=')[1]) : null))
    .filter((q): q is string => q !== null);
  const searchHits = new Map(
    await Promise.all(
      [...new Set(searchTerms)].map(
        async (q) =>
          [q, (await catalogService.listPublicProducts({ q, limit: 1 })).total > 0] as const,
      ),
    ),
  );
  const liveCategories = new Set(categories.filter((c) => c.page.total > 0).map((c) => c.slug));
  const routeLeadsSomewhere = (href: string) => {
    if (href.startsWith('/category/')) return liveCategories.has(href.slice('/category/'.length));
    if (href.startsWith('/products?q='))
      return searchHits.get(decodeURIComponent(href.split('q=')[1])) === true;
    return true;
  };
  return {
    routeLeadsSomewhere,
    newest: newest.items,
    totalProducts: newest.total,
    categories,
    brands: shell.brands,
    facts,
  };
}

export default async function HomePage() {
  // The home banner headline and card titles paint in both Archivo faces; other routes discover them via CSS.
  for (const face of ['expanded-700', 'semiexpanded-600']) {
    preload(`/fonts/archivo/archivo-${face}.woff2`, {
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
    });
  }
  const { newest, totalProducts, categories, brands, facts, routeLeadsSomewhere } =
    await loadHome();
  const featured =
    newest.find((p) => p.isPopular && p.inStock) ?? newest.find((p) => p.inStock) ?? newest[0];
  // A short list should not repeat itself: each product appears once on the page where the catalog allows.
  const rail = newest.filter((p) => p.id !== featured?.id).slice(0, 4);
  const shown = new Set([featured?.id, ...rail.map((p) => p.id)]);
  const showcase = categories
    .map((c) => ({ ...c, unseen: c.page.items.filter((p) => !shown.has(p.id)) }))
    .find((c) => c.unseen.length > 0);
  const codOn = facts.methods.includes('COD');

  return (
    <HomeMotion>
      <div className="pb-6">
        <HomeBanner banner={HOME_BANNER} />

        {/* Category index beside one product at full scale. */}
        <section
          aria-label="Featured"
          className="mt-20 grid grid-cols-1 gap-8 md:mt-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12"
        >
          <div className="flex min-w-0 flex-col">
            <h2 className="font-display text-[clamp(2.1rem,5.4vw,4rem)] font-bold leading-[0.95] tracking-[-0.025em] font-stretch-expanded text-balance">
              Our pick, and where to look next.
            </h2>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-2">
              Delivered across Bangladesh{codOn ? ', and you can pay when it arrives' : ''}. Pick a
              category to see everything in it.
            </p>

            {categories.length > 0 ? (
              <nav aria-label="Shop by category" className="mt-8 lg:mt-12">
                <ul className="border-t border-ink max-md:hidden">
                  {categories.map((c) => (
                    <li key={c.id} className="border-b border-rule">
                      <Link
                        href={`/category/${c.slug}`}
                        className="group flex h-14 items-center gap-4 transition-colors hover:text-raven-ink"
                      >
                        <span className="font-display text-xl font-semibold font-stretch-semi-expanded">
                          {c.name}
                        </span>
                        <span className="text-xs text-ink-2 tabular-nums">
                          {c.page.total} {c.page.total === 1 ? 'product' : 'products'}
                        </span>
                        <ArrowRight
                          aria-hidden
                          className="ml-auto size-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:hidden">
                  {categories.map((c) => (
                    <li key={c.id} className="shrink-0">
                      <Link
                        href={`/category/${c.slug}`}
                        className="flex h-11 items-center gap-2 rounded-full border border-rule-strong bg-surface px-4 text-sm font-medium"
                      >
                        {c.name}
                        <span className="text-xs text-ink-2 tabular-nums">{c.page.total}</span>
                      </Link>
                    </li>
                  ))}
                  <li className="shrink-0">
                    <Link
                      href="/products"
                      className="flex h-11 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper"
                    >
                      All {totalProducts}
                    </Link>
                  </li>
                </ul>
              </nav>
            ) : null}
          </div>

          {featured ? <FeaturedProduct product={featured} /> : null}
        </section>

        <BrandMarquee brands={brands} />

        {rail.length > 0 ? (
          <section aria-labelledby="new-in" data-offscreen className="mt-16 md:mt-24">
            <SectionHead
              id="new-in"
              title="New in"
              href="/products"
              linkLabel={`All ${totalProducts} products`}
            />
            <div
              className={cn(
                '-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-x-6 sm:gap-y-8 sm:overflow-visible sm:px-0',
                rail.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
              )}
            >
              {rail.map((p) => (
                <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {routeLeadsSomewhere(HOME_STORY.cta.href) ? <ScrollStory story={HOME_STORY} /> : null}

        <CategoryBento tiles={HOME_TILES.filter((t) => routeLeadsSomewhere(t.href))} />

        {showcase ? (
          <CategoryShowcase
            category={{ ...showcase, page: { ...showcase.page, items: showcase.unseen } }}
          />
        ) : null}

        <BuyingSteps steps={HOME_STEPS} />

        <section
          aria-labelledby="how-buying-works"
          data-offscreen
          data-reveal
          className="mt-16 md:mt-24"
        >
          <div className="grid gap-x-10 gap-y-6 border-t-2 border-ink pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <h2
              id="how-buying-works"
              className="self-start font-display lg:sticky lg:top-24 text-2xl font-bold leading-tight tracking-[-0.02em] font-stretch-expanded md:text-[32px]"
            >
              What you know before you pay
            </h2>
            <dl className="text-sm">
              <LedgerRow term="Delivery, Dhaka">
                <span className="font-display font-semibold tabular-nums font-stretch-semi-expanded">
                  {formatBDT(facts.shipping.insideDhakaCents)}
                </span>
              </LedgerRow>
              <LedgerRow term="Delivery, elsewhere">
                <span className="font-display font-semibold tabular-nums font-stretch-semi-expanded">
                  {formatBDT(facts.shipping.outsideDhakaCents)}
                </span>
              </LedgerRow>
              <LedgerRow term="Free delivery">
                Orders from{' '}
                <span className="font-display font-semibold tabular-nums font-stretch-semi-expanded">
                  {formatBDT(facts.shipping.freeFromCents)}
                </span>
              </LedgerRow>
              <LedgerRow term="Payment">
                {facts.methods.length > 0
                  ? `${facts.methods.map((m) => PAYMENT_METHOD_SHORT_LABEL[m]).join(', ')}, with the total confirmed before you order`
                  : 'Methods and the total are shown at checkout'}
              </LedgerRow>
              <LedgerRow term="Warranty">
                Term listed on each product; claims from your delivered order
              </LedgerRow>
              <LedgerRow term="Returns">
                <Link href="/refund-policy" className="underline hover:text-raven-ink">
                  Refund and return policy
                </Link>
              </LedgerRow>
            </dl>
          </div>
        </section>
        <HomeClosing closing={HOME_CLOSING} />
      </div>
    </HomeMotion>
  );
}

function FeaturedProduct({ product }: Readonly<{ product: PublicProductSummary }>) {
  return (
    <article className="group relative grid overflow-hidden rounded-lg bg-field sm:grid-cols-[1.2fr_1fr] lg:grid-cols-1">
      <ProductImage
        src={product.imageUrl}
        alt={product.name}
        brand={product.brand.name}
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="aspect-[4/3] bg-transparent sm:aspect-auto sm:min-h-72 lg:aspect-[16/11]"
      />
      <div className="flex flex-col gap-3 border-t border-rule bg-surface p-5 sm:border-l sm:border-t-0 lg:border-l-0 lg:border-t md:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-2">{product.brand.name}</p>
          <StockMark inStock={product.inStock} />
        </div>
        <h2 className="font-display text-2xl font-semibold leading-tight tracking-[-0.015em] font-stretch-semi-expanded md:text-[28px]">
          <Link
            href={`/products/${product.slug}`}
            className="after:absolute after:inset-0 after:rounded-lg"
          >
            {product.name}
          </Link>
        </h2>
        {product.specs.length > 0 ? (
          <p className="text-sm text-ink-2">{product.specs.join(' · ')}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-2">
          <div>
            <Price
              cents={product.priceCents}
              originalCents={product.originalPriceCents}
              size="lg"
              showSaving
            />
            {product.warrantyMonths > 0 ? (
              <p className="mt-1 text-xs text-ink-2">{product.warrantyMonths}-month warranty</p>
            ) : null}
          </div>
          <span className="inline-flex h-11 items-center gap-2 rounded-md bg-raven px-4 text-sm font-medium text-on-raven transition-colors group-hover:bg-raven-ink">
            View product
            <ArrowUpRight aria-hidden className="size-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

function CategoryShowcase({
  category,
}: Readonly<{
  category: { name: string; slug: string; page: { items: PublicProductSummary[]; total: number } };
}>) {
  const [lead, ...rest] = category.page.items;
  return (
    <section aria-labelledby="showcase" className="mt-16 md:mt-24">
      <SectionHead
        id="showcase"
        title={category.name}
        href={`/category/${category.slug}`}
        linkLabel={`All ${category.page.total} in ${category.name}`}
      />
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <ProductCard product={lead} feature sizes="(max-width: 768px) 100vw, 55vw" />
        <ul className="border-t border-rule md:border-t-0">
          {rest.slice(0, 3).map((p) => (
            <li key={p.id} className="border-b border-rule">
              <ProductRow product={p} />
            </li>
          ))}
          <li className="border-b border-rule">
            <Link
              href={`/category/${category.slug}`}
              className="group flex h-16 items-center justify-between gap-4 font-display text-lg font-semibold font-stretch-semi-expanded hover:text-raven-ink"
            >
              Every {category.name.toLowerCase()} product
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1"
              />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

/** Compact horizontal listing used beside a feature card. */
function ProductRow({ product }: Readonly<{ product: PublicProductSummary }>) {
  return (
    <article className="group relative grid grid-cols-[96px_1fr] items-center gap-4 py-4 md:grid-cols-[120px_1fr]">
      <ProductImage
        src={product.imageUrl}
        alt={product.name}
        brand={product.brand.name}
        sizes="120px"
        className="aspect-square rounded-md transition-colors duration-300 group-hover:bg-raven-soft [&_span:first-child]:text-sm"
      />
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-ink-2">{product.brand.name}</p>
        <h3 className="font-medium leading-snug">
          <Link href={`/products/${product.slug}`} className="after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>
        {product.specs.length > 0 ? (
          <p className="truncate text-xs text-ink-2">{product.specs.join(' · ')}</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-x-3 pt-1">
          <Price cents={product.priceCents} originalCents={product.originalPriceCents} size="sm" />
          <StockMark inStock={product.inStock} />
        </div>
      </div>
    </article>
  );
}

function SectionHead({
  id,
  title,
  href,
  linkLabel,
}: Readonly<{ id: string; title: string; href: string; linkLabel: string }>) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4 border-b border-ink pb-3">
      <h2
        id={id}
        className="font-display text-2xl font-bold tracking-[-0.02em] font-stretch-expanded md:text-[32px]"
      >
        {title}
      </h2>
      <Link
        href={href}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-raven-ink hover:underline"
      >
        {linkLabel}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

function LedgerRow({ term, children }: Readonly<{ term: string; children: React.ReactNode }>) {
  return (
    <div className="grid grid-cols-[minmax(8rem,38%)_1fr] gap-4 border-b border-rule py-3">
      <dt className="text-ink-2">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
