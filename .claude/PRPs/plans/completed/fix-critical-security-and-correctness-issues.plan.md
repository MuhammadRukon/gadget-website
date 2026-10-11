# Plan: Fix Critical Security/Correctness Issues & Harden Core Service Patterns

## Summary
Cryptech (Next.js 16 + Prisma e-commerce MVP) has a forgeable payment-callback bypass, two concurrency races (stock oversell, coupon over-redemption), an ineffective rate limiter, and several smaller security/correctness gaps — all documented in `docs/issues/`. This plan fixes the scoped subset in `docs/issues/00-fix-scope.md`: it makes the shop safe to take real payments and resistant to abuse, closes the two data-integrity races using one reusable "conditional update" pattern, and adds the two structural pieces (central env validation, a shared concurrency idiom) that prevent this class of bug from recurring — without adding new infrastructure, new abstractions, or features.

## User Story
As the shop owner, I want the checkout, payment-callback, and admin-order flows to be safe and correct under concurrent/adversarial use, so that the site can go live and take real customer payments without being defrauded or overselling inventory.

## Problem → Solution
Payment callbacks trust attacker-controlled request data to skip validation; stock and coupon updates race under concurrent checkouts; rate limiting resets on every serverless cold start; several defaults/config gaps quietly weaken security. → Callback trust is gated on server-side credential presence, not request data; stock/coupon updates use conditional `updateMany` + row-count assertion (one pattern, two call sites); rate limiting moves to a Postgres-backed bucket (free-tier, no new infra); config gaps get one-line fixes plus a central `src/env.ts` that fails fast on missing production config.

## Metadata
- **Complexity**: XL (structural pattern + many small, independent call sites)
- **Source PRD**: N/A
- **PRD Phase**: N/A
- **Estimated Files**: ~19 (2 new, 14 updated, 3 deleted)

---

## UX Design

N/A — internal/backend change. No UI redesign. One user-visible behavior change: if checkout's payment-gateway kickoff fails, the customer now sees a clean "payment could not be started, please try again" error instead of an order that silently exists in limbo (order is cancelled + restocked server-side instead of orphaned).

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Checkout, gateway init fails | 500 error; order + stock decrement + coupon increment persist as an orphan | 400/502 error; order auto-cancelled and stock/coupon restored server-side | Customer can simply retry checkout |
| Checkout, last-unit race | Both concurrent buyers may succeed (oversell) | Second buyer gets a clear "insufficient stock" error | `ConflictError` → existing `jsonError` → 409 |
| Coupon at usage limit, concurrent use | Multiple buyers may exceed `usageLimit`/`perUserLimit` | Buyers past the limit get "coupon has reached its usage limit" | Same conditional-update mechanism |
| Admin: cancelling an already-cancelled or DELIVERED order | Silently "succeeds" (any→any) | Rejected with a clear conflict error | Prevents accidental state corruption |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `docs/issues/00-fix-scope.md` | all | The scope decision this plan implements |
| P0 | `src/server/payments/providers/sslcommerz.ts` | 60-159 | Sandbox-trust bug + amount fields to wire up |
| P0 | `src/server/payments/providers/bkash.ts` | 68-217 | Same, bKash variant (prefix check is on the opposite field) |
| P0 | `src/server/payments/payments.service.ts` | 99-163 | `applyCallback` — where amount check + restock-on-fail land |
| P0 | `src/server/checkout/checkout.service.ts` | 147-311 | `placeOrder` — stock decrement race, coupon tx-threading bug |
| P0 | `src/server/coupons/coupons.service.ts` | 96-140 | `validate` — needs a `db` param and conditional update |
| P1 | `src/server/orders/orders.service.ts` | 50-121 | `cancelByCustomer` (restock pattern to mirror) vs `transition` (needs the transition map) |
| P1 | `src/server/common/rate-limit.ts` | 1-77 | Full current implementation + every call site |
| P1 | `src/server/common/errors.ts` | 1-92 | Exact `AppError` subclasses/constructors to throw |
| P1 | `src/contracts/payments.ts` | 1-30 | `verifyPaymentSchema` default to remove |
| P1 | `src/server/payments/gateway.interface.ts` | 44-60 | `CallbackOutcome` — add amount field here |
| P2 | `src/proxy.ts` | 1-41 | Edge guard to upgrade from cookie-presence to JWT verification |
| P2 | `src/server/auth/authOptions.ts` | 25-113 | Google provider flag, JWT/session callbacks |
| P2 | `prisma/seed.ts` | 1-40 | Admin credential fallback to guard |
| P2 | `src/app/sitemap.ts`, `src/app/robots.ts` | full | `NEXT_PUBLIC_APP_URL` usage + `force-dynamic` conflict |
| P2 | `prisma/schema.prisma` | Order, OrderItem, Payment, ProductVariant, Coupon models (~lines 180-350) | Exact fields for every fix below |

## External Documentation
No external research needed — every fix uses Prisma/Next.js/Zod patterns already present in the codebase (conditional `updateMany`, Zod schemas, Next.js `instrumentation.ts`). One reference worth confirming during implementation: SSLCommerz/bKash return `amount` as a **decimal string in Taka**, not cents — verify against each provider's actual sandbox/live response before trusting the conversion in Task 3 (the code you're reading only declares the field as `string`; it does not document its precision).

---

## Patterns to Mirror

### ERROR_HANDLING
// SOURCE: src/server/common/errors.ts:30-64
```ts
export class ConflictError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super('CONFLICT', message, meta);
  }
}
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', meta?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, meta);
  }
}
```
`ConflictError` has no default message (concurrency conflicts must say what happened); `ValidationError` has a default. Routes never need a try/catch beyond the existing `catch (err) { return jsonError(err); }` — throwing the right `AppError` subclass is sufficient.

