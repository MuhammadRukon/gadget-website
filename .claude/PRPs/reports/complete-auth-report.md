# Implementation Report: Complete Auth — Production Hardening

## Summary
Closed the auth gaps identified in the audit: fixed two security bugs (un-awaited verification/resend throttle, unthrottled login), added a change-password flow, hardened password reset (sibling-token invalidation + security-notification email), added `/account` edge protection, bumped bcrypt cost, persisted the resend cooldown across refresh, and wrote the first auth test suite (20 tests). Env rename and a new PasswordInput component were intentionally NOT done (see Deviations).

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 8/10 | Single-pass, one test-fixture fix |
| Files Changed | 12–14 | 11 non-test (3 created, 8 updated) + 3 test files |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Await verify/resend rate limits | Complete | `actions.ts:111,138` |
| 2 | Login rate limit + throttled code | Complete | `ThrottledLoginError`, bucket cleared on success, login page toast |
| 3 | bcrypt cost 12 | Complete | back-compat test added |
| 4 | changePassword + reset hardening + security email | Complete | `passwordChangedEmail`, sibling-token kill |
| 5 | changePasswordSchema + changePasswordAction | Complete | `requireSession` + `change-pw:` rate limit |
| 6 | Change-password UI | Complete | `/account/settings` + header dropdown link |
| 7 | Proxy `/account` + comment fix | Partial | matcher + comment done; env rename deferred |
| 8 | Test suite | Complete | 20 tests across 3 files |
| 9 | PasswordInput component | Skipped | `Input` already has eye toggle; signup hint already present |
| 9b | Persist resend cooldown | Complete | localStorage keyed by email |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | Pass | zero errors |
| Unit Tests | Pass | 77/77 (20 new auth) |
| Build | Pass | compiled; `/account/settings` prerendered |
| Lint | N/A | `next lint` removed in Next 16; project eslint config throws a pre-existing circular-structure error — unrelated to this change |
| Edge Cases | Pass | expired/used/sibling tokens, Google-only account, cost-10 back-compat |

## Files Changed

| File | Action | Notes |
|---|---|---|
| `src/modules/auth/actions.ts` | UPDATED | await fixes + changePasswordAction |
| `src/server/auth/authOptions.ts` | UPDATED | login throttle + ThrottledLoginError |
| `src/server/auth/auth.service.ts` | UPDATED | changePassword + reset hardening |
| `src/server/auth/password.ts` | UPDATED | COST 12 |
| `src/server/common/mailer.ts` | UPDATED | passwordChangedEmail |
| `src/contracts/auth.ts` | UPDATED | changePasswordSchema |
| `src/proxy.ts` | UPDATED | /account matcher |
| `src/app/(dashboard)/layout.tsx` | UPDATED | comment fix |
| `src/app/(public)/login/page.tsx` | UPDATED | throttled toast |
| `src/app/(public)/verify-email/page.tsx` | UPDATED | localStorage cooldown |
| `src/app/components/header/header-account.tsx` | UPDATED | settings link |
| `src/app/(public)/account/settings/page.tsx` | CREATED | change-password form |
| `src/server/auth/__tests__/rbac.test.ts` | CREATED | 5 tests |
| `src/server/auth/__tests__/verification.test.ts` | CREATED | 6 tests |
| `src/server/auth/__tests__/auth.service.test.ts` | CREATED | 9 tests |

## Deviations from Plan

1. **Env rename to `AUTH_*` — DEFERRED.** Risk outweighs value: purely cosmetic (v5 already works via `NEXTAUTH_SECRET` fallback + explicit `getToken({ secret })`), but renaming in code without simultaneously updating the deployment's env vars would break the live edge session check (redirect loop). Should be its own change coordinated with the host env update. Left `NEXTAUTH_SECRET`/`NEXTAUTH_URL` intact.
2. **Task 9 PasswordInput component — SKIPPED (redundant).** `src/components/ui/input.tsx` already renders an eye/eye-off toggle for `type="password"`, and signup already shows an "At least 8 characters" placeholder. A wrapper would add code for zero behavior change.
3. **Test-fixture fix.** Initial verify-email test relied on `signup().devCode`, which is null when a mailer is configured (the test DB has `RESEND_API_KEY`). Switched to `issueVerification()` to get the raw code directly.

## Issues Encountered
- `next lint` no longer exists in Next 16; direct eslint invocation hits a pre-existing circular-config crash. Typecheck + build used as the static gate instead.
- Mailer logs `send_failed` (403/422) during tests — expected: test env has an invalid Resend key and `sendMail` never rejects by contract. Harmless.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `rbac.test.ts` | 5 | requireUser/requireAdmin |
| `verification.test.ts` | 6 | issue/match/expiry/reissue/hash-only storage |
| `auth.service.test.ts` | 9 | signup dup, verify single-use, reset expired/used/success+sibling, changePassword wrong/google-only/success, cost-10 back-compat |

## Post-Review Fixes (applied)
- **#1 login lockout DoS** — `authOptions.ts`: throttle key `login:${email}` → `login:${ip}:${email}` (IP from authorize's `request` via `clientIp`). Remote attacker can't lock a victim globally; correct password from another IP always works. Success clears via new `clearRateLimit`.
- **#3 change-password lockout** — `actions.ts`: parse before throttle (malformed payloads don't burn budget), limit 5→10, clear bucket on success.
- **New helper** `clearRateLimit(key)` in `rate-limit.ts`, reused by login + change-password.

## Deferred Review Findings (not fixed — intentional)
- **#2 cooldown wiped on email-field edit** (`verify-email/page.tsx`): `form.watch('email')` dep + `setResendCooldown(0)` for partial key clears an active countdown if the user edits email mid-cooldown. UX only; server guard holds. Low.
- **#4 cooldown persisted before await** (`verify-email/page.tsx`): a transient/network resend failure still sets 60s cooldown + localStorage, locking retry though nothing was sent. Low UX.
- **#5 legacy sub-8-char password blocked from change** (`contracts/auth.ts`): `currentPassword.min(8)` rejects any account whose real password is <8 chars; they must use the reset flow instead. Unlikely (signup always enforced 8). Low.
- **#6 delete-every-login efficiency** (`authOptions.ts`): `clearRateLimit` fires on every successful login even with an empty bucket — one extra DB round-trip on the hot path. Cheaper: only clear when count>0, or let the row expire. Minor.
- **Credential-stuffing gap**: IP+email keying means a botnet rotating IPs (few tries each per email) won't trip the per-source limit. Acceptable at launch scale; add a low-threshold email-only *failure* counter later if abuse appears.

## Next Steps
- [ ] `/code-review` the diff
- [ ] Separate coordinated change: rename env to `AUTH_SECRET`/`AUTH_URL` alongside host env update
- [ ] Manual browser pass: `/account/settings`, login throttle, resend cooldown after refresh
- [ ] When extracting the auth boilerplate repo, lift Tasks 1–5, 7, 8
