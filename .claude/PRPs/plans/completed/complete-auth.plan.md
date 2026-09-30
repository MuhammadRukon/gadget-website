# Plan: Complete Auth — Production Hardening

## Summary
The auth stack (Auth.js v5 + JWT + Prisma + bcryptjs) is architecturally sound: layered contracts → service → transport, hashed one-time tokens, enumeration-resistant flows, triple-layer admin guard. This plan closes the remaining gaps to production grade: two security bugs (un-awaited rate limit, unthrottled login), missing standard flows (change password, security notification emails), zero auth tests, env-name drift, and small UX polish — without adding anything a launch does not need.

## User Story
As a store customer (and as the store admin),
I want signup, login, verification, and password management to be safe against abuse and complete for everyday account care,
So that my account cannot be brute-forced or hijacked, and I never hit a dead end (can't change password, no notice when it changes).

## Problem → Solution
Auth works end-to-end but: verification-code throttle silently never fires (fire-and-forget async), login accepts unlimited password guesses, users cannot change a known password, resets leave sibling tokens alive, no email is sent on password change, `/account` pages flash before client-side redirect, and none of the auth service is tested.
→ All abuse paths throttled and tested, standard account-care flows present, consistent Auth.js v5 env names, no over-engineering (no 2FA/passkeys/CAPTCHA/session-revocation machinery).

## Metadata
- **Complexity**: Medium (≈12 files touched, ~500 lines including tests)
- **Source PRD**: N/A
- **PRD Phase**: N/A
- **Estimated Files**: 12–14

---

## Current State (audit record — what is implemented today)

| Area | File | State |
|---|---|---|
| Auth.js v5 instance | `src/auth.ts` | ✅ single instance, JWT strategy |
| Config + providers | `src/server/auth/authOptions.ts` | ✅ Credentials + optional Google; role baked into JWT; OAuth-takeover linking refused; unverified-email blocked *after* password check (no enumeration) |
| Edge guard | `src/proxy.ts` (Next 16 middleware convention) | ✅ verifies JWT + `role === 'ADMIN'` for `/dashboard`, `/api/admin`; ❌ does not cover `/account` |
| Server guards | `src/server/common/http.ts` (`requireSession`, `requireAdminSession`), `src/server/auth/rbac.ts` | ✅ used by every admin route + dashboard layout (defense in depth) |
| Passwords | `src/server/auth/password.ts` | ✅ bcryptjs; ⚠️ cost 10 (2026 baseline is 12) |
| Reset tokens | `src/server/auth/tokens.ts` | ✅ 32-byte raw, SHA-256 stored, 30 min TTL, single-use `usedAt` |
| Email verification | `src/server/auth/verification.ts` | ✅ 6-digit code + deeplink token, both hashed, mutually invalidating, consumed transactionally |
| Service | `src/server/auth/auth.service.ts` | ✅ signup / verify / resend / forgot / reset; generic responses everywhere; reset also verifies email; ❌ no changePassword; ❌ reset leaves other outstanding reset tokens valid; ❌ no security-notification emails |
| Rate limiting | `src/server/common/rate-limit.ts` | ✅ Postgres-backed, survives cold starts; applied to signup/forgot/reset routes; 🐞 **verify/resend server actions call it without `await`** (`src/modules/auth/actions.ts:111,138`) — throttle never blocks, error escapes as unhandled rejection; 🐞 **login (`authorize`) has no rate limit at all** |
| Validation | `src/contracts/auth.ts` | ✅ zod at every boundary; password 8–72 (bcrypt byte cap) |
| Env | `src/env.ts`, `.env.example` | ⚠️ v4 names `NEXTAUTH_SECRET`/`NEXTAUTH_URL` mixed with v5 `AUTH_TRUST_HOST`; `src/proxy.ts:22` hardcodes `NEXTAUTH_SECRET` |
| UI | `(public)/login,signup,forgot-password,reset-password,verify-email` + `src/modules/auth/*` | ✅ RHF+zod, unverified→redirect to verify, resend cooldown 60s, dev-mode code fallback; ❌ no show-password toggle, no password-requirements hint; `/account/*` guard is client-only (`useSession` + `router.replace` → loader flash) |
| Tests | `src/server/common/__tests__/rate-limit.test.ts` only | ❌ zero tests for auth service, tokens, verification, rbac |
| Sessions | JWT, no DB rows | ⚠️ by design: no revocation — demoted admin valid until token expiry (documented in `proxy.ts` header) |

---

## UX Design

### Before
```
Login page:            Signup page:              /account/orders (logged out):
[email    ]            [name/email/password]     ┌───────────────┐
[password ] (no eye)   (no requirements hint)    │   <Loader/>   │ ← flash, then
[Login]                                          └───────────────┘   client redirect
                       Password change: DOES NOT EXIST
                       Password changed email: none
```

### After
```
Login page:            Signup page:              /account/* (logged out):
[email    ]            [password      (👁)]      proxy.ts → 302 /login?callbackUrl=…
[password (👁)]        "8+ characters" hint      (no flash, no page load)
[Login]  ≤10 tries/15m
                       Account settings:
                       [current pw][new pw][confirm] → "Password updated" + email sent
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Login brute force | unlimited guesses | 10/15 min per email → clear toast | bucket cleared on successful login |
| Verify-code brute force | throttle broken (not awaited) | 5/15 min enforced | restores intended behavior |
| Password fields | masked only | eye toggle | login, signup, reset, change |
| Signup password | no guidance | static "At least 8 characters" hint | no strength-meter lib — over-engineering |
| Change password | impossible | form in account area | requires current password |
| Password reset/change | silent | notification email sent | standard production practice |
| `/account/*` logged out | loader flash → client redirect | edge redirect via proxy | one matcher entry |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/modules/auth/actions.ts` | 105–161 | The two un-awaited `enforceRateLimit` calls; action error-handling pattern to mirror |
| P0 | `src/server/auth/authOptions.ts` | 44–94 | `authorize()` — where the login rate limit goes |
| P0 | `src/server/auth/auth.service.ts` | all | Service pattern; where `changePassword` lands; reset transaction to extend |
| P1 | `src/server/common/rate-limit.ts` | all | `enforceRateLimit` is async; `RateLimitedError.retryAfter` |
| P1 | `src/server/common/http.ts` | all | `requireSession` for the change-password action |
| P1 | `src/server/common/__tests__/rate-limit.test.ts` | all | The ONLY test pattern in repo: real prisma, random keys, self-cleanup |
| P1 | `src/proxy.ts` | all | Matcher + role check to extend for `/account` |
| P2 | `src/server/common/mailer.ts` | all | `sendMail` never rejects; template function pattern (`passwordResetEmail`) |
| P2 | `src/contracts/auth.ts` | all | zod schema naming/export pattern |
| P2 | `src/app/(public)/reset-password/page.tsx` | all | Form page pattern for the change-password UI |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Auth.js v5 env vars | authjs.dev/getting-started/migrating-to-v5 | v5 reads `AUTH_SECRET`/`AUTH_URL`; `NEXTAUTH_*` kept only for back-compat. `getToken()` accepts explicit `secret` param — update `proxy.ts:22` when renaming |
| Next.js 16 proxy | nextjs.org docs | `middleware.ts` → `proxy.ts` rename; this repo already complies. Matcher syntax unchanged |
| bcrypt cost | bcryptjs README | Cost is embedded in each hash — raising `COST` to 12 does NOT invalidate existing hashes; they verify at their stored cost and upgrade naturally on next password change |

---

## Patterns to Mirror

### SERVICE_PATTERN
```ts
// SOURCE: src/server/auth/auth.service.ts:136-164 (resetPassword)
async resetPassword(input: ResetPasswordInput) {
  if (!input.token) throw new BadRequestError('Token is required');
  const tokenHash = hashResetToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!record) throw new NotFoundError('Reset token');
  ...
  await prisma.$transaction([ ... ]);
}
```

### ACTION_PATTERN (server action error envelope)
```ts
// SOURCE: src/modules/auth/actions.ts:86-103 (resetPasswordAction)
export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const data = resetPasswordSchema.parse(input);
    await authService.resetPassword(data);
    return { ok: true, message: 'Password updated. You can now sign in.' };
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, message: '...', fieldErrors: fieldErrorsFromZod(err) };
    if (err instanceof AppError) return { ok: false, message: err.message };
    log.error('auth.reset.action.failed', { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, message: toJsonError(err).message };
  }
}
```

### ROUTE_PATTERN (rate-limited API route)
```ts
// SOURCE: src/app/api/auth/signup/route.ts:8-18
export async function POST(request: Request) {
  try {
    await enforceRateLimit(`signup:${clientIp(request)}`, { max: 5, windowMs: 15 * 60 * 1000 });
    const input = signupSchema.parse(await request.json());
    ...
  } catch (err) {
    return jsonError(err);
  }
}
```

### MAILER_TEMPLATE_PATTERN
```ts
// SOURCE: src/server/common/mailer.ts — template fns return { subject, html }; callers:
void sendMail(user.email, passwordResetEmail(resetUrl));  // fire-and-forget AFTER tx commit
```

### TEST_STRUCTURE (real prisma, random keys, self-cleanup)
```ts
// SOURCE: src/server/common/__tests__/rate-limit.test.ts:10-32
import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
const usedKeys: string[] = [];
function freshKey(prefix: string) { const key = `${prefix}:${Math.random()}`; usedKeys.push(key); return key; }
afterEach(async () => { await prisma.rateLimitBucket.deleteMany({ where: { key: { in: usedKeys.splice(0) } } }); });
```

### LOGGING_PATTERN
```ts
// SOURCE: src/server/auth/auth.service.ts:80
log.info('auth.emailVerified', { email });   // dot-namespaced event, structured fields
```

### ERROR_HANDLING
```ts
// SOURCE: src/server/common/errors.ts — services throw AppError subclasses; transport maps via jsonError/toJsonError
throw new ConflictError('An account with this email already exists', { field: 'email' });
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/modules/auth/actions.ts` | UPDATE | P0 bug: add `await` to 2 `enforceRateLimit` calls; add `changePasswordAction` |
| `src/server/auth/authOptions.ts` | UPDATE | P0: login rate limit in `authorize()`; clear bucket on success |
| `src/server/auth/auth.service.ts` | UPDATE | `changePassword`; invalidate sibling reset tokens; send security emails |
| `src/server/auth/password.ts` | UPDATE | `COST` 10 → 12 |
| `src/server/common/mailer.ts` | UPDATE | add `passwordChangedEmail` template |
| `src/contracts/auth.ts` | UPDATE | `changePasswordSchema` |
| `src/proxy.ts` | UPDATE | add `/account/:path*` matcher (any authed user); rename secret env |
| `src/env.ts` | UPDATE | `AUTH_SECRET`/`AUTH_URL` |
| `.env.example` | UPDATE | new env names |
| `src/app/(dashboard)/layout.tsx` | UPDATE | fix stale "Middleware" comment → "proxy.ts" (comment only) |
| `src/app/(public)/account/settings/page.tsx` | CREATE | change-password form |
| `src/components/ui/password-input.tsx` | CREATE | input with eye toggle, reused by 4+ forms |
| `src/app/(public)/{login,signup,reset-password}/page.tsx` | UPDATE | swap to `PasswordInput`; signup hint text |
| `src/app/(public)/verify-email/page.tsx` | UPDATE | persist resend cooldown in localStorage (survives hard refresh) |
| `src/server/auth/__tests__/auth.service.test.ts` | CREATE | service tests |
| `src/server/auth/__tests__/verification.test.ts` | CREATE | token issue/match/expiry/single-use |
| `src/server/auth/__tests__/rbac.test.ts` | CREATE | guard tests (pure, no DB) |

## Necessity Verdicts

| Item | Verdict | Why |
|---|---|---|
| Await rate-limit bug fix | **REQUIRED (P0)** | 6-digit code brute-forceable today; the guard exists but never fires |
| Login throttle | **REQUIRED (P0)** | Only unthrottled credential surface; bcrypt alone is not an anti-brute-force control |
| Auth tests | **REQUIRED (P1)** | Security-critical code with zero coverage; also prerequisite for extracting the planned auth boilerplate repo |
| Change password | **REQUIRED (P1)** | Standard production flow; today's only path is the forgot-password dance |
| Invalidate sibling reset tokens | **REQUIRED (P1)** | Multiple `forgot` requests leave multiple live tokens; one-line transaction addition |
| Password-changed email | **RECOMMENDED (P2)** | Standard hijack-detection practice; mailer infra already exists, ~20 lines |
| `/account` in proxy matcher | **RECOMMENDED (P2)** | Removes loader flash; data was never exposed (APIs guarded) — UX + defense-in-depth |
| bcrypt cost 12 | **RECOMMENDED (P2)** | One-line; old hashes unaffected |
| Env rename to `AUTH_*` | **RECOMMENDED (P2)** | v5 convention; do now so the future auth-boilerplate repo starts clean |
| Show-password toggle + hint | **RECOMMENDED (P2)** | Cheap, measurable UX win |
| Stale comment fix | trivial | bundle with proxy change |
| 2FA/TOTP, passkeys, magic links | **NOT NOW** | COD-only local e-commerce launch; large surface, no current requirement |
| CAPTCHA | **NOT NOW** | Postgres rate limiting covers launch-scale abuse |
| DB sessions / revocation lists | **NOT NOW** | JWT tradeoff is documented and acceptable; 30-day expiry bounds exposure |
| Account lockout (hard lock) | **NOT NOW** | Rate limit per email suffices; hard lockout enables griefing (lock victims out) |
| Email-change flow | **NOT NOW** | Real need eventually, but requires re-verification design; separate story |
| Audit log table | **NOT NOW** | Structured logs already record auth events |

## NOT Building
- 2FA/TOTP, WebAuthn/passkeys, magic links, CAPTCHA
- Database sessions, token revocation/rotation machinery
- Hard account lockout
- Email-change flow
- Additional OAuth providers
- Password strength meter (zxcvbn etc.) — static hint only
- Auto sign-in after email verification (nice-to-have; skip)

---

## Step-by-Step Tasks

### Task 1: Fix un-awaited rate limits (P0)
- **ACTION**: Add `await` at `src/modules/auth/actions.ts:111` and `:138`.
- **IMPLEMENT**: `await enforceRateLimit(\`verify:${data.email}\`, ...)` / `await enforceRateLimit(\`resend-verify:${data.email}\`, ...)`. Both enclosing functions are already `async` and already catch `RateLimitedError`.
- **MIRROR**: ROUTE_PATTERN (awaited call in signup route).
- **IMPORTS**: none new.
- **GOTCHA**: Do NOT change the policy values; only the missing `await`.
- **VALIDATE**: New test drives 6 failing verify attempts → 6th returns the "Too many attempts" message.

### Task 2: Login rate limit (P0)
- **ACTION**: Throttle `authorize()` in `src/server/auth/authOptions.ts`.
- **IMPLEMENT**: After `credentialsSchema.safeParse` succeeds, `await enforceRateLimit(\`login:${parsed.data.email}\`, { max: 10, windowMs: 15 * 60 * 1000 })`. On successful password verification, clear the bucket: `await prisma.rateLimitBucket.deleteMany({ where: { key: \`login:${parsed.data.email}\` } })` so legitimate users never accumulate failures. Wrap the enforce call so `RateLimitedError` is rethrown as a `CredentialsSignin` subclass with `code = 'throttled'` (mirror `UnverifiedEmailError` at `authOptions.ts:17-19`); login page maps `res.code === 'throttled'` to "Too many attempts. Try again in a few minutes."
- **MIRROR**: `UnverifiedEmailError` class pattern; login page's existing `res?.code === 'unverified'` branch.
- **IMPORTS**: `enforceRateLimit`, `RateLimitedError` from `@/server/common/rate-limit`.
- **GOTCHA**: Key by email, not IP — `authorize` has awkward access to the raw request, and per-email is the correct anti-credential-stuffing granularity. Plain errors thrown from `authorize` collapse into generic `CredentialsSignin` — must subclass to carry `code`.
- **VALIDATE**: Test: 10 wrong passwords → 11th attempt with CORRECT password still rejected; bucket cleared after success.

### Task 3: bcrypt cost 12
- **ACTION**: `src/server/auth/password.ts:3` → `const COST = 12;`
- **IMPLEMENT**: one-line constant change.
- **MIRROR**: n/a.
- **GOTCHA**: Existing hashes verify fine (cost embedded per-hash). No migration.
- **VALIDATE**: `verifyPassword` test with a cost-10 fixture hash still passes.

### Task 4: Service — changePassword + reset hardening + security email
- **ACTION**: Extend `src/server/auth/auth.service.ts` and `mailer.ts`.
- **IMPLEMENT**:
  1. `changePassword(userId: string, input: ChangePasswordInput)`: load user; `BadRequestError('This account uses Google sign-in')` if no `passwordHash`; verify `currentPassword` (`UnauthorizedError('Current password is incorrect')` on mismatch); hash new; `$transaction`: update hash + `passwordResetToken.deleteMany({ where: { userId, usedAt: null } })`. After commit: `void sendMail(user.email, passwordChangedEmail())`; `log.info('auth.passwordChanged', { userId })`.
  2. In `resetPassword` transaction, add `prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null, tokenHash: { not: tokenHash } } })` — kill sibling tokens. Send `passwordChangedEmail` after commit.
  3. `mailer.ts`: add `passwordChangedEmail(): MailContent` — subject "Your password was changed", body advising immediate reset if this wasn't you. Mirror `passwordResetEmail` shape.
- **MIRROR**: SERVICE_PATTERN, MAILER_TEMPLATE_PATTERN, LOGGING_PATTERN.
- **IMPORTS**: `verifyPassword` (already imported? check — service currently imports only `hashPassword`; add it).
- **GOTCHA**: `sendMail` AFTER `$transaction` commits (mailer.ts header contract).
- **VALIDATE**: Service tests (Task 8).

### Task 5: Contract + action for change password
- **ACTION**: Add schema + server action.
- **IMPLEMENT**: In `src/contracts/auth.ts`:
  ```ts
  export const changePasswordSchema = z.object({
    currentPassword: z.string().min(8).max(72),
    password: z.string().min(8).max(72),
  });
  export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
  ```
  In `actions.ts`: `changePasswordAction(input: unknown)` — `const user = await requireSession()` (import from `@/server/common/http`), `await enforceRateLimit(\`change-pw:${user.id}\`, { max: 5, windowMs: 15 * 60 * 1000 })`, then `authService.changePassword(user.id, data)`. Full ACTION_PATTERN envelope including `RateLimitedError` branch.
- **MIRROR**: ACTION_PATTERN (`verifyEmailAction` — it has the RateLimitedError branch).
- **IMPORTS**: `requireSession` from `@/server/common/http`; `changePasswordSchema` from `@/contracts/auth`.
- **GOTCHA**: `requireSession` throws `UnauthorizedError` (an `AppError`) — already handled by the `AppError` branch.
- **VALIDATE**: typecheck + service tests.

### Task 6: Change-password UI
- **ACTION**: Create form in account area.
- **IMPLEMENT**: `src/app/(public)/account/settings/page.tsx` (check first whether an account nav/sidebar component exists to register the link): client page, RHF + `zodResolver(changePasswordSchema.extend({ confirm: z.string() }).refine(d => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' }))`, three `PasswordInput` fields, calls `changePasswordAction`, toasts result. Guard: same client `useSession` pattern as `account/orders/page.tsx:20-24` (proxy also covers it after Task 7).
- **MIRROR**: `src/app/(public)/reset-password/page.tsx` form; `account/orders/page.tsx` guard.
- **IMPORTS**: `PasswordInput` (Task 9), `changePasswordAction`.
- **GOTCHA**: confirm-field refine lives in the PAGE schema, not in `contracts/auth.ts` (server never needs `confirm`).
- **VALIDATE**: manual browser flow.

### Task 7: Proxy covers /account + env rename + comment fix
- **ACTION**: Extend `src/proxy.ts`; standardize env names.
- **IMPLEMENT**:
  1. `proxy.ts`: matcher `['/dashboard/:path*', '/api/admin/:path*', '/account/:path*']`; logic: `needsAdmin` as today; `needsUser = pathname.startsWith('/account')` requires any valid token (no role check), redirect to `/login?callbackUrl=` like the existing branch.
  2. Env: `.env.example` + `.env` → `AUTH_SECRET`, `AUTH_URL` (same values); `src/env.ts` schema → new names; `proxy.ts:22` → `secret: process.env.AUTH_SECRET`. Update remaining `NEXTAUTH_URL` consumers: `src/app/robots.ts:5`, `src/app/sitemap.ts:9`.
  3. `src/app/(dashboard)/layout.tsx` comment: "Middleware" → "proxy.ts (Next 16 middleware)".
- **MIRROR**: existing redirect branch in `proxy.ts:25-36`.
- **IMPORTS**: none new.
- **GOTCHA**: Auth.js v5 auto-reads `AUTH_SECRET`, but `getToken` in proxy needs the explicit param updated or every edge session check fails silently (all tokens "invalid" → redirect loop). Update `.env` BEFORE restarting dev server; manually verify login immediately after.
- **VALIDATE**: logged-out hit on `/account/orders` → 302 to login with callbackUrl; logged-in CUSTOMER passes `/account`, blocked from `/dashboard`; ADMIN passes both.

### Task 8: Test suite
- **ACTION**: Create `src/server/auth/__tests__/{auth.service,verification,rbac}.test.ts`.
- **IMPLEMENT** (mirror TEST_STRUCTURE — real prisma, random emails `test-${Math.random()}@example.test`, afterEach cleanup of users/tokens/buckets):
  - `verification.test.ts`: issue → match by code (email required, wrong email rejected) → match by token (email recovered) → expired row rejected → re-issue invalidates previous.
  - `auth.service.test.ts`: signup duplicate → `ConflictError`; verifyEmail consumes all rows (second use fails); resetPassword: expired token rejected, used token rejected, success sets `usedAt` + kills sibling tokens + sets `emailVerified`; changePassword: wrong current password → `UnauthorizedError`, Google-only account → `BadRequestError`, success invalidates outstanding reset tokens; cost-10 fixture hash still verifies.
  - `rbac.test.ts` (pure, no DB): `requireUser(null)` throws `UnauthorizedError`; `requireAdmin(CUSTOMER)` throws `ForbiddenError`; ADMIN passes through.
- **MIRROR**: TEST_STRUCTURE.
- **IMPORTS**: `vitest`, `prisma`, service under test.
- **GOTCHA**: DB-backed — needs `DATABASE_URL`; keep TTL windows generous (remote DB latency — see comment in rate-limit.test.ts:16-19). `sendMail` is a no-op without `RESEND_API_KEY` — no mocking needed.
- **VALIDATE**: `npm run test` green.

### Task 9b: Persist resend cooldown across refresh (UX bug, user-reported)
- **ACTION**: Rehydrate the 60s resend timer in `src/app/(public)/verify-email/page.tsx` from localStorage.
- **IMPLEMENT**: On successful resend: `localStorage.setItem(\`resend-at:${email}\`, String(Date.now() + RESEND_COOLDOWN_S * 1000))`. On mount (useEffect keyed by email): read the timestamp, if future, `setResendCooldown(Math.ceil((until - Date.now()) / 1000))`. Clear the key when countdown hits 0 or verification succeeds.
- **MIRROR**: existing `resendCooldown` state + interval logic in the same file.
- **IMPORTS**: none.
- **GOTCHA**: localStorage is UX only — bypassable by design; the SERVER limit (`resend-verify:${email}`, fixed in Task 1) is the enforcement. Guard `localStorage` access for SSR safety (component is `'use client'` but read inside useEffect anyway). Key by email so switching accounts doesn't inherit a stale timer.
- **VALIDATE**: resend → hard refresh → timer still counting; 4th resend within 15 min rejected by server regardless.

### Task 9: PasswordInput component + form polish
- **ACTION**: Create `src/components/ui/password-input.tsx`; adopt in login, signup, reset-password, change-password forms.
- **IMPLEMENT**: wraps existing `Input`, `type` toggles password/text, Eye/EyeOff icons from `lucide-react` (already a dep), `aria-label="Show password"`, `tabIndex={-1}` on the toggle. Signup: add `<p className="text-xs text-muted-foreground">At least 8 characters</p>` under the password field.
- **MIRROR**: `src/components/ui/input.tsx` styling conventions (shadcn).
- **IMPORTS**: `Eye`, `EyeOff` from `lucide-react`.
- **GOTCHA**: keep RHF `{...field}` spread intact; toggle button `type="button"` or it submits the form.
- **VALIDATE**: manual: toggle works on all four forms; forms still submit.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected | Edge? |
|---|---|---|---|
| verify throttle enforced | 6th verify attempt same email | "Too many attempts" (not proceed) | regression for P0 bug |
| login throttle | 11th attempt, correct password | rejected until window resets | yes |
| login bucket cleared | success then more logins | allowed | yes |
| duplicate signup | same email twice | ConflictError | |
| verification single-use | verify then reuse code | second fails | yes |
| expired reset token | expiresAt in past | ValidationError | yes |
| sibling reset tokens killed | 2 issued, use one | other rejected | yes |
| changePassword wrong current | bad currentPassword | UnauthorizedError | |
| changePassword Google-only | user without passwordHash | BadRequestError | yes |
| cost-10 hash back-compat | fixture hash | verifies | yes |
| rbac | null / CUSTOMER / ADMIN | throw / throw / pass | |

### Edge Cases Checklist
- [x] Concurrent rate-limit window boundary (documented acceptable in rate-limit.ts:38-41 — do NOT "fix")
- [x] Google-only account hits change-password
- [x] Expired/used/sibling tokens
- [x] Mailer unconfigured (no-op by contract)
- [ ] Empty input (zod covers)

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: zero errors

### Unit Tests
```bash
npm run test
```
EXPECT: all pass (requires DATABASE_URL)

### Build
```bash
npm run lint && npm run build
```
EXPECT: clean; proxy matcher syntax verified at build

### Manual Validation
- [ ] Logged out → `/account/orders` → edge-redirect to login; callbackUrl returns after sign-in
- [ ] 10 bad logins → correct password blocked with clear toast; window reset → works
- [ ] Signup → verify with code → login; resend cooldown still 60s
- [ ] Change password → old fails, new works, notification email logged/sent
- [ ] Forgot twice → reset with one link → second link dead
- [ ] Eye toggle on all password fields

## Acceptance Criteria
- [ ] Both P0 security bugs fixed and regression-tested
- [ ] Change-password flow live end-to-end
- [ ] All new/changed behavior covered by tests; suite green
- [ ] `AUTH_*` env names everywhere; login verified working after rename
- [ ] No new dependencies added

## Completion Checklist
- [ ] Code follows discovered patterns (service/action/route/test)
- [ ] Errors via AppError subclasses; transport maps them
- [ ] Logging dot-namespaced structured events
- [ ] No hardcoded values
- [ ] No scope additions beyond Necessity Verdicts table

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Env rename breaks edge token check (silent redirect loop) | Medium | High | Task 7 GOTCHA: update `.env` first, manual login test immediately; single commit so revert is atomic |
| Per-email login throttle enables targeted griefing (10 bad guesses lock victim 15 min) | Medium | Low | Short window; accept for launch, note in README |
| DB round-trip per login attempt | Low | Low | Single indexed upsert; same cost as existing signup path |
| next-auth beta API drift | Low | Medium | Pin exact `next-auth` version when extracting boilerplate |

## Notes
- Rate limiter is Redis-swappable by design: callers only use `rateLimit`/`enforceRateLimit` (already async). Swap = rewrite `rateLimit()` body with `INCR`+`PEXPIRE`; atomic INCR also removes the documented double-window race. Not in scope now — Postgres is fine at launch scale.
- `middleware.ts` vs `proxy.ts`: Next.js 16 renamed the convention; this repo is already correct. Only the dashboard layout comment lags.
- JWT no-revocation tradeoff stays (documented in proxy.ts header); revisit only if admin count grows.
- This plan doubles as the cleanup pass before extracting the reusable auth boilerplate repo discussed earlier — Tasks 1–5, 7, 8 are exactly the code that gets extracted; keep diffs clean.