### TRANSACTION_PATTERN (existing, to extend — not invent)
// SOURCE: src/server/orders/orders.service.ts:56-97
```ts
async cancelByCustomer(userId: string, orderId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    ...
    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    ...
  });
}
```
This is the exact restock loop to mirror in Task 7 (admin cancel) and Task 8 (payment-callback restock).

### SERVICE_PATTERN — env-var presence as a server-side gate (existing idiom, to reuse correctly)
// SOURCE: src/server/payments/providers/sslcommerz.ts:60-66
```ts
function getCreds() {
  const id = process.env.SSLCOMMERZ_STORE_ID;
  const pwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
  if (!id || !pwd) return null;
  const sandbox = (process.env.SSLCOMMERZ_SANDBOX ?? 'true') === 'true';
  return { id, pwd, sandbox };
}
```
The codebase already has the right idiom (credentials-presence as the sandbox gate) — the bug is that `parseCallback` doesn't consult it before trusting the `sandbox_` prefix from the request. Task 2 fixes the *order of checks*, it does not invent a new mechanism.

### ROUTE_PATTERN (thin route, unchanged by this plan)
// SOURCE: src/app/api/admin/payments/[id]/verify/route.ts:11-21
```ts
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const admin = await requireAdminSession();
    const { id } = await params;
    const { outcome, note } = verifyPaymentSchema.parse(await request.json());
    const payment = await paymentsService.verify(admin.id, id, outcome, note);
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
```
No task in this plan changes route shape — routes stay `parse → auth → call service → NextResponse.json` / `catch → jsonError`.

