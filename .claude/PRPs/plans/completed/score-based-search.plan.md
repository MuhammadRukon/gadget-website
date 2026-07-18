# Plan: Score-Based Product Search

## Summary
Replace the strict substring product search (`contains` on name/description) with relevance-scored ranking. A pure TypeScript scoring module ranks candidates by weighted field matches (name > SKU > brand > description), with prefix/whole-word bonuses, light typo tolerance, and popularity/recency tiebreaks. Results are ranked whenever `q` is present — header preview, `/products?q=`, brand and category pages all benefit with zero frontend changes.

## User Story
As a shopper, I want search results ordered by how well they match my query (best match first, tolerant of small typos), so that I find the product I mean instead of a raw newest-first substring dump.

## Problem → Solution
**Current**: `buildPublicProductWhere` builds `OR [name contains q, description contains q]` (case-insensitive), then results are ordered by `createdAt desc`. A query "iphone" ranks a new accessory whose *description* mentions iPhone above the actual iPhone product. Typos ("ipohne") return nothing. Brand names and SKUs are not searched at all.

**Desired**: When `q` is present, candidates are fetched with the non-q filters (status/brand/category/stock/price), scored in the service layer against name, brand name, variant SKUs, and description with weighted heuristics + fuzzy token matching, filtered to score > 0, sorted by score (desc), and paginated in memory. Explicit `sort=price_asc|price_desc` still overrides relevance order.

## Metadata
- **Complexity**: Medium
- **Source PRD**: N/A
- **PRD Phase**: N/A (standalone; TODO markers at `src/hooks/use-header-search-preview.ts:3` and `src/app/components/header/header.tsx:52`)
- **Estimated Files**: 6 (2 create, 4 update)

---

## UX Design

### Before
```
Header search "ipohne pro"
┌────────────────────────────────┐
│ No products found              │   ← typo = zero results
└────────────────────────────────┘

Header search "iphone"
┌────────────────────────────────┐
│ USB-C Cable (desc mentions     │   ← newest first, not best first
│   iPhone)                      │
│ iPhone 15 Pro                  │
│ ...                            │
└────────────────────────────────┘
```

### After
```
Header search "ipohne pro"
┌────────────────────────────────┐
│ iPhone 15 Pro        ৳ 145,000 │   ← fuzzy token match ranks it
│ iPhone 15 Pro Max    ৳ 165,000 │
└────────────────────────────────┘

Header search "iphone"
┌────────────────────────────────┐
│ iPhone 15 Pro        (name)    │   ← name matches outrank
│ iPhone 15            (name)    │      description matches
│ USB-C Cable          (desc)    │
└────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Header preview dropdown | Substring, newest-first | Score-ranked, best-first, typo-tolerant | No component changes; ordering comes from API |
| `/products?q=` page | Same substring behavior | Score-ranked when no explicit sort | `sort=price_asc/desc` still wins |
| Brand / category pages with `q` | Substring within filter | Score-ranked within filter | Non-q filters unchanged |
| Empty / no-match query | "No products found" | Same, but only when score is 0 everywhere | |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/server/catalog/catalog.service.ts` | 405-534 | `buildPublicProductWhere` + `listPublicProducts` — the code being changed; note the existing in-memory price sort at 496-508 (precedent for in-memory ranking) |
| P0 | `src/contracts/catalog.ts` | 105-139 | `productListQuerySchema`, `PublicProductSummary`, `PublicProductPage` — response contract must not change |
| P1 | `src/app/api/catalog/products/route.ts` | all | Route stays untouched; understand `revalidate = 60` caching |
| P1 | `prisma/schema.prisma` | 136-199 | `Product`, `ProductVariant` (sku), `Brand` (name) fields available for scoring |
| P2 | `src/server/orders/__tests__/orders.service.test.ts` | 1-30 | Live-DB test convention (no Prisma mocking exists in repo) — only needed if writing the optional integration test |
| P2 | `src/hooks/use-header-search-preview.ts` | all | Consumer of the API; remove TODO at line 3 |
| P2 | `src/app/components/header/header.tsx` | 50-53 | Remove TODO at line 52 |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| — | — | No external research needed — pure TypeScript scoring over existing Prisma queries; no new dependencies |

