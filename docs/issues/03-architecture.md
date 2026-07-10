# Architectural Concerns

These aren't bugs today, but they will hurt as the shop grows. Each note includes a cheap path forward given the free-tier constraint.

## 1. Vestigial repo layer

`cart.repo.ts`, `orders.repo.ts`, `coupons.repo.ts` are just `{ prisma }` passthroughs, while `catalog.repo.ts` and `reviews.repo.ts` hold real query logic. Services mostly call Prisma directly, so the stated goal ("server logic framework-agnostic enough to migrate to standalone services later") isn't actually achievable. **Decide**: commit to real repos (all queries behind them, accepting a `tx` client) or delete the empty ones. The `tx`-parameter refactor also fixes correctness issue #6.

## 2. No shared concurrency primitive

Stock, coupon, and callback races (correctness #1, #2; security #9) all stem from the same missing pattern: conditional `updateMany` / `SELECT FOR UPDATE`. Fix once, apply everywhere. Zero infra cost — it's just SQL discipline.

## 3. No server-side pagination in the admin

Every admin list endpoint returns the entire table — orders come with items+payments+user eagerly included for every row (`ordersService.listAll`). `DataTable` paginates client-side. Payload size and DB load grow linearly with sales. **Fix**: cursor pagination on admin lists (the public catalog already has `src/server/common/pagination.ts` patterns to reuse).

## 4. Analytics computed in application memory

`analytics.service.overview` loads all 30-day order items into memory for profit/top-sellers, and `customersCount` fetches distinct rows and takes `.length`. Fine now; unbounded later. **Fix**: `groupBy`/`aggregate` in SQL; no caching needed until traffic justifies it.

## 5. Payment kickoff outside the order transaction

See correctness #7 — structural: there's no compensation/saga step for gateway-init failure. A minimal "retry payment" endpoint keeps this simple without a queue.

## 6. No transactional email layer

Password reset works only in dev (link shown inline); order confirmations, status changes, and warranty updates never notify customers. Everything labeled "visible to the customer" assumes they revisit the site. **Fix**: one thin `mailer.ts` behind an interface; Resend/Brevo free tiers cover MVP volume. This unblocks several product gaps at once.

## 7. No background job mechanism

Order expiry, stock-reservation cleanup, and low-stock alerts all want a scheduled tick. Vercel free tier includes limited cron — one daily/hourly cron route is enough for the MVP; design the handlers to be idempotent.

## 8. Missing central env validation

Providers each read `process.env.*` with silent sandbox fallbacks; a half-configured deploy quietly degrades (which is what turns the sandbox branch into a vulnerability). **Fix**: single zod-validated `src/env.ts` imported by everything; fail the build/boot on missing prod vars.

## 9. Duplicated component trees

`src/components/*` vs `src/app/components/*` + `src/app/common/*` hold overlapping shared UI (two button systems, two checkbox implementations, breadcrumb component that's never used). Consolidate into `src/components` gradually.

## 10. Test coverage is pure-logic only

Unit tests cover money/slug/shipping/rate-limit/errors/fetcher. No service-layer tests (checkout, payments callback idempotency), no API integration tests, no E2E. The highest-value additions, in order: checkout `placeOrder` (with a test DB or mocked tx), `applyCallback` idempotency, coupon validation edge cases. These are exactly the areas where the race bugs live.

## 11. Single ADMIN role

Any admin can promote/demote anyone (including themselves; no last-admin guard). Fine for a one-person shop; revisit before adding staff. Cheap guard now: forbid self-role-change and demoting the last admin in `users.service.ts`.

## 12. Prisma connection usage on serverless

`src/lib/prisma.ts` is the standard singleton, but on Vercel each warm instance holds its own connection pool against Prisma-hosted Postgres. At MVP scale this is fine; if connection errors appear under burst, enable Prisma Accelerate (has a free tier) or set a low `connection_limit` in `DATABASE_URL` before considering anything paid.
