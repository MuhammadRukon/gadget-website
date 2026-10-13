# Perf Waterfall + Docs Cleanup Plan (gadget-website)

Status: APPROVED 2026-10-13. Revised 2026-10-13 (after approval): Phase 1 adds server-component review list and shortened author names; Phase 2 adds OAuth landing route, parallel session/summary calls, persistent header badge, guest stock safety, guest-cart persist hardening and the additive `adjustments` field on `PUT /api/cart`. Planning only. No code changed.
Plan branch: `docs/perf-and-docs-cleanup-plan` (off `origin/dev` @ `c37783c`, which already contains PR #33, the Redis/ISR work). Execution branch (later, owner-chosen base): `feature/perf-waterfall-and-docs-cleanup` off latest `origin/dev`. `git-hygiene` defaults feature branches to `main`; the owner chose `dev` because `dev` already holds the code this plan edits. Flag this mismatch at execution start. PR target `dev`.
Skills the executor invokes: `tdd` (pure-logic parts of Phases 1-4), `ecc:docs-lookup` (verify Next 16 `after()` and next-auth `session` prop behavior before relying on them), `ecc:security-review` (Phase 2 auth hint, Phase 3 limiter), `ecc:verification-loop` and `code-review` (Cross-Validation), `git-hygiene` (commits/PR).

---

## 1. Summary

After the Redis/ISR work, the remaining waste is client-side waterfalls and page weight: the PDP review list loads after hydration (extra function call, two loading states, no review text in HTML); every full page load calls `/api/auth/session` and, for logged-in users, the full `/api/cart`, even for guests or for a header badge; preview search fires from the first character with no client cache; the Redis cache SET is awaited on the response path; the home banner is requested twice and ~10 MB of TTF fonts are shipped. Separately, the docs contain stale claims and ~10 obsolete or duplicated files. Goal (confirmed): fix the waterfall/weight items in four phases, clean the docs (delete obsolete, fix stale, keep context and roadmap docs), and park the correctness bugs and heavier items in a backlog.

Approach: smallest client-side changes that keep ISR intact (no server `auth()`/`cookies()` in the layout tree), measured on a Vercel preview. Rejected larger options: server-provided session via `auth()` (makes the root layout dynamic and kills ISR), a client-side-fetch/infinite-scroll reviews API, `@vercel/functions` dependency (Next `after()` covers it).

---

## 2. Findings (file:line, from the read-only explorations of 2026-10-13)

### 2.1 Reviews (PDP)
- `src/app/(public)/products/[slug]/page.tsx:57-58`: ISR render already computes `reviewsService.summaryForProduct`; the list is NOT in the HTML.
- `src/modules/storefront/components/deferred-reviews-section.tsx:5-11`: `next/dynamic(..., { ssr: false })`, fallback `Loading reviews...`; `src/modules/reviews/components/reviews-section.tsx:59-67`: `useProductReviews`, then a `<Loader/>` while loading (two staged loading states, layout shift, no review text for crawlers).
- `src/modules/reviews/hooks.ts:13-22` fetches `/api/reviews?productId=`; `src/server/reviews/reviews.repo.ts:4-11` `take: 50`; `src/app/api/reviews/route.ts:11-42`: GET `s-maxage=10`; POST already calls `revalidateProductPage(slug)` best-effort (`src/app/api/_lib/revalidate.ts:65-67`). The write form is not on the PDP (`src/app/(public)/account/reviews/page.tsx:77`).
- DTO `PublicReview` already serializes `createdAt` as ISO string; `authorName` is the user's full name or "Verified buyer" (now crawlable; shortening is a backlog item).

### 2.2 Session and cart calls
- `src/components/providers.tsx:31`: `<SessionProvider>` with no `session` prop, so every full page load calls `/api/auth/session`; `src/app/components/header/header-account.tsx:26` waits on it (skeleton). Other `useSession` consumers: `src/modules/cart/hooks.ts` (:25, :47, :77, :91, :157), `CartBootstrap` (`providers.tsx:17-18`).
- The session cookie is always httpOnly (`authjs.session-token` / `__Secure-authjs.session-token`, optionally chunked): a client cannot read it. Passing `session` via server `auth()` would make the root layout dynamic: rejected.
- `src/app/components/header/cart-panel/cart-panel.tsx:22-34`: the header badge calls `useCart()` (`hooks.ts:72`), which fires BOTH `useServerCart('full')` and `useGuestSnapshot()`. `?view=summary` exists (`hooks.ts:29-31`, `src/app/api/cart/route.ts:14-17`) but only `checkout-client.tsx:33` uses it. Guests with items POST `/api/cart/hydrate` on every page load. `src/lib/queryClient.ts:11-14`: staleTime 30 s, in-memory only. Guest store `src/modules/cart/guest-cart.ts` is zustand `persist` (`Cryptech.guestCart`, lines `{variantId, quantity}`).

### 2.3 Search, cache, page weight
- `src/hooks/use-header-search-preview.ts:9,61-99`: debounce 400 ms, minimum length 1, abort of the previous request already exists, no client cache (`setPreview(null)` per keystroke). `header-search.tsx` has `maxLength=100`; Enter navigates to `/products?q=` independently of the preview.
- `src/server/common/cache.ts:14,141-173`: `TIMEOUT_MS = 400`; `cached()` awaits the Redis SET (`:167`) after the loader; `src/server/cart/cart.service.ts` (~:262-271) awaits `Promise.all(writes)` in `hydrateGuestCart`. `src/server/common/http.ts` is the only `src/server` file allowed to import `next/server`; `instrumentation.ts` has only `register()` importing `./src/env`.
- `src/server/common/rate-limit.ts:49-52`: `fallback: 'none'` returns allow-all (used by `enforceIpLimit` for cart hydrate and catalog `q`); the `// shortcut:` comment promises a per-instance in-memory window.
- `src/app/(public)/page.tsx:23-48`: the same `/banner.webp` (2000x1000, 67 KB, declared 1600x500) twice with `priority`. `src/app/layout.tsx:9-35`: `localFont` with 5 TTFs of ~2 MB each (`src/app/fonts`, total ~10.2 MB); `font-medium` 50 uses, `font-semibold` 49, `font-bold` 0, no Tailwind `italic` class (italic face unused).

### 2.4 Docs audit (verified against code)
Verdicts and exact stale lines are in Phase 5. Headline: most suspected stale items were already fixed on `dev` (edge guard, jsdom, `NEXT_PUBLIC_APP_URL`); the real staleness is in `PROJECT_GUIDE.md`, `docs/issues/*`, `CLAUDE.md:55,115,123,125`, `docs/context/*` (no ISR/Redis section; `02-architecture.md:14,25,66,71`; `05-frontend.md:13-16,55`; `03-data-model.md`; `04-api-reference.md`; `01-overview.md:20,26,34-43,53`), `SCALE-UP-TODO.md:5,21-23`, `SEO-AUDIT.md:7-9`, `README.md:16,102-105`, and `.env.example` lacks the Upstash vars (it is tracked on `dev`).

---

## 3. Constraints, assumptions, risks, unknowns

Non-negotiable: no server `auth()`/`cookies()` in the root or public layout trees (ISR must stay); the auth hint is NEVER used for authorization (all APIs keep `requireSession()`; hint only decides whether the client asks for a session); no PII in new client storage beyond a boolean hint and a cart count; checkout/payment code untouched; cache `defer` failure never breaks a request (fail-open); docs deletions only after every reference is updated.

| Item | Mitigation / owner |
|---|---|
| next-auth v5 beta: does `session={null}` really skip the mount fetch? | Phase 2 spike with `ecc:docs-lookup` + a network check before building on it; fallback: keep fetch but only when the hint says logged-in via a custom lightweight provider |
| Google OAuth returns via full navigation, hint absent on arrival (user looks logged out until session fetched) | `/login` and the OAuth callback landing always use the normal fetch; sync the hint when `useSession` becomes `authenticated`; stale hint only costs one wasted call (safe direction) |
| SSR/hydration mismatch for the badge (zustand empty on server) | `mounted` flag, no server-rendered count |
| `after()` throws outside a request scope (tests, build, prerender) | injectable `defer` with try/catch fallback to the current awaited behavior |
| Lower Redis timeout (250 ms) may trip the breaker more | watch Vercel logs; revert to 400 ms if `cache store failure` warnings spike |
| SSR of 10 reviews adds PII (author names) to cached HTML | already public via the API; shortening names is a backlog item |
| Font conversion needs a one-off tool | `pip install fonttools brotli` outside the repo; no new repo dependency; keep the TTFs recoverable via git history |
| Docs deletions break references | Phase 5 greps every deleted path and updates links first; `docs/KNOWN-ISSUES.md` replaces `docs/issues/*` |
| Redis plan still holds owner follow-ups (measurements, Upstash env vars, budget cap, formatter stash drop) | KEEP it until the follow-ups are recorded (backlog item to trim it) |
| Vercel Hobby non-commercial / 1M invocation cap | owner decision, outside this plan |

---

## 4. Workspace setup (first step)
1. Confirm PR #33 (Redis/ISR) is merged into `dev` (it is, `c37783c`), then `git fetch` and create `feature/perf-waterfall-and-docs-cleanup` from latest `origin/dev`. Plain branch (owner can choose a worktree at execution). Run `npm install` (new deps may exist) and `npx prisma generate`.
2. One commit per phase, `git-hygiene` format. PR into `dev`. Push and PR need an explicit yes at that time.

---

## 5. Phases

### Phase 0: Baseline (no code)
Steps: on a Vercel preview or production, with a logged-out browser, load `/`, one category, one product page; export the Vercel log; record function invocations and `/api/auth/session`, `/api/cart`, `/api/reviews` call counts per page, plus Prisma "Total Operations" before/after one product view. Also record current font bytes (`ls -l src/app/fonts`) and home-page transferred bytes (DevTools).
Acceptance criteria:
- [ ] A table records, per page (home, category, PDP), the number of function invocations from the Vercel log export and which of `/api/auth/session`, `/api/cart`, `/api/reviews` fired (expected baseline from 2026-10-12 log: all three fire on the PDP for a logged-in user, session fires on every page).
- [ ] The Prisma operations delta for one PDP view is recorded as a number.
- [ ] `src/app/fonts` total bytes (about 10,227,000) and home-page transferred bytes are recorded.

### Phase 1: PDP reviews in the ISR render
Scope: `src/server/reviews/reviews.repo.ts`, `src/server/reviews/reviews.service.ts`, `src/app/(public)/products/[slug]/page.tsx`, `src/modules/storefront/components/product-detail.tsx`, `src/modules/storefront/components/deferred-reviews-section.tsx`, `src/modules/reviews/components/reviews-section.tsx`, `src/modules/reviews/hooks.ts`, new tests.
Steps (tdd for service/hook logic): (1) `listByProduct(productId, take = 50)` and `listForProduct(productId, take?)`; (2) in `page.tsx` run `Promise.all([summaryForProduct(product.id), listForProduct(product.id, 10)])` and pass `initialReviews` to `ProductDetail`; (3) drop the `dynamic(..., { ssr: false })` wrapper (render `ReviewsSection` directly, delete `deferred-reviews-section.tsx` if unused) so the first 10 reviews are in the HTML; (3b) split: the list renders as a server component; only the "Show all reviews" control is a client island (no list hydration); (3c) shorten `authorName` to first name + initial in the `PublicReview` serializer (the names are now in cached public HTML); (4) `useProductReviews(productId, { initialItems, enabled })`: `initialData` from the SSR items, `staleTime` 60 s, and the full 50-item list is requested only when the user clicks a "Show all reviews" control (existing GET stays `take: 50`, `s-maxage=10`); (5) no change to the POST route (revalidate-on-submit already exists).
Acceptance criteria:
- [ ] `curl -s https://<preview>/products/<slug>` (second request, ISR HIT) HTML contains the text of the newest review (rating, title, author name) and the summary count, with no client fetch needed.
- [ ] Loading a PDP in the browser issues 0 requests to `/api/reviews` (network panel / Vercel log), and shows no "Loading reviews..." text and no spinner.
- [ ] Clicking "Show all reviews" on a product with more than 10 reviews issues exactly 1 `GET /api/reviews?productId=<id>` and renders up to 50 items; a product with 10 or fewer reviews shows no such control.
- [ ] After `POST /api/reviews` succeeds (201), the next request to `/products/<slug>` shows the new review within one reload (revalidate on submit), verified on a preview.
- [ ] A product with 0 reviews renders "No reviews yet" in HTML and no JSON-LD `aggregateRating` (unchanged).
- [ ] `listForProduct(productId, 10)` returns at most 10 items ordered by `createdAt desc` (unit test with mocked Prisma); `listForProduct(productId)` still returns up to 50.
- [ ] Review author names in HTML and API are "First L." (or "Verified buyer"); never the full name (unit test on the serializer).
- [ ] Existing tests pass: `src/app/api/__tests__/review-revalidate.test.ts`, `cache-headers.test.ts` unchanged.
- [ ] Vercel log for one PDP view after the change: 0 `/api/reviews` function runs (baseline from Phase 0 is 1).

### Phase 2: Session and cart call diet
Scope: new `src/lib/auth-hint.ts`, `src/components/providers.tsx`, `src/modules/cart/hooks.ts`, `src/app/components/header/cart-panel/cart-panel.tsx`, the credentials sign-in page (`src/app/(public)/login/page.tsx`), the logout component (`logout.tsx`), `src/modules/cart/guest-cart.ts`, `src/app/components/cart/cart-line-item.tsx`, `src/modules/cart/components/add-to-cart-button.tsx`, `src/server/cart/cart.service.ts` (`mergeGuestCart` result only), `src/contracts/cart.ts`, tests `src/lib/__tests__/auth-hint.test.ts`, guest-cart and merge tests.
Steps: (0) spike: with `ecc:docs-lookup`, confirm next-auth v5 beta `SessionProvider session={null}` skips the initial fetch and keeps `status === 'unauthenticated'` (`refetchOnWindowFocus={false}` is already set in `providers.tsx`, keep it; also confirm no visibility/storage-event refetch); if not, STOP and report (deviation checkpoint). (1) `auth-hint.ts`: `readAuthHint()`, `setAuthHint()`, `clearAuthHint()` over localStorage key `Cryptech.authHint` with `typeof window` guards and try/catch; (2) `Providers` passes `session={null}` when the hint is absent, `undefined` (normal fetch) when present; an effect syncs the hint from `useSession` (`authenticated` -> set, `unauthenticated` -> clear); `/login` always uses the normal fetch; Google OAuth `callbackUrl` goes through a landing route (`?auth=1`) that always does the normal fetch and then sets the hint (with `session={null}` nothing else would ever flip status to `authenticated`); (2b) cart badge lives in the persistent `(public)/layout.tsx` Header: it must not remount or refetch on navigation (queries keyed once, `refetchOnMount: false` for the badge, updates only via mutation `setQueryData`/`invalidate`); (3) `hooks.ts`: with the hint present, fire the summary query in parallel with the session call (do not gate it on `useSession` status; a 401 clears the hint); invalidate summary on cart mutations; `useCartBadgeCount()` returns the guest line-count sum from the zustand store (after a `mounted` flag) or, when authenticated, `useServerCart('summary')` with 5 min staleTime; keep `useCart()` for the full cart; (4) `cart-panel.tsx`: badge from `useCartBadgeCount()`, panel content (a child component using `useCart()`) mounts only when the Sheet is open; guest lines show price skeletons while the hydrate query runs; (4b) guest stock safety (still 0 requests per mutation): `add()`/`setQuantity()` accept an optional `maxStock`; the PDP passes the selected variant's stock into the add, the cart line passes `line.stock` from the hydrated snapshot; an increment past stock is blocked with a toast; quantity cap stays 99 as the absolute ceiling; (4c) badge for guests = sum of quantities of lines that are active and in stock per the last hydrate result (fallback to the raw store sum only before the first hydrate); after each hydrate, prune lines whose variant no longer exists (the server skips them) from the store, and persist `lastValidatedAt`, forcing one hydrate on first panel open or any cart page view when older than 24 h; panel open always revalidates (hydrate `staleTime` 0); (4d) `guest-cart.ts` persist gets `version: 1` and a `merge`/`migrate` step that zod-validates stored lines (positive integer quantity, string `variantId`) and drops invalid ones; add a `storage` event listener so other tabs rehydrate the store (guest cleared or changed in one tab shows in all); (4e) merge result: `mergeGuestCart` returns `CartSnapshot & { adjustments: [{ variantId, name?, requested, applied }] }` (additive: snapshot fields stay at the top level, so the response is backward compatible; applied 0 = removed because inactive or out of stock, applied < requested = clamped); add `mergeAdjustmentSchema` and the `CartMergeResult` type to `src/contracts/cart.ts` and parse the PUT response with it in the hook; `PUT /api/cart` response carries `adjustments` (the only caller is `useGuestCartMerge`, no existing tests cover the route); `useGuestCartMerge` shows one toast ("N items were removed or reduced because of stock") and still clears the store only on success; (5) set the hint after a successful credentials `signIn` (before `router.refresh()`), clear it in logout together with any persisted cart count.
Acceptance criteria:
- [ ] Logged-out first load of `/` (no hint in localStorage): 0 requests to `/api/auth/session` and 0 to `/api/cart` in the browser network panel and the Vercel log; header shows "Login" without a skeleton.
- [ ] Logged-in returning user (hint present): exactly 1 `/api/auth/session` and 1 `GET /api/cart?view=summary` on page load; 0 requests to full `GET /api/cart` until the cart panel is opened; opening the panel issues exactly 1 `GET /api/cart`.
- [ ] Logged-in load: `/api/auth/session` and `GET /api/cart?view=summary` start in the same tick (network waterfall shows no serial gap).
- [ ] Navigating between 3 storefront pages (client navigation) issues 0 cart or session requests; adding an item issues exactly 1 mutation request and the badge updates from its response.
- [ ] Guest add/update/remove issue 0 network requests (localStorage only), and a guest cannot increment a line past its known stock (toast shown, quantity unchanged); a unit test on the store covers `maxStock`.
- [ ] Guest with a stored line whose variant was deleted or is out of stock: the badge excludes it, the panel marks or omits it, and the deleted variant's line is pruned from `Cryptech.guestCart` after the first hydrate.
- [ ] Guest cart older than 24 h (`lastValidatedAt` faked): first panel open triggers 1 hydrate and sold-out lines show as unavailable immediately; opening the panel again within `staleTime` 0 still refetches once per open.
- [ ] Corrupt `Cryptech.guestCart` (quantity 0, NaN, string, missing `variantId`, wrong version) rehydrates to a valid store with invalid lines dropped and no hydrate 422 (unit test).
- [ ] Two tabs: clearing or merging the guest cart in tab A updates the badge in tab B without reload.
- [ ] Merge with an out-of-stock line and a clamped line: `PUT /api/cart` returns `adjustments` listing both, one toast is shown, the store is cleared, and a failed merge keeps the store and shows no toast (service test + hook test).
- [ ] New route-level test for `PUT /api/cart` (mock session): response still contains the `CartSnapshot` fields (`lines`, `subtotalCents`, `itemCount`) at the top level plus `adjustments`; unauthenticated call returns 401.
- [ ] Guest with 2 lines in localStorage: badge shows 2 on first client paint (after mount) with 0 network requests; opening the panel issues exactly 1 `POST /api/cart/hydrate`.
- [ ] Credentials login: after sign-in the badge shows the server cart count and the guest lines merge (`PUT /api/cart` once, guest store cleared) as before.
- [ ] Google login: after returning from OAuth, the user appears logged in (avatar) after the first session fetch and the hint is set; the next full load makes exactly 1 session call.
- [ ] Logout: hint and any persisted count are cleared; the next full load makes 0 session calls.
- [ ] A forged hint (`localStorage.setItem('Cryptech.authHint','1')` while logged out) causes one session call that returns no session, then the hint is cleared; no protected API ever returns data (spot check `GET /api/cart` returns 401 without a session).
- [ ] No React hydration warning in the browser console on `/`, a category page, and a PDP (guest and logged-in).
- [ ] `src/lib/__tests__/auth-hint.test.ts`: read/write/clear round-trip, invalid stored value returns false, and SSR (no `window`) returns false without throwing.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass; `ecc:security-review` reports no new high findings.

### Phase 3: Search typing, deferred cache writes, timeout, limiter fallback
Scope: `src/hooks/use-header-search-preview.ts`, `src/app/components/header/header-search.tsx`, `src/server/common/cache.ts`, `instrumentation.ts`, `src/server/cart/cart.service.ts` (`hydrateGuestCart` writes), `src/server/common/rate-limit.ts`, tests under `src/server/common/__tests__/`.
Steps (tdd): (1) search: `MIN_PREVIEW_CHARS = 3`; below it cancel the debounce, abort, clear the preview and loading, and hide the panel; keep the abort logic; add a module-level `Map` cache (key: lowercased, whitespace-collapsed query; value: result + timestamp; TTL 60 s; cap 30 entries, FIFO eviction; never cache error fallbacks); Enter still navigates to `/products?q=` for any length; (2) `cache.ts`: `setDefer(fn | undefined)` plus `runDeferred`, the SET in `cached()` and the `hydrateGuestCart` writes go through it; unset or throwing `defer` falls back to the current awaited behavior; `instrumentation.ts` `register()` (node runtime) calls `setDefer` with Next `after()` (verify the API with `ecc:docs-lookup` first; if `after` is unusable from instrumentation, record the deviation and keep the awaited path); (3) `TIMEOUT_MS` 400 -> 250 and update the timeout test; (4) `rate-limit.ts`: `fallback: 'none'` uses a per-instance in-memory fixed window (`Map<key,{count,resetAt}>`, cap 5000 keys, lazy expired sweep on cap, drop oldest if still full) instead of allow-all; update the `// shortcut:` comments.
Acceptance criteria:
- [ ] Typing 1-2 characters in the header search issues 0 requests to `/api/catalog/products` and shows no panel; typing the 3rd character issues exactly 1 request after the debounce.
- [ ] Typing `iph`, clearing, then retyping `iph` within 60 s issues 1 request total (cache hit on the second); typing `iph` then `ipho` quickly issues at most 1 completed request and the first is aborted (`AbortError` ignored).
- [ ] Pressing Enter with the 2-character query `ip` navigates to `/products?q=ip`.
- [ ] With an injected fake `defer`, `cached()` returns the loader value before the store `set` is called, and calling the captured function then performs `set` once; with `defer` unset or throwing, the value is still returned and `set` still runs (awaited), with no exception (tests in `cache.test.ts`).
- [ ] `hydrateGuestCart` returns its snapshot without waiting for the Redis SETs when `defer` is set (test: SET promise left pending, call resolves).
- [ ] The hung-request test uses 250/251 ms: an `upstashStore.get` that never resolves rejects after 250 ms (fake timers); `incrWindow` window TTL tests are unchanged.
- [ ] With the store absent, `enforceRateLimit('k', {max:3,windowMs:30000}, {fallback:'none'})` called 4 times: the 4th throws `RateLimitedError`; after fake timers advance 30001 ms the next call passes; two different keys are independent; with 5001 distinct keys the map size stays <= 5000.
- [ ] `src/app/api/__tests__/route-rate-limits.test.ts` still passes unchanged (121st `q` call and 121st hydrate call return 429 with `Retry-After`).
- [ ] On a Vercel preview with Redis enabled, a cache-miss listing response time is not slower than before and Vercel logs show the SET after the response (no new errors); no `after`-related exceptions in logs.
- [ ] `npm run typecheck`, `npm test`, `npm run build` pass.

### Phase 4: Page weight (banner and fonts)
Scope: `src/app/(public)/page.tsx`, `src/app/layout.tsx`, `src/app/fonts/*`, `public/banner.webp` (only if a second real image is supplied), `docs` none.
Steps: (1) home: keep `priority` and `loading="eager"` only on the first slide, second slide `loading="lazy"` without `priority`; if the second slide has no distinct image, render a single image and drop the carousel; fix declared dimensions to match the asset (2000x1000) or crop to 1600x500, add `sizes="100vw"`; (2) fonts: verify which weights render (`globals.css` base styles, headings, `<strong>`/`<b>` default to 700; grep `font-bold`, `<strong`, `<b>`, `<em>`, `<i>`) and record the decision for Bold and Italic; remove the unused faces; (3) convert the kept faces to subsetted woff2 with a one-off tool outside the repo (`pip install fonttools brotli`; subset Latin, Latin-1, general punctuation, currency incl. U+09F3, and Bengali U+0980-09FF only if Bengali content exists), replace the TTFs in `src/app/fonts`, update `localFont` `src`, add `display: 'swap'`.
Acceptance criteria:
- [ ] Home page HTML contains at most 1 `<link rel="preload" as="image">` for the banner, and the network panel shows the banner image requested once per viewport size.
- [ ] `src/app/fonts` total size is under 200 KB (baseline ~10.2 MB); `ls -l` output recorded; no `.ttf` remains unless Bold was kept for a documented reason.
- [ ] Visual check on `/`, a category page, the PDP and checkout: text weights render as before (400/500/600; 700 only if kept); no fallback-font flash beyond `swap`; Bengali or `৳` glyphs render if used anywhere (grep recorded).
- [ ] Home-page transferred bytes (DevTools, cold cache, preview) drop by at least the removed font bytes; LCP does not regress versus the Phase 0 baseline (Lighthouse run on the preview, numbers recorded).
- [ ] `npm run build` passes; `next/font` emits no warnings.

### Phase 5: Docs cleanup
Rules: delete what is obsolete or fully superseded, fix stale claims in what stays, keep context and roadmap docs, no archive folder (git history keeps deleted files). Do references first, deletions last.
Scope and steps:
1. `.env.example`: add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (optional, with the fail-open comment).
2. `docs/context/02-architecture.md`: fix line 14 (repo layer: only `catalog.repo.ts` and `reviews.repo.ts` exist), line 25 (mailer is wired via Resend), line 66 (rate limiting now covers login, verify, resend-verify, quote, warranty, reviews, txn-check, txn-id, cart hydrate; Postgres plus optional Redis), line 71 (56+ test files, live-DB service tests and route tests, no browser E2E); ADD a "Caching / ISR" section: listing rewrite split (`next.config.ts` rewrites from `src/lib/listing-rewrites.ts`, `/live/*` twins, base routes ISR 60 s, PDP `generateStaticParams` 120 s), `revalidateCatalog`/`revalidateProductPage` helper (`src/app/api/_lib/revalidate.ts`, the only `next/cache` importer), `CATALOG_CACHE_CONTROL`, Redis keys via `buildKey` (`gw:<env>:`), `cached()`, fail-open breaker, Postgres limiter fallback.
3. `docs/context/00-INDEX.md` (relink: `PROJECT_GUIDE`, `../issues/` -> `../KNOWN-ISSUES.md`; mention ISR/caching in 02), `01-overview.md` (line 20 testing wording, line 26 rate-limit framing, env table add `UPSTASH_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `CLOUDINARY_UPLOAD_FOLDER`, verify the `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` row, line 53 sandbox sentence contradicts line 32 of 02: remove), `03-data-model.md` (add `RateLimitBucket`, `User.emailVerified` and verification token flow, index note: `Product_slug_idx` dropped by migration `20261013100000_drop_redundant_product_slug_index`), `04-api-reference.md` (lines 11 and 26 "token only shown in dev" is stale; line 35 checkout/config `force-dynamic` + `no-store`; line 27 `PUT /api/cart` response now includes `adjustments` (removed or clamped lines from the guest merge), add `Cache-Control` on `/api/catalog/*`, rate-limit coverage, `/live/*` twins are not API routes), `05-frontend.md` (lines 13-16 rendering table: `/products`, `/category`, `/brand` ISR 60 with `/live/*` twins, PDP ISR 120; line 13 home has an sr-only h1; line 55 footer links go to real pages; re-verify the header search form nesting claim), `06-conventions.md` (line 19 coupon `tx` violation is fixed; add "admin writes call `revalidate.ts`" and cache-key conventions).
4. `README.md`: line 16 testing wording (Vitest, node, live local Postgres via `npm test`), tree lines 89-94 (new docs layout), lines 102-105 payment-forgery warning is stale (replace with a pointer to `docs/KNOWN-ISSUES.md`), add one line on the optional Upstash layer and ISR; verify `package.json:14` `"lint": "next lint"` works on the installed Next (if it does not, record it in KNOWN-ISSUES instead of changing it here).
5. `CLAUDE.md`: line 55 (remove the passthrough-repo sentence), lines 9/112 (rate-limit coverage list), line 115 (route-level vitest tests exist; no browser E2E), lines 121-125 Docs section (drop `cotext.md`, point to `docs/KNOWN-ISSUES.md`, replace the "docs lag" warning with an accurate one), add a short "Caching and ISR" bullet pointing to `02-architecture.md` (no duplicated detail).
6. `docs/product/SCALE-UP-TODO.md`: line 5 (email and optional Redis exist), lines 21-23 (ISR tuning and `Cache-Control` done; Upstash item re-scoped to remaining: coupon counters, usage measurement), keep CI line 65 and Playwright line 70 as TODO. `docs/product/FEATURE-GAPS.md`: re-verify open items; fix line 36 only if wrong. `docs/SEO-AUDIT.md`: rewrite the lead (lines 7-9) to the true open list (#7 category/brand descriptions and OG, partial #6 per-page Twitter, #11-#14, image sitemap); check `/live/*` carries `noindex` + canonical before stating it. `docs/plans/playwright-e2e-testing-plan.md`: refresh its Context section (`.env.dev` is loaded by `npm test`, the guard exists, PR template exists, workflows still do not, suite is 56+ files). `docs/e2e/payment-settings-cod-fee-flows.md`: add a cross-reference to the playwright plan.
7. Create `docs/KNOWN-ISSUES.md` (single list of verified-open items only): Security (media upload trusts client MIME/folder, shallow `/api/health`, duplicate callback audit events: verify first); Correctness (price sort per page, expiry sweep needs cron, warranty `void adminId`, category cycle check, negative-margin variants, payment callback race/double-restock and cancelled-order revival, coupon `usedCount` not released on most cancel paths, admin `updateProduct` absolute stock overwrite, `minPrice`/`maxPrice` overwrite); Architecture (no server pagination for admin lists, in-memory analytics, no job runner, duplicated component trees, single ADMIN role/no last-admin guard, connection pooling); Frontend (category page `brand={category}`, uploader destroys before save, no `loading.tsx`, client error states, header client component, admin forms show raw cents); Tooling (`npm run lint` status, no CI workflows, owner follow-ups carried from `dev-environment-setup-plan.md`: blank `.env` DB URLs, Vercel env scoping, delete the Cloudinary test asset, never accept a `migrate dev` reset); Owner follow-ups from the Redis plan (Phase 0 measurements, Upstash env vars with budget cap and 80% alert, drop `stash@{0}: exec-cart-format-churn`).
8. Update every reference to a doomed path (grep list in the criteria), then delete: `cotext.md`, `docs/PROJECT_GUIDE.md`, `docs/issues/` (6 files), `docs/plans/checkout-concurrency-plan.md`, `docs/plans/admin-payment-methods-cod-fee-plan.md`, `docs/plans/post-review-structural-cleanup-plan.md`, `docs/plans/dev-environment-setup-plan.md`, and `.claude/PRPs/plans/completed/*`, `.claude/PRPs/reports/*` (delete as a set, they cross-reference each other).
9. KEEP: `docs/plans/redis-caching-strategy-plan.md` (owner follow-ups open; trim later, see Backlog), `docs/plans/playwright-e2e-testing-plan.md`, `docs/e2e/*`, `docs/product/*`, `docs/SEO-AUDIT.md`, `.github/pull_request_template.md`, this plan file.
Acceptance criteria:
- [ ] `git ls-files docs cotext.md` lists exactly: `docs/KNOWN-ISSUES.md`, `docs/SEO-AUDIT.md`, `docs/context/00-INDEX.md` through `06-conventions.md` (7 files), `docs/e2e/payment-settings-cod-fee-flows.md`, `docs/product/FEATURE-GAPS.md`, `docs/product/SCALE-UP-TODO.md`, `docs/plans/playwright-e2e-testing-plan.md`, `docs/plans/redis-caching-strategy-plan.md`, `docs/plans/perf-waterfall-and-docs-cleanup-plan.md`; `cotext.md`, `docs/PROJECT_GUIDE.md`, `docs/issues/*` and the 4 executed plans are gone.
- [ ] `git grep -nE "docs/issues|cotext\.md|PROJECT_GUIDE|checkout-concurrency-plan|admin-payment-methods-cod-fee-plan|post-review-structural-cleanup-plan|dev-environment-setup-plan|\.claude/PRPs" -- ':!docs/plans/perf-waterfall-and-docs-cleanup-plan.md' ':!docs/plans/redis-caching-strategy-plan.md'` returns 0 matches.
- [ ] Every relative markdown link in README, CLAUDE.md and `docs/**/*.md` resolves to an existing file (a short script or `git grep` pass lists 0 broken links).
- [ ] `.env.example` contains both `UPSTASH_REDIS_REST_URL=` and `UPSTASH_REDIS_REST_TOKEN=` and `npm run build` still boots without them set.
- [ ] Each stale claim listed in steps 2-6 is rewritten and checked against code: for each, the executor records the file:line it verified (for example `src/server/common/mailer.ts` for the Resend claim) in the progress notes.
- [ ] `docs/context/02-architecture.md` contains a "Caching / ISR" section that names `src/lib/listing-rewrites.ts`, `/live/*`, `src/app/api/_lib/revalidate.ts`, `src/server/common/cache.ts`, and states the ISR revalidate values 60/60/120/120.
- [ ] `docs/KNOWN-ISSUES.md` exists, every item names its code location, and none of its items is already fixed (executor spot-checks 5 items against code).
- [ ] `README.md` and `CLAUDE.md` contain no mention of `cotext.md`, `docs/issues`, "critical payment-callback forgery", or "known flaws" links to deleted files.
- [ ] No source file (`src/**`, `prisma/**`, `package.json`) changes in this phase except `.env.example` (`git diff --stat` check).

### Phase 6: Cross-Validation (always last)
Steps: (1) `npm run typecheck && npm test && npm run build` (tests need the local DB on 5433 per `dev`'s guard); (2) `ecc:verification-loop`; (3) on a Vercel preview with Redis off then on: logged-out and logged-in walks through home, category, filter, search typing, PDP, reviews, cart panel, login (credentials and Google), logout, checkout (COD); (4) reconcile every criterion above; (5) one final `code-review` + `ecc:security-review` over the full diff; (6) re-measure Phase 0 numbers and record the before/after table.
Acceptance criteria:
- [ ] All three commands exit 0; test count is not lower than before; no new skipped tests.
- [ ] Vercel log export for one logged-out session `/` -> category -> PDP shows 0 `/api/auth/session`, 0 `/api/cart`, 0 `/api/reviews` function runs and at most 6 total function invocations (baseline ~20+ before the Redis/ISR work, 3 session/cart/review calls per page after it).
- [ ] Logged-in session: at most 1 `/api/auth/session` per full page load and 0 full `GET /api/cart` until the panel opens.
- [ ] A review submitted on a preview appears on the PDP after one reload; an admin price edit appears on the PDP immediately (revalidate paths unchanged).
- [ ] Redis off: every flow above completes with no 5xx; Redis on: no `after`/`defer` errors in the log and cache hit behavior unchanged (listing repeat requests still HIT).
- [ ] Final code review and security review report no unresolved high/critical findings.
- [ ] A before/after table (invocations, Prisma ops, font bytes, home transferred bytes, LCP) is written into the plan's progress notes.

---

## 6. Backlog (no phases; each has a trigger)

| Item | Severity | Trigger / note |
|---|---|---|
| Payment callback read-then-write race and double restock; late SUCCEEDED can revive a cancelled order (`src/server/payments/payments.service.ts:112-198`) | High | Fix BEFORE re-enabling bKash/SSLCommerz online payments |
| Coupon `usedCount` not released on most cancel paths (`src/server/orders/orders.service.ts:56-79`) | Medium | Before running coupon campaigns |
| Admin `updateProduct` overwrites stock with the form value (`src/server/catalog/catalog.service.ts` ~:401) | Medium | When more than one person edits products |
| Price sort only sorts within the page; `minPrice` dropped when `maxPrice` set (`catalog.service.ts` ~:529-530, :654-717) | Medium | Before price filters are advertised |
| Admin lists unpaginated; analytics aggregated in memory (`analytics.service.ts:46-64`) | Medium | When orders per month exceed a few hundred |
| `pg_trgm`/FTS for search (migration + GIN index) | Medium | Search latency complaints or catalog above ~2,000 SKUs |
| Rewrite rules 27 -> 3 (single regex `has` key) | Low | Only if a spike proves Next honors a regex in `key` on Vercel |
| Cold-start / auth bundle trimming (`/api/auth/session` 600 ms cold) | Low | After Phases 1-2 measurements |
| Trim `docs/plans/redis-caching-strategy-plan.md` to a short "Caching decisions" doc | Low | After the Redis plan's owner follow-ups are recorded |
| Product PUT/DELETE and review POST extra lookups; cache `this` binding; shared test helpers | Low | Opportunistic |
| Vercel Hobby -> Pro | Owner | Before real launch (non-commercial and invocation cap) |

## 7. Out of scope (deliberate)
- All backlog items above; `SCALE-UP-TODO.md` roadmap features; server-side `auth()` session provisioning; `@vercel/functions`; moving `memoryStore` out of production code; changing checkout/payment code.
- Shortcuts taken: auth hint is a localStorage flag, not a cookie (limit: a stale hint costs one extra session call; upgrade to a server-set non-httpOnly cookie if Google-login flash becomes a complaint; the OAuth landing-route fetch in Phase 2 is required either way); search preview cache is per tab and in memory (limit: no cross-tab sharing; upgrade to TanStack Query if more client caching is needed); memory limiter state is per instance (limit: effective cap is `max x instances`; upgrade only if abuse shows up with Redis on).

## 8. Rollback
Each phase is one commit: `git revert <sha>`. Phase 5 deletions are recoverable from git history (`git show <sha>^:<path>`). Abandon entirely: delete the execution branch (or worktree). No migrations, no data changes.

## Execution Progress
(empty, filled by `supercharged-executor`)
