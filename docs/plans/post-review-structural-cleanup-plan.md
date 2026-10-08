# Post-review structural cleanup: payment settings + COD fee

Status: in progress (execute-with-me run started 2026-10-08). Written 2026-10-08 at the end of the `execute-with-me` run for `docs/plans/admin-payment-methods-cod-fee-plan.md` (that plan is COMPLETE, ready for PR). Source: a strict structural review (`/thermo-nuclear-code-review`) by three read-only reviewers over `main...HEAD` plus the uncommitted working tree. Verdict: no blockers, no file near 1000 lines, correctness and tests are fine. The items below are structure debt.

This file is a handoff. Read it, then ask the user which items to run before starting. Nothing here has been applied.

## Where things stand

- Branch `feature/admin-payment-methods-cod-fee`, plain branch in the main working directory, 39 commits ahead of `main`, nothing pushed.
- Last verified (local Postgres via `.env.dev`): `npm run typecheck` exit 0; `npm run test` 29 files / 283 tests pass; `npm run build` exit 0 (run before the simplify pass); browser E2E S1-S9 all PASS (run before the simplify pass).
- **Uncommitted working tree** (needs a commit decision from the user before more work):
  - docs sync: `CLAUDE.md`, `docs/context/02-architecture.md` to `06-conventions.md`
  - `docs/plans/admin-payment-methods-cod-fee-plan.md` (untracked, final status written), `docs/plans/dev-environment-setup-plan.md` (untracked, unrelated draft, leave alone), this file
  - the `/simplify` pass: 38 modified files plus 2 new files `src/lib/contact-admin.ts` and `src/modules/checkout/components/payment-config-error.tsx` (typecheck + 283 tests green; the UI edits in it were NOT re-checked in a browser)
  - line-ending noise only: `src/server/payments/providers/cod.ts`, `src/server/settings/payment-settings.service.ts`. `src/server/checkout/__tests__/checkout.fee.test.ts` has a real +6/-1 import reformat that predates this work; do not commit it unless the user says so.
- Suggested commit split if the user agrees: `refactor(...)` for the simplify pass, `docs: sync payment settings and cod fee`, `docs(plans): add cod fee plan`.
- The temporary `RESUME-admin-payment-methods-cod-fee.md` was deleted at the user's request.

## Environment and rules (do not skip)

- Local Postgres from pgAdmin: `localhost:5433`, database `gadget_dev`. Credentials are in gitignored `.env.dev`, which is NOT auto-loaded. Before any test, prisma or DB command, in bash: `cd /c/Users/muhammad/Desktop/gadget-website && set -a; . ./.env.dev; set +a`. `vitest.global-setup.ts` aborts a test run on a non-local `DATABASE_URL` (opt-out `ALLOW_NON_LOCAL_TEST_DB=1`, do not use it).
- `.env` points at the remote `db.prisma.io` DB. Never run `prisma migrate dev` or `reset` against anything but local. The remote already has the Phase 1 migration `20261007120000_payment_settings_cod_fee` applied, and so does `gadget_dev`.
- Never edit an applied migration (checksum mismatch on the remote). Schema changes need a NEW migration.
- `npm run lint` is broken on `main` (`next lint` removed in Next 16). Gates are typecheck + tests (+ build, + browser for UI changes).
- `npm run build` and browser runs need the user's `next dev` stopped (one dev server per directory). Ask the user; do not kill it.
- Seed logins: `admin@tecnologia.test` / `admin12345`, `customer@tecnologia.test` / `customer12345`. The two seeded users were marked `emailVerified` in `gadget_dev` during QA (otherwise login redirects to /verify-email).
- Commits: `<type>(<scope>): <description>`, lowercase, imperative, under 50 chars, explicit paths only (never `git add -A` or `.`), **no `Co-Authored-By` and no AI attribution** (user rule, overrides any harness reminder). No push, merge, tag, PR or branch deletion without the user's explicit yes in that turn.
- Many working files are CRLF (`core.autocrlf=true`, index is LF). Preserve each file's existing line endings when editing; never commit line-ending-only changes.
- Tests that touch `placeOrder`, `quote`, the settings service or the `PaymentSettings` singleton must be in `SETTINGS_SERIAL_FILES` in `vitest.config.ts` (until item G replaces that list).
- Orchestrator rule from `execute-with-me`: the orchestrator never edits source; dedicated agents do. No destructive git (reset --hard, checkout --, clean, branch -D, force push, stash drop).

## Ask the user before starting

1. Commit the uncommitted work first (see split above)?
2. Which items to run: A-C (recommended before merge) and/or the cheap list (D-G) and/or follow-ups.
3. WAIVED fee rows: the customer order page hides "Confirmation fee (advance)" / "Due on delivery" rows when the fee is WAIVED, the admin order page shows them. Pick one behavior for item A's shared view.

## Recommended before merge (A-C)