### TEST_STRUCTURE
// SOURCE: src/server/common/__tests__/rate-limit.test.ts (existing file, being rewritten in Task 10)
Existing pattern: plain Vitest (`describe`/`it`/`expect`, `globals: false` per `vitest.config.ts` so imports are explicit), pure-function style — no mocking framework currently in use anywhere in the repo. Task 10 introduces the first prisma-mocking test in the codebase; keep it minimal (a hand-rolled fake object satisfying the two Prisma calls used, not a mocking library — don't add a new dependency for one test file).

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/env.ts` | CREATE | Central zod-validated env access; fails fast on missing prod config (Task 1) |
| `instrumentation.ts` | CREATE | Triggers `src/env.ts` parse at server boot (Task 1) |
| `.env.example` | CREATE | Repo has none today; documents every var incl. the canonical `NEXT_PUBLIC_APP_URL` (Task 1) |
| `prisma/schema.prisma` | UPDATE | Add `RateLimitBucket` model (Task 10) |
| `src/server/payments/providers/sslcommerz.ts` | UPDATE | Fix sandbox-trust order (Task 2); read+convert amount (Task 3) |
| `src/server/payments/providers/bkash.ts` | UPDATE | Same, bKash variant (Task 2, Task 3) |
| `src/server/payments/gateway.interface.ts` | UPDATE | Add `amountCents` to `CallbackOutcome` (Task 3) |
| `src/server/payments/payments.service.ts` | UPDATE | Amount check in `applyCallback` (Task 3); restock on FAILED/CANCELLED (Task 8) |
| `src/contracts/payments.ts` | UPDATE | Remove unsafe `.default('SUCCEEDED')` (Task 4) |
| `src/server/checkout/checkout.service.ts` | UPDATE | Conditional stock decrement (Task 5); thread `tx` to coupon validate (Task 6) |
| `src/server/coupons/coupons.service.ts` | UPDATE | Accept `db` param; conditional `usedCount` update (Task 6) |
| `src/server/orders/orders.service.ts` | UPDATE | Transition map + restock on admin cancel (Task 7) |
| `src/server/common/rate-limit.ts` | UPDATE | Postgres-backed bucket, same exported API (Task 10) |
| `src/server/common/__tests__/rate-limit.test.ts` | UPDATE | Adjust to async + fake Prisma client (Task 10) |
| `src/app/api/checkout/route.ts` | UPDATE | Catch kickoff failure → cancel + restock (Task 9); `await enforceRateLimit` (Task 10) |
| `src/app/api/auth/reset/route.ts`, `forgot/route.ts`, `signup/route.ts` | UPDATE | `await enforceRateLimit` (Task 10) |
| `src/server/auth/authOptions.ts` | UPDATE | Disable `allowDangerousEmailAccountLinking` (Task 11) |
| `src/proxy.ts` | UPDATE | JWT/role verification instead of cookie presence; fix stale comments (Task 12) |
| `prisma/seed.ts` | UPDATE | Throw when `SEED_ADMIN_*` missing in production (Task 13) |
| `src/app/sitemap.ts` | UPDATE | Drop `force-dynamic` (Task 14) |
| `src/server/cart/cart.repo.ts`, `src/server/orders/orders.repo.ts`, `src/server/coupons/coupons.repo.ts` | DELETE | Confirmed zero external imports; pure dead passthrough (Task 15) |

## NOT Building
See `docs/issues/00-fix-scope.md` → "Deferred" table for the full list and rationale. Highlights: no price-sort fix (needs a schema change), no admin server pagination, no analytics SQL rewrite, no transactional email, no retry-payment endpoint, no Redis/queue, no component-tree dedup, no broader test-coverage buildout, no frontend/UX fixes.

---

## Step-by-Step Tasks

### Task 1: Central env validation
- **ACTION**: Create `src/env.ts` with a Zod schema validating required vars; create `instrumentation.ts` at repo root to trigger it at boot; create `.env.example` documenting every var found in `.env` (names only).
- **IMPLEMENT**:
  ```ts
  // src/env.ts
  import { z } from 'zod';

  const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    NEXTAUTH_URL: z.string().min(1),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().min(1),
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    SSLCOMMERZ_STORE_ID: z.string().optional(),
    SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),
    SSLCOMMERZ_SANDBOX: z.string().optional(),
    BKASH_BASE_URL: z.string().optional(),
    BKASH_APP_KEY: z.string().optional(),
    BKASH_APP_SECRET: z.string().optional(),
    BKASH_USERNAME: z.string().optional(),
    BKASH_PASSWORD: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  });

  export const env = schema.parse(process.env);
  ```
  ```ts
  // instrumentation.ts (repo root, alongside next.config.ts)
  export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./src/env');
    }
  }
  ```
- **MIRROR**: N/A — first central env file in the repo; this establishes the pattern rather than copying one.
- **IMPORTS**: `zod` (already a dependency via other contracts).
- **GOTCHA**: Do NOT migrate every existing `process.env.X` read to import `env` — that's explicitly out of scope (see "Non-goals" in `00-fix-scope.md`). Only Task 13's seed-script fix and Task 1's own `.env.example` touch env-var surface beyond this file. `instrumentation.ts` needs Next's instrumentation hook enabled — check `next.config.ts`; Next 16 has this stable, no config flag needed (verify by running `npm run dev` and confirming no warning).
- **VALIDATE**: `npm run dev` — server boots without throwing. Temporarily unset `DATABASE_URL` and confirm boot fails loudly with a Zod error (then restore it).

### Task 2: Fix payment sandbox-trust bypass (CRITICAL)
- **ACTION**: In both `sslcommerz.ts` and `bkash.ts`, only trust the `sandbox_`-prefixed callback when server-side credentials are genuinely absent — not merely because the request claims to be sandbox.
- **IMPLEMENT** (sslcommerz.ts, `realParseCallback`, currently lines 119-159):
  ```ts
  async function realParseCallback(payload: unknown): Promise<CallbackOutcome> {
    const data = payload as SslcCallbackPayload;
    const tran = data.tran_id;
    const valId = data.val_id;
    if (!tran) throw new Error('Missing tran_id in SSLCommerz callback');

    const creds = getCreds(); // moved up: compute real-credential presence FIRST

    // Only trust the sandbox harness when we have no live credentials at all.
    if (!creds && typeof valId === 'string' && valId.startsWith('sandbox_')) {
      return {
        paymentId: tran,
        status: data.status === 'VALID' || data.status === 'VALIDATED'
          ? PaymentStatus.SUCCEEDED
          : data.status === 'CANCELLED' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED,
        providerRef: valId,
        rawPayload: data,
      };
    }

    if (!creds) {
      throw new Error('SSLCommerz credentials missing for live callback validation');
    }
    // ... rest unchanged (validator API call)
  }
  ```
  Apply the mirror-image fix in `bkash.ts` (`realParseCallback`, currently lines 160-217): compute `getCreds()` first, and gate the `data.paymentID.startsWith('sandbox_')` branch on `!creds`.
- **MIRROR**: `sslcommerz.ts:60-66` `getCreds()` — reuse verbatim, just reorder the call.
- **IMPORTS**: none new.
- **GOTCHA**: This is the entire fix — do not add a new env flag (`PAYMENTS_SANDBOX`) as the issue doc originally suggested; the codebase already computes "are real credentials configured" correctly in `getCreds()`, the bug is purely that `parseCallback` checked the request string before checking that. Reordering is sufficient and simpler. Also disable the `/api/payments/sandbox/*` harness routes when `creds` is non-null (defense in depth) — add a guard at the top of each sandbox route handler that 404s if `getCreds()` returns non-null for that provider.
- **VALIDATE**: Manual — with real `SSLCOMMERZ_STORE_ID`/`STORE_PASSWORD` set in `.env`, POST a forged callback (`tran_id=<real paymentId>&val_id=sandbox_x&status=VALID`) directly to `/api/payments/sslcommerz/success` and confirm the payment is NOT marked SUCCEEDED (should fall through to "credentials missing" only if no val_id is real, or attempt real validation and fail). Repeat for bKash with a forged `paymentID=sandbox_x`.

### Task 3: Add amount verification to payment callbacks (HIGH)
- **ACTION**: Add an amount field to `CallbackOutcome`, populate it from each provider's real response, and reject a mismatch in `applyCallback`.
- **IMPLEMENT**:
  ```ts
  // gateway.interface.ts:44-49 — add one field
  export interface CallbackOutcome {
    paymentId: string;
    status: Extract<PaymentStatus, 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'PENDING'>;
    providerRef: string;
    rawPayload: unknown;
    verifiedAmountCents?: number; // only set on the live (non-sandbox) path
  }
  ```
  In `sslcommerz.ts`, after the validator `fetch` (around line 150), convert and attach:
  ```ts
  import { takaToCents } from '@/server/common/money';
  // ...
  return {
    paymentId: json.tran_id || tran,
    status: okStatuses.has(json.status) ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
    providerRef: json.val_id ?? valId,
    rawPayload: json,
    verifiedAmountCents: json.amount ? takaToCents(parseFloat(json.amount)) : undefined,
  };
  ```
  In `bkash.ts`, after the execute call (around line 213), same pattern using `json.amount` from `BkashExecuteResponse`.
  In `payments.service.ts` `applyCallback` (currently lines 124-131), before flipping to SUCCEEDED:
  ```ts
  if (
    outcome.status === PaymentStatus.SUCCEEDED &&
    outcome.verifiedAmountCents !== undefined &&
    outcome.verifiedAmountCents !== payment.amountCents
  ) {
    log.error('payments.callback.amount_mismatch', {
      paymentId: payment.id, expected: payment.amountCents, got: outcome.verifiedAmountCents,
    });
    outcome = { ...outcome, status: PaymentStatus.FAILED };
  }
  const updated = await tx.payment.update({ /* unchanged, now uses possibly-overridden outcome.status */ });
  ```
- **MIRROR**: `src/server/common/money.ts:19-24` `takaToCents` — reuse directly, do not re-implement the taka→cents conversion.
- **IMPORTS**: `takaToCents` from `@/server/common/money` in both provider files.
- **GOTCHA**: Confirm SSLCommerz's validator `amount` and bKash's execute `amount` are actually decimal Taka strings (e.g. `"1299.00"`) against real sandbox responses before trusting `parseFloat` — the type declarations in both files only say `string`, they don't document precision or currency. Sandbox-path callbacks (trusted per Task 2) have no `verifiedAmountCents` — that's intentional, the field is `optional` and the check is skipped when `undefined`.
- **VALIDATE**: Unit test (new) constructing a fake `CallbackOutcome` with `verifiedAmountCents` mismatched against a fixture `payment.amountCents`, asserting `applyCallback` results in `FAILED` not `SUCCEEDED`. Manual: use provider sandbox credentials if available to confirm a real successful payment still flows to SUCCEEDED (amounts must match exactly).

### Task 4: Admin payment verify must not default to SUCCEEDED (MEDIUM)
- **ACTION**: Make `outcome` required in `verifyPaymentSchema`.
- **IMPLEMENT**:
  ```ts
  // src/contracts/payments.ts:14-18
  export const verifyPaymentSchema = z.object({
    outcome: z.enum(['SUCCEEDED', 'FAILED']),
    note: z.string().max(300).optional(),
  });
  ```
- **MIRROR**: N/A — one-line removal.
- **IMPORTS**: none.
- **GOTCHA**: Check `src/modules/admin/**` for any form that POSTs `{}` expecting the default — the admin UI should already send an explicit choice; if a form is found relying on the default, fix the form to send `outcome` explicitly rather than restoring the default.
- **VALIDATE**: `POST /api/admin/payments/[id]/verify` with body `{}` now returns a 422 Zod validation error instead of silently succeeding.

### Task 5: Fix stock oversell race in checkout (HIGH)
- **ACTION**: Replace the unconditional stock decrement with a conditional `updateMany` + row-count assertion.
- **IMPLEMENT** (checkout.service.ts, currently lines 255-261):
  ```ts
  for (const [variantId, quantity] of qtyByVariantId.entries()) {
    const res = await tx.productVariant.updateMany({
      where: { id: variantId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (res.count !== 1) {
      throw new ConflictError('Not enough stock to complete checkout', { variantId });
    }
  }
  ```
- **MIRROR**: `src/server/common/errors.ts:54-58` `ConflictError` constructor (message required).
- **IMPORTS**: add `ConflictError` to the existing `@/server/common/errors` import in `checkout.service.ts` (already imports `BadRequestError, NotFoundError, ValidationError` from there).
- **GOTCHA**: The pre-check loop at lines 210-215 (`if (!variant || variant.stock < requiredQty) throw new ValidationError(...)`) stays — it's a fast-fail UX check for the common case; the `updateMany` guard below is the actual concurrency-safe enforcement. Keep both; don't remove the early check thinking the conditional update replaces it (the early check gives a nicer error message for the non-concurrent case).
- **VALIDATE**: Manual concurrency test — set a variant's stock to 1, fire two concurrent `POST /api/checkout` requests for that variant (e.g. two terminal tabs with `curl` at the same time, or a small script using `Promise.all`), confirm exactly one succeeds (201) and the other gets a 409 with "Not enough stock to complete checkout".

### Task 6: Fix coupon usage race + tx-client threading bug (HIGH)
- **ACTION**: Give `couponsService.validate` an optional `db` param (defaulting to the global `prisma`), thread `tx` through from checkout, and make the usage-limit re-check + increment atomic via conditional `updateMany`.
- **IMPLEMENT**:
  ```ts
  // coupons.service.ts — add Prisma client type param
  import { prisma } from '@/lib/prisma';
  import type { Prisma as PrismaNS } from '@prisma/client';

  type Db = typeof prisma | PrismaNS.TransactionClient;

  async validate(input: ValidateCouponInput, db: Db = prisma): Promise<ValidatedCoupon> {
    const code = input.code.trim().toUpperCase();
    const coupon = await db.coupon.findUnique({ where: { code } });
    // ... unchanged checks, replacing every `prisma.` with `db.` in this function (lines 105, 123)
  }
  ```
  ```ts
  // checkout.service.ts:187-196 — pass tx through
  if (input.couponCode) {
    const validated = await couponsService.validate(
      { code: input.couponCode, userId, subtotalCents },
      tx, // <-- the fix: was previously omitted, defaulting to the global client
    );
    discountCents = validated.discountCents;
    couponId = validated.id;
    couponCode = validated.code;
  }
  ```
  Coupon increment (checkout.service.ts:264-269) — **Prisma cannot express `usedCount < usageLimit` as a column-to-column comparison in `updateMany.where`.** Use a fresh in-transaction read followed by a conditional update instead (still race-free because both happen inside the same `tx`):
  ```ts
  if (couponId) {
    const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: couponId } });
    const res = await tx.coupon.updateMany({
      where: {
        id: couponId,
        ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (res.count !== 1) {
      throw new ConflictError('This coupon has reached its usage limit');
    }
  }
  ```
- **MIRROR**: Task 5's conditional-`updateMany` + count-check pattern — same idiom, second call site.
- **IMPORTS**: `ConflictError` (already added to checkout.service.ts in Task 5); coupons.service.ts already imports `Prisma` from `@prisma/client` for `CouponType` — extend that import for the transaction-client type.
- **GOTCHA**: This does not fully eliminate every theoretical race (two transactions can still both read the same `coupon.usedCount` in the `findUniqueOrThrow` before either commits) but Postgres's default transaction isolation plus the second `updateMany`'s row-count guard means only one will see its own increment reflected in `res.count`; the other gets `res.count === 0` and throws — the same "optimistic conditional update" guarantee Task 5 relies on for stock, just expressed as read-then-conditional-write instead of a single comparison because Prisma can't do column-to-column comparisons in `where`. Do not attempt a raw SQL query to work around this — it's not needed for correctness and would break the "one client" abstraction.
- **VALIDATE**: Set a coupon's `usageLimit: 1`, fire two concurrent checkouts using it, confirm one succeeds and the other gets "This coupon has reached its usage limit".

### Task 7: Order status transition validation + admin-cancel restock (MEDIUM)
- **ACTION**: Encode an explicit transition map in `orders.service.ts` `transition()`; restock when an admin transitions an order to CANCELLED (parity with customer self-cancel).
- **IMPLEMENT**:
  ```ts
  // orders.service.ts — module-level constant
  const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  async transition(adminId: string, orderId: string, status: OrderStatus, note?: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundError('Order');
      if (!ALLOWED_TRANSITIONS[order.status].includes(status)) {
        throw new ConflictError(`Cannot move order from ${order.status} to ${status}`);
      }
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status,
          cancelledAt: status === OrderStatus.CANCELLED ? new Date() : order.cancelledAt,
          cancelReason: status === OrderStatus.CANCELLED ? (note ?? 'Admin') : order.cancelReason,
        },
      });
      if (status === OrderStatus.CANCELLED) {
        for (const item of order.items) {
          if (item.variantId) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } },
            });
          }
        }
      }
      await tx.orderEvent.create({ data: { orderId, status, note: note ?? null, actorId: adminId } });
      return updated;
    });
  }
  ```
- **MIRROR**: `orders.service.ts:56-97` `cancelByCustomer`'s restock loop — reused verbatim inside `transition` now.
- **IMPORTS**: `ConflictError` is already imported in `orders.service.ts` (alongside `ForbiddenError, NotFoundError`) — just needs to be thrown here too.
- **GOTCHA**: This is a **behavior change** from the documented-as-intentional "admin cancel does not restock" — confirm with the shop owner this is desired before shipping (it closes the correctness §3/§4 gap but changes existing admin behavior). If NOT desired, skip the restock block and keep only the transition-map guard.
- **VALIDATE**: Attempt `transition(orderId, 'PENDING')` on a `DELIVERED` order → expect `ConflictError`/409. Cancel a `CONFIRMED` order with 2 units of a variant → confirm variant stock increases by 2.

### Task 8: Restock on failed/cancelled online payments (MEDIUM)
- **ACTION**: In `applyCallback`, when the outcome is FAILED or CANCELLED, restock the order's items (once — the existing terminal-state no-op guard at lines 115-122 already prevents double-restock).
- **IMPLEMENT** (payments.service.ts, inside the `else if` branch currently at lines 145-154):
  ```ts
  } else if (outcome.status === PaymentStatus.FAILED || outcome.status === PaymentStatus.CANCELLED) {
    const order = await tx.order.findUnique({ where: { id: payment.orderId }, include: { items: true } });
    if (order) {
      for (const item of order.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }
    }
    await tx.orderEvent.create({
      data: { orderId: payment.orderId, status: OrderStatus.PENDING, note: `Payment ${outcome.status.toLowerCase()} via ${method}; stock restored` },
    });
  }
  ```
- **MIRROR**: Same restock loop as Task 7.
- **IMPORTS**: none new (already has `tx`, `OrderStatus` imported).
- **GOTCHA**: Order status is NOT changed to CANCELLED here (matches existing comment "Don't auto-cancel the order yet; the customer might retry") — only stock is restored. If the customer never retries, the order stays PENDING with stock now correctly available for other buyers; the order itself becoming stale/abandoned is the deferred "expiry sweep" item (out of scope, see `00-fix-scope.md`).
- **VALIDATE**: Trigger a FAILED callback for a pending SSLCommerz/bKash payment (sandbox harness), confirm the variant's stock is incremented back and an `OrderEvent` is recorded.

### Task 9: Handle payment-kickoff failure without orphaning the order (MEDIUM)
- **ACTION**: Wrap `paymentsService.kickoff` in a try/catch in the checkout route; on failure, cancel the just-created order (restocking + releasing the coupon) and return a clean error.
- **IMPLEMENT**:
  ```ts
  // src/app/api/checkout/route.ts
  const { order, paymentId } = await checkoutService.placeOrder(user.id, input);
  const origin = new URL(request.url).origin;
  try {
    const initiated = await paymentsService.kickoff(paymentId, { origin });
    return NextResponse.json({ /* unchanged */ }, { status: 201 });
  } catch (err) {
    await checkoutService.cancelOrphanedOrder(order.id); // new method, see below
    return jsonError(new BadRequestError('Could not start payment; please try again'));
  }
  ```
  Add `cancelOrphanedOrder` to `checkout.service.ts`, reusing the same restock + coupon-release logic as Task 7/8 (extract a small shared internal helper `restockOrderItems(tx, items)` used by all three call sites — see GOTCHA).
- **MIRROR**: Same restock loop pattern as Tasks 7 and 8.
- **IMPORTS**: `BadRequestError` in `checkout/route.ts` (add to existing imports).
- **GOTCHA**: By this point three places restock order items identically (Task 7, Task 8, Task 9) — extract one small shared function, e.g. `restockOrderItems(tx: Prisma.TransactionClient, items: { variantId: string | null; quantity: number }[])` in `src/server/common/` or directly in `orders.service.ts` and imported by the other two. Do this extraction only after all three call sites exist (don't pre-build an abstraction for a single caller) — this keeps the fix aligned with "don't overengineer" while avoiding copy-pasted logic three times.
- **VALIDATE**: Temporarily point `BKASH_BASE_URL` at an invalid host (forcing `kickoff`'s `fetch` to throw), place an order with bKash, confirm: order ends up CANCELLED, stock is restored, coupon `usedCount` is decremented (if a coupon was used), and the client gets a clean 400 instead of a 500.

### Task 10: Replace in-memory rate limiter with a Postgres-backed one (HIGH)
- **ACTION**: Add a `RateLimitBucket` model; rewrite `rate-limit.ts` internals to use it while keeping the exact same exported function signatures (so no call site needs to change except adding `await`).
- **IMPLEMENT**:
  ```prisma
  // prisma/schema.prisma — new model
  model RateLimitBucket {
    key       String   @id
    count     Int      @default(0)
    resetAt   DateTime
    updatedAt DateTime @updatedAt

    @@index([resetAt])
  }
  ```
  ```ts
  // src/server/common/rate-limit.ts — same exported names, new implementation
  import { prisma } from '@/lib/prisma';

  export async function rateLimit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const now = new Date();
    const resetAt = new Date(now.getTime() + policy.windowMs);

    const incremented = await prisma.rateLimitBucket.updateMany({
      where: { key, resetAt: { gt: now } },
      data: { count: { increment: 1 } },
    });

    if (incremented.count === 0) {
      await prisma.rateLimitBucket.upsert({
        where: { key },
        update: { count: 1, resetAt },
        create: { key, count: 1, resetAt },
      });
      return { ok: true, remaining: policy.max - 1, resetAt: resetAt.getTime() };
    }

    const bucket = await prisma.rateLimitBucket.findUniqueOrThrow({ where: { key } });
    return {
      ok: bucket.count <= policy.max,
      remaining: Math.max(0, policy.max - bucket.count),
      resetAt: bucket.resetAt.getTime(),
    };
  }

  export async function enforceRateLimit(key: string, policy: RateLimitPolicy): Promise<void> {
    const result = await rateLimit(key, policy);
    if (!result.ok) throw new RateLimitedError(result.resetAt);
  }
  ```
  `clientIp` and `RateLimitedError` stay exactly as-is (pure functions, no DB access needed).
- **MIRROR**: Same conditional-`updateMany` idiom as Tasks 5 and 6 — this plan now has exactly one concurrency pattern used in three places.
- **IMPORTS**: `prisma` from `@/lib/prisma` (new import in this file).
- **GOTCHA**: `enforceRateLimit` is now `async` — every call site must add `await`: `src/app/api/checkout/route.ts:12`, `src/app/api/auth/reset/route.ts:10`, `src/app/api/auth/forgot/route.ts:11`, `src/app/api/auth/signup/route.ts:10` (all four routes are already `async function POST`, so this is a one-word change per file). There's a small residual race in the "bucket expired or missing" branch (two concurrent first-requests-in-a-window can both hit `incremented.count === 0` and both upsert) — acceptable for rate limiting (worst case: one extra request slips through per window boundary), do not add a transaction around it, that would be over-engineering for a non-critical-path abuse guard. No cron needed to clean up old rows — an unbounded `RateLimitBucket` table is fine at MVP scale (rows are tiny, one per key); add a cleanup cron only if this becomes a problem (tracked implicitly via `docs/product/SCALE-UP-TODO.md`, not this plan).
- **VALIDATE**: `npx prisma migrate dev --name add_rate_limit_bucket`. Rewrite `src/server/common/__tests__/rate-limit.test.ts` to await the now-async functions against a real or fake `prisma.rateLimitBucket` (simplest: point `DATABASE_URL` at a local/test Postgres for this test file, or hand-write a minimal in-memory fake implementing `updateMany`/`upsert`/`findUniqueOrThrow` — pick whichever the existing test setup supports; there is no existing Prisma-mocking convention in this repo to mirror, so document the choice in the test file's top comment). Manually: hit `/api/auth/signup` 6 times in under 15 minutes, confirm the 6th returns 429 with a `Retry-After` header.

### Task 11: Disable dangerous email account linking (MEDIUM)
- **ACTION**: Remove `allowDangerousEmailAccountLinking: true` (Auth.js defaults to `false`).
- **IMPLEMENT**:
  ```ts
  // authOptions.ts:62-70
  ...(useGoogle
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
      ]
    : []),
  ```
- **MIRROR**: N/A — deletion.
- **IMPORTS**: none.
- **GOTCHA**: A user who previously signed up with credentials and later tries Google with the same email will now hit Auth.js's standard `OAuthAccountNotLinked` error instead of silent auto-linking. Confirm the sign-in page already surfaces NextAuth error codes reasonably (check `src/app/(auth)/login` or equivalent for `searchParams.error` handling) — if it doesn't show a readable message for `OAuthAccountNotLinked`, add one line mapping that code to "An account already exists with this email; sign in with your password instead." Do not build a custom account-linking flow — that's out of scope.
- **VALIDATE**: Sign up with credentials using `test@example.com`, then attempt Google sign-in with the same email, confirm you get `OAuthAccountNotLinked` (visible in the URL query param and/or UI) rather than being silently logged into the existing account.

### Task 12: Verify JWT/role at the edge instead of cookie presence (MEDIUM)
- **ACTION**: Replace the cookie-presence-only check in `proxy.ts` with an actual token read (`getToken` from `next-auth/jwt`), checking `role === 'ADMIN'` for `/api/admin/**` and `/dashboard/**`.
- **IMPLEMENT**:
  ```ts
  // src/proxy.ts — replace hasSessionToken-based check
  import { getToken } from 'next-auth/jwt';

  export default async function proxy(request: NextRequest) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const isAdminRoute = request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/api/admin');
    if (isAdminRoute && (!token || token.role !== 'ADMIN')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }
  export const config = { matcher: ['/dashboard/:path*', '/api/admin/:path*'] };
  ```
- **MIRROR**: `authOptions.ts:100-107` `jwt` callback — confirms `role` is already on the token, so `getToken` needs no DB read.
- **IMPORTS**: `getToken` from `next-auth/jwt`.
- **GOTCHA**: `getToken` is edge-runtime-safe — confirm `proxy.ts`'s runtime (check for `export const runtime = 'edge'` or default) before assuming so. This is verification only, not revocation: a demoted admin's existing JWT still passes until it expires (documented staleness caveat, unchanged — full fix would need short-lived tokens or a DB check per request, which is bigger than this pass). Also fix the stale code comments referencing a nonexistent `middleware.ts` (the file is `proxy.ts`).
- **VALIDATE**: Log in as a CUSTOMER, manually hit `/dashboard` → redirected to login (previously would pass the edge guard and rely solely on the layout's server check). Log in as ADMIN → `/dashboard` loads normally.

### Task 13: Require seed admin credentials in production (MEDIUM)
- **ACTION**: Throw in `prisma/seed.ts` if `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are unset AND `NODE_ENV === 'production'`; keep the dev fallback otherwise.
- **IMPLEMENT**:
  ```ts
  // prisma/seed.ts:16-17
  if (process.env.NODE_ENV === 'production' && (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD)) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set before seeding production');
  }
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@Cryptech.test';
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin12345';
  ```
- **MIRROR**: N/A — standalone script, deliberately not wired to `src/env.ts` (seed runs via `tsx` outside the Next.js runtime).
- **IMPORTS**: none.
- **GOTCHA**: `README.md:31` already tells operators to set these vars — this task makes that a hard requirement instead of a suggestion. Do not also add this check to `src/env.ts`/`instrumentation.ts` — seeding is a one-off script, not part of server boot.
- **VALIDATE**: `NODE_ENV=production npm run db:seed` without the env vars set → throws immediately. With them set → seeds normally.

### Task 14: Fix sitemap config conflict + confirm `NEXT_PUBLIC_APP_URL` (MEDIUM)
- **ACTION**: Remove the contradictory `dynamic = 'force-dynamic'` export from `src/app/sitemap.ts`; add `NEXT_PUBLIC_APP_URL` to `.env`/`.env.example` with the real deployed origin.
- **IMPLEMENT**: Delete `export const dynamic = 'force-dynamic';` (line 13), keep `export const revalidate = 3600;` (line 12) so the sitemap is cached for an hour instead of hitting the DB on every crawl.
- **MIRROR**: N/A — deletion.
- **IMPORTS**: none.
- **GOTCHA**: `robots.ts` has no such conflict already; leave it untouched beyond what Task 1's `.env.example` documents. This does not fix `correctness §11`'s full "pick one canonical name" recommendation across the whole codebase — it just ensures the variable both files already read is actually set, closing the "works by accident via NEXTAUTH_URL fallback" gap.
- **VALIDATE**: `npm run build` succeeds; `curl localhost:3000/sitemap.xml` twice within an hour and confirm (via response headers or a temporary log) it isn't re-querying the DB on the second hit.

### Task 15: Delete vestigial repo passthroughs (architecture cleanup)
- **ACTION**: Delete `src/server/cart/cart.repo.ts`, `src/server/orders/orders.repo.ts`, `src/server/coupons/coupons.repo.ts`.
- **IMPLEMENT**: `rm` the three files. Grep confirmed (this session) zero imports of `cartRepo`, `ordersRepo`, `couponsRepo` anywhere outside their own definitions.
- **MIRROR**: N/A — deletion, no replacement needed since nothing consumed them.
- **IMPORTS**: none.
- **GOTCHA**: Re-run the grep yourself right before deleting (`grep -rn "cartRepo\|ordersRepo\|couponsRepo" --include="*.ts" --include="*.tsx" .`) in case something changed since this plan was written — do not delete based solely on this document if the codebase has moved on.
- **VALIDATE**: `npm run typecheck` and `npm run build` both succeed after deletion (proves nothing referenced them).

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `payments.service.test.ts` (new) | `applyCallback` with `verifiedAmountCents` ≠ `payment.amountCents` | Payment ends FAILED, order stays PENDING | Yes — the whole point of Task 3 |
| `payments.service.test.ts` (new) | `applyCallback` called twice with the same terminal outcome | Second call is a no-op (existing idempotency guard) | Yes — regression check that Task 3/8 didn't break existing dedup |
| `orders.service.test.ts` (new) | `transition(DELIVERED → PENDING)` | Throws `ConflictError` | Yes |
| `orders.service.test.ts` (new) | `transition(CONFIRMED → CANCELLED)` with items | Order CANCELLED, stock incremented per item | Yes |
| `rate-limit.test.ts` (rewritten) | `enforceRateLimit` called `max+1` times within `windowMs` | `RateLimitedError` on the `max+1`th call | Yes — must still pass after async rewrite |
| `coupons.service.test.ts` (new) | `validate(input, tx)` inside a transaction that reads a coupon at its `usageLimit` | Throws before increment | Yes |

### Edge Cases Checklist
- [x] Concurrent access — Tasks 5, 6, 10 are entirely about this
- [x] Invalid state transition — Task 7
- [x] Network/gateway failure — Task 9 (kickoff failure)
- [x] Missing/invalid config at boot — Task 1
- [ ] Maximum size input — not touched by this plan, no new user input surfaces are added
- [ ] Permission denied — Task 12 covers role-gating; no new permission surface added

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
npm run lint
```
EXPECT: Zero type errors, zero new lint errors.

### Unit Tests
```bash
npm run test
```
EXPECT: All existing tests pass; new tests from "Testing Strategy" above pass.

### Database Validation
```bash
npx prisma migrate dev --name add_rate_limit_bucket
npx prisma studio   # spot-check RateLimitBucket table exists
```
EXPECT: Migration applies cleanly against the dev database; `SHADOW_DATABASE_URL` must be set per existing convention.

### Browser/Manual Validation
```bash
npm run dev
```
- [ ] Forged sandbox payment callback (Task 2) is rejected when real credentials are configured
- [ ] Concurrent checkout on last-unit stock (Task 5) — one 201, one 409
- [ ] Concurrent checkout with a usage-limit-1 coupon (Task 6) — one succeeds, one rejected
- [ ] Admin cannot transition DELIVERED → PENDING (Task 7)
- [ ] Failed bKash/SSLCommerz sandbox payment restocks the order (Task 8)
- [ ] Simulated gateway-init failure cancels + restocks instead of orphaning (Task 9)
- [ ] 6th signup attempt in 15 minutes gets 429 (Task 10)
- [ ] Google sign-in with an existing credentials email hits `OAuthAccountNotLinked`, not silent linking (Task 11)
- [ ] CUSTOMER role hitting `/dashboard` is redirected at the edge (Task 12)
- [ ] `NODE_ENV=production npm run db:seed` without `SEED_ADMIN_*` throws (Task 13)
- [ ] `npm run build` succeeds after repo-file deletion (Task 15)

---

## Acceptance Criteria
- [ ] All 15 tasks completed
- [ ] All validation commands pass
- [ ] New tests written and passing (Testing Strategy table)
- [ ] No type errors, no new lint errors
- [ ] Every manual validation checklist item confirmed
- [ ] `docs/issues/00-fix-scope.md` items marked "in scope" are all addressed; deferred items untouched (no scope creep)

## Completion Checklist
- [ ] Code follows discovered patterns (conditional `updateMany` + count-check used consistently in Tasks 5, 6, 10; restock loop shared/reused across Tasks 7, 8, 9)
- [ ] Error handling matches codebase style (`AppError` subclasses, no new error-handling mechanism introduced)
- [ ] No hardcoded values beyond what's already convention (e.g. transition map is explicit, not derived)
- [ ] Documentation updated: this plan, `docs/issues/00-fix-scope.md`; consider a short changelog note in `docs/context/02-architecture.md` once merged (not required by this plan, but keeps context docs from going stale)
- [ ] No unnecessary scope additions — verify against "NOT Building" and `00-fix-scope.md`'s deferred table before merging
- [ ] Self-contained — no questions needed during implementation (confirm Task 7's behavior-change flag was resolved with the shop owner before or during implementation, per its GOTCHA)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SSLCommerz/bKash `amount` field precision/format differs from assumed decimal-Taka string | Medium | Task 3's amount check could false-positive-reject valid payments | Verify against real sandbox responses before enabling the mismatch→FAILED behavior in production; consider logging-only (no FAILED override) for one deployment cycle first if credentials aren't available to test against |
| Task 7's admin-cancel restock is a behavior change | Medium | Could surprise an admin used to manually rebalancing stock after cancels | Explicit GOTCHA calls this out; confirm with shop owner before implementing, or ship transition-map-only without restock if undesired |
| Task 12's edge JWT check misconfigures `NEXTAUTH_SECRET` access at the edge runtime | Low | Could lock out all admin access if broken | Test thoroughly in a preview deployment before merging to `main`; keep the existing route-level `requireAdminSession()` and layout checks as-is (defense in depth already exists, so a proxy bug fails safe into "extra redirect," not "no protection") |
| Task 10's rate-limit rewrite adds a DB round-trip to every signup/reset/forgot/checkout request | Low | Slight latency increase | Acceptable — these are low-frequency, already-authenticated-adjacent routes; no caching needed at this scale |

## Notes
- This plan intentionally does not touch `docs/issues/04-frontend-ux.md` or the larger architecture items in `docs/issues/03-architecture.md` beyond #1, #2, #8 — see `docs/issues/00-fix-scope.md` for the full scoping rationale.
- Tasks 5, 6, and 10 all converge on one idiom (conditional `updateMany` + row-count assertion, optionally preceded by a fresh in-transaction read when a column-to-column comparison isn't expressible). Implementing them in that order (5 → 6 → 10) lets the pattern solidify once before being reapplied, which is why they're sequenced together despite touching unrelated subsystems.
- Task 9's shared `restockOrderItems` extraction should happen last among 7/8/9, once all three call sites exist, to avoid designing an abstraction around a single caller.
