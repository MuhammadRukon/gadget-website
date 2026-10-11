# Plan: Production Launch Blockers — Rate-Limit Migration, Payment Amount Enforcement, Email, Trust Pages

## Summary
The previous pass (`completed/fix-critical-security-and-correctness-issues.plan.md`) made the payment/checkout code safe, but the shop still **cannot go live** for four reasons: (1) the `RateLimitBucket` table has no migration — the limiter *code* is fully implemented, only the migration was never generated (no DB connectivity in that environment), so every rate-limited route (login, signup, forgot/reset password, checkout) throws at runtime against a fresh database; (2) payment amount verification is log-only, so a tampered gateway callback with the wrong amount still SUCCEEDS; (3) password reset is a dead end in production (reset link only surfaced in dev) and no order email of any kind is sent; (4) the footer's Privacy/Terms/Refund links all point to `/` — SSLCommerz/bKash merchant approval requires published refund and privacy policies, so this blocks enabling live gateway credentials. This plan fixes exactly these four blockers plus the unit tests the previous report explicitly carried over. Nothing already implemented in that report is redone; nothing from FEATURE-GAPS P1+ is included.

## User Story
As the shop owner, I want the deployed site to actually function end-to-end (auth routes don't 500, customers can recover passwords, orders send confirmations, payment amounts are enforced) and to satisfy gateway merchant requirements (published policies, contact channel), so that I can enable live payment credentials and open the shop.

## Problem → Solution
- Rate-limited routes crash on a fresh DB (missing table) → generate and apply the `add_rate_limit_bucket` migration; **no code changes** — the implementation already landed in the previous pass.
- Amount mismatch only logged → route mismatched SUCCEEDED callbacks into the existing FAILED branch (which already restocks).
- No email at all → one `mailer.ts` (Resend HTTP API via `fetch`, no new dependency), fail-soft, wired to password reset, order confirmation, payment result, and order status changes.
- Trust/legal links point to `/` → five static pages (`about`, `contact`, `privacy-policy`, `terms`, `refund-policy`) + real footer links.
- Untested security-critical logic → the payments/orders unit tests the previous report deferred.

## Metadata
- **Complexity**: L (one migration, one enforcement flip, one small infra module + call sites, five static pages, tests)
- **Source PRD**: `docs/product/FEATURE-GAPS.md` (P0 table only) + `.claude/PRPs/reports/fix-critical-security-and-correctness-issues-report.md` "Next Steps"
- **PRD Phase**: P0 — blockers for running a real shop
- **Estimated Files**: ~20 (9 new, 10 updated, 1 migration dir)

---

## UX Design

Mostly invisible infrastructure. User-visible changes:

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Forgot password (production) | Generic message, no email ever arrives — account is unrecoverable | Reset email actually delivered | Response body unchanged (no account enumeration) |
| Order placed | No email | Confirmation email with order number, total, payment instructions | Fire-and-forget; checkout never fails because email failed |
| Payment succeeded/failed (gateway) | No email | "Payment received" / "Payment failed, stock released" email | Sent after the callback transaction commits |
| Admin changes order status | No email | Status update email (CONFIRMED/SHIPPED/DELIVERED/CANCELLED) | Same fail-soft rule |
| Gateway pays wrong amount | Payment SUCCEEDED + error log | Payment marked FAILED, stock restocked, order stays PENDING | Uses the existing FAILED branch in `applyCallback` |
| Footer: About/Privacy/Terms/Refund | All link to `/` | Real pages | Contact page also linked |
| Any rate-limited route on a fresh DB | 500 (table missing) | Works | Migration applied |

No design work: static pages use the existing `(public)` layout + `Container` component, plain prose consistent with the site's Tailwind usage.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/reports/fix-critical-security-and-correctness-issues-report.md` | Next Steps + Issues | The carried-over work this plan finishes |
| P0 | `prisma/schema.prisma` | `RateLimitBucket` model | What the migration must create |
| P0 | `src/server/payments/payments.service.ts` | 100–190 | `applyCallback` — the log-only block to flip (126–138) and the FAILED/restock branch to route mismatches into (161–181) |
| P0 | `src/server/auth/auth.service.ts` | 45–60 | `issuePasswordReset` — where the reset email send belongs (user + raw token both in scope here) |
| P0 | `src/app/api/auth/forgot/route.ts` | all | Dev-only token exposure to keep; prod branch that the mailer makes real |
| P1 | `src/app/api/checkout/route.ts` | all | Where order-confirmation email hooks in after `placeOrder` succeeds |
| P1 | `src/server/orders/orders.service.ts` | 33–40, 122–160 | `ALLOWED_TRANSITIONS` + `transition` — status-email hook point (send AFTER the `$transaction` returns, never inside it) |
| P1 | `src/env.ts` | all | Where `RESEND_API_KEY` / `EMAIL_FROM` are declared (optional — absence = dev/log mode, same idiom as gateway creds) |
| P1 | `src/app/components/footer/footer.tsx` | 26–50 | The link array to point at real pages |
| P2 | `src/app/(public)/layout.tsx` | all | Layout the five static pages inherit |
| P2 | `src/server/common/__tests__/rate-limit.test.ts` | header comment | These 4 tests define "migration worked" |
| P2 | `src/server/payments/providers/sslcommerz.ts`, `bkash.ts` | amount parsing | Confirm Taka-string → cents conversion before enforcement (Task 2 gate) |

## External Documentation
- Resend HTTP API: `POST https://api.resend.com/emails` with `Authorization: Bearer $RESEND_API_KEY`, JSON body `{ from, to, subject, html }`. Free tier: 100 emails/day — fine for launch volume. Use plain `fetch`; **do not add the `resend` npm package**.
- Resend requires a verified sending domain for a custom `from`; until DNS is set up, `onboarding@resend.dev` works for testing. `EMAIL_FROM` env var covers both phases.
- SSLCommerz sandbox: confirm the `amount` field format (decimal string in Taka) in one real sandbox callback before trusting Task 2's enforcement in production — the previous plan flagged this as unverified and that is *why* enforcement was deferred.

---

## Patterns to Mirror

### ENV_GATE — optional creds = degraded mode, not crash
// SOURCE: src/server/payments/providers/sslcommerz.ts:60-66
```ts
function getCreds() {
  const id = process.env.SSLCOMMERZ_STORE_ID;
  const pwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
  if (!id || !pwd) return null;
  ...
}
```
The mailer follows the same idiom: no `RESEND_API_KEY` → log the email payload (`log.info('mailer.skipped', ...)`) and return, never throw. Declare both vars as `.optional()` in `src/env.ts` like the gateway creds.

### FAIL_SOFT_SIDE_EFFECT — never let a notification break a transaction
// SOURCE: src/app/api/checkout/route.ts:34-38 (kickoff failure isolation)
Every email send is wrapped the same way: `sendMail(...).catch((err) => log.error('mailer.send_failed', {...}))` — fire-and-forget, after the DB transaction has committed. **Never `await` a mail send inside `prisma.$transaction`.**

### TERMINAL_FAILURE_BRANCH — where amount mismatch routes to
// SOURCE: src/server/payments/payments.service.ts:161-181
Task 2 does not invent a new path: a mismatched SUCCEEDED callback is coerced to FAILED *before* the status switch, so restock + event emission come for free.

### STATIC_PAGE — public route group page
New pages are server components under `src/app/(public)/<slug>/page.tsx`, wrapped in the existing `Container`, exporting `metadata` (title/description) like other public pages. No client components needed.

---

## Files to Change

| File | Action | What |
|---|---|---|
| `prisma/migrations/<ts>_add_rate_limit_bucket/migration.sql` | CREATED (generated) | `prisma migrate dev --name add_rate_limit_bucket` — migration only, code already exists |
| `src/server/common/mailer.ts` | CREATE | `sendMail({to, subject, html})` via Resend fetch; env-gated; fail-soft; + HTML builders for the 4 email kinds |
| `src/env.ts` | UPDATE | + `RESEND_API_KEY: z.string().optional()`, `EMAIL_FROM: z.string().optional()` |
| `.env.example` | UPDATE | Document both vars |
| `src/server/auth/auth.service.ts` | UPDATE | `issuePasswordReset` sends reset email (link built from `NEXT_PUBLIC_APP_URL`) |
| `src/app/api/checkout/route.ts` | UPDATE | Fire order-confirmation email after successful `placeOrder` |
| `src/server/payments/payments.service.ts` | UPDATE | (a) coerce amount-mismatch SUCCEEDED → FAILED; (b) fire payment-result email after `applyCallback` tx commits |
| `src/server/orders/orders.service.ts` | UPDATE | Fire status-change email after `transition` tx commits |
| `src/app/(public)/about/page.tsx` | CREATE | Company intro (Cryptech Ltd, Hazaribagh, Dhaka — details already in footer) |
| `src/app/(public)/contact/page.tsx` | CREATE | Phone/WhatsApp, email, address |
| `src/app/(public)/privacy-policy/page.tsx` | CREATE | Data collected, use, cookies, third parties (Cloudinary, gateways, Google OAuth) |
| `src/app/(public)/terms/page.tsx` | CREATE | Ordering, pricing, payment methods, warranty terms |
| `src/app/(public)/refund-policy/page.tsx` | CREATE | Return window, condition rules, refund method/timeline (SSLCommerz requires this published) |
| `src/app/components/footer/footer.tsx` | UPDATE | Point link array at the five real routes |
| `src/app/sitemap.ts` | UPDATE | Add the five static routes |
| `src/server/payments/__tests__/payments.service.test.ts` | CREATE | Amount-mismatch → FAILED + restock; idempotency no-op (carried over) |
| `src/server/orders/__tests__/orders.service.test.ts` | CREATE | Transition map rejection; cancel restocks (carried over) |

## NOT Building
Everything already implemented per the previous report (sandbox-trust fix, races, rate-limiter code, transition map, kickoff failure handling, edge JWT, seed guard, env validation) — untouched. Also out:
- Everything in FEATURE-GAPS P1/P2/P3 (quantity selector, related products, profile page, SMS, admin pagination, refund workflow UI, wishlist, …).
- **Warranty-update emails** — not a launch gate; trivial follow-up once the mailer exists.
- **Cron expiry sweep for stale orders** — still deferred per `docs/issues/00-fix-scope.md`.
- **Lint tooling repair** (`next lint` removed in Next 16) — pre-existing, zero runtime impact; separate chore.
- **Resend domain DNS setup** — owner action, not code.
- **CMS/admin editing for legal pages** — static TSX is fine at this stage.

## Step-by-Step Tasks

### Task 1: Create and apply the `RateLimitBucket` migration (BLOCKER — migration only, no code)
Run `npx prisma migrate dev --name add_rate_limit_bucket` against the dev DB. Verify the 4 tests in `src/server/common/__tests__/rate-limit.test.ts` now pass. If DB connectivity is unavailable, generate the SQL with `prisma migrate diff` into a properly named migration folder and mark `migrate deploy` as the one manual step.

### Task 2: Enforce payment amount verification (HIGH — fraud gate)
Confirm the providers' amount parsing (`sslcommerz.ts`/`bkash.ts`) converts Taka decimal strings to cents. In `applyCallback`: when a SUCCEEDED outcome carries `verifiedAmountCents` ≠ `payment.amountCents`, keep the `log.error`, coerce the effective status to `FAILED` before the status switch (existing branch restocks + writes the event), with a distinct event note (`amount mismatch`). Callbacks without an amount field remain trusted.

### Task 3: `mailer.ts` + env plumbing
`src/server/common/mailer.ts`: `sendMail({ to, subject, html })` — if `RESEND_API_KEY`/`EMAIL_FROM` missing, `log.info('mailer.skipped', ...)` and return; else `fetch` Resend, non-2xx → `log.error('mailer.send_failed', ...)`, never throw. Export builders: `passwordResetEmail`, `orderConfirmationEmail`, `paymentResultEmail`, `orderStatusEmail` — plain HTML strings. Add both vars to `src/env.ts` (optional) and `.env.example`.

### Task 4: Wire password reset email (P0 — reset is dead in prod)
In `authService.issuePasswordReset`, after the token row is created, fire-and-forget `sendMail` to `user.email` with `${NEXT_PUBLIC_APP_URL}/reset-password?token=${raw}`. Keep the dev-only `devResetUrl` branch and the generic prod response (no enumeration).

### Task 5: Wire order + payment + status emails
- `checkout/route.ts`: after `placeOrder` succeeds, fire order-confirmation email (session user has the email).
- `payments.service.applyCallback`: return enough context from the tx (order number, user email, applied status), send the payment-result email after the tx resolves — only when this callback actually transitioned the payment (not on idempotent no-ops).
- `orders.service.transition`: include the order user's email in the existing findUnique, send after the tx returns.
All sends follow FAIL_SOFT_SIDE_EFFECT.

### Task 6: Trust/legal + contact pages, footer, sitemap (P0 — gateway approval gate)
Create the five pages under `(public)`, each a server component with `export const metadata` and real content drafted from what the code establishes (payment methods, warranty claims, self-cancellation, contact details from the footer). Conservative real drafts (7-day return window, refunds to original payment method within 10 business days) — not lorem ipsum; flag for owner review. Update the footer array; add routes to `sitemap.ts`.

### Task 7: Carried-over unit tests
- `payments.service.test.ts`: amount mismatch coerces to FAILED + restocks; terminal payment no-ops on second callback.
- `orders.service.test.ts`: disallowed transitions throw `ConflictError`; CANCELLED transition restocks.
Mirror `rate-limit.test.ts` conventions (live dev DB + cleanup).

## Testing Strategy
- Existing suite stays green — including the 4 rate-limit tests Task 1 unblocks (30/30 target, up from 26/30).
- New tests per Task 7.
- Mailer: no unit test (thin env-gated fetch wrapper); its skip path is exercised by every test running without `RESEND_API_KEY`.

## Validation Commands
```bash
npm run typecheck
npm run test              # 30 existing + new payments/orders tests
npm run build             # five new static routes appear
npx prisma migrate status # no pending migrations
```

## Manual Validation
1. Fresh DB → signup, login, forgot-password, checkout respond without 500.
2. Forgot password with `RESEND_API_KEY` set → email arrives with working reset link; without → `mailer.skipped` log, generic response.
3. Sandbox payment → confirmation + payment-received emails; tampered callback amount → payment FAILED, stock restored.
4. Admin ships an order → customer gets status email.
5. Every footer link resolves; `/sitemap.xml` lists the new pages.

## Acceptance Criteria
- [ ] `RateLimitBucket` migration exists and `migrate status` is clean; rate-limited routes work on a freshly-migrated DB
- [ ] SUCCEEDED callback with wrong amount → `Payment.status = FAILED`, restocked inventory, order event — unit-tested
- [ ] Password reset works end-to-end in production configuration
- [ ] Order confirmation, payment result, and status-change emails send; their failure can never fail the underlying request
- [ ] `/about`, `/contact`, `/privacy-policy`, `/terms`, `/refund-policy` live, footer-linked, in sitemap
- [ ] No email sent inside a Prisma transaction
- [ ] Carried-over payments/orders unit tests passing

## Completion Checklist
- [ ] All validation commands pass
- [ ] Manual validation done against dev DB with sandbox creds
- [ ] Owner reviewed legal-page copy before gateway submission
- [ ] Report written to `.claude/PRPs/reports/production-launch-blockers-report.md`
- [ ] Plan moved to `.claude/PRPs/plans/completed/`

## Risks
| Risk | Mitigation |
|---|---|
| Amount-field format assumption wrong (Taka vs cents) | Provider-parsing review + keep the log line so live traffic stays observable; sandbox confirmation before live creds |
| Resend deliverability without verified domain | `onboarding@resend.dev` for testing; DNS is a documented owner step; mailer fail-soft |
| Legal copy inadequate for gateway review | Conservative real drafts + owner-review checklist item |
| Live-DB tests flaky | Same tradeoff already accepted for `rate-limit.test.ts`; cleanup in `afterEach`/`beforeEach` |

## Notes
- This plan is the intersection of FEATURE-GAPS **P0 only** and the previous report's carried-over Next Steps. Items 4–7 of FEATURE-GAPS' suggested build order are P1 and intentionally excluded.
- After this plan, the shop is launchable. The next natural pass (separate plan) is FEATURE-GAPS P1 operational items — none of which gate launch.
