# Plan: checkout and cancel concurrency hardening

## Summary

Audit of the order flow found one safe guard and three real races.

- **Safe:** stock cannot go negative via checkout. The decrement is an atomic conditional `updateMany`.
- **Double-submit:** there is no idempotency. One user's concurrent duplicate POSTs can create two orders.
- **Per-user coupon limit:** racy (unlocked read-then-act).
- **Cancel paths:** status is read unlocked, then written unconditionally. Concurrent cancels double-restock stock.
- **Loser error UX:** the losing user gets inconsistent 400, 409 or 422 errors, and the UI never refreshes the cart.

**Goal:** under concurrency, exactly one of any competing requests wins. Stock and coupon counts stay exact. The loser gets a clear 409 naming the item, and the UI refetches the cart. No schema migration.

## Context & findings

- `placeOrder` ([checkout.service.ts:152-343](../../src/server/checkout/checkout.service.ts)): the atomic stock decrement at L271-279 is correct and is kept. The cart read at L154 is unlocked. The `cartItem.deleteMany` at L311 has its result ignored.
- Stock-error status codes today:
  - L176/179 and L225 throw `ValidationError` (422).
  - L277 throws `ConflictError` (409).
  - L172 throws `BadRequestError` (400).
- `ConflictError(message, meta)` returns `{ code, message, meta }` with status 409 ([errors.ts:54-91](../../src/server/common/errors.ts), [http.ts:65](../../src/server/common/http.ts)). `ApiClientError` exposes `.status` and `.payload.meta` ([fetcher.ts:12-62](../../src/lib/fetcher.ts)).
- Per-user coupon check: unlocked `order.count` at [coupons.service.ts:124-131](../../src/server/coupons/coupons.service.ts).
- Unconditional status writes after an unlocked read:
  - [orders.service.ts:97-104](../../src/server/orders/orders.service.ts) (`cancelByCustomer`)
  - [orders.service.ts:138-145](../../src/server/orders/orders.service.ts) (`transition`)
  - [checkout.service.ts:357-373](../../src/server/checkout/checkout.service.ts) (`cancelOrphanedOrder`, which also decrements `usedCount` unconditionally)
- UI: [checkout-client.tsx:89-118](../../src/modules/checkout/components/checkout-client.tsx) has a state-only double-click guard and no `meta` or status handling. It has no cart invalidation, and `submitting` is reset before navigation finishes.
- Tests run against the live `DATABASE_URL` DB, using a random-suffix fixture pattern with `afterEach` cleanup. See [orders.service.test.ts](../../src/server/orders/__tests__/orders.service.test.ts). No `placeOrder`, coupon or `cancelOrphanedOrder` tests exist, and no fixture builds a Cart. Vitest runs in node with no jsdom, so UI logic must be tested as pure functions.
- Reuse: `ConflictError`, `restockOrderItems` ([orders.service.ts:20](../../src/server/orders/orders.service.ts)), `queryKeys.cart` (prefix-invalidates `cartSummary`), and the existing fixture pattern.

**Key design:** consume the cart at the start of the transaction.

- `deleteMany` the exact item ids that were read, and throw `ConflictError` if the count differs.
- A concurrent second `placeOrder` for the same user blocks on the row lock, then sees 0 rows and aborts before coupon validation.
- This fixes the double-submit and the per-user coupon race with no lock primitive and no migration.

## Constraints, assumptions, risks

- **Assumption:** Postgres runs at default READ COMMITTED. The plan relies on row-lock-then-recheck semantics of `UPDATE`/`DELETE`. Verified by the race tests.
- **Risk:** race tests hit the real `DATABASE_URL` DB. **Precondition:** confirm it is a dev DB, never prod (owner: executor, before first run). Fixtures are random-suffixed and cleaned up.
- **Risk:** flaky concurrency tests. Mitigation: assert invariants (exactly one winner, exact stock, exact counts), never which caller wins. The Cross-Validation phase reruns them several times.
- **Risk:** hosted-Postgres connection limits or the 5s interactive-transaction timeout when the loser waits on a lock. Mitigation: tests use only 2 concurrent callers. Raise the timeout only if the tests show it is needed.
- **Accepted:** a cart quantity edit racing with checkout can produce an order at the quantity read a moment earlier. The stock guard still applies and the user sees the order summary.

## Workspace setup

Plain branch in the current directory. Base: `main`. Branch: `fix/checkout-concurrency`. The PR target is `dev`, opened by hand per git-hygiene. No commits to `main` or `dev`. Commit per phase, stage specific files, and use messages like `test(checkout): ...` then `fix(checkout): ...`.

