# Frontend / UX Flaws

## 1. MEDIUM — Category page locks the wrong filter (functional bug)

**Evidence**: `src/app/(public)/category/[slug]/page.tsx` passes `brand={category}` to `CommonListPage`, and `src/app/components/common-listpage.tsx:42` does `lockedBrandSlug={brand?.slug}`. On a category page the **brand** dropdown gets hidden/locked to the *category* slug, the category dropdown stays visible but does nothing (the route forces `categorySlug`), and **filtering by brand within a category is impossible**. The brand page is wired correctly.

**Fix**: add a `lockedCategorySlug` prop path and pass the category through it.

## 2. MEDIUM — Admin image uploader destroys Cloudinary assets before save

**Evidence**: `src/modules/admin/catalog/components/admin-image-uploader.tsx` — `removeAt` calls `/api/admin/media/delete` (permanent Cloudinary destroy) the moment an image is removed from the form. Cancelling the product edit leaves DB records pointing at deleted assets. Errors are partially swallowed.

**Fix**: mark for deletion in form state; only destroy after a successful product save (or run a periodic orphan sweep).

## 3. MEDIUM — Invalid interactive nesting

- `src/app/components/cart-panel/cart-panel.tsx` renders `<Button disabled><Link href="/checkout">…` **without** `asChild` → `<button>` wrapping `<a>` (invalid HTML), and the "disabled" button doesn't prevent navigating via the inner link. (`cart-summary.tsx` does it correctly with `asChild` — copy that.)
- `src/app/components/header/header.tsx` (Header.Search) wraps a `<form>` + `<input>` inside a `<button type="button">` — invalid and confusing for assistive tech.

## 4. MEDIUM — No route-level loading states

No `loading.tsx` exists anywhere. Server pages (PDP, listings) block on data with no skeleton; client account pages flash a loader then redirect unauthenticated users via `useEffect` (`account/*` pages) instead of being server-gated like `/checkout`.

**Fix**: add `loading.tsx` for the public route group and PDP; convert account pages to server-gated auth.

## 5. LOW — Missing error states on client lists

`useMyOrders`, `useReviewableItems`, `useAddresses` render loading → data only; a failed fetch leaves an empty/stuck state (order detail and bank-transfer pages handle `error` correctly — mirror that pattern).

## 6. LOW — Heading structure

- Home page has no `<h1>` (first heading is `<h2>Featured products`).
- `product-filters.tsx:73` renders a leftover `<h2>Filter Panel</h2>` that lands *before* the page `<h1>` in DOM order on all listing pages.

## 7. LOW — Header is one big client component

`src/app/components/header/header.tsx` is entirely `'use client'` even though menu data arrives as server props. Only search preview, cart trigger, and account dropdown need interactivity — the rest could be server-rendered to cut bundle size.

## 8. LOW — Font & image payload

- Fonts ship as 5 × `.ttf` via `next/font/local`; converting to `woff2` cuts font bytes roughly in half.
- Home hero carousel renders the same `/banner.webp` twice, both with `priority` + eager loading (two LCP-priority requests for one asset).

## 9. LOW — Dead/leftover UI

- Footer links (About, Privacy Policy, Terms, Refund Policy, Blog, etc. — `src/app/components/footer/footer.tsx`) all point to `/`; the pages don't exist.
- `CustomBreadcrumb` component exists but is never used.
- In-page filter search box is commented out (`product-filters.tsx:71-85`).
- Admin Settings page is a stub (`<div>settings page</div>`).
- Price min/max are raw text inputs committed `onBlur`, although a `Slider`/`range` component exists in the codebase.

## 10. LOW — Admin forms expose raw cents

Product and coupon forms take prices as integer cents (e.g. `129900` for 1,299৳) — error-prone for operators. Add a display-unit input with conversion.
