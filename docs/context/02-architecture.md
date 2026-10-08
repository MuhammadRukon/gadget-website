# Architecture

## Layering

```
UI (src/app pages, src/modules components/hooks)
  → API route handlers (src/app/api/**)        — transport: parse Zod contract, auth check, delegate
    → Services (src/server/<domain>/*.service)  — business logic
      → Prisma (src/lib/prisma.ts)              — data access (repos are mostly thin/nominal)
```

- `src/server/common/http.ts` is the only server file allowed to import `next/server`. It provides `requireSession()`, `requireAdminSession()`, `jsonError()`.
- `src/server/common/errors.ts`: `AppError` hierarchy with `ErrorCode` → HTTP status mapping. `jsonError` special-cases `RateLimitedError` (429 + Retry-After) and `ZodError` (422).
- Repo layer is inconsistent: `catalog.repo.ts` and `reviews.repo.ts` hold real query logic; `cart.repo.ts`, `orders.repo.ts`, `coupons.repo.ts` are just `{ prisma }` passthroughs — services mostly call Prisma directly.
- `src/contracts/**` — Zod schemas + DTO types shared by routes (validation) and client hooks (typing).

## Auth & RBAC

- Auth.js v5 config in `src/server/auth/authOptions.ts`, instantiated once in `src/auth.ts` (`handlers`, `auth`, `signIn`, `signOut`).
- **JWT session strategy.** `id` and `role` are baked into the token at sign-in and exposed via the `session` callback. Role changes only take effect when the token refreshes (staleness caveat — see issues).
- Providers: credentials (bcrypt cost 10, `src/server/auth/password.ts`) + Google (registered only when env vars present; `allowDangerousEmailAccountLinking: true`).
- **Edge guard**: `src/proxy.ts` (Next 16's middleware file, named `proxy.ts` not `middleware.ts`) verifies the JWT and checks `role === 'ADMIN'` for `/dashboard/:path*` and `/api/admin/:path*`; `/account` requires any authenticated user. Fast-fail only; real enforcement:
  - Every `/api/admin/**` route calls `requireAdminSession()` (verified complete coverage).
  - `(dashboard)/layout.tsx` re-checks `session.user.role === 'ADMIN'` server-side and redirects.
- Password reset: tokens stored SHA-256-hashed (`src/server/auth/tokens.ts`), single-use, TTL-checked. No mailer is wired — the reset link is only surfaced inline in dev mode.

## Payments (strategy pattern)

- `src/server/payments/gateway.interface.ts`: `PaymentGateway { planPlacement?, init, parseCallback }`. Optional `planPlacement` (pure) returns `PlacementPlan` describing order creation (initial status, events, fee snapshot); providers are DB-free; `payments.service.ts` owns persistence and idempotency.
- `registry.ts` maps `PaymentMethod` → gateway: `cod.ts` (implements `planPlacement`; auto-confirm if no fee), `bank-transfer.ts` (customer submits ref → admin verifies), `bkash.ts` (grant→create→execute token flow), `sslcommerz.ts` (hosted checkout + validator API).
- Callback routes (`/api/payments/{provider}/{success,fail,cancel,ipn}`) are thin wrappers over `src/app/api/payments/_handlers.ts`.
- **Sandbox fallback**: with no credentials, providers redirect to `/api/payments/sandbox/*` harness pages that POST back `sandbox_`-prefixed refs. `parseCallback` now checks server-side credential presence *before* trusting that prefix (fixed in `docs/issues/00-fix-scope.md`'s pass; previously the prefix alone was trusted, the project's most critical security flaw — see `docs/issues/01-security.md`).
- `paymentsService.applyCallback` runs in a transaction, dedupes by terminal payment status, flips order PENDING → CONFIRMED on success, writes an `OrderEvent`. Failed/cancelled payments **do restock** (atomically in the same transaction).

## Cart

- **Logged-in**: `Cart`/`CartItem` rows keyed by unique `userId`. `cart.service.getCart` uses raw SQL for the snapshot; mutations use the ORM.
- **Guest**: localStorage via Zustand (`src/modules/cart/guest-cart.ts`); enriched for display via public `POST /api/cart/hydrate` (no persistence).
- **Merge on login**: `useGuestCartMerge` (mounted in `providers.tsx`) PUTs guest lines; server sums quantities, clamps to stock, merges transactionally.

## Checkout

1. `GET /api/checkout/config` — returns enabled payment methods (intersection of admin-flagged and gateway-configured), COD fee rule, QR/contact/note (always present, nullable, so orders can display them even if later disabled).
2. `POST /api/checkout/quote` — optional `paymentMethod` param; returns subtotal + coupon validation + shipping (`shipping.ts`: Dhaka 60৳ / outside 120৳, free ≥ 5000৳), plus `codFeeCents`, `dueOnDeliveryCents` (= total − fee), `codFeeRule` (null if no fee or non-COD method).
3. `POST /api/checkout` — `checkoutService.placeOrder` in one `prisma.$transaction`, in this order: consume the cart (count-checked `deleteMany`, serializes double submits); read settings via `tx` and reject a disabled method (400 `BadRequestError`); check line availability/stock; `priceOrder` (re-validates the coupon via `tx`, shipping, totals, and the COD fee through the payment strategy's `planPlacement`); optional `customerTxnId` duplicate pre-check; conditional stock decrement (`updateMany` where `stock >= qty`); conditional coupon `usedCount` bump; then ONE nested `order.create` carrying the item snapshots (name/sku/price), the `Payment` (PENDING, fee snapshot feeCents/feeType/feeValue/feeStatus) and the `OrderEvent`s (explicit increasing `createdAt`). `codFeeCents` is stored on Order; COD is auto-CONFIRMED only if no fee applies. A lost race on the `customerTxnId` unique index maps to `TxnIdDuplicateError`. Response includes `feeRequired`.
4. The **route** then calls `paymentsService.kickoff` (outside the transaction) to get the gateway redirect URL.

Concurrency: the stock decrement and coupon increment are conditional `updateMany` guards inside the transaction (oversell and usage-limit overrun fail with a `ConflictError`), and the coupon is re-validated with the `tx` client. If `kickoff` fails, the route calls `checkoutService.cancelOrphanedOrder` (restock, release coupon, cancel the order).

## Orders lifecycle

`PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`.

- COD auto-confirms at checkout only when no confirmation fee applies; with a fee, order stays PENDING until admin verifies via `codFeeService.verifyFee` (outcome: VERIFIED → CONFIRMED, REJECTED → stays PENDING). Gateway success confirms via callback; bank transfer confirms on admin verify.
- Admin transitions via `ordersService.transition` — validated against an explicit `ALLOWED_TRANSITIONS` map. When transitioning PENDING→CONFIRMED with COD fee PENDING or REJECTED, auto-waives the fee (sets feeStatus: WAIVED). Admin cancel and customer self-cancel both restock atomically.
- Customer self-cancel allowed while PENDING/CONFIRMED/PROCESSING — restocks atomically via the shared `restockOrderItems` helper.
- Every transition writes an `OrderEvent` (status, note, actorId) — the audit trail shown on both customer and admin order pages.

## Reviews & warranty

- Reviews: only for DELIVERED order items owned by the user; one per `orderItemId` (DB unique + service check). Public GET returns list + aggregate stats.
- Warranty: customer files against a DELIVERED order (one active request per order); admin transitions OPEN → APPROVED/REJECTED, APPROVED → RESOLVED/REJECTED. Actor currently discarded (`void adminId`).

## Rate limiting & logging

- `src/server/common/rate-limit.ts`: Postgres-backed (`RateLimitBucket` model) — applied to signup, forgot, reset, checkout only. Shared across serverless instances, unlike the earlier in-process `Map`.
- `src/server/common/logger.ts`: structured server logging helpers.

## Testing

Vitest unit tests for pure logic only: `money`, `rate-limit`, `errors`, `slug`, `shipping`, `fetcher`. No API/integration or E2E tests.