---

## Patterns to Mirror

### SERVICE_OBJECT_PATTERN
```ts
// SOURCE: src/server/catalog/catalog.service.ts:69, 433
export const catalogService = {
  async listPublicProducts(query: ProductListQuery): Promise<PublicProductPage> {
```
Services are plain exported object literals with async methods; helpers are module-level functions above the object (`pricingFromVariant`, `ensureUniqueSkus`).

### IN_MEMORY_SORT_PRECEDENT
```ts
// SOURCE: src/server/catalog/catalog.service.ts:496-508
const sortedRows =
  sort === 'newest'
    ? rows
    : [...rows].sort((a, b) => {
        const aPrice = a.variants[0]?.sellingPriceCents ?? Number.POSITIVE_INFINITY;
        ...
        return sort === 'price_asc' ? aPrice - bPrice : bPrice - aPrice;
      });
```
The service already sorts fetched rows in memory. Score ranking follows the same shape.

### QUERY_SCHEMA_PATTERN
```ts
// SOURCE: src/contracts/catalog.ts:105-115
export const productListQuerySchema = z.object({
  q: z.string().optional(),
  ...
  sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
});
```
Zod v4 (`z.enum(PublishStatus)` object-enum style elsewhere). Query params coerced with `z.coerce`.

### DOC_COMMENT_PATTERN
```ts
// SOURCE: src/server/catalog/catalog.service.ts:405-408
/**
 * Build the Where clause for a public product query, sharing the
 * status filter, full-text search, and category/brand selection.
 */
```
JSDoc block comments on non-obvious service methods explaining the "why".