**Skills the executor invokes:**

- `ecc:tdd-workflow` for the failing race tests first in every phase.
- `ecc:prisma-patterns` for conditional `updateMany` idioms.
- `ecc:verification-loop` and `run` in the final phase.
- `ecc:code-review` once, in the final phase only.
- `git-hygiene` for branch and commit conventions.

## Phase 1: checkout server (fixtures, race tests, cart guard, 409 meta)

**Scope:**

- `src/server/checkout/checkout.service.ts`
- New `src/server/checkout/__tests__/fixtures.ts`
- New `src/server/checkout/__tests__/checkout.service.test.ts`

**Steps:**

1. Write fixture `createCheckoutFixture({ stock, cartQty, couponPerUserLimit? })`. It creates a user, address, brand, PUBLISHED product, active variant, Cart plus CartItem, and an optional coupon. It returns the ids, and cleanup mirrors `orders.service.test.ts`.
2. Write the failing tests below (TDD red).
3. Right after the cart read, consume the cart with `tx.cartItem.deleteMany({ where: { id: { in: ids } } })`. Throw `ConflictError('Your cart changed, please review and try again')` if `count !== cartItems.length`. Remove the old delete at L311.
4. Convert the stock and unavailability throws at L176, L179, L225 and L277 to `ConflictError`, all with `meta: { variantId, productName, reason }`, where `reason` is `'insufficient_stock'` or `'unavailable'`.

**Acceptance criteria:**

- [ ] `checkout.service.test.ts`: two users each with qty 1 of one variant (stock 1), `Promise.all([placeOrder(u1), placeOrder(u2)])`. Exactly one fulfils and one rejects with `ConflictError`. The rejection has `meta.variantId` equal to the variant id and `meta.productName` equal to the product name. Final `variant.stock === 0` (never negative). Exactly 1 `Order` contains that variant.
- [ ] Same test: the loser's `CartItem` row still exists (rolled back) and the loser has no `Order`.
- [ ] Same user, cart qty 1, stock 5, `Promise.all([placeOrder(u, input), placeOrder(u, input)])`. Exactly one fulfils and one rejects with `ConflictError`. `Order.count({ userId }) === 1`. Final `stock === 4`. Cart is empty.
- [ ] Same user, coupon `perUserLimit: 1`, two concurrent `placeOrder`. `Order.count({ userId, couponId }) === 1` and `coupon.usedCount === 1`.
- [ ] Sequential: a second `placeOrder` after a successful one still rejects with `BadRequestError('Cart is empty')` (HTTP 400, unchanged).
- [ ] Sequential: cart qty greater than stock rejects with `ConflictError` whose `meta.variantId` and `meta.productName` are set. The HTTP status is 409 via `jsonError`, not 422.
- [ ] `npx vitest run src/server/checkout` passes. `npm run typecheck` is clean.

## Phase 2: cancel and transition paths (only the winner restocks)

**Scope:**

- `src/server/orders/orders.service.ts` (`cancelByCustomer`, `transition`)
- `src/server/checkout/checkout.service.ts` (`cancelOrphanedOrder`)
- Extend `src/server/orders/__tests__/orders.service.test.ts`
- Add `cancelOrphanedOrder` tests to `checkout.service.test.ts`

**Steps:**

1. Write the failing race tests (red).
2. Replace each unconditional `order.update` with `order.updateMany({ where: { id, status: <status read> }, data })`.
   - If `count !== 1`, `cancelByCustomer` and `transition` throw `ConflictError('Order status changed, refresh and retry')`.
   - `cancelOrphanedOrder` returns silently.
   - Restock, the `usedCount` decrement and the `OrderEvent` happen only after a successful update.
3. `transition` re-fetches the updated order inside the transaction (it needs `orderNumber`).

**Acceptance criteria:**

- [ ] Two concurrent `cancelByCustomer` on one PENDING order (qty 2, stock 5 after order). Exactly one fulfils and one rejects with `ConflictError`. Final `stock === 7` (restocked once). Exactly one `OrderEvent` with status CANCELLED.
- [ ] Concurrent `cancelByCustomer` and admin `transition(..., CANCELLED)`. Exactly one fulfils. `stock` increases by exactly `quantity`. Order status is CANCELLED.
- [ ] Concurrent `cancelByCustomer` and `transition(PROCESSING -> SHIPPED)` on a PROCESSING order. Exactly one fulfils. Final status is SHIPPED with stock unchanged, or CANCELLED with stock `+quantity`. The order never ends with both a SHIPPED and a CANCELLED event.
- [ ] Two concurrent `transition` calls to the same valid status. One fulfils, one rejects with `ConflictError`, and exactly one `OrderEvent` is written for it.
- [ ] Two concurrent `cancelOrphanedOrder` on one order with a coupon (`usedCount: 1`). Both resolve without throwing. Stock restored once. `coupon.usedCount === 0` (not -1). Exactly one CANCELLED `OrderEvent`.
- [ ] The 4 existing tests in `orders.service.test.ts` still pass. `npm run typecheck` is clean.

