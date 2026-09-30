# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Cryptech" — gadget/electronics e-commerce MVP for the Bangladesh market. Next.js 16 App Router + React 19 + TypeScript, Prisma + PostgreSQL, Auth.js v5 (JWT sessions), TanStack Query + Zustand, Tailwind 4 + shadcn/ui, Cloudinary media, Vitest.

Hosted on Vercel free tier + Prisma-hosted Postgres. Cost-sensitive: prefer DB-backed or free-tier solutions over paid infra (this is why rate limiting is a Postgres table, not Redis).

## Commands

```bash
npm run dev          # Turbopack dev server on :3000
npm run build        # production build
npm run lint         # eslint (next/core-web-vitals + next/typescript)
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run test:watch
npm run db:seed      # tsx prisma/seed.ts — admin + demo catalog; never run against prod
npm run db:studio
npx prisma migrate dev   # after editing prisma/schema.prisma (needs SHADOW_DATABASE_URL)
```

Single test file / single test:

```bash
npx vitest run src/server/common/__tests__/money.test.ts
npx vitest run -t "free shipping"
```

Vitest runs in the **node** environment (`vitest.config.ts`), not jsdom, and only picks up `src/**/*.{test,spec}.{ts,tsx}`. Tests use explicit imports (`globals: false`) — import `describe`/`it`/`expect` from `vitest`.

`src/env.ts` fail-fast validates env at boot via `instrumentation.ts`; a missing required var crashes the server rather than failing later. Copy `.env.example` to `.env`.

## Architecture

```
UI (src/app pages, src/modules components+hooks)
  → API route handlers (src/app/api/**)     transport only: parse Zod contract, auth check, delegate
    → Services (src/server/<domain>/*.service.ts)   business logic, framework-agnostic
      → Prisma (src/lib/prisma.ts)
```

Key invariants:

- **`src/server/common/http.ts` is the only server-layer file allowed to import `next/server`.** It owns `requireSession()`, `requireAdminSession()`, `jsonError()`. Services must stay free of Next imports.
- Errors: throw `AppError` subclasses from `src/server/common/errors.ts`; routes `catch → jsonError(err)`, which maps `ErrorCode` to HTTP status and special-cases `RateLimitedError` (429 + Retry-After) and `ZodError` (422).
- **Money is integer cents (BDT paisa) everywhere.** Never floats. Helpers in `src/server/common/money.ts`.
- Order items are **snapshotted** (name/sku/price copied at checkout) so historical orders stay correct when the catalog changes.
- The repo layer is inconsistent by drift: `catalog.repo.ts` / `reviews.repo.ts` hold real queries; `cart.repo.ts`, `orders.repo.ts`, `coupons.repo.ts` are `{ prisma }` passthroughs and their services call Prisma directly. Don't assume a repo exists.

### Contracts-first workflow

Adding or changing a feature touches layers in this order:

1. `src/contracts/<domain>.ts` — Zod schema + inferred types (shared: server validation *and* client typing).
2. `src/server/<domain>/<domain>.service.ts` — business logic.
3. `src/app/api/**/route.ts` — thin handler.
4. `src/constants/queryKeys.ts` — add/extend the key factory (keeps cache keys from drifting).
5. `src/modules/<domain>/hooks.ts` — React Query wrapper over `src/lib/fetcher.ts` (`apiGet`/`apiSend`, throws typed `ApiClientError`).
6. UI in `src/modules/<domain>/components/` or a page under `src/app`.

Forms use react-hook-form + `zodResolver` with the *same* contract schema. Toasts via `sonner`.

### Auth & RBAC (three layers, all required)

- `src/auth.ts` instantiates Auth.js v5 from `src/server/auth/authOptions.ts`. **JWT strategy** — `id` and `role` are baked into the token at sign-in, so role changes only apply after the token refreshes.
- `src/proxy.ts` — Next 16's middleware file (named `proxy.ts`, not `middleware.ts`). Verifies the JWT and role at the edge for `/dashboard/*`, `/api/admin/*`, `/account/*`. Fast-fail only.
- **Enforcement of record**: every `/api/admin/**` route calls `requireAdminSession()`, and `(dashboard)/layout.tsx` re-checks `role === 'ADMIN'` server-side. Never rely on the edge guard alone.

### Payments (strategy pattern)

