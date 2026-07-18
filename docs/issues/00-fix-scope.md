# Fix Scope — 2026-07-12 (✅ completed 2026-07-18 — see `.claude/PRPs/reports/fix-critical-security-and-correctness-issues-report.md`; follow-up launch-blocker items in `.claude/PRPs/reports/production-launch-blockers-report.md`)

This file decides **what gets fixed now** out of the full flaw list in this folder, and why. It exists because "fix the current issues" against 16+ documented findings needs an explicit cut line — otherwise scope creeps into a rewrite. Full evidence for every item below already lives in [01-security.md](./01-security.md), [02-correctness.md](./02-correctness.md), [03-architecture.md](./03-architecture.md); this file does not repeat file:line evidence, only the scoping decision.

Implementation plan: [`.claude/PRPs/plans/fix-critical-security-and-correctness-issues.plan.md`](../../.claude/PRPs/plans/fix-critical-security-and-correctness-issues.plan.md).

## Why this cut line

The goal stated for this round: **make the shop safe to actually run** (no forgeable payments, no oversold stock, no double-spent coupons) and **fix the two structural gaps that make those bugs possible in the first place** (no shared concurrency pattern, no central env validation) — without expanding into features, UX polish, or infra that isn't needed yet. Everything deferred below is either (a) not a correctness/security risk, just a nice-to-have, or (b) needs a design decision or new infra (cron, email provider, denormalized columns) that's bigger than a "fix" and belongs in its own plan.

## In scope now

All 16 items below shipped. #2 landed log-only in the first pass and was flipped to enforcing (mismatch → FAILED + restock) in the launch-blockers pass; #6's migration was also recorded in that pass.

| # | Issue | Source | Why now |
| --- | --- | --- | --- |
| 1 | ~~Payment success callbacks forgeable via `sandbox_` prefix~~ (✅ completed) | security §1 | CRITICAL — real money bypass |
| 2 | ~~No amount verification on gateway callbacks~~ (✅ completed — enforcing) | security §2 | HIGH — partial-payment fraud |
| 3 | ~~Admin payment verify defaults to SUCCEEDED on empty body~~ (✅ completed) | security §4 | Trivial one-line fix, same file family as #1/#2 |
| 4 | ~~Stock oversell race in checkout~~ (✅ completed) | correctness §1 | HIGH — sells inventory you don't have |
| 5 | ~~Coupon usage-limit race (+ tx-client bug that causes it)~~ (✅ completed) | correctness §2, §6 | HIGH — same root cause as #4, one pattern fixes both |
| 6 | ~~In-memory rate limiting ineffective on Vercel~~ (✅ completed — incl. migration) | security §3 | HIGH — auth/checkout abuse currently unthrottled in prod |
| 7 | ~~Order status transitions unvalidated~~ (✅ completed) | correctness §4 | Admin can accidentally corrupt order state; cheap state-machine guard |
| 8 | ~~Stock leaks on abandoned online payments~~ (✅ completed — restock; expiry sweep still deferred) | correctness §3 (partial) | Restock-on-terminal-failure is cheap; full expiry sweep deferred (needs cron, see below) |
| 9 | ~~Payment kickoff failure orphans the order~~ (✅ completed) | correctness §7 | Currently a silent 500 with a half-created order; needs a clean failure path |
| 10 | ~~Default admin credentials in seed script~~ (✅ completed) | security §5 | One guard clause |
| 11 | ~~`allowDangerousEmailAccountLinking: true`~~ (✅ completed — via `signIn` callback fix) | security §6 | One-line disable, no new flow needed |
| 12 | ~~Middleware checks cookie presence only~~ (✅ completed) | security §7 | Role is already in the JWT; verifying it at the edge is cheap (no DB read needed) |
| 13 | ~~Env var naming drift (`NEXT_PUBLIC_APP_URL` vs `NEXT_PUBLIC_BASE_URL`) + sitemap `force-dynamic` contradiction~~ (✅ completed) | correctness §11, §12 | Folded into the env-validation task below |
| 14 | ~~No central env validation~~ (✅ completed) | architecture §8 | Prerequisite for #10 and #13; fail fast on missing prod config instead of silently degrading (which is *why* #1 was exploitable) |
| 15 | ~~No shared concurrency primitive~~ (✅ completed) | architecture §2 | This *is* the fix for #4/#5 — conditional `updateMany`, not a new abstraction |
| 16 | ~~Vestigial repo passthroughs (`cart.repo.ts`, `orders.repo.ts`, `coupons.repo.ts`)~~ (✅ completed — deleted) | architecture §1 | Confirmed zero external imports (grepped) — pure dead indirection, delete rather than pretend they're a real repo layer |

## Deferred (explicitly out of scope for this pass)

| Issue | Source | Why deferred |
| --- | --- | --- |
| Price sort only sorts current page | correctness §5 | Needs a denormalized `minPriceCents` column + backfill/maintenance strategy — a small feature, not a one-line fix |
| Warranty actor discarded, category cycle check, negative-margin variants | correctness §8–10 | LOW severity, no user-facing breakage today |
| Server-side admin pagination | architecture §3 | Real work (cursor pagination across every admin list) — fine at current order volume, revisit per `docs/product/SCALE-UP-TODO.md` |
| Analytics computed in app memory | architecture §4 | Fine at current volume; revisit when `groupBy`/`aggregate` becomes necessary |
| Full stale-order expiry sweep (cron) | architecture §7 | Needs a Vercel cron route; restock-on-callback (#8 above) removes most of the pain without new infra |
| Transactional email layer | architecture §6 | Whole feature area, tracked in `docs/product/FEATURE-GAPS.md` P0 |
| Duplicated component trees | architecture §9 | Cosmetic/DX, no correctness impact |
| Test coverage expansion beyond this fix set | architecture §10 | This plan adds targeted tests for the changed logic only; broader service-layer test buildout is its own effort |
| Single ADMIN role / last-admin guard | architecture §11 | Fine for a one-person shop today |
| Prisma connection pooling on serverless | architecture §12 | No symptoms observed yet; documented trigger already exists |
| All Frontend/UX findings | 04-frontend-ux.md | None are security/data-integrity risks; separate plan once functional/safety work lands |

## Non-goals for this pass

- No new payment gateways, no Redis, no queue/saga system. The rate-limit fix is Postgres-backed (matches the existing free-tier constraint and the codebase's existing conditional-`updateMany` idiom introduced for the stock/coupon fix) instead of adding new infra.
- No refactor of `process.env.*` call sites beyond what's touched by these fixes. `src/env.ts` is introduced as a foundation; migrating every existing read is future work, not this pass.
- No retry-payment endpoint. Kickoff failure fails cleanly (order cancelled + restocked); a "resume payment" UX is a product decision, not a bug fix.
