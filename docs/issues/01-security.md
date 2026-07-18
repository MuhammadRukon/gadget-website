# Security Flaws

## ~~1. CRITICAL — Payment success callbacks can be forged (`sandbox_` bypass works in production)~~ (✅ completed)

**Evidence**
- `src/server/payments/providers/sslcommerz.ts:126` — `parseCallback` returns `SUCCEEDED` whenever the request's `val_id` starts with `sandbox_`, skipping the validator API entirely — even when real credentials are configured.
- `src/server/payments/providers/bkash.ts:170` — same pattern keyed on `paymentID.startsWith('sandbox_')`.
- Callback routes (`/api/payments/sslcommerz/success`, `/api/payments/bkash/success`) are public, and `src/app/api/payments/_handlers.ts` takes `tran_id`/`paymentId` from the request body.

**Exploit**: a customer places an order (gets their `paymentId` from the checkout response), then POSTs `tran_id=<paymentId>&val_id=sandbox_x&status=VALID` to the success route. The payment flips to SUCCEEDED and the order to CONFIRMED — **without paying**.

**Fix**: never trust request data to select sandbox mode. Gate the sandbox branch on a server-side flag (e.g. `PAYMENTS_SANDBOX=true` env var, or "credentials absent" computed server-side), and refuse sandbox refs when the flag is off. Ideally also disable the `/api/payments/sandbox/*` harness routes in production builds.

## ~~2. HIGH — No amount verification on gateway callbacks~~ (✅ completed — mismatch now rejects the payment and restocks)

**Evidence**
- `sslcommerz.ts:150-158` reads the validator's `amount` but never compares it to `Payment.amountCents`.
- `bkash.ts:209-216` same; the file's header comment *claims* it cross-checks the amount, but the code does not.
- `payments.service.ts` `applyCallback` trusts `outcome.status` blindly.

**Impact**: a partial/wrong-amount payment still confirms the order.

**Fix**: return the gateway-reported amount in `CallbackOutcome` and compare against `payment.amountCents` in `applyCallback`; mismatch → FAILED + log.

## ~~3. HIGH — In-memory rate limiting is ineffective on Vercel~~ (✅ completed — Postgres-backed, migration applied)

**Evidence**: `src/server/common/rate-limit.ts:16` — per-process `Map`. Serverless invocations run in separate, recycled instances, so buckets aren't shared and limits reset on cold start. Applied only to signup/forgot/reset/checkout.

**Impact**: credential stuffing, signup spam, and checkout abuse are effectively unthrottled in production.

**Fix (free-tier friendly)**: either Upstash Redis free tier (`@upstash/ratelimit`, the interface was designed to be swapped), or a Postgres-based limiter (a small `rate_limit` table with `INSERT ... ON CONFLICT` counters) to stay at zero extra cost.

## ~~4. MEDIUM — Admin payment verification defaults to SUCCEEDED~~ (✅ completed)

**Evidence**: `src/contracts/payments.ts:14-18` — `verifyPaymentSchema.outcome` has `.default('SUCCEEDED')`. An empty `{}` POST to `/api/admin/payments/[id]/verify` silently marks the payment paid and confirms the order.

**Fix**: make `outcome` required; destructive actions should never be a default.

## ~~5. MEDIUM — Default admin credentials in the seed script~~ (✅ completed)

**Evidence**: `prisma/seed.ts:16-17` — falls back to `admin@Cryptech.test` / `admin12345` when `SEED_ADMIN_*` env vars are unset.

**Fix**: require the env vars (throw if missing) or generate a random password and print it once.

## ~~6. MEDIUM — `allowDangerousEmailAccountLinking: true`~~ (✅ completed — actual fix was in the custom `signIn` callback; see the fix report)

**Evidence**: `src/server/auth/authOptions.ts:67`. Google sign-in auto-links to any existing account with the same email. Combined with a credentials provider, this enables account takeover if an email is ever attacker-controlled or unverified.

**Fix**: disable it and handle the OAuthAccountNotLinked flow explicitly, or only link when the existing account's email is verified.

## ~~7. MEDIUM — Middleware checks cookie presence only; JWT role staleness~~ (✅ completed — edge guard now verifies JWT + role)

**Evidence**
- `src/proxy.ts:11-21` — only tests that a session cookie *exists*; no JWT verification, no role check. Any authenticated CUSTOMER passes the edge guard for `/dashboard` and `/api/admin` (route-level `requireAdminSession` and the dashboard layout do compensate — coverage verified complete, keep it that way).
- Role is baked into the JWT at sign-in (`authOptions.ts:100-107`); demotions/deletions don't take effect until the token expires.
- Several code comments reference a `middleware.ts` that doesn't exist (the file is `proxy.ts`) — misleading for future maintainers.

**Fix**: verify the JWT (and role) in `proxy.ts` using `getToken`/`auth`; consider re-reading the role from DB in the `jwt` callback on an interval; fix the stale comments.

## 8. LOW — Media upload trusts client MIME; unsanitized folder

**Evidence**: `src/server/media/media.service.ts:22` validates client-supplied `file.type`; `src/app/api/admin/media/upload/route.ts:13` passes `folder` unsanitized into the Cloudinary path. Admin-only, so low risk — but no magic-byte sniffing and no rate limit on upload/delete.

## 9. LOW — Duplicate callback audit events under concurrency

**Evidence**: `payments.service.ts:115-122` — two simultaneous callbacks can both read PENDING and both write an `OrderEvent`. No double-fulfillment (order update is idempotent), just duplicate audit rows. `Payment.providerRef @unique` exists but isn't used as a gate.

## 10. LOW — Shallow health check

**Evidence**: `src/app/api/health/route.ts` returns static OK without touching the DB — useless as a readiness probe. Add a `SELECT 1`.
