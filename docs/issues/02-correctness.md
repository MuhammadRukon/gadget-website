# Correctness & Data-Integrity Flaws

## 1. HIGH — Stock oversell race in checkout

**Evidence**: `src/server/checkout/checkout.service.ts:150-261` — the transaction reads `variant.stock`, validates, then unconditionally `stock: { decrement: quantity }` (line ~257). Under Postgres READ COMMITTED, two concurrent checkouts of the last unit both pass validation and both decrement → negative stock / oversell.

**Fix**: conditional decrement and assert the row count:
```ts
const res = await tx.productVariant.updateMany({
  where: { id: variantId, stock: { gte: quantity } },
  data: { stock: { decrement: quantity } },
});
if (res.count !== 1) throw new ConflictError('Insufficient stock');
```

## 2. HIGH — Coupon usage-limit race

**Evidence**: `src/server/coupons/coupons.service.ts:116` checks `usedCount >= usageLimit` while `checkout.service.ts:264-268` increments later; `perUserLimit` is checked via a racy `order.count` (coupons.service.ts:123). Concurrent checkouts can exceed both limits.

**Fix**: same conditional-update pattern — `updateMany({ where: { id, OR: [{ usageLimit: null }, { usedCount: { lt: usageLimit } }] }, data: { usedCount: { increment: 1 } } })` inside the checkout transaction.

## 3. MEDIUM — Stock leaks on abandoned online payments

**Evidence**: `placeOrder` decrements stock for ALL payment methods at order creation; `payments.service.ts:145` (FAILED/CANCELLED branch) explicitly does not restock, and nothing expires PENDING orders.

**Impact**: every abandoned bKash/SSLCommerz/bank-transfer checkout permanently holds inventory until someone manually cancels.

**Fix (free-tier friendly)**: restock on FAILED/CANCELLED callbacks, plus an expiry sweep for stale PENDING orders (Vercel cron hitting an internal route once/hour is free, or run the sweep lazily inside the admin orders list load).

## 4. MEDIUM — Order status transitions unvalidated

**Evidence**: `src/server/orders/orders.service.ts` `transition()` accepts any status → any status (DELIVERED → PENDING, CANCELLED → SHIPPED…). The admin UI offers all statuses unconditionally. Admin cancel does not restock (customer self-cancel does).

**Fix**: encode a transition map (`PENDING → CONFIRMED|CANCELLED`, etc.) and reject invalid moves; decide restock policy for admin cancels explicitly.

## 5. MEDIUM — Price sort only sorts the current page

**Evidence**: `src/server/catalog/catalog.service.ts:455` always orders by `createdAt desc` in SQL, paginates, then sorts the fetched page in memory by price (lines 496-508). Page 2 of a price-sorted listing is meaningless.

**Fix**: sort in SQL. Requires a derived "effective price" — either store a denormalized `minPriceCents` on Product, or order by a subquery/aggregate on variants.

## 6. MEDIUM — Coupon validation inside checkout tx doesn't use the tx client

**Evidence**: `checkout.service.ts:183-188` re-runs `couponsService.validate` "inside the transaction to lock in usedCount", but `validate` uses the global `prisma`, not `tx` — the read is outside the transaction's isolation scope; the comment's claimed lock doesn't exist.

**Fix**: pass the `tx` client through (make services accept an optional `db = prisma` parameter).

## 7. MEDIUM — Payment kickoff failure orphans the order

**Evidence**: `src/app/api/checkout/route.ts:17-20` — order is committed, then `paymentsService.kickoff` runs. If the gateway init throws (network error), the customer gets a 500 while the order + stock decrement persist as an orphan PENDING order with no retry path.

**Fix**: catch kickoff failure and either cancel+restock the order, or return the order id with a "retry payment" affordance (needs a retry endpoint).

## 8. LOW — Warranty transitions discard the acting admin

**Evidence**: `src/server/warranty/warranty.service.ts:71` — `void adminId;`. No audit trail for warranty decisions, unlike orders/payments.

## 9. LOW — Category tree has no cycle check

**Evidence**: category update accepts any `parentId` without validating against self/descendants → a cycle would break tree traversal.

## 10. LOW — Negative-margin variants allowed

**Evidence**: product form/contract accepts `buyingPriceCents > sellingPriceCents` with no warning; profit analytics silently go negative.

## 11. LOW — Env var naming drift

**Evidence**: `src/app/sitemap.ts:8` / `robots.ts:5` read `NEXT_PUBLIC_APP_URL`, but `.env` defines `NEXT_PUBLIC_BASE_URL`. Works today only because of the `NEXTAUTH_URL` fallback. Pick one name; add central env validation (a zod-parsed `env.ts`) so half-configured deploys fail loudly instead of silently falling back (this is also what makes the sandbox payment bypass dangerous).

## 12. LOW — `sitemap.ts` conflicting route config

**Evidence**: `src/app/sitemap.ts:12-13` declares both `revalidate = 3600` and `dynamic = 'force-dynamic'`; force-dynamic wins, so the sitemap hits the DB on every request. Drop `force-dynamic`.