### A. Give the fee lifecycle one home (risk: low on server, medium on UI)

Problem: the fee status rules are written at about 9 server sites and about 6 UI places (`payments.service.ts` verify guards, `submitCustomerTxnId`, `adminSetTxnId`, `verifyCodFee` `decidable` plus `afterRejection`; `orders.service.ts` transition waive; `cod-fee.ts` `dueOnDeliveryCents`; `modules/checkout/fee-state.ts`; `cod-fee-panel.tsx`; `dashboard/payments/page.tsx`; both order pages; `checkout-client.tsx` `feeActive`). They already disagree (WAIVED rows). Also 5 UI files import from `@/server/checkout/cod-fee`.

Do, in this order:
1. Mechanical move: pure, client-safe helpers (`computeCodConfirmationFee`, `describeCodFeeRule`, `buildCodFeeWarning`, `dueOnDeliveryCents`, `isFeeUnverified`, `FEE_UNVERIFIED_STATUSES`, `adminClause` from `src/lib/contact-admin.ts`, `buildFeeRejectedMessage`) to something like `src/lib/cod-fee/` (`compute.ts`, `copy.ts`, later `policy.ts`/`view.ts`). Leave a re-export at `src/server/checkout/cod-fee.ts` if that keeps the server diff small, then migrate imports. `computeCodConfirmationFee` should call `isValidCodFeeValue` and `COD_PERCENT_MIN/MAX` from `src/contracts/payment-settings.ts` instead of repeating the bounds. Note `buildFeeRejectedMessage` says "Contact admin at X." (capital C), so reusing `adminClause` there changes copy; only unify if the tests are updated on purpose.
2. Policy table in the same module:
   ```ts
   const FEE_ACTIONS = {
     verify: { from: [PENDING, REJECTED], to: VERIFIED },
     reject: { from: [PENDING],           to: REJECTED },
     waive:  { from: [PENDING, REJECTED], to: WAIVED },
   } as const
   export const canFee = (action, status) => FEE_ACTIONS[action].from.includes(status)
   export const FEE_CREDITED = [PENDING, VERIFIED] // drives dueOnDeliveryCents
   ```
   Replace the `decidable` ternary, the `afterRejection` flag (derive the note from `from === REJECTED`), the two `verify()` guards (one `isFeeUnverified` check with a message keyed by status), `getFeeNoticeState`'s switch, and the UI `canVerify`/`canReject`/`canEditTxn`.
3. `feeView(payment, order)` (pure) returning `{ status, show, feeCents, dueCents, customerNotice, admin: { canVerify, canReject, canEditTxn, confirmWaivesFee } }`, plus a `<FeeSummaryRows view />` component replacing the three copies of the "Confirmation fee (advance) / Due on delivery" JSX (checkout-client, public order page, admin order page). The payments page renders its buttons from `feeView(p).admin`.

Tests that protect it: `payments.fee.test.ts`, `cod-fee.test.ts`, `orders.service.test.ts`, `fee-state.test.ts` (extend it for the new fields). UI rendering is browser-only: re-run the E2E scenarios S3, S5, S6.

### B. Split `payments.service.ts` (321 to 565 lines; risk: low)

Problem: it is three modules in one object. Gateway lifecycle (`kickoff`, `applyCallback`), manual verification (`submitBankReference`, `verify`, `listPendingForVerification`), and the COD-fee/txn-id lifecycle (`txnIdExists`, `submitCustomerTxnId`, `adminSetTxnId`, `verifyCodFee`, about 210 lines). The header claim that it is "the only module that mutates a Payment row" is false (checkout creates payments, orders waives fees).

Do:
1. New `src/server/payments/cod-fee.service.ts` exporting `codFeeService = { verifyFee, submitCustomerTxnId, adminSetTxnId, txnIdExists }`. Keep `txn-id.ts` next to it. Update the 4 routes: `admin/payments/[id]/fee`, `admin/payments/[id]/txn-id`, `payments/txn-id`, `payments/txn-check`. No forwarding wrappers on `paymentsService`. Fix the header comment.
2. Then fold the shared skeleton of the three mutators (load payment + order, NotFound, method/status guards, order-PENDING guard, optional `claimOrderStatus`, `updateMany` CAS with `count !== 1` throw, `OrderEvent`, re-read) into helpers: `loadPendingCodPayment(tx, paymentId, opts?)`, `casFee(tx, paymentId, action, extraData)` (throws "Confirmation fee already processed" itself). In `txn-id.ts` add `assertTxnIdFree(db, txnId, { excludePaymentId, revealOrder })` and `mapTxnIdViolation(err, ...)`; use them from `placeOrder` too (the duplicate pre-check plus P2002 remap is written 6 times). Keep the same check order so error messages and precedence do not change. About 45 lines saved.