### TEST_STRUCTURE (unit — for the pure scoring module)
```ts
// SOURCE: src/server/common/__tests__/rate-limit.test.ts (structure), vitest across repo
import { describe, expect, it } from 'vitest';

describe('thing', () => {
  it('does X', () => {
    expect(fn(input)).toBe(expected);
  });
});
```
Tests live in `__tests__/` next to the module. Scoring module is pure — no DB, no mocks needed (avoids the repo's no-Prisma-mocking gap entirely).

### ERROR_HANDLING
No new error paths introduced. Bad query params already rejected by `productListQuerySchema.parse` → `jsonError(err)` in the route (SOURCE: `src/app/api/catalog/products/route.ts:12-16`). Scoring is pure and cannot throw on valid rows.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/server/catalog/search-score.ts` | CREATE | Pure scoring module: tokenizer, fuzzy token match, weighted field scorer |
| `src/server/catalog/__tests__/search-score.test.ts` | CREATE | Unit tests for scoring (pure, no DB) |
| `src/server/catalog/catalog.service.ts` | UPDATE | Ranked path in `listPublicProducts` when `q` present; widen candidate `where` to include brand name + variant SKU |
| `src/contracts/catalog.ts` | UPDATE | (Optional, only if needed) — see Task 3; default is NO change |
| `src/hooks/use-header-search-preview.ts` | UPDATE | Remove `//TODO: add score based search.` (line 3) |
| `src/app/components/header/header.tsx` | UPDATE | Remove `//TODO: add score based search.` (line 52) |

## NOT Building

- **Postgres full-text search (`tsvector`/`ts_rank`) or `pg_trgm`** — rejected for now: requires migration + raw SQL (`$queryRaw` exists only in cart.service.ts, not for querying), and catalog size doesn't justify it. Revisit if catalog grows past ~5,000 products.
- **New search endpoint** — existing `/api/catalog/products?q=` keeps its contract; response shape (`PublicProductPage`) unchanged.
- **Frontend UI changes** — no highlighting of matched terms, no "did you mean", no score display. Preview panel renders whatever order the API returns.
- **Search analytics / query logging**.
- **Category name matching** — products link to categories via join table; scoring covers name/brand/SKU/description only. Category browsing already exists via category pages.
- **Debounce/limit changes in the hook** — 400ms / limit 8 stay as is.

---

## Step-by-Step Tasks

### Task 1: Create pure scoring module
- **ACTION**: Create `src/server/catalog/search-score.ts`.
- **IMPLEMENT**:
  ```ts
  /**
   * Pure relevance scoring for public product search. Kept free of Prisma
   * so it can be unit-tested without a database.
   */

  export interface SearchCandidate {
    name: string;
    brandName: string;
    skus: string[];
    description: string;
    isPopular: boolean;
    createdAt: Date;
  }

  const WEIGHTS = {
    nameExact: 100,
    namePrefix: 80,
    nameWordPrefix: 60,
    nameContains: 40,
    nameFuzzyToken: 30,
    skuExact: 70,
    skuPrefix: 50,
    brandExact: 45,
    brandContains: 25,
    descriptionContains: 10,
  } as const;

  export function normalize(s: string): string          // lowercase, trim, collapse whitespace
  export function tokenize(s: string): string[]          // normalize then split on /[^a-z0-9]+/
  export function isFuzzyTokenMatch(token: string, word: string): boolean
    // Levenshtein distance <= 1 for tokens of length >= 4 (single-row DP, early exit);
    // exact match required for shorter tokens. Bounded O(len*len), inputs are single words.
  export function scoreProduct(query: string, candidate: SearchCandidate): number
  ```
  `scoreProduct` logic:
  1. `normalize` query and name. Exact name equality → `nameExact`; name starts with query → `namePrefix`; any name word starts with the full query → `nameWordPrefix`; name contains query as substring → `nameContains`. Take the **highest** name bracket, not the sum.
  2. Tokenize query. For each query token, check name words: exact/prefix hit already covered above; else fuzzy hit adds `nameFuzzyToken` (once per token). Multiply the summed token score by coverage ratio (`matchedTokens / totalTokens`) so "iphone pro" matching both words beats one.
  3. SKU: any sku (normalized) equal to query → `skuExact`; sku starts with query → `skuPrefix`.
  4. Brand: equality → `brandExact`; contains → `brandContains`.
  5. Description contains query → `descriptionContains` (flat, no per-token fuzz — keeps noise down).
  6. Sum brackets from 1-5 (name bracket + token bonus + sku + brand + description). Return 0 if nothing matched.
  Also export a comparator helper:
  ```ts
  export function compareScored<T extends { score: number; isPopular: boolean; createdAt: Date }>(a: T, b: T): number
  // score desc, then isPopular (true first), then createdAt desc
  ```
- **MIRROR**: Module-level pure helpers like `pricingFromVariant` (catalog.service.ts:28-39); JSDoc block per DOC_COMMENT_PATTERN.
- **IMPORTS**: None (pure module — no Prisma, no zod).
- **GOTCHA**: Do NOT import `@prisma/client` here — keeping it dependency-free is what makes the tests trivial. Levenshtein must be length-guarded (`Math.abs(a.length - b.length) > 1 → false`) before running DP.
- **VALIDATE**: `npm run typecheck` — zero errors.

### Task 2: Wire ranked path into `listPublicProducts`
- **ACTION**: Update `src/server/catalog/catalog.service.ts`.
- **IMPLEMENT**:
  1. In `buildPublicProductWhere` (line 409), widen the `q` OR-clause so the candidate set includes brand-name and SKU matches (needed because scoring can only rank rows the DB returns):
     ```ts
     if (query.q) {
       const terms = candidateTerms(query.q); // [q, ...tokens(q).filter(t => t.length >= 3).map(t => t.slice(0, 4))], deduped via Set
       where.OR = [
         { description: { contains: query.q, mode: 'insensitive' } },
         ...terms.flatMap((t) => [
           { name: { contains: t, mode: 'insensitive' } },
           { brand: { is: { name: { contains: t, mode: 'insensitive' } } } },
           { variants: { some: { sku: { contains: t, mode: 'insensitive' } } } },
         ]),
       ];
     }
     ```
     The 4-char prefix trick catches *trailing* typos ("iphonr" → term "ipho" matches "iphone"). Internal typos ("ipohne") are caught only when the row is already a candidate via another term (brand/sku/other token). Document this limitation in the JSDoc.
  2. In `listPublicProducts` (line 433), branch on `query.q`:
     - **No q** → existing code path, untouched.
     - **With q** → fetch candidates with the widened `where`, `take: MAX_SEARCH_CANDIDATES` (module const `500`), **no skip**, same `select` as today PLUS `description: true` and variant `sku` (see GOTCHA on the variants select). Then:
       ```ts
       const scored = rows
         .map((row) => ({
           row,
           score: scoreProduct(query.q!, {
             name: row.name,
             brandName: row.brand.name,
             skus: row.variants.map((v) => v.sku),
             description: row.description,
             isPopular: row.isPopular,
             createdAt: row.createdAt,
           }),
         }))
         .filter((s) => s.score > 0);
       ```
       Sort: if `sort` is `price_asc`/`price_desc`, keep the existing price comparator (explicit user intent wins); otherwise (`newest` default or unset) sort with `compareScored`. Paginate in memory: `total = scored.length`, `items = scored.slice(skip, skip + pageSize)` mapped through the existing `PublicProductSummary` builder.
  3. Keep the min/max price variant-merge block (lines 441-453) exactly as today — it writes `where.variants` (top-level), which composes as AND with `where.OR`.
  4. Add JSDoc on the branch: relevance ranking is in-memory over max 500 candidates; Postgres FTS/pg_trgm is the upgrade path.
- **MIRROR**: IN_MEMORY_SORT_PRECEDENT (catalog.service.ts:496-508); `pricingFromVariant` mapping stays identical for building `PublicProductSummary`.
- **IMPORTS**: `import { compareScored, scoreProduct } from './search-score';`
- **GOTCHA**:
  - The widened `where.OR` includes `variants: { some: { sku } }` entries while the price-filter block ALSO writes `where.variants` — different keys (`OR` array entries vs top-level `variants`), so they compose correctly as AND(OR(...), variants-filter). Do NOT move the sku clause to top-level `variants` or it collides with the price merge.
  - The existing `variants` select (`where: { isActive: true }, take: 1, orderBy: { sellingPriceCents: 'asc' }`) feeds pricing. SKU scoring needs ALL active skus — on the **q branch only**, drop `take: 1` and add `sku: true` to the select; keep the same `orderBy` and use `variants[0]` for pricing (identical lowest-price semantics), `variants.map(v => v.sku)` for scoring. No-q branch keeps `take: 1`.
  - `total` semantics change on the q path: "candidates with score > 0" capped at 500. The header's "View all N results" link reads it dynamically — acceptable and more truthful than the substring count.
  - `revalidate = 60` on the route caches per-URL; q is in the query string so each query caches separately. No change needed.
- **VALIDATE**: `npm run typecheck && npm run test` — zero errors, existing tests pass.

### Task 3: Contract check (expected: no change)
- **ACTION**: Confirm `src/contracts/catalog.ts` needs no edits.
- **IMPLEMENT**: `PublicProductPage` / `PublicProductSummary` shapes unchanged; `productListQuerySchema` unchanged (relevance is implicit when `q` present, not a new `sort` value — keeps the enum stable for the existing UI sort dropdown). Only touch this file if a `SearchCandidate` type export in contracts is preferred during implementation — default is keep it in `search-score.ts`.
- **MIRROR**: N/A.
- **GOTCHA**: Do NOT add `'relevance'` to the `sort` enum unless the products-page sort dropdown is also updated to offer it — out of scope.
- **VALIDATE**: `npm run typecheck`.

### Task 4: Unit tests for scoring
- **ACTION**: Create `src/server/catalog/__tests__/search-score.test.ts`.
- **IMPLEMENT**: Pure vitest tests (no DB, no mocks) per TEST_STRUCTURE. Cover the table in Testing Strategy below. Build a small `candidate()` factory returning a `SearchCandidate` with overridable fields.
- **MIRROR**: TEST_STRUCTURE; `describe`/`it`/`expect` from vitest as elsewhere in the repo.
- **IMPORTS**: `import { describe, expect, it } from 'vitest';` and the scoring exports.
- **GOTCHA**: Assert *relative ordering* (scoreA > scoreB), not absolute score numbers — keeps tests stable when weights are tuned.
- **VALIDATE**: `npm run test` — new tests pass.

### Task 5: Remove TODO markers
- **ACTION**: Delete `//TODO: add score based search.` from `src/hooks/use-header-search-preview.ts:3` and `src/app/components/header/header.tsx:52`.
- **IMPLEMENT**: Comment removal only; no logic changes in either file.
- **MIRROR**: N/A.
- **GOTCHA**: header.tsx line 52 sits directly above the `useHeaderSearchPreview()` call — remove only the comment line.
- **VALIDATE**: `npm run lint`.

### Task 6 (optional, recommended): Live-DB integration test
- **ACTION**: Add a `listPublicProducts` ranking case in new `src/server/catalog/__tests__/catalog.service.test.ts`.
- **IMPLEMENT**: Follow the orders.service.test.ts live-DB convention exactly (header comment, randomized suffix fixtures, cleanup arrays + `afterEach`, `TEST_TIMEOUT = 60_000`). Create two PUBLISHED products with a unique random term X in play: "X Phone Pro" (name match) and "X Cable" with description containing X (description-weaker match). Assert `listPublicProducts({ q: X })` returns the name-match first and pricing/inStock fields intact.
- **MIRROR**: `src/server/orders/__tests__/orders.service.test.ts:1-30` fixture + cleanup pattern.
- **GOTCHA**: Products default to `status: DRAFT` (schema line 142) — fixtures must set `status: 'PUBLISHED'` explicitly or the public query returns nothing. Use unique random suffixes in names/queries so leftover data can't collide.
- **VALIDATE**: `npm run test` against DATABASE_URL.

---

## Testing Strategy

### Unit Tests (search-score.test.ts)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| Exact name beats prefix | q="iphone 15", names "iPhone 15" vs "iPhone 15 Pro" | exact scores higher | |
| Name match beats description match | q="iphone", name "iPhone 15" vs desc-only "…for iPhone" | name candidate higher | |
| SKU prefix match scores | q="IP15", skus ["IP15-BLK"] | score > 0 | |
| Brand match scores | q="apple", brandName "Apple" | score > 0 | |
| Fuzzy: single-char typo matches | q="iphonr", name "iPhone 15" | score > 0 via fuzzy token | ✓ |
| Fuzzy: short tokens require exact | q="ipd" vs word "ipad" | no fuzzy credit (len < 4) | ✓ |
| Multi-token coverage | q="iphone pro", "iPhone 15 Pro" vs "iPhone 15" | full coverage scores higher | |
| No match returns 0 | q="samsung", candidate all-Apple | 0 | ✓ |
| Empty query | q="" | 0 | ✓ |
| Case/whitespace insensitive | q="  IPHONE  " | same as "iphone" | ✓ |
| Comparator tiebreaks | equal scores, one isPopular | popular first, then newest | ✓ |
| Unicode/Bangla input doesn't throw | q="ফোন" | number ≥ 0, no throw | ✓ |

### Edge Cases Checklist
- [x] Empty input (q="" → hook never fires empty q; service takes no-q path)
- [x] Long query (tokenizer splits naturally; Levenshtein length-guarded)
- [x] Invalid types (zod coercion at route boundary, unchanged)
- [x] Page beyond results (slice returns [], total honest)
- [ ] Concurrent access — N/A, read-only pure function
- [x] q + brandSlug/categorySlug/inStock/minPrice combos (filters compose; scoring within filtered set)

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: Zero type errors

### Lint
```bash
npm run lint
```
EXPECT: Zero errors

### Unit Tests
```bash
npx vitest run src/server/catalog
```
EXPECT: All scoring tests pass

### Full Test Suite
```bash
npm run test
```
EXPECT: No regressions (note: orders/payments/rate-limit tests hit DATABASE_URL — need a reachable dev DB)

### Browser Validation
```bash
npm run dev
```
EXPECT: Header search — typing a product name shows best matches first; a trailing typo in a ≥4-char word still finds the product; "View all N results" count matches ranked total; `/products?q=…&sort=price_asc` still sorts by price.

### Manual Validation
- [ ] Header preview: exact product name → that product first
- [ ] Typo ("iphonr") → still finds iPhone products
- [ ] Brand name query ("apple") → brand's products surface
- [ ] SKU fragment query → matching variant's product surfaces
- [ ] Category page + q → ranked within category only
- [ ] Price sort with q still price-ordered
- [ ] Empty results state renders "No products found"

---

## Acceptance Criteria
- [ ] Search results ordered by relevance score when `q` present (name > SKU > brand > description)
- [ ] Single-character typos in tokens ≥ 4 chars still match at scoring level
- [ ] Explicit price sorts override relevance ordering
- [ ] `PublicProductPage` response shape unchanged — zero frontend edits beyond TODO removal
- [ ] All validation commands pass
- [ ] Both TODO markers removed

## Completion Checklist
- [ ] Scoring module pure (no Prisma import)
- [ ] Weights in one `WEIGHTS` const, JSDoc'd
- [ ] No-q path byte-identical behavior to today
- [ ] Tests assert ordering, not magic numbers
- [ ] Candidate cap (500) documented in JSDoc with FTS upgrade note
- [ ] No new dependencies

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| In-memory ranking degrades on large catalogs | Low (small shop) | Medium | `MAX_SEARCH_CANDIDATES = 500` cap; JSDoc names Postgres FTS/pg_trgm as upgrade path |
| Widened candidate `where` (token prefixes) returns noisy candidate sets | Medium | Low | Score filter (`> 0`) drops noise before response; cap bounds the fetch |
| Internal-typo queries ("ipohne") miss candidates the DB never returned | Medium | Low | Documented limitation; brand/sku/other-token routes usually still surface the row; FTS upgrade fixes fully |
| `total` semantics change breaks "View all N results" expectations | Low | Low | New total is more accurate (score-filtered); UI reads it dynamically |
| Widened variants select on q path changes pricing pick | Low | Medium | Keep `orderBy sellingPriceCents asc` and use `variants[0]` — identical lowest-price semantics; assert in integration test |

## Notes
- Alternatives considered: (a) Postgres `tsvector`+`ts_rank` — best long-term, but needs migration, raw SQL, and English-stemming config that fits Bangla product names poorly; (b) `pg_trgm` similarity — great typo tolerance but requires the extension (may not be enabled on managed DB) and raw SQL; (c) client-side scoring in the hook — rejected: would only reorder the 8 preview items the API already picked, not fix retrieval. App-level service scoring chosen: zero migrations, fully unit-testable, honest upgrade path.
- The `sort` enum deliberately does NOT grow a `relevance` value; relevance is the implicit default whenever `q` is present and no price sort is chosen. This keeps the `CommonListPage` sort dropdown untouched.
