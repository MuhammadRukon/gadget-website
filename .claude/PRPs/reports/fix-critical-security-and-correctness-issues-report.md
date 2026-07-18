# Implementation Report: Fix Critical Security/Correctness Issues & Harden Core Service Patterns

## Summary
Implemented all 15 tasks from `.claude/PRPs/plans/fix-critical-security-and-correctness-issues.plan.md` on branch `fix/critical-security-and-correctness-issues`: closed the payment sandbox-forgery hole, added (log-only) payment-amount verification, fixed the stock and coupon concurrency races with one reusable conditional-`updateMany` pattern, moved rate limiting to Postgres, added order-transition validation with restock parity, handled payment-kickoff failure cleanly, fixed a real (and more subtle than planned) account-linking vulnerability, upgraded the edge auth guard to verify JWT role, guarded production seeding, fixed a sitemap config conflict, and deleted three dead repo files.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | XL | XL — confirmed |
| Confidence | 8/10 | Matches — one deviation (Task 11) needed deeper investigation than planned, no other surprises |
| Files Changed | ~19 (2 new, 14 updated, 3 deleted) | 25 changed: 4 new (`src/env.ts`, `instrumentation.ts`, `docs/issues/00-fix-scope.md`, `.env.example` not tracked by git — see note), 18 updated, 3 deleted |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Central env validation | ✅ Complete | `src/env.ts`, `instrumentation.ts`, `.env.example` created; `.env` gained `NEXT_PUBLIC_APP_URL` |
| 2 | Fix payment sandbox-trust bypass | ✅ Complete | Reordered credential check before `sandbox_` prefix trust in both providers, exactly as planned |
| 3 | Payment amount verification | ✅ Complete (log-only) | Per your answer, mismatches are logged (`payments.callback.amount_mismatch`) but do not block the payment yet |
| 4 | Remove unsafe verify default | ✅ Complete | Confirmed admin UI already sends `outcome` explicitly before removing the default |
| 5 | Fix stock oversell race | ✅ Complete | Conditional `updateMany` + count check in `checkout.service.ts` |
| 6 | Fix coupon usage race + tx threading | ✅ Complete | `couponsService.validate` now takes an optional `db` param; checkout passes `tx` |
| 7 | Order transition map + admin-cancel restock | ✅ Complete | Per your answer, admin cancel now restocks (previously intentional no-restock) |
| 8 | Restock on failed/cancelled payments | ✅ Complete | Uses the shared `restockOrderItems` helper (see deviation note) |
| 9 | Kickoff-failure handling | ✅ Complete | Added `checkoutService.cancelOrphanedOrder`; extracted `restockOrderItems` once all 3 call sites existed, as the plan's GOTCHA specified |
| 10 | Postgres-backed rate limiter | ⚠️ Code complete, migration not run | See "Issues Encountered" — no DB connectivity in this sandbox |
| 11 | Disable dangerous account linking | ✅ Complete, **deviated** | See "Deviations" — the planned fix (remove the flag) would have done nothing |
| 12 | Edge JWT/role verification | ✅ Complete | `proxy.ts` now uses `getToken` + role check instead of cookie presence |
| 13 | Require seed admin creds in production | ✅ Complete | As planned |
| 14 | Sitemap config + APP_URL | ✅ Complete | As planned |
| 15 | Delete vestigial repos | ✅ Complete | Re-confirmed zero importers immediately before deleting |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (typecheck) | ✅ Pass | `npm run typecheck` clean after every task group |
| Lint | ⚠️ Pre-existing tooling failure | `npm run lint` (`next lint`) is broken — removed in Next 16. Direct `npx eslint .` crashes with a circular-JSON error in `eslint-config-next`'s flat-config compat layer. **Confirmed pre-existing**: reproduced identically on `git stash` (unmodified branch). Not caused by this work; a separate tooling fix is needed (out of scope) |
| Unit Tests | ⚠️ 26/30 pass | The 4 failures are all in the rewritten `rate-limit.test.ts`, and fail only because the `RateLimitBucket` table/migration doesn't exist yet in the reachable DB (see Issues). All 5 other test files (26 tests) pass unchanged |
| Build | ✅ Pass | `npm run build` succeeds; sitemap.xml now shows a real `revalidate: 1h` instead of always-dynamic |
| Integration | N/A | No dev server smoke-test run (no browser session in this environment); recommend manual pass per the plan's "Browser/Manual Validation" checklist before merging |
| Edge Cases | ⚠️ Not exercised | Concurrency races (Tasks 5/6), kickoff failure (Task 9), and rate-limit throttling (Task 10) are implemented per the plan's designed logic but not exercised live — same DB-connectivity blocker |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `src/env.ts` | CREATED | +26 |
| `instrumentation.ts` | CREATED | +5 |
| `.env.example` | CREATED | +37 |
| `docs/issues/00-fix-scope.md` | CREATED | +48 (from planning phase) |
| `prisma/schema.prisma` | UPDATED | +11 |
| `prisma/seed.ts` | UPDATED | +7 |
| `src/app/(public)/login/page.tsx` | UPDATED | +7/-1 |
| `src/app/api/auth/{forgot,reset,signup}/route.ts` | UPDATED | +1/-1 each |
| `src/app/api/checkout/route.ts` | UPDATED | +21/-12 |
| `src/app/sitemap.ts` | UPDATED | -1 |
| `src/contracts/payments.ts` | UPDATED | +1/-2 |
| `src/proxy.ts` | UPDATED | +19/-12 |
| `src/server/auth/authOptions.ts` | UPDATED | +9/-2 |
| `src/server/checkout/checkout.service.ts` | UPDATED | +58/-22 |
| `src/server/common/rate-limit.ts` | UPDATED | +40/-29 |
| `src/server/common/__tests__/rate-limit.test.ts` | UPDATED | rewritten (async + live DB) |
| `src/server/coupons/coupons.service.ts` | UPDATED | +6/-3 |
| `src/server/orders/orders.service.ts` | UPDATED | +38/-17 |
| `src/server/payments/gateway.interface.ts` | UPDATED | +6 |
| `src/server/payments/payments.service.ts` | UPDATED | +18/-8 |
| `src/server/payments/providers/{bkash,sslcommerz}.ts` | UPDATED | +11/-6 each |
| `src/server/cart/cart.repo.ts`, `src/server/orders/orders.repo.ts`, `src/server/coupons/coupons.repo.ts` | DELETED | -3 each |
| `docs/context/02-architecture.md` | UPDATED | 3 stale claims corrected (sandbox trust, admin restock, rate-limit storage) |
| `docs/issues/README.md` | UPDATED | +1 (links new scope doc) |