- `src/server/payments/gateway.interface.ts` defines `PaymentGateway { init, parseCallback }`. Providers are **DB-free**; `payments.service.ts` owns all persistence and idempotency.
- `registry.ts` maps `PaymentMethod` to a provider: `cod` (auto-confirm), `bank-transfer` (customer submits ref, admin verifies), `bkash` (grant/create/execute token flow), `sslcommerz` (hosted checkout + validator API).
- Callback routes are thin wrappers over `src/app/api/payments/_handlers.ts`.
- **Sandbox fallback**: with no credentials configured, providers redirect to `/api/payments/sandbox/*`, which POSTs back `sandbox_`-prefixed refs. `parseCallback` checks server-side credential presence before trusting that prefix — do not weaken this, it was the project's most critical security flaw.
- `applyCallback` runs in a transaction, dedupes on terminal payment status, flips the order PENDING → CONFIRMED, and writes an `OrderEvent`. Failed/cancelled payments do **not** restock.

**Current launch state: COD only.** `checkout-client.tsx` offers only Cash on Delivery; bKash/SSLCommerz/bank transfer are hidden pending business registration. The API contract (`src/contracts/checkout.ts`) and the registry still accept all four methods — an API-level guard is still outstanding, so don't treat the hidden UI as enforcement.

### Checkout

1. `POST /api/checkout/quote` — read-only: subtotal + coupon validation + shipping (`shipping.ts`: Dhaka 60 BDT / outside 120 BDT, free at 5000 BDT and above).
2. `POST /api/checkout` — `placeOrder` in one `prisma.$transaction`: re-validate stock and coupon, snapshot items, decrement stock, bump coupon usage, create `Payment`, clear cart, write `OrderEvent`.
3. The **route** (not the service) then calls `paymentsService.kickoff` outside the transaction to get the redirect URL.

Multi-step DB writes go inside `prisma.$transaction` and must pass the `tx` client to any helper called within. Known violation: coupon re-validation in checkout uses the global client.

### Cart

Logged-in carts are `Cart`/`CartItem` rows (unique per `userId`; `getCart` uses raw SQL for the snapshot, mutations use the ORM). Guest carts live in localStorage via Zustand (`src/modules/cart/guest-cart.ts`) and are enriched for display through public `POST /api/cart/hydrate`. `useGuestCartMerge` (mounted in `providers.tsx`) merges on login: sums quantities, clamps to stock, transactional.

### Orders

`PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`. Admin transitions go through `ordersService.transition`, validated against an explicit `ALLOWED_TRANSITIONS` map. Both admin and customer cancellation restock atomically via `restockOrderItems`. Every transition writes an `OrderEvent` — that's the audit trail rendered on both the customer and admin order pages.

## Conventions

- Path alias `@/*` maps to `src/*`.
- Slugs via `src/server/common/slug.ts`; pagination via `src/server/common/pagination.ts`.
- Rate limiting (`src/server/common/rate-limit.ts`) is Postgres-backed via the `RateLimitBucket` model so it works across serverless instances. Currently applied to signup, forgot, reset, and checkout only.
- Mailer (`src/server/common/mailer.ts`) uses Resend; with `RESEND_API_KEY` unset it logs and skips instead of sending.
- Component trees: `src/components/ui/*` are generated shadcn primitives (edit sparingly), `src/components/*` are shared app components. `src/app/components/*` and `src/app/common/*` are legacy storefront-specific duplicates — **prefer `src/components` for new shared work.**
- Tests cover pure logic plus some services; there are no API/integration or E2E tests. Pure functions in `src/server/common` are the easiest targets.

## Git flow

`main` = production (auto-deploys on Vercel), `dev` = integration. `feature/*` branches from `main`, PR into `dev`, then `dev` into `main`. Commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`.

## Docs

`docs/context/00-INDEX.md` is the orientation hub — overview/env, architecture, data model, full API reference, frontend map, conventions. `docs/issues/` is the known-flaws fix list (read `01-security.md` before touching payments). `docs/product/FEATURE-GAPS.md` and `SCALE-UP-TODO.md` cover the roadmap. Root `cotext.md` is superseded by `docs/context/`.

These docs are detailed but can lag the code — e.g. `02-architecture.md` still describes the edge guard as cookie-presence-only and the Vitest environment as jsdom, both since changed. Verify against source before relying on a specific claim.