Tests: `payments.fee.test.ts`, `payment-routes.test.ts`, `customer-payments.test.ts`, `payments.pending-list.test.ts`, `payments.service.test.ts`, `checkout.fee.test.ts`.

### C. Stop COD logic from accreting in `placeOrder` and `quote` (risk: low for 1 and 3, medium for 2)

1. `priceOrder(db, { userId, address, lines, couponCode?, paymentMethod?, settings })` returning `{ subtotalCents, discountCents, couponId, couponCode, shippingCents, totalCents, codFee }`, and `assertMethodAvailable(settings, method)` next to `effectiveMethods`. `quote` becomes address + lines + settings read in one `Promise.all`, then `priceOrder(prisma, ...)`; `placeOrder` calls `priceOrder(tx, ...)` after consuming the cart. This deletes `computeOrderTotals` (and probably `totals.ts`), `unwrapSettled`, the `Promise.allSettled`, the `unwrapSettled(settingsResult)!` non-null assertion, and the duplicated method check. About 55 lines. Note: `Promise.all` makes "which error wins" non-deterministic; all are 400/404 and no test pins the order. If the old order must stay, await sequentially inside `quote`.
2. `planPlacement({ settings, totalCents, customerTxnId }) -> { paymentFields, initialStatus, events[], feeRequired }` on the payment strategy (`gateway.interface.ts`). COD implements it, the default is `{ status: PENDING }`. `placeOrder` then does one nested `tx.order.create` (status, items, payments, events) and drops the separate `payment.create`, two `orderEvent.create` calls, the COD `order.update` and the final reload: 5 fewer queries per checkout on the remote DB. The txn-id pre-check and unique-violation catch wrap that one create. `codGateway.init` can throw "COD has no gateway hop" (it is dead today because `payments.service.ts` short-circuits COD). **Verify that nested event creates keep their order** (events are ordered by `createdAt`; `eventsFor` in tests asserts it). This is the riskiest item here.
3. `loadCart(db, userId)` returning `{ items, lines }` (each line carries `cartItemId`), with a shared `CART_INCLUDE` and `toCartLine`. `loadCartLines` and the inline cart read in `placeOrder` (identical include tree and mapping) both use it. About 40 lines.

Tests: `checkout.fee.test.ts` ("quote total equals placeOrder total", method enforcement, txn dup, race), `checkout.service.test.ts` (concurrency, lock ordering, unchanged), `totals.test.ts`, `payment-routes.test.ts`, `payments.fee.test.ts`.

## Cheap, safe, can go in the same pass (D-G)

- **D. Error plumbing.** One `ERROR_STATUS = {...} as const` (including `RATE_LIMITED: 429`) in `src/contracts/errors.ts`; derive `ErrorCode`, `apiErrorSchema` and `codeToStatus` from it. Make `TxnIdDuplicateError extends AppError` with `super('TXN_ID_DUPLICATE', ...)` and revert `ConflictError` to its 2-arg form (check `errors.test.ts` for an `instanceof ConflictError` assertion on the duplicate error; nothing in non-test code relies on it). Optionally make `RateLimitedError extends AppError`. Tests: `errors.test.ts`, `fetcher.test.ts`, `payment-routes.test.ts`.
- **E. Settings flag mapping.** Add `PAYMENT_METHOD_FLAG: Record<PaymentMethod, keyof MethodFlags>` in contracts; `flaggedMethods`, the `update` data copy, the form's `METHODS` list and the defaults iterate it. Delete the test-only `getEffective` (rewrite its tests against `effectiveMethods`). Move `gatewayConfigured` into `gateway-creds.ts` so the settings service does not import the whole payment registry. Use `z.enum(PaymentMethod)` in `paymentMethodSchema` (`contracts/checkout.ts`) as `payment-settings.ts` does. Export `DEFAULT_PAYMENT_SETTINGS` and spread it in the test fixture (it currently repeats the defaults with a different `codFeeValue`).
- **F. Gateway credentials typed read.** `readEnv(keys, env): Record<K, string> | null` plus per-gateway key tuples (`BKASH_ENV`, `SSLCOMMERZ_ENV`) in `gateway-creds.ts`; providers do `const e = readEnv(BKASH_ENV, process.env); return e && {...}` so there are no `?? ''` coercions; `hasGatewayCreds` derives from the same keys; drop the production export `GATEWAY_ENV_KEYS` if tests can use the tuples. **This is the sandbox-trust security path** (`parseCallback` trusts `sandbox_` refs only when creds are absent; see `docs/issues/01-security.md`): behavior must stay byte-identical. Tests: `gateway-creds.test.ts`, `payment-routes.test.ts`.
- **G. Test serial list.** Rename the 5 settings-mutating test files to `*.serial.test.ts`; the `settings-serial` vitest project includes `**/*.serial.test.ts`, `parallel` excludes it; delete `SETTINGS_SERIAL_FILES`. Add a guard in `snapshotSettings()` that throws unless `expect.getState().testPath` contains `.serial.test.`, so a forgotten rename fails loudly instead of racing. Update the CLAUDE.md / `docs/context/06-conventions.md` lines that mention `SETTINGS_SERIAL_FILES`.
- Small: `notify` closure vs returned `{ result, notify }` from the transaction in `applyCallback` / `verifyCodFee`; `TERMINAL` payment status list as a const; `type Db = typeof prisma | Prisma.TransactionClient` is declared in 3 places.