## Deviations from Plan

1. **Task 11 (account linking) — the plan's literal fix would not have worked.** Investigating `authOptions.ts` before editing revealed this project has no `PrismaAdapter` attached (its own header comment confirms this deliberate choice). NextAuth's `allowDangerousEmailAccountLinking` flag only affects adapter-driven linking — without an adapter, it's a no-op, and the actual linking logic is the custom `signIn` callback, which unconditionally linked any Google sign-in to an existing user found by email. Removing the flag alone would have changed nothing. **Actual fix**: the `signIn` callback now refuses to link (`return false`) when the existing user already has a `passwordHash` set — blocking the real attack (attacker pre-registers a victim's email via credentials, victim later "logs in with Google" and lands in the attacker's account) while still allowing legitimate re-linking of an OAuth-only account. Also added minimal error-toast handling on the login page for the resulting `AccessDenied` redirect, since none existed.
2. **Restock-helper extraction sequencing** — exactly as the plan anticipated: implemented Tasks 7 and 8 with inline restock loops first, then extracted the shared `restockOrderItems(tx, items)` helper into `orders.service.ts` once Task 9 added the third call site, rather than pre-building the abstraction.
3. **Coupon amount check simplification** — the plan's first draft of Task 6 sketched a `usedCount: { lt: usageLimit }` comparison directly in `updateMany.where`, then self-corrected to a fresh in-transaction read followed by a conditional update (since Prisma can't do column-to-column comparisons). Implemented per that corrected version.

## Issues Encountered

**No outbound network access in this sandbox** (confirmed via DNS resolution timing out for any host, not just the database — `db.prisma.io`, `github.com`, `prisma.io` all failed identically, with and without `dangerouslyDisableSandbox`). This blocked:
- Running `npx prisma migrate dev --name add_rate_limit_bucket` — **you need to run this yourself** in an environment with DB connectivity before Task 10 is live. `npx prisma generate` (schema→types only, no network needed) was run successfully so typecheck/build already reflect the new `RateLimitBucket` model.
- The rewritten `rate-limit.test.ts`, which now legitimately needs a live DB (documented in its own header comment as the chosen tradeoff, since no Prisma-mocking convention exists in this repo). These 4 tests will pass once the migration above is run.
- Any live manual validation of the concurrency fixes (Tasks 5, 6, 9, 10) against real concurrent requests — the code follows the plan's designed pattern, but a live check (as listed in the plan's "Manual Validation" checklist) is still recommended before considering this production-ready.

**`next lint` is broken independent of this work** — Next.js 16 removed the `next lint` subcommand; `package.json`'s `lint` script still calls it. `npx eslint .` directly also crashes (pre-existing ESLint 9 / `eslint-config-next` flat-config incompatibility, reproduced identically on the unmodified branch via `git stash`). Recommend a separate, unrelated task to fix the lint tooling.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `src/server/common/__tests__/rate-limit.test.ts` | 4 (rewritten, not new) | Rate-limit window/refill/isolation behavior against the new Postgres-backed implementation — blocked on migration, see above |

The plan's Testing Strategy also called for new tests on `payments.service.ts` (amount-mismatch handling) and `orders.service.ts` (transition-map rejection, restock-on-cancel). **These were not written** in this pass — given the DB-connectivity blocker made it impossible to verify any new DB-touching test would actually pass here, I prioritized getting the implementation itself typecheck/build-clean over adding untested new test files. Recommend adding these once the migration is run and you can verify tests pass in a connected environment.

## Next Steps
- [ ] **Run `npx prisma migrate dev --name add_rate_limit_bucket`** in an environment with DB access — this is the one remaining step before Task 10 is fully live.
- [ ] Add the still-missing unit tests for `payments.service.ts` (amount mismatch) and `orders.service.ts` (transition map, restock) once migration is run.
- [ ] Manually verify the concurrency fixes (Tasks 5, 6, 9, 10) per the plan's "Manual Validation" checklist, ideally against a real dev DB.
- [ ] Decide whether to fix the broken lint tooling separately (pre-existing, unrelated to this work).
- [ ] Code review via `/code-review`
- [ ] Create PR via `/prp-pr`
