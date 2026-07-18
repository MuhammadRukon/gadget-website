# Implementation Report: Cart Item-Count Badge & Signup Email Verification

## Summary
Implemented two UX fixes on top of the `production-launch-blockers` work: a cart-icon item-count badge (guest + logged-in) and a full signup email-verification flow (6-digit code + deeplink, mimicking a free OTP-style login using the existing Resend mailer). No new npm dependencies, no new Prisma migration — verification reused the pre-existing unused Auth.js-shaped `VerificationToken` table already in `prisma/schema.prisma`.

**Status note:** this work was completed and validated (see below) but was not committed before the working tree was later reset/checked out to an earlier state. None of the files described here are present on disk as of this writing. This report documents what was built and verified at the time.

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Cart item-count badge | ✅ Complete | `CartPanel` trigger showed `cart.itemCount` (already computed server-side, both for guest via `/api/cart/hydrate` and authed via `/api/cart`) as a small badge, capped at `99+`, hidden at 0. No new state — reused the existing `useCart()` hook. |
| 2 | `mailer.ts` (Resend, fail-soft) | ✅ Complete | Extended the existing mailer (from `production-launch-blockers`) with `mailerConfigured()` (dev-fallback gate) and `verificationEmail(code, verifyUrl)`. Same degraded-mode idiom: missing `RESEND_API_KEY`/`EMAIL_FROM` → log + skip, never throws. |
| 3 | Verification core | ✅ Complete | New `src/server/auth/verification.ts`: `issueVerification(email)` stores two SHA-256-hashed rows in `VerificationToken` (one for a 6-digit code, one for a 32-byte deeplink token), both keyed by `identifier = email`, 30-minute expiry. `matchVerification(secret, email)` checks either secret without consuming; caller deletes all rows for the email in the same transaction that sets `emailVerified`. No migration needed — table already existed, unused. |
| 4 | Login gate | ✅ Complete | `authorize()` in `authOptions.ts` selected `emailVerified` and threw a custom `UnverifiedEmailError extends CredentialsSignin` (with `code = 'unverified'`) when the password was correct but the account unverified — checked only after password verification, so it can't be used to probe registered emails. Verified against `node_modules/next-auth` that `code` propagates through `signIn({redirect:false})`'s client result. Google sign-in and a completed password reset both also mark `emailVerified` (mailbox-ownership proof). |
| 5 | Signup / verify-email / login pages + actions | ✅ Complete | Signup no longer auto-logs-in; redirects to `/verify-email?email=...` instead. New `/verify-email` page: 6-digit code form (mirrors the `reset-password` Suspense + server-action pattern), resend button with 60s cooldown, and automatic verification when a `?token=` deeplink is present. Login page catches `res.code === 'unverified'` and redirects to `/verify-email` with a toast. New server actions `verifyEmailAction` / `resendVerificationAction` in `modules/auth/actions.ts`, rate-limited (5 verify attempts / 15 min per email against 6-digit brute force, 3 resends / 15 min). New zod schemas `verifyEmailSchema` / `resendVerificationSchema`. |
| 6 | Backfill existing users | ✅ Complete | One-off `prisma/backfill-email-verified.ts` (`UPDATE User SET emailVerified = now() WHERE emailVerified IS NULL`) — run against the dev DB, backfilled 6 pre-existing users (including admin) so the new login gate didn't lock out accounts created before verification existed. |
| 7 | Validation | ✅ Complete | See below. |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Typecheck | ✅ Pass | Clean after all tasks |
| Build | ✅ Pass | `/verify-email` appeared as a static route alongside existing pages |
| Unit tests | ✅ 37/37 pass | No new test files added for this feature; all pre-existing suites (including the payments/orders tests from `production-launch-blockers`) stayed green |
| Backfill | ✅ Ran | 6 users backfilled on the dev DB |
| Manual/browser | ⚠️ Not run | No dev-server smoke test in this pass; recommend exercising signup → code entry → login, and the deeplink path, before relying on this in production |

## Key Design Decisions
- **No migration**: verification codes/links piggyback on the existing unused `VerificationToken` model instead of adding a new table.
- **Dual secret, single table**: each signup/resend issues both a code and a token as separate rows under the same `identifier`; either one verifies and consuming deletes both, so a stale code and a stale link can't both be redeemed after one is used.
- **Only hashes stored**: both the code and the deeplink token are SHA-256'd before storage (same helper as password-reset tokens), so a DB leak can't be used to verify accounts directly.
- **Fail-soft email everywhere**: verification email send is fire-and-forget after the DB write; a Resend outage never blocks signup.
- **Dev fallback**: when no mailer is configured, the signup/resend responses carry the raw code/token (mirroring the existing `devResetUrl` convention on password reset) so the whole flow is testable without an email provider.

## Files Touched (at time of implementation)
- `src/app/components/cart-panel/cart-panel.tsx` — badge
- `src/server/common/mailer.ts` — `mailerConfigured`, `verificationEmail`
- `src/server/auth/verification.ts` — new
- `src/server/auth/auth.service.ts` — `signup`, new `verifyEmail`, `resendVerification`, `resetPassword` also sets `emailVerified`
- `src/server/auth/authOptions.ts` — `UnverifiedEmailError`, `emailVerified` select + gate, Google-verifies-on-link
- `src/contracts/auth.ts` — `verifyEmailSchema`, `resendVerificationSchema`
- `src/modules/auth/actions.ts` — `verifyEmailAction`, `resendVerificationAction`, updated `signupAction`
- `src/app/(public)/signup/page.tsx` — drop auto-login, redirect to verify page
- `src/app/(public)/verify-email/page.tsx` — new
- `src/app/(public)/login/page.tsx` — `unverified` code handling
- `prisma/backfill-email-verified.ts` — new, one-off script

## Next Steps
- [ ] Re-implement, since the working tree no longer contains these changes.
- [ ] Add unit tests for `verification.ts` (issue/match/expiry) and the login-gate rejection, mirroring the `payments.service.test.ts` / `orders.service.test.ts` live-DB style.
- [ ] Manual browser pass: signup → dev code shown → verify → login; deeplink path; resend cooldown.
- [ ] Re-run the backfill against whichever DB ends up hosting this once re-implemented (idempotent, safe to re-run).
- [ ] Commit once re-implemented and validated — this pass was lost because it was never committed.
