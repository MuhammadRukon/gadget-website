# Post-review structural cleanup: payment settings + COD fee

Status: proposed, not started. Written 2026-10-08 at the end of the `execute-with-me` run for `docs/plans/admin-payment-methods-cod-fee-plan.md` (that plan is COMPLETE, ready for PR). Source: a strict structural review (`/thermo-nuclear-code-review`) by three read-only reviewers over `main...HEAD` plus the uncommitted working tree. Verdict: no blockers, no file near 1000 lines, correctness and tests are fine. The items below are structure debt.

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
