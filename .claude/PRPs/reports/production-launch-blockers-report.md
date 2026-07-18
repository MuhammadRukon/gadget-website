# Implementation Report: Production Launch Blockers

## Summary
Implemented all 7 tasks from `.claude/PRPs/plans/production-launch-blockers.plan.md` on branch `fix/critical-security-and-correctness-issues`: recorded the missing `RateLimitBucket` migration (the limiter code from the previous pass was already complete — only the migration was missing), flipped payment amount verification from log-only to enforcing (mismatch → FAILED + restock), built a fail-soft Resend mailer and wired it to password reset, order confirmation, payment results, and order status changes, created the five trust/legal/contact pages required for gateway merchant approval, and added the unit tests the previous report carried over. Nothing already implemented per `fix-critical-security-and-correctness-issues-report.md` was redone.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | L | L — confirmed |
| Files Changed | ~20 (9 new, 10 updated) | 19: 9 new, 10 updated |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | RateLimitBucket migration | ✅ Complete | The live DB already had the table (schema previously pushed), so the migration was generated from schema diff and recorded via `prisma migrate resolve --applied`. `migrate status` clean. Also fixed the 4 rate-limit tests: they were flaking not because of the table but because their 1s windows expired during remote-DB round-trips — widened to latency-tolerant windows. All 4 pass. |
| 2 | Enforce amount verification | ✅ Complete | Mismatched SUCCEEDED callbacks now coerce to FAILED before the status switch, so the existing FAILED branch restocks and writes a distinct `amount mismatch` order event. Verified provider conversion (`takaToCents(parseFloat(amount))`, `Math.round`) is sound; `verifiedAmountCents` is only set on live validation paths so sandbox callbacks are unaffected. **Still recommended**: confirm one real SSLCommerz sandbox callback's amount format before going live. |
| 3 | mailer.ts + env | ✅ Complete | `src/server/common/mailer.ts` — Resend HTTP API via plain `fetch`, no new dependency. Env-gated (`RESEND_API_KEY`, `EMAIL_FROM` optional in `src/env.ts`); logs `mailer.skipped` when unconfigured, `mailer.send_failed` on non-2xx/network error, never throws. Also added the missing `NEXT_PUBLIC_APP_URL` to `.env.example` (required by env.ts but undocumented). |
| 4 | Password reset email | ✅ Complete | Sent fire-and-forget inside `issuePasswordReset` after the token row is created. Dev `devResetUrl` behavior and the anti-enumeration generic response unchanged. |
| 5 | Order/payment/status emails | ✅ Complete | Checkout confirmation sends only after gateway kickoff succeeds (a failed kickoff cancels the order — no email for a dead order). `applyCallback` collects notification context inside the tx, sends after commit, and only on actual transitions (idempotent no-ops don't email). `transition` includes the customer email in its existing query and sends after commit. |
| 6 | Trust/legal/contact pages | ✅ Complete | `/about`, `/contact`, `/privacy-policy`, `/terms`, `/refund-policy` — real conservative drafts (7-day return window, 10-business-day refunds, COD/bKash/SSLCommerz/bank-transfer coverage) built from facts already in the codebase. Footer links rewired (dead `Blog`/`Online Delivery` links removed; `Complain / Advice` → `/contact`). All five added to the sitemap. **Owner must review the legal copy (especially refund windows/timelines) before gateway submission.** |
| 7 | Carried-over unit tests | ✅ Complete | `payments.service.test.ts` (3 tests: match → CONFIRMED, mismatch → FAILED + restock + event, terminal idempotency) and `orders.service.test.ts` (4 tests: transition-map rejection, mapped transition + event, cancel restock, non-cancel no-restock). Live-DB style mirroring `rate-limit.test.ts`, randomized fixtures with cleanup. |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Typecheck | ✅ Pass | Clean |
| Unit tests | ✅ 37/37 pass | Up from 26 passing / 4 blocked: 4 rate-limit (unblocked), 7 new |
| Build | ✅ Pass | All five static pages appear as prerendered routes; sitemap keeps `revalidate: 1h` |
| Migrate status | ✅ Clean | 2 migrations, none pending |
| Manual/browser | ⚠️ Not run | No dev-server session in this pass. Remaining checklist: forgot-password with a real `RESEND_API_KEY`, one sandbox SSLCommerz payment (also confirms amount format for Task 2), footer link click-through |

## Deviations from Plan
1. **Migration was `resolve --applied`, not `migrate dev`** — the live DB already contained the table (schema had been pushed previously), so the migration file was generated from the schema diff and marked applied. Same end state; a fresh DB now gets the table via `migrate deploy`.
2. **Rate-limit test timing fix (unplanned)** — the plan assumed the 4 tests would pass once the table existed; they actually flaked because their 1s windows expired across remote-DB round-trips. Widened the main policy window to 30s and gave the refill test its own 6s window + explicit timeout.

## Next Steps (before enabling live gateway credentials)
- [ ] Set `RESEND_API_KEY` + `EMAIL_FROM` in production env (and later verify a sending domain in Resend to replace `onboarding@resend.dev`).
- [ ] Run one SSLCommerz sandbox payment end-to-end to confirm the callback amount format (the enforcement is live; this validates the conversion against reality).
- [ ] Owner review of `/privacy-policy`, `/terms`, `/refund-policy` copy before submitting for gateway merchant approval.
- [ ] `npx prisma migrate deploy` in any other environment (staging/prod) so the RateLimitBucket table exists there.
- [ ] Code review via `/code-review`, then PR.