## Phase 3: checkout UI

**Scope:**

- `src/modules/checkout/components/checkout-client.tsx`
- New pure helper `src/modules/checkout/checkout-error.ts`
- New `src/modules/checkout/__tests__/checkout-error.test.ts`

**Steps:**

1. TDD the helper `describeCheckoutError(err): { message: string; refetchCart: boolean }`.
2. Add a `useRef` submit guard that blocks re-entry synchronously.
3. Reset `submitting` only on error, not on success before navigation.
4. On error, toast the helper's message and call `queryClient.invalidateQueries({ queryKey: queryKeys.cart })` when `refetchCart` is true.
5. On success, invalidate `queryKeys.cart` before navigating.

**Acceptance criteria:**

- [ ] `describeCheckoutError`: an `ApiClientError` with status 409 and `payload.meta.productName: 'Foo'` and `reason: 'insufficient_stock'` returns a message containing `"Foo"` and `refetchCart: true`.
- [ ] `describeCheckoutError`: 409 without meta returns the server `message` and `refetchCart: true`.
- [ ] `describeCheckoutError`: 400 `Cart is empty` returns `refetchCart: true`. A non-`ApiClientError` returns `'Could not place order'` and `refetchCart: false`.
- [ ] Manual (Phase 4): a synchronous double click on Place order sends exactly one `POST /api/checkout` (Network tab).
- [ ] Manual (Phase 4): with stock 1 and two signed-in browsers, the loser sees a toast naming the product, and the cart UI refetches and shows the line as unavailable, with the place-order button blocked via `cartHasIssues`.
- [ ] `npm run lint` and `npm run typecheck` are clean.

## Phase 4: Cross-Validation (final)

1. Confirm `DATABASE_URL` is a non-prod DB. Run `npm run test`, `npm run typecheck`, `npm run lint` and `npm run build`. All must pass.
2. Flake check: run `npx vitest run src/server/checkout src/server/orders` 5 times in a row. All 5 must be green.
3. End-to-end with `run` and `ecc:verification-loop`:
   - Seed a variant with stock 1 and use two signed-in sessions. Both check out at once. One order is created, stock is 0, and the loser sees the sold-out toast and a refreshed cart.
   - Double-click the place-order button. One order is created.
4. Reconcile every criterion above, plus the original goals: no negative stock, one winner, a clear loser message, no double-restock.
5. One `ecc:code-review` pass over the whole branch diff, and fix any blocking findings.
6. Prepare the PR title and body for `fix/checkout-concurrency` into `dev`, for the user to open by hand.

## Out of scope (follow-ups)

- Coupon `usedCount` release on customer and admin cancel, and whether CANCELLED orders count toward `perUserLimit` (a business-rule decision).
- Payment callbacks (`applyCallback` double-restock, SUCCEEDED overwriting a CANCELLED order) at `src/server/payments/payments.service.ts`. **Fix before re-enabling gateways.**
- Admin `updateProduct` absolute stock overwrite from a stale form (`src/server/catalog/catalog.service.ts:392-405`).
- Uncaught P2002 on the first concurrent add-to-cart (`src/server/cart/cart.service.ts`).
- Idempotency-key table, stock reservation, and a DB `CHECK (stock >= 0)` migration (good defense-in-depth later).

## Rollback

Delete `fix/checkout-concurrency` and stay on `main`: `git switch main` then `git branch -D fix/checkout-concurrency`. There is no migration and no data change. Test fixtures clean up after themselves.

## Execution Progress

**Status: in progress**

_Last updated: 2026-10-01 — Branch: fix/checkout-concurrency — Workspace: main working directory_

Final commit list: (pending)

| Phase | Status | Commit | Review | Notes |
| ----- | ------ | ------ | ------ | ----- |
| 1. Checkout server (fixtures, race tests, cart guard, 409 meta) | pending | — | deferred | — |
| 2. Cancel and transition paths (only the winner restocks) | pending | — | deferred | — |
| 3. Checkout UI | pending | — | deferred | — |
| 4. Cross-Validation | pending | — | pending | — |

## Final Status

(pending)
