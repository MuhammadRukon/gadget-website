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
- **Edge guard**: `src/proxy.ts` (Next 16's middleware file) matches `/dashboard/:path*` and `/api/admin/:path*` but only checks *cookie presence*, not validity or role. Real enforcement:
  - Every `/api/admin/**` route calls `requireAdminSession()` (verified complete coverage).
  - `(dashboard)/layout.tsx` re-checks `session.user.role === 'ADMIN'` server-side and redirects.
- Password reset: tokens stored SHA-256-hashed (`src/server/auth/tokens.ts`), single-use, TTL-checked. No mailer is wired — the reset link is only surfaced inline in dev mode.

## Payments (strategy pattern)

- `src/server/payments/gateway.interface.ts`: `PaymentGateway { init, parseCallback }`. Providers are DB-free; `payments.service.ts` owns persistence and idempotency.
- `registry.ts` maps `PaymentMethod` → gateway: `cod.ts` (auto-confirm), `bank-transfer.ts` (customer submits bankRef → admin manually verifies), `bkash.ts` (grant→create→execute token flow), `sslcommerz.ts` (hosted checkout + validator API).
- Callback routes (`/api/payments/{provider}/{success,fail,cancel,ipn}`) are thin wrappers over `src/app/api/payments/_handlers.ts`.
- **Sandbox fallback**: with no credentials, providers redirect to `/api/payments/sandbox/*` harness pages that POST back `sandbox_`-prefixed refs. The `sandbox_` prefix is trusted from request data — this is the project's most critical security flaw (see `docs/issues/01-security.md`).
- `paymentsService.applyCallback` runs in a transaction, dedupes by terminal payment status, flips order PENDING → CONFIRMED on success, writes an `OrderEvent`. Failed/cancelled payments do **not** restock.

## Cart

- **Logged-in**: `Cart`/`CartItem` rows keyed by unique `userId`. `cart.service.getCart` uses raw SQL for the snapshot; mutations use the ORM.
- **Guest**: localStorage via Zustand (`src/modules/cart/guest-cart.ts`); enriched for display via public `POST /api/cart/hydrate` (no persistence).
- **Merge on login**: `useGuestCartMerge` (mounted in `providers.tsx`) PUTs guest lines; server sums quantities, clamps to stock, merges transactionally.

## Checkout

1. `POST /api/checkout/quote` — read-only: address + cart lines → subtotal, coupon validation, shipping (`shipping.ts`: Dhaka 60৳ / outside 120৳, free ≥ 5000৳) → totals.
2. `POST /api/checkout` — `checkoutService.placeOrder` in one `prisma.$transaction`: re-validate stock + coupon, snapshot order items (name/sku/price copied), decrement stock, bump coupon `usedCount`, create `Payment` (PENDING; COD auto-CONFIRMED), clear cart, write `OrderEvent`.
3. The **route** then calls `paymentsService.kickoff` (outside the transaction) to get the gateway redirect URL.

Known caveats: stock decrement and coupon increment are not concurrency-safe; kickoff failure orphans the order; coupon re-validation inside the tx uses the global prisma client, not `tx`. All tracked in `docs/issues/02-correctness.md`.

## Orders lifecycle

`PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`.

- COD confirms at checkout; gateway success confirms via callback; bank transfer confirms on admin verify.
- Admin transitions via `ordersService.transition` — **no state-machine validation** (any → any) and admin cancel does not restock (documented as intentional).
- Customer self-cancel allowed while PENDING/CONFIRMED/PROCESSING — this one **does** restock atomically.
- Every transition writes an `OrderEvent` (status, note, actorId) — the audit trail shown on both customer and admin order pages.

## Reviews & warranty

- Reviews: only for DELIVERED order items owned by the user; one per `orderItemId` (DB unique + service check). Public GET returns list + aggregate stats.
- Warranty: customer files against a DELIVERED order (one active request per order); admin transitions OPEN → APPROVED/REJECTED, APPROVED → RESOLVED/REJECTED. Actor currently discarded (`void adminId`).

## Rate limiting & logging

- `src/server/common/rate-limit.ts`: in-process token-bucket `Map` — applied to signup, forgot, reset, checkout only. **Ineffective on Vercel serverless** (per-instance memory); needs a shared store before it means anything.
- `src/server/common/logger.ts`: structured server logging helpers.

## Testing

Vitest unit tests for pure logic only: `money`, `rate-limit`, `errors`, `slug`, `shipping`, `fetcher`. No API/integration or E2E tests.