## Follow-up PRs, not this one

- **Drop `Order.codFeeCents`.** Written once (`checkout.service.ts`), never read in production code, can drift from `Payment.feeCents`. The reviewers suggested editing the migration, but it is already applied on the remote and local DBs, so this needs a NEW migration (`ALTER TABLE "Order" DROP COLUMN "codFeeCents"`), plus removing the write and the fixture line and retargeting 5 test asserts to `payment.feeCents`.
- **`enabledMethods PaymentMethod[]` instead of four boolean flags.** Needs a new migration too.
- **Consistency gap (needs owner sign-off).** `verify()` and `applyCallback` do not use the `claimOrderStatus` compare-and-set convention the fee code relies on (they do an unguarded `order.update` after reading status earlier in the tx). A shared `confirmOrderInTx(tx, order, { from, note, actorId? })` would fix it but tightens existing behavior. Gateways are off for launch, so exposure is low today; do it before re-enabling gateways (the plan's out-of-scope list already says `applyCallback` double-restock and SUCCEEDED-over-CANCELLED must be fixed first).
- **UI decomposition (browser-only coverage, so re-run the E2E scenarios):**
  - shared order components under `src/modules/orders/components/`: `order-items-card`, `order-events-card`, `order-totals-rows` (with `FeeSummaryRows`), `cancel-order-card`, `warranty-request-card`, `order-fee-section` (moves `FeeSection` and `SubmittedTxnId` out of the 361-line public page)
  - split `checkout-client.tsx` (441 lines, 11 state/ref values, 3 effects): `CheckoutPaymentCard`, `OrderSummaryCard`, `useCheckoutTxnId()`, `usePaymentSelection(methods)`; extract a shared `<TxnIdInput>` for `TxnIdField` and `AddTxnIdCard` (note `maxLength={64}` does not match `TXN_ID_MAX` 30; the 64 may be deliberate so over-long input still shows the hint)
  - split `payment-settings-form.tsx` (503 lines): `PaymentMethodsCard`, `CodFeeCard`, a `FeePreview` that watches only the fee fields instead of `useWatch` on the whole form; simplify `FeeValueInput` state; normalize empty-string-to-null in the contract, not twice in the UI; `qrImage: { url, publicId } | null` in the contract (touches the server)
  - `cod-fee-panel.tsx` (8 `useState`, 3 inline dialogs): extract `AdminTxnIdDialog` and `RejectFeeDialog`. Reusing the reject dialog on the payments page would add a customer-visible note there, which is a behavior change, so it needs the user's yes.
  - `primaryPayment(order)` helper (or a singular `payment` in the order DTO) for the unenforced `payments[0]` assumption
- **Quote as a keyed TanStack query** (`useCheckoutQuote`, `queryKeys.checkoutQuote`) instead of `apiFetch` in an effect with hand-rolled `quote`/`quoting`/`cancelled` state. It changes request timing (dedupe/caching: set `staleTime: 0`, `retry: false`), so give it its own PR.
- **Efficiency items from review, only if wanted:**
  - `findPaymentByTxnId` matches `bankRef` case-insensitively and `bankRef` has no index, so it can scan `Payment` on every txn-check blur and txn submission. Fix needs a new migration (functional index on `lower("bankRef")`) or dropping the bankRef branch (a behavior change: bank refs would stop counting as duplicates).
  - the `usePaymentConfig` hook uses `staleTime: 0` + `refetchOnMount: 'always'`, so it refetches on every focus; a 30-60 s staleTime would be fine because the server re-checks the method, but it is a behavior choice.
  - `invalidateAdminPaymentViews` invalidates the whole `['admin','orders']` prefix after a fee action.

## Known leftovers and accepted items (no action unless the user asks)

- One test QR is orphaned in Cloudinary: `gadget-website/settings/jsh30r07j9qmykemxwg5` (delete by hand if wanted).
- Local `gadget_dev` holds QA data: 8 QA orders, a deactivated coupon `QA498`, a customer address, 2 users marked verified, iPhone 15 Pro stock 25 to 17, one cart item. Re-seed or ignore.
- Accepted limitations recorded in the plan: unsaved QR upload orphans an image; `PaymentSettings` update is a full replacement; txn ids stay reserved on cancelled orders; bank-ref vs `customerTxnId` duplicate namespace is one-way; no lock on concurrent admin settings saves; FLAT `codFeeValue` 0 cannot be saved from the form (contract minimum is 100); warning copy prints "Tk 100", not "Tk 100.00".
- Minor E2E observations: the QR `next/image` with `fill` logs a missing `sizes` warning on the settings page; `POST /api/cart` once returned a line with empty `productId` (outside this feature, not investigated).

## PR (user opens it by hand; target `dev`, standard merge)

Title: `feat(checkout): admin payment methods and cod fee`

Body:
```
## Summary
- Admin picks which payment methods customers see (new PaymentSettings singleton, /dashboard/settings). Methods are enforced server-side in placeOrder and quote; a gateway without credentials is never offered.
- Optional COD confirmation fee (flat BDT or integer percent, rounded up to the next 10 BDT, capped at the total). Treated as an advance credit: the order total is unchanged. Fee orders stay PENDING until an admin verifies, rejects or waives the fee.
- Customers see the rule, QR, contact and note, can add a transaction id once (add-only). Duplicate ids give customers a message only and admins a modal linking the existing order.
- Admin: fee panel on order detail, fee columns and Verify/Reject actions on the payments page. A rejected fee can still be verified later.
- Hardening: QR URL pinned to our Cloudinary cloud, per-user rate limit on txn-check/txn-id, trimmed customer payment fields, test runner refuses a non-local DATABASE_URL.

## Deploy notes
- Migration `20261007120000_payment_settings_cod_fee` must be applied to the production DB before or with the deploy (`prisma migrate deploy`). All new columns have defaults or are nullable, so rolling the app back needs no DB revert.
- CI must pass.

## Test plan
- typecheck, 283 unit/service tests, production build: green on local Postgres.
- Manual browser run (local DB): settings page, checkout with fee off/flat/percent, txn blur check and duplicate privacy, order-page add-txn dialog, admin verify/reject/waive, payments page, 375px layout, BKASH guard via API.
- `npm run lint` is broken on main (next lint removed in Next 16); not part of this change.
```

## How to resume

1. Read this file and `docs/plans/admin-payment-methods-cod-fee-plan.md` (its `## Execution Progress`, `### Cross-Validation` and `## Final Status`).
2. Run the state check (read-only): `git branch --show-current` (expect `feature/admin-payment-methods-cod-fee`), `git status --short`, `git rev-list --count main..HEAD` (expect 39, or more if work was committed since), `git log main..HEAD --format=%B | grep -ciE 'co-authored|generated with'` (expect 0).
3. Load `.env.dev`, run `npm run typecheck` and `npm run test` to confirm green before touching anything.
4. Ask the user the three questions in "Ask the user before starting", then run the chosen items one at a time (implementation agent per item, orchestrator verifies with typecheck + full tests, one commit per item, browser E2E re-run after UI-touching items). Delete this file when the work is done (ask the user first; do not commit it unless they say so).

## Execution Progress

**Status: COMPLETE, ready for PR (nothing pushed)**

_Last updated: 2026-10-08 — Branch: feature/admin-payment-methods-cod-fee — Workspace: main working directory (plain branch)_

User choices at setup: run A, B, C and D-G in order; commit pending work first on the same branch; WAIVED fee rows are hidden on both customer and admin pages; subagent-driven (Agent tool). Pending work was committed first as `d5431c8` (refactor(checkout): simplify cod fee code), `8b23539` (docs: sync payment settings and cod fee), `93de1a3` (docs(plans): add cod fee and cleanup plans); branch was 42 commits ahead of main at start, nothing pushed.

Final commit list: `9f1f7f3` (move cod fee helpers to lib), `154a72f` (policy table), `1ba83ee` (fee view + summary rows), `8081ba1` + `1e488bc` (split cod fee service, share mutator helpers), `98c3b0e` + `c32114a` + `4da6bef` (cart loading, priceOrder, placement plan), `3a06f97` + `d8fb3b7` + `c598546` + `4911ba4` + `6a17efe` + `8b7a47f` + `059ca5b` (style, errors, settings flags, gateway env, serial naming, P2002 scope, pending-list test), `3f467a1` + `a7cc41c` (race test, tidy), docs `e1fda53`. Pre-run commits: `d5431c8` (simplify), `8b23539` (docs sync), `93de1a3` (plans), `b857642` (progress).

| Phase | Status | Commit | Review | Notes |
| --- | --- | --- | --- | --- |
| 1. A: fee lifecycle home (move to src/lib/cod-fee, policy table, feeView + FeeSummaryRows) | done (UI rendering browser-checked in Cross-Validation) | `9f1f7f3`, `154a72f`, `1ba83ee` | deferred | general-purpose agents (first died on a session limit after step 1; step 1 verified and committed by orchestrator, fresh agent did steps 2-3). Verified: typecheck 0, 3 full runs 30 files / 335 tests pass. `isFeeUnverified` / `FEE_UNVERIFIED_STATUSES` and `modules/checkout/fee-state.ts` deleted (folded into policy.ts / view.ts). WAIVED summary rows hidden on both pages (user decision). `feeActive` in checkout-client left as-is (not provably equivalent). Payments page passes order status PENDING to feeView (list DTO has no order status; list excludes cancelled). Only typecheck-verified: fee-summary-rows, both order pages, payments page, cod-fee-panel, checkout-client. One flaky failure seen once in payments.pending-list.test.ts ("Field order is required"), not reproduced in 4 later runs. |
| 2. B: split payments.service (cod-fee.service + shared mutator helpers) | done | `8081ba1`, `1e488bc` | deferred | general-purpose agent. Verified: typecheck 0, 2 full runs 30 files / 335 tests pass. `payments.service.ts` 563 to 353 lines; new `cod-fee.service.ts` 247 lines (`codFeeService = { verifyFee, submitCustomerTxnId, adminSetTxnId, txnIdExists }`, `verifyCodFee` renamed `verifyFee`); `txn-id.ts` gains `assertTxnIdFree` / `mapTxnIdViolation`, also used by placeOrder. Mutator skeleton helpers saved fewer lines than the plan estimated (+13 net in the service) because guards differ per mutator (error class/message, customer add-only CAS). One extra small user select per customer-submit/admin-set txn call (loadPaymentWithOrder includes user.email). Docs follow-up: CLAUDE.md and docs/context/02-architecture.md still say `paymentsService.verifyCodFee`; fix in the final docs sync. |
| 3. C: checkout pricing (priceOrder, loadCart, planPlacement) | done | `98c3b0e`, `c32114a`, `4da6bef` | deferred | general-purpose agent. Verified: typecheck 0, 3 full runs 32 files / 347 tests pass (baseline 30/335). `checkout.service.ts` 502 to 326 lines. New `cart-lines.ts` (`loadCart`), `pricing.ts` (`priceOrder`), `placement.ts` + optional `planPlacement` on `PaymentGateway` (COD implements it; default plan for others); `assertMethodAvailable` next to `effectiveMethods`; `resolveCodFee` moved to src/lib/cod-fee/compute.ts; `totals.ts` deleted; `placeOrder` does one nested `order.create`; `codGateway.init` now throws (dead, `kickoff` short-circuits COD). Nested event creates tie on timestamp, so events get explicit increasing `createdAt` (proved: the new strict-order test fails 5/5 without it). Deviations: `priceOrder` takes `payment?: { method, settings, customerTxnId? }`; `plan.fee` extra field feeds `Order.codFeeCents` / quote `codFeeRule`. Known follow-ups carried to Phase 4: P2002 on the order create is now remapped to TxnIdDuplicateError whenever a txn id is set (should only map the customerTxnId target); `payments.pending-list.test.ts` flaked twice in full runs (global listing races other files' cleanup). |
| 4. D-G: error plumbing, settings flag map, typed gateway creds, serial test rename (+ follow-ups H, I) | done | `3a06f97`, `d8fb3b7`, `c598546`, `4911ba4`, `6a17efe`, `8b7a47f`, `059ca5b` | deferred | general-purpose agent. Verified: typecheck 0, 3 full runs 34 files / 450 tests pass (baseline 32/347). D: `ERROR_STATUS` in src/contracts/errors.ts drives ErrorCode/apiErrorSchema/statusFromError; `TxnIdDuplicateError` and `RateLimitedError` now extend `AppError` (http.ts 429 handling unchanged). E: `PAYMENT_METHOD_FLAG`/`pickMethodFlags`, `getEffective` removed, `gatewayConfigured` moved to gateway-creds.ts, `paymentMethodSchema = z.enum(PaymentMethod)`, `DEFAULT_PAYMENT_SETTINGS` (fixture keeps explicit codFeeValue 10_000). F: typed `readEnv` + `BKASH_ENV`/`SSLCOMMERZ_ENV`; equivalence proved by an 81-test `gateway-sandbox-trust.test.ts` written and passing against the OLD logic before the refactor. G: 5 files renamed `*.serial.test.ts`, `SETTINGS_SERIAL_FILES` deleted, fixture guard throws outside serial files (experiment run and reverted). H: `mapTxnIdViolation` only maps P2002 on `customerTxnId` (fixes the Phase 3 regression). I: pending-list flake root cause = Prisma include race with other files' order cleanup; fixed at test level (retry on that exact error + own-id scoping). Style commit `3a06f97` rewrapped lines in view.ts/view.test.ts/txn-id.ts. |
| Cross-Validation | done | `3f467a1`, `a7cc41c`, docs `e1fda53` | clean (0 CRITICAL/HIGH; 1 MEDIUM + LOW findings fixed or accepted) | typecheck 0, 34 files / 451 tests x3 runs, `npm run build` exit 0, browser E2E R1-R9 all PASS, combined gap analysis + code review, race test for the real P2002 shape. See below. |

### Cross-Validation

- Gates (local Postgres via `.env.dev`): `npm run typecheck` exit 0; `npm run test` 34 files / 451 tests pass on 3 consecutive runs (baseline at start of this run 29 files / 283; 32 / 347 after Phase 3; 34 / 450 after Phase 4); `npm run build` exit 0 (run after Phase 4; the later commits are a test, an unused-import removal, a docstring rewrap and docs). The one build log line "Dynamic server usage: /api/catalog/products" is pre-existing (route untouched by this branch).
- Combined gap analysis + code review of `2e3777c..HEAD` (read-only agent, old-vs-new comparison with `git show 2e3777c:<path>` for every rewritten function): 0 CRITICAL, 0 HIGH. Verdict: behavior-preserving; ready to merge. Findings and outcome:
  - MEDIUM: `isTxnIdUniqueViolation` was only tested with hand-built error shapes. Fixed by `3f467a1`, an 8-round real-DB race test (two concurrent `placeOrder` with the same txn id: exactly one `TXN_ID_DUPLICATE`, loser has no order, cart intact, stock down by exactly 1; 7 of 8 rounds hit the raw P2002). Observed real shape `{"modelName":"Order","target":["customerTxnId"]}`, already matched by `namesTxnIdField`; run 10 times in a row, all passed.
  - LOW fixed: unused `BadRequestError` import and a very long docstring in `pricing.ts` (`a7cc41c`); stale docs (coupon "uses the global client" and "not concurrency-safe" claims, placeOrder step list, `kickoff` failure "orphans the order") corrected in `e1fda53`.
  - LOW accepted: `quote` now reads address/cart/settings with `Promise.all`, so which error wins when several fail is nondeterministic (all 400/404, no test pins it); `quote` builds the placement plan before `assertMethodAvailable` (a misconfigured COD fee on a disabled method would 500 instead of 400; needs a direct DB edit because the settings contract forbids that state); `copy.ts` still imports `formatBDT` from `@/server/common/money` (pure; many UI files do the same); global `testTimeout`/`hookTimeout` 60 s means a hung DB test takes 60 s to fail; COD `planPlacement` docstring says "DB-free" but calls `new Date()` for `txnSubmittedAt`; customer txn-id submit gates on `canFee('reject', ...)` (comment explains; a dedicated `submitTxn` policy entry would be sturdier); partially configured gateway reads as "no credentials" (pre-existing, byte-equivalent `readEnv`).
- Intended behavior differences (all verified): WAIVED fee summary rows hidden on both order pages (user decision); COD no-fee orders are created CONFIRMED in one nested create (same events); events carry explicit increasing `createdAt`; `codGateway.init` throws (dead path, `kickoff` short-circuits COD); `TxnIdDuplicateError` and `RateLimitedError` extend `AppError` directly (every `instanceof RateLimitedError` site precedes any `instanceof AppError` check); `getEffective` removed; `gatewayConfigured` lives in `gateway-creds.ts`; `gatewayStatus` JSON key order follows the Prisma enum.
- Browser E2E (Chrome DevTools MCP, local DB, mailer blanked), R1-R9 all PASS: settings page (switches, credentials-missing, FLAT/PERCENT preview, save persistence, all-off blocked); checkout method list, config-failure alert + Retry, mid-checkout disable toast; fee flows (off auto-confirm with correct timeline order, FLAT, PERCENT 25 on Tk 498.40 = Tk 130, Bank Transfer hides fee); txn blur (1 request per blur, none per keystroke or when empty, existing id message without link/order number, uppercase storage, server 409 `TXN_ID_DUPLICATE` leaves cart intact); order page (notice, add-txn dialog, read-only after submit, duplicate message, REJECTED/VERIFIED/WAIVED states, WAIVED has no fee rows, snapshot after fee turned off, config-failure Retry); admin order detail (verify, reject, verify after rejection, duplicate modal, waive, WAIVED admin summary has no fee rows, REJECTED due = full total, cancel restores stock); payments page (columns, fee actions behind confirm dialogs, REJECTED rows show only Verify fee, cancelled absent); 375 px no horizontal scroll; API privacy (13 customer payment keys, txn-check body `{exists}`, BKASH guard 400, rate limit 429 + `Retry-After` + `RATE_LIMITED`). Not run: QR upload/display (skipped to avoid Cloudinary orphans). Observation: on a WAIVED order the admin fee panel still lists the fee and due on delivery (Summary card hides them; matches the brief).
- State restored by the QA agent: `PaymentSettings` row identical to its start (full-row diff), coupon `QA498` back to inactive. Local `gadget_dev` still holds about 8 more QA orders and lower stock for APL-IP15P-256; dev server stopped, port 3000 free.

## Final Status

All four phases (A, B, C, D-G plus follow-ups H and I) shipped as separate commits on `feature/admin-payment-methods-cod-fee`, behavior-preserving except the one approved UI change (WAIVED rows hidden on both order pages). 60 commits ahead of `main`, nothing pushed, no AI attribution in any commit message. Key structure changes: fee rules in one place (`src/lib/cod-fee/` with policy table and `feeView`, no client imports from `src/server` for fee logic), `payments.service.ts` 563 to 353 lines with the COD fee lifecycle in `cod-fee.service.ts`, `checkout.service.ts` 502 to 326 lines on a shared `priceOrder` + strategy `planPlacement`, one error-code map, typed gateway credential read with an 81-test sandbox-trust equivalence suite, and settings-mutating tests selected by the `*.serial.test.ts` name with a fixture guard.

Remaining (not done here, by design): the follow-up list above (drop `Order.codFeeCents` and `enabledMethods[]` via NEW migrations, the `verify()`/`applyCallback` compare-and-set consistency gap, UI decomposition, quote as a keyed query, `bankRef` index). Next steps for the user: review the branch, open the PR by hand (target `dev`, standard merge, CI must pass, migration `20261007120000_payment_settings_cod_fee` applied to production first; PR body is in "PR" above, update its test counts to 451 tests), delete the orphaned Cloudinary test image if wanted. No push, merge, tag or PR was done.

## Follow-up Execution Progress

**Status: in progress** (started 2026-10-08, user said "Implement the follow ups")

Scope: every item in "Follow-up PRs, not this one" above. Decisions made by the orchestrator (user gave a blanket yes): migration changes are NEW hand-written SQL migrations applied with `prisma migrate deploy` to the LOCAL `gadget_dev` only (never the remote DB); the `bankRef` duplicate lookup keeps its behavior and gets a functional index (`lower("bankRef")`) instead of dropping the bankRef branch; the verify()/applyCallback compare-and-set tightening is approved (user asked for the follow-ups; gateways stay off for launch); the payments page keeps its current plain reject confirm (the customer-visible reject note is NOT added there; only the order-detail panel's dialogs are extracted). Subagent-driven; one commit per logical step; verify typecheck + full tests after every phase; browser E2E + combined review at the end.

| Phase | Status | Commit | Review | Notes |
| --- | --- | --- | --- | --- |
| 5. Schema: drop Order.codFeeCents; bankRef functional index (new migrations) | done | `cabaa6c`, `82bc6a5` | deferred | general-purpose agent. Verified: typecheck 0, 2 full runs 34 files / 451 tests; `migrate status` up to date on local gadget_dev (5 migrations). New migrations `20261008100000_drop_order_cod_fee_cents`, `20261008100100_add_payment_bankref_lower_index` (apply to production before/with deploy). Prisma `mode: 'insensitive'` compiles to ILIKE, which cannot use a `lower("bankRef")` index, so the bankRef branch of `findPaymentByTxnId` is a `$queryRaw` on `lower("bankRef") = lower($1)` (EXPLAIN shows an index scan with seqscan disabled on the small local table); behavior same except `_`/`%` in the id are no longer ILIKE wildcards. `migrate diff` exit 2 only because of a pre-existing unrelated drift (Product slug index). Docs follow-up: CLAUDE.md Checkout step 2, 02-architecture.md:45, 03-data-model.md:23 still mention `Order.codFeeCents`. |
| 6. Schema: enabledMethods array instead of 4 boolean flags (new migration + contract + form) | done | `20c9a73` | deferred | general-purpose agent. Verified: typecheck 0, 2 full runs 34 files / 466 tests; `migrate status` up to date (6 migrations). New migration `20261008100200_payment_settings_enabled_methods` (DESTRUCTIVE on the four boolean columns; converts the existing row to the array in enum order first; also safe with no row; data preservation proved on local by setting SSLCOMMERZ+BKASH+BANK_TRANSFER then migrating). Contract: `enabledMethods: z.array(z.enum(PaymentMethod)).transform(canonicalMethods)`; empty array still yields the service's 400 "At least one payment method must remain enabled"; fee refine now requires COD in the array. `effectiveMethods` returns enum order regardless of stored order. Admin GET/PUT body shape changed (booleans to array). Apply to production before/with deploy. Docs follow-up: CLAUDE.md:76 and 03-data-model.md:27 list the four flags. |
| 7. Order confirmation compare-and-set (confirmOrderInTx for verify() and applyCallback) | pending | — | deferred | — |
| 8. UI decomposition: shared order components, panel dialogs, primaryPayment | pending | — | deferred | — |
| 9. UI decomposition: checkout-client + payment-settings-form splits | pending | — | deferred | — |
| 10. Quote as keyed query; usePaymentConfig staleTime; narrower admin invalidation | pending | — | deferred | — |
| Cross-Validation 2 | pending | — | pending | build, browser E2E, combined review, docs sync |
