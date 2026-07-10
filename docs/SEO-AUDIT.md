# SEO Audit

Audit date: 2026-07-11. Verdict: **solid foundation, several high-impact gaps.** Catalog content is server-rendered and crawlable, sitemap/robots exist, PDP has OpenGraph + Product JSON-LD. Missing: `metadataBase`/canonicals, review/rating structured data (reviews are invisible to crawlers), breadcrumbs, Organization/WebSite schema, and a correct heading hierarchy.

## What's already good ✅

- **Server-rendered catalog**: home, `/products`, PDP, category, brand pages are all server components with ISR (`revalidate` 60–120) — content is visible to crawlers.
- **Dynamic sitemap** (`src/app/sitemap.ts`): all published products (up to 5000), categories, brands with `lastModified`/priority.
- **robots.ts**: sensible disallows (api, dashboard, account, cart, checkout, auth pages), sitemap + host declared.
- **PDP metadata**: `generateMetadata` uses per-product `metaTitle`/`metaDescription` (admin-editable fields exist!), OpenGraph with product image.
- **Product JSON-LD** on PDP (`product-detail.tsx` `buildJsonLd`): name, description, images, brand, sku, single Offer with BDT price and availability — server-rendered.
- **Title template** (`%s | Cryptech`) in root layout; `lang="en"`.
- **next/image everywhere** with mostly-good alt texts; self-hosted fonts via `next/font`.

## Gaps, by impact

### HIGH

1. **No `metadataBase`, no canonical URLs** — zero matches for `metadataBase`/`canonical`/`alternates` in `src`. Filtered/paginated listing URLs (`/products?page=2&sort=…`) have no canonical, risking duplicate-content dilution; OG image URL resolution is unspecified.
   *Fix*: set `metadataBase` in `src/app/layout.tsx`; add `alternates.canonical` in each page's metadata (PDP → `/products/[slug]`, listings → their base path).
2. **Reviews are invisible to crawlers and absent from structured data** — PDP reviews load via `next/dynamic ssr:false` (`deferred-reviews-section.tsx`), and Product JSON-LD has no `aggregateRating`/`review`. You forfeit star rich results, the single biggest e-commerce SERP CTR lever.
   *Fix*: fetch the review summary server-side on the PDP (it's one cheap query) and add `aggregateRating` to the JSON-LD; the interactive list can stay client-side.
3. **No `BreadcrumbList` JSON-LD and no visible breadcrumbs** — a `CustomBreadcrumb` component exists but is never used. Category → product breadcrumbs help both UX and SERP display.
4. **Home page has no `<h1>`**; listing pages have an out-of-order `<h2>Filter Panel</h2>` before the `<h1>` (`product-filters.tsx:73`).

### MEDIUM

5. **No `Organization` / `WebSite` JSON-LD** (logo, name, social profiles; `WebSite` + `SearchAction` can enable a sitelinks search box).
6. **No Twitter card metadata** anywhere.
7. **Category/brand pages have generic descriptions** and no OG tags; no description field exists on the Category/Brand models to source from.
8. **Missing trust pages** (About/Contact/Privacy/Terms/Refund — footer links point to `/`). Thin-content/trust signal for Google, especially for e-commerce ("Your Money or Your Life" scrutiny). Also see FEATURE-GAPS P0.
9. **`sitemap.ts` declares `dynamic='force-dynamic'` alongside `revalidate=3600`** — force-dynamic wins; the sitemap queries the DB on every crawler hit. Remove `force-dynamic` to serve it from ISR cache (also saves free-tier function invocations).
10. **Env drift**: sitemap/robots read `NEXT_PUBLIC_APP_URL` but `.env` defines `NEXT_PUBLIC_BASE_URL` — currently held together by the `NEXTAUTH_URL` fallback. If that ever changes, sitemap URLs silently become `http://localhost:3000/...`.

### LOW

11. Fonts are `.ttf` (convert to `woff2` — smaller, faster LCP/CLS).
12. Duplicate hero image loaded twice with `priority` on home (LCP waste).
13. No image entries in the sitemap (product image sitemaps help Google Images traffic).
14. `/products?q=` search results are indexable (not disallowed) — consider `noindex` on search-result views to preserve crawl budget.
15. 404 page exists (good); no custom `not-found` metadata.

## Recommended order of work

1. `metadataBase` + canonicals (one file + small per-page additions).
2. Server-render review summary + `aggregateRating` in Product JSON-LD.
3. Breadcrumbs (visible + JSON-LD) on PDP/category/brand.
4. h1 fixes (home; remove "Filter Panel" heading).
5. Organization/WebSite JSON-LD + Twitter cards in root layout.
6. Trust pages (shared with FEATURE-GAPS P0).
7. Sitemap cleanup (`force-dynamic`, env var name, image entries).
