# Plan: Admin-configured payment methods + COD confirmation fee

Status: executed; see Execution Progress

## Summary

Admin picks which payment methods customers see at checkout. COD gets an optional confirmation fee, either flat BDT or an integer percent. When the fee is on, COD orders stay PENDING until the admin verifies the fee, which the customer pays manually outside the system (QR, contact number, txn id). Customers see a warning with the rule, QR and admin contact, and can add a txn id once, add-only. Duplicate txn ids are detected: customers get a message only, admins get a modal linking the existing order.

## Context and findings

- No settings model exists. `src/app/(dashboard)/dashboard/settings/page.tsx` is a stub (`<div>settings page</div>`). A new singleton `PaymentSettings` model is needed.
- The only COD auto-confirm is `src/server/checkout/checkout.service.ts:349-363`. Total math is duplicated in `quote()` (:152-159) and `placeOrder` (:247-253): extract one helper.
- `checkoutInputSchema` (`src/contracts/checkout.ts:5`) accepts all 4 methods and nothing enforces enablement server-side today (CLAUDE.md: "API-level guard still outstanding").
- Gateways without env creds fall back to the sandbox. Credential checks are private `getCreds()` in `src/server/payments/providers/sslcommerz.ts:60-66` and `bkash.ts:77-85`.
- Reuse:
  - coupons module (`src/modules/admin/coupons/*`, `src/app/api/admin/coupons/*`) for the admin form, hooks, routes
  - `src/modules/admin/catalog/components/admin-image-uploader.tsx` (`single`, `folder="settings"`) for the QR
  - `enforceRateLimit` + `clientIp` (`src/server/common/rate-limit.ts`)
  - `alert-dialog` for confirm modals
  - `verify()` / `submitBankReference` in `src/server/payments/payments.service.ts` as patterns only (bank-only, overwritable)
  - `src/server/checkout/shipping.ts` + `shipping.test.ts` as the pure-calculator pattern
- `alert` and `radio-group` shadcn components are missing from `src/components/ui`; add `alert` via shadcn.
- Tests are live-DB (no Prisma mocks). Fixtures (`payments.service.test.ts`, `orders.service.test.ts`) hand-create Order/Payment rows, so every new column needs a default or must be nullable.
- Analytics revenue is `_sum(order.totalCents)` over confirmed-ish statuses: fee-pending COD orders drop out of revenue until confirmed.
- Customer-facing order APIs return full `Payment` rows (`payments: true`), so new Payment columns are visible to the order owner.

## Constraints, assumptions, risks

| Item | Mitigation / owner |
|---|---|
| Fee = advance credit. `totalCents` unchanged, COD due = total − fee. | Confirmed with user. |
| Percent is an integer 1–100 of the grand total (items + shipping − discount), rounded **up** to the next 10 BDT, capped at the grand total (flat too). | Confirmed. Pure calculator tested with the 124.6 → 130 example. |
| Fee rule + amount snapshotted on Payment at checkout. | Later config changes never alter existing orders. |
| Gateway enabled without creds gives a self-payable sandbox order. | Effective enabled = setting AND `gatewayConfigured`. Enforced at save and inside `placeOrder` (tx client). |
| Customer duplicate check is an enumeration oracle. | Auth required, rate-limited, boolean-only, normalized (trim + uppercase). User chose this behavior. |
| Duplicate race. | Unique index on `Payment.customerTxnId`; P2002 maps to `ConflictError`. |
| Settings must not be CDN-cached. | `force-dynamic` + `Cache-Control: no-store` on the config endpoint (do NOT copy the catalog `revalidate` pattern). |
| Tests and `SHADOW_DATABASE_URL` may point at the live Prisma-hosted DB. | **Executor must confirm a dev DB before running tests or migrations.** Never `migrate dev` / `reset` on live. Hand-written SQL migration + `migrate deploy` on dev. |
| Missing settings row. | `get()` falls back to defaults (COD on, fee off); the migration also inserts the default row. |
| QR delete happens at click time, not on Save (uploader). | `deferDelete` prop; server deletes old `publicId` on save (P1 service, P3 UI). |
| Admin `verify()` (cash collected) confirms the order. | New `verifyCodFee` with its own `feeStatus`; cash verify blocked while fee unverified (P2). |
| Quote vs place race (admin changes fee between). | Order total is unchanged under advance-credit semantics; the order page shows the snapshot. A method disabled in between returns 400 and the UI refetches config. |
| **Open (owner: user):** `fix/checkout-concurrency` must be merged into `main` before execution (this feature changes the same `placeOrder` code). | User merges first. |

## Workspace setup (first step, always)

- Precondition: `fix/checkout-concurrency` is merged into `main`. Verify `git log main --oneline` includes `8441f26`.
- Base: `main`. Branch: `feature/admin-payment-methods-cod-fee`, plain branch in the current working directory (no worktree).
- PR target: `dev`, standard merge (opened by a human).
- Commits: one per logical change, per phase, conventional format `<type>(<scope>): <description>`, **no AI attribution trailers** (git-hygiene overrides the harness reminder). Commits inside an approved execution are pre-authorized.
- No push, PR, merge, tag or branch deletion without a separate explicit yes.

## Skills for the executor

- `git-hygiene` at start and for every commit.
- `ecc:tdd-workflow` for the calculator, settings service, payments logic.
- `ecc:prisma-patterns`, `ecc:database-migrations` for P1.
- `ecc:api-design` for routes.
- `ecc:security-review`, `ecc:verification-loop`, `ecc:code-review` (once) in Phase 5.
- `run` skill for browser-driven verification.

---

## Phase 1: Foundation (schema, contracts, calculator, settings service)

**Scope**
- `prisma/schema.prisma`
- new `prisma/migrations/20261007120000_payment_settings_cod_fee/migration.sql`
- new `src/contracts/payment-settings.ts`
- new `src/server/checkout/cod-fee.ts` + `src/server/checkout/__tests__/cod-fee.test.ts`
- `src/server/payments/registry.ts`
- `src/server/payments/providers/sslcommerz.ts`, `bkash.ts` (export a pure creds check)
- new `src/server/settings/payment-settings.service.ts` + `__tests__/payment-settings.service.test.ts`

**Steps** (contracts-first)
1. **Schema**
   - Enums `CodFeeType {FLAT, PERCENT}` and `CodFeeStatus {NONE, PENDING, VERIFIED, REJECTED, WAIVED}`.
   - Model `PaymentSettings`, singleton `id String @id @default("singleton")`:
     - `codEnabled` (default true), `bkashEnabled`, `sslcommerzEnabled`, `bankTransferEnabled` (default false)
     - `codFeeEnabled` (default false), `codFeeType` (default FLAT), `codFeeValue Int @default(0)` — FLAT = **cents** (10000 = 100 BDT; the admin form takes whole BDT and multiplies by 100), PERCENT = integer 1–100
     - `qrImageUrl?`, `qrImagePublicId?`, `contactNumber?`, `paymentNote?`
     - `updatedAt`, `updatedById?`
   - `Order`: `codFeeCents Int @default(0)`.
   - `Payment`:
     - `feeCents Int @default(0)`
     - `feeType CodFeeType?`, `feeValue Int?`
     - `feeStatus CodFeeStatus @default(NONE)`
     - `customerTxnId String? @unique`, `txnSubmittedAt DateTime?`
     - `feeVerifiedById String?` (relation to User, mirroring `verifiedBy`), `feeVerifiedAt DateTime?`
2. **Migration SQL**
   - Hand-write in the existing plain-SQL style (`-- CreateTable`, `TIMESTAMP(3)`, quoted identifiers). Do not run `migrate dev`.
   - Include `INSERT INTO "PaymentSettings" (...) VALUES ('singleton', ...) ON CONFLICT DO NOTHING`.
   - Apply with `migrate deploy` on the **dev** DB only, then `npx prisma generate`.
3. **Contracts** (`payment-settings.ts`): `paymentSettingsInputSchema` (admin PUT, no defaults on the enabled flags), `PublicPaymentConfig`, `CodFeeRule`.
   - `contactNumber` matches `^(\+?88)?01[3-9]\d{8}$`, required when `codFeeEnabled`
   - `qrImageUrl` must start with `https://res.cloudinary.com/`
   - `paymentNote` max 500 chars
   - PERCENT value: integer 1–100
   - FLAT value: integer in cents, multiple of 100, at least 100
4. **Calculator** (tests first)
   - `computeCodConfirmationFee({type, value, totalCents})`: pure, integer cents. PERCENT = `ceil(totalCents * value / 100)`, rounded up to the next 1000 cents, then capped at `totalCents`. FLAT = `min(value, totalCents)`.
   - `describeCodFeeRule(rule, feeCents)`: FLAT → `flat ${formatBDT(feeCents)}`, PERCENT → `${value}% = ${formatBDT(feeCents)}`.
5. **Gateway creds**
   - Extract a pure `hasGatewayCreds(method, envLike)` from the providers' `getCreds()` logic; the providers must call it (no duplicated env var lists).
   - Add `gatewayConfigured(method)` to `registry.ts`.
6. **Settings service**
   - `get(client = prisma)` returns defaults without writing when the row is missing.
   - `getEffective(client)` returns enabled methods intersected with `gatewayConfigured`.
   - `update(adminId, input)` validates, upserts, and deletes the old QR via `mediaService.deleteImage` when `qrImagePublicId` changes or clears.

**Acceptance criteria**
- [ ] `npx prisma validate` and `npm run typecheck` exit 0. Fixtures in `payments.service.test.ts` and `orders.service.test.ts` compile unchanged (all new columns defaulted or nullable).
- [ ] After `migrate deploy` on the dev DB, `SELECT * FROM "PaymentSettings"` returns exactly one row: `id='singleton'`, `codEnabled=true`, the other three method flags false, `codFeeEnabled=false`.
- [ ] After migration, pre-existing `Payment` rows have `feeCents=0`, `feeStatus='NONE'`, `customerTxnId IS NULL`; pre-existing `Order` rows have `codFeeCents=0`.
- [ ] `npm run test` on the dev DB shows 0 failures (baseline before the change: 94 passing).
- [ ] `cod-fee.test.ts` asserts these exact outputs (values in cents):
  - FLAT 10000, total 500000 → 10000
  - FLAT 10000, total 6000 → 6000 (capped)
  - PERCENT 25, total 49840 → 13000 (124.6 BDT rounds up to 130)
  - PERCENT 50, total 100000 → 50000 (already a multiple of 10 BDT, no extra rounding)
  - PERCENT 100, total 12345 → 12345 (rounds up to 13000, capped at total)
  - total 0 → 0 for both types
  - PERCENT 0 and PERCENT 101 throw
- [ ] `describeCodFeeRule` returns `flat ${formatBDT(10000)}` for FLAT and `25% = ${formatBDT(13000)}` for PERCENT 25.
- [ ] `hasGatewayCreds` returns:
  - BKASH false and SSLCOMMERZ false for an empty env object
  - SSLCOMMERZ true with `SSLCOMMERZ_STORE_ID` and `SSLCOMMERZ_STORE_PASSWORD` set
  - BKASH true only when all five bKash vars are set
  - COD and BANK_TRANSFER always true
- [ ] Contract tests: `paymentSettingsInputSchema` rejects PERCENT value 0, PERCENT value 101, `codFeeEnabled=true` without `contactNumber`, `contactNumber` `'12345'`, `qrImageUrl` `'http://evil.com/x.png'`, FLAT value 150 (not a multiple of 100).
- [ ] Service tests (live dev DB, singleton restored in `afterEach`):
  - `get()` with the row deleted returns `codEnabled=true`, `codFeeEnabled=false`, and creates no row.
  - `update` with all 4 methods false throws `BadRequestError`.
  - `update` enabling BKASH with no creds throws `BadRequestError` whose message contains "credentials".
  - `update` changing `qrImagePublicId` from `A` to `B` calls `deleteImage('A')` exactly once; clearing the QR calls it once.
  - `update` persists `updatedById = adminId`.
  - `getEffective()` excludes a method whose flag is true but whose creds are missing.
- [ ] Commits: schema + migration, contracts, calculator, registry creds, settings service. Separate conventional commits, no attribution trailer.

---

## Phase 2: Checkout server (enforcement, fee, txn id, admin fee verify)

**Scope**
- `src/contracts/checkout.ts` (quote schema moved in, `CheckoutQuote` extended, `customerTxnId` added)
- `src/server/checkout/checkout.service.ts`, new `src/server/checkout/totals.ts`
- `src/app/api/checkout/route.ts`, `src/app/api/checkout/quote/route.ts`
- new `src/app/api/checkout/config/route.ts`
- new `src/app/api/payments/txn-check/route.ts`, `src/app/api/payments/txn-id/route.ts`
- new `src/app/api/admin/payments/[id]/txn-id/route.ts`, `src/app/api/admin/payments/[id]/fee/route.ts`
- `src/contracts/payments.ts`
- `src/server/payments/payments.service.ts`
- `src/server/orders/orders.service.ts` (`transition`)
- tests: `checkout.service.test.ts`, `fixtures.ts`, `payments.service.test.ts`, `orders.service.test.ts`
- stale comments: `checkout.service.ts:175-176`, `payments.service.ts:62`, `contracts/payments.ts:24`, `providers/cod.ts:3-5`

**Steps**
1. **Contracts.**
   - `checkoutInputSchema` gains optional `customerTxnId`: trimmed, alphanumeric, 6–30 chars, uppercased.
   - Move the inline `quoteSchema` from the quote route into the contract and add an optional `paymentMethod`.
   - `CheckoutQuote` adds `codFeeCents`, `dueOnDeliveryCents`, `codFeeRule: {type, value} | null`.
2. **Shared totals helper** (`totals.ts`, TDD).
   - `computeOrderTotals({subtotalCents, discountCents, shippingCents})` → `totalCents`.
   - `resolveCodFee({method, settings, totalCents})` → `{feeCents, rule} | null`. A fee of 0 returns null.
   - `quote()` and `placeOrder` both call it (removes the duplicated math at `:152-159` and `:247-253`).
3. **`placeOrder`.**
   - Read settings via `tx` (`paymentSettingsService.get(tx)`), after the cart-consume guard.
   - Reject any method not in `getEffective(tx)` with `BadRequestError`, before any stock mutation.
   - Compute the fee and pass `codFeeCents` in `order.create` (no second `order.update`).
   - Snapshot `feeCents`, `feeType`, `feeValue`, `feeStatus: PENDING` on the Payment when a fee applies; otherwise `NONE`.
   - Skip the `:349-363` auto-confirm when a fee applies; write an `OrderEvent` (PENDING) with note "COD confirmation fee pending".
   - If `customerTxnId` is provided and a fee applies, store it normalized with `txnSubmittedAt`. Pre-check for a duplicate inside the tx and throw `ConflictError` with code `TXN_ID_DUPLICATE` (rollback leaves the cart intact). If no fee applies, ignore the field.
   - `POST /api/checkout` response gains `feeRequired: boolean`.
4. **Quote.** `quote()` accepts `paymentMethod`, validates it against effective methods, returns the fee fields. A method other than COD returns `codFeeCents: 0` and `dueOnDeliveryCents = total`.
5. **`GET /api/checkout/config`.**
   - `requireSession`, `dynamic = 'force-dynamic'`, `Cache-Control: no-store`.
   - Returns `{methods, cod: {feeEnabled, type, value}, qrImageUrl, contactNumber, paymentNote}`. The last three are always present (nullable), regardless of the fee flag, so orders placed while the fee was on can still show the contact and QR if the admin later disables the fee. The warning text itself comes from the Payment snapshot, not live settings.
6. **`POST /api/payments/txn-check`.**
   - `requireSession`, `enforceRateLimit('txn-check:${userId}:${ip}', max 10, window 10 min)`.
   - Normalizes the id and looks it up in `Payment.customerTxnId` and `Payment.bankRef` (case-insensitive).
   - Response body is exactly `{exists: boolean}`.
7. **`paymentsService.submitCustomerTxnId(userId, paymentId, txnId)`** and `POST /api/payments/txn-id` (rate-limited).
   - Checks ownership, method COD, `feeStatus === PENDING`, order PENDING.
   - Atomic write: `updateMany where {id, customerTxnId: null, feeStatus: PENDING}`; a count of 0 → `ConflictError` ("already submitted").
   - P2002 → `ConflictError` code `TXN_ID_DUPLICATE` with a generic message and no order info.
   - Writes `OrderEvent` "Customer submitted transaction ID".
8. **`paymentsService.adminSetTxnId(adminId, paymentId, txnId)`** and `POST /api/admin/payments/[id]/txn-id`.
   - Allowed while the order is PENDING and `feeStatus` is PENDING or REJECTED; can set or replace the id.
   - On duplicate: `ConflictError` with `meta: {existingOrderId, existingOrderNumber}` serialized by `jsonError`. Admin-only.
   - Writes an `OrderEvent`.
9. **`paymentsService.verifyCodFee(adminId, paymentId, outcome, note?)`** and `POST /api/admin/payments/[id]/fee` with `{outcome: 'VERIFIED' | 'REJECTED', note?}`.
   - Single tx. Requires method COD, `feeStatus === PENDING`, order PENDING.
   - VERIFIED: sets `feeStatus`, `feeVerifiedById`, `feeVerifiedAt`; confirms the order through the existing optimistic status-claim helper and writes `OrderEvent` CONFIRMED with the admin as actor; sends `orderStatusEmail` after commit.
   - REJECTED: sets `feeStatus: REJECTED`; the order stays PENDING; an `OrderEvent` is written.
10. **Guards on existing paths.**
    - `paymentsService.verify`: for a COD payment with `feeStatus === PENDING`, throw `ConflictError("Verify the confirmation fee first")`.
    - `ordersService.transition` PENDING→CONFIRMED with the COD `feeStatus` PENDING or REJECTED: set `feeStatus: WAIVED` in the same tx; the event note says "confirmed without confirmation fee (waived by admin)".
11. **Fixtures.** Add `setPaymentSettings(partial)` that restores the singleton in cleanup. Update the stale comments listed under Scope.

**Acceptance criteria**
- [ ] **Fee off, unchanged behavior.** `placeOrder` COD with `codFeeEnabled=false` → `Order.status=CONFIRMED`, `Payment.feeStatus='NONE'`, `Payment.feeCents=0`, `Order.codFeeCents=0`, and an OrderEvent containing "COD order auto-confirmed".
- [ ] **Flat fee.** `codFeeEnabled=true`, FLAT 10000, an order whose `totalCents` T ≥ 10000:
  - `Order.status='PENDING'`, `Order.codFeeCents=10000`
  - `Payment.feeCents=10000`, `feeType='FLAT'`, `feeValue=10000`, `feeStatus='PENDING'`
  - `Payment.amountCents === Order.totalCents`
  - events are exactly [PENDING "Order placed", PENDING note contains "confirmation fee"], no CONFIRMED event
- [ ] **Percent rounding.** PERCENT 25 with `totalCents=49840` → `Payment.feeCents=13000`.
- [ ] **Cap.** FLAT 10000 with `totalCents=6000` → `feeCents=6000`.
- [ ] **Zero fee.** `resolveCodFee` with a computed fee of 0 returns null (unit test), so the order auto-confirms like the fee-off case.
- [ ] **Method enforcement.**
  - `bkashEnabled=false`: `placeOrder({paymentMethod:'BKASH'})` throws `BadRequestError`, creates no Order, leaves cart rows intact and stock unchanged.
  - `bkashEnabled=true` with no bKash creds in env is rejected the same way.
  - `codEnabled=false`: COD is rejected.
- [ ] **Missing settings row.** With the singleton deleted, `placeOrder` COD succeeds on defaults, and the existing 94 tests still pass.
- [ ] **Snapshot.** After placing a PERCENT 25 order, update settings to FLAT 5000: the stored Payment still has `feeType='PERCENT'`, `feeValue=25` and the original `feeCents`.
- [ ] **Quote.**
  - `quote({paymentMethod:'COD'})` with the fee on returns `codFeeCents=F`, `dueOnDeliveryCents=totalCents−F`, `codFeeRule` non-null.
  - Omitting `paymentMethod`, or `BANK_TRANSFER`, returns `codFeeCents=0`.
  - For the same cart, `quote().totalCents === placeOrder().totalCents`.
- [ ] **Txn id at checkout.**
  - `' abc12345 '` is stored as `'ABC12345'` with `txnSubmittedAt` set.
  - A duplicate throws `ConflictError` with `code='TXN_ID_DUPLICATE'`, creates no order, and leaves cart rows intact.
  - With the fee off and a txn id supplied, `customerTxnId` stays NULL.
- [ ] **Config endpoint.**
  - Unauthenticated → 401.
  - Authenticated → 200 with `Cache-Control: no-store`.
  - The body contains `qrImageUrl`, `contactNumber` and `paymentNote` (null when unset) regardless of `codFeeEnabled`.
  - A method flagged true but missing creds is absent from `methods`.
- [ ] **Txn-check.**
  - Unauthenticated → 401.
  - A stored `'ABC12345'` queried as `'abc12345 '` → `{"exists":true}`; an unknown id → `{"exists":false}`.
  - Response keys are exactly `['exists']` (no order id or number).
  - The 11th call within 10 minutes → 429 with `Retry-After`.
- [ ] **`submitCustomerTxnId`.**
  - Success sets the id once and writes an OrderEvent.
  - A second call with a different id throws `ConflictError` and the DB value is unchanged.
  - Another user's payment throws `NotFoundError`.
  - `feeStatus='NONE'` or a non-PENDING order throws `ConflictError`.
  - A duplicate on another payment throws `TXN_ID_DUPLICATE`, and the message contains no order number.
  - `Promise.allSettled` of two concurrent calls with the same id on different payments → exactly 1 fulfilled and 1 rejected.
- [ ] **`adminSetTxnId`.** Set and replace succeed. A duplicate throws `ConflictError` with `meta.existingOrderId` and `meta.existingOrderNumber` equal to the conflicting order's values.
- [ ] **`verifyCodFee` VERIFIED.**
  - `feeStatus='VERIFIED'`, `feeVerifiedById=adminId`, order CONFIRMED.
  - OrderEvent CONFIRMED with `actorId=adminId` and a note containing "fee verified".
  - A second call throws `ConflictError` and creates no extra event.
  - On a CANCELLED order it throws `ConflictError` and the order stays CANCELLED.
  - `Promise.allSettled` of two concurrent calls → exactly 1 fulfilled.
- [ ] **`verifyCodFee` REJECTED.** `feeStatus='REJECTED'`, order stays PENDING, an OrderEvent is written whose note contains "rejected".
- [ ] **Existing guards.**
  - `verify()` on a COD payment with `feeStatus='PENDING'` throws `ConflictError`; with `NONE` it behaves as before.
  - `ordersService.transition(PENDING→CONFIRMED)` with COD `feeStatus='PENDING'` sets `feeStatus='WAIVED'` and the event note contains "waived"; with `NONE` there is no change.
- [ ] **Structural checks.**
  - `grep prisma.paymentSettings` finds nothing inside `placeOrder` (tx client only).
  - Every new route handler calls `requireSession()` or `requireAdminSession()` as its first awaited statement.
  - The "lock ordering" tests in `checkout.service.test.ts` pass unchanged.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` exit 0 on the dev DB.
- [ ] Commits: contracts + totals helper, `placeOrder` + quote, config + txn endpoints, fee verify + guards, tests/fixtures. Conventional format, no attribution trailers.

---

## Phase 3: Admin settings, fee verify and txn-id UI

**Scope**
- `src/contracts/payment-settings.ts` (one added refine)
- new `src/app/api/admin/settings/payments/route.ts` (GET, PUT)
- new `src/modules/admin/settings/hooks.ts`, `components/payment-settings-form.tsx`
- `src/app/(dashboard)/dashboard/settings/page.tsx` (replace the stub)
- `src/modules/admin/catalog/components/admin-image-uploader.tsx` (`deferDelete` prop)
- `src/components/ui/alert.tsx` (add via shadcn; also used in P4)
- `src/app/(dashboard)/dashboard/orders/[id]/page.tsx`, `src/modules/admin/orders/hooks.ts`
- `src/app/(dashboard)/dashboard/payments/page.tsx`, `src/modules/admin/payments/hooks.ts`
- `payments.service.ts` `listPendingForVerification`
- `src/constants/queryKeys.ts` (add the `paymentConfig` key for P4)

**Steps**
1. **Contract refine.** `paymentSettingsInputSchema`: `codFeeEnabled` requires `codEnabled`. Add a test.
2. **Admin settings route** (`GET`/`PUT /api/admin/settings/payments`).
   - Both call `requireAdminSession()` first.
   - GET returns the settings plus `gatewayConfigured: Record<PaymentMethod, boolean>` (booleans only, never env values).
   - PUT parses `paymentSettingsInputSchema` and calls `paymentSettingsService.update`.
3. **Hooks** mirroring `modules/admin/coupons/hooks.ts`: `useAdminPaymentSettings` (key `['admin','settings','payments']`), `useUpdatePaymentSettings` with toasts and invalidation.
4. **Uploader.** Optional `deferDelete` prop, default `false` so the catalog behavior is unchanged. When true, removal only calls `onChange` and skips the immediate `/api/admin/media/delete`; the server deletes on save.
5. **Settings form** (react-hook-form + `zodResolver(paymentSettingsInputSchema)`).
   - Four method `Switch`es. A gateway whose `gatewayConfigured` is false is disabled, shows "credentials missing", and cannot be turned on. Inline error when no method is on.
   - COD confirmation fee section: `Switch` for `codFeeEnabled`; type `Select` (Flat / Percent); value input (whole BDT for Flat, ×100 on submit; integer 1–100 for Percent); live preview using `computeCodConfirmationFee` with a sample-total input (e.g. "On an order of Tk 498.40 → fee Tk 130"); `contactNumber`; `paymentNote` `Textarea`; single QR via `AdminImageUploader` (`single`, `folder="settings"`, `deferDelete`).
   - Save is disabled until the form is dirty.
6. **Admin order detail fee panel.**
   - Shown when `payments[0].feeStatus !== 'NONE'`.
   - Content: the rule via `describeCodFeeRule`; fee amount; due on delivery (total − fee); a status badge; the customer txn id or "—"; an "Add / edit transaction ID" dialog.
   - When the order is PENDING and `feeStatus` is PENDING: "Fee received — confirm order" (`AlertDialog`) and "Reject fee" (dialog with optional note).
   - Hooks `useVerifyCodFee` and `useAdminSetTxnId` call the P2 routes and invalidate the admin orders and payments queries.
   - Summary card: "Confirmation fee (advance)" and "Due on delivery" rows only when `feeCents > 0`; the Total row is unchanged.
   - The PENDING→CONFIRMED status button, when `feeStatus` is PENDING or REJECTED, opens a confirm dialog: "Confirmation fee not verified. Confirming will waive it."
7. **Duplicate modal** (`DuplicateTxnDialog`). Opens when `useAdminSetTxnId` fails with HTTP 409 and `payload.meta.existingOrderId`. Shows "This transaction ID is already used on order #<existingOrderNumber>" with an "Open order" link to `/dashboard/orders/<existingOrderId>` (new tab).
8. **Payments page.**
   - Add columns: Txn ID, Fee, Fee status. `listPendingForVerification` selects `customerTxnId`, `feeCents`, `feeStatus`.
   - A COD row with `feeStatus='PENDING'` shows "Verify fee" / "Reject fee" (the fee route, each in an `AlertDialog`) instead of cash Verify.
   - Plain COD (`NONE`) and BANK_TRANSFER rows keep the existing buttons, now wrapped in `AlertDialog`.

**Acceptance criteria**
- [ ] `GET /api/admin/settings/payments`: no session → 401; customer session → 403; admin → 200 with every `PaymentSettings` field plus `gatewayConfigured` `{COD: true, BANK_TRANSFER: true, BKASH: <bool>, SSLCOMMERZ: <bool>}`. The response contains no env var values.
- [ ] `PUT /api/admin/settings/payments` (curl or route test): a valid body → 200 and the row reads back; all four methods false → 400 with a message; PERCENT value 0 → 422 `VALIDATION_ERROR`; `codFeeEnabled=true` with `codEnabled=false` → 422.
- [ ] Settings page, in a browser:
  - `/dashboard/settings` loads the persisted values.
  - On a host without bKash creds the bKash switch is disabled and shows "credentials missing".
  - Saving FLAT 100 BDT shows a success toast; a reload shows 100 and the DB has `codFeeValue=10000`.
  - The preview for PERCENT 25 and a sample of Tk 498.40 reads "Tk 130".
  - Removing the QR without saving makes **no** request to `/api/admin/media/delete`.
  - Saving afterwards deletes the old `publicId` once (the P1 service test covers the call).
- [ ] Catalog product form image removal still deletes immediately (default `deferDelete=false`; `git diff` shows no catalog call-site change).
- [ ] Admin order detail for a fee-pending COD order:
  - The panel shows the rule text equal to `describeCodFeeRule`, the fee amount, `due = total − fee`, a PENDING badge, and the txn id or "—".
  - The Summary card shows the two fee rows; Total is unchanged.
  - "Fee received — confirm order" → confirm → order shows CONFIRMED, badge VERIFIED, and the event timeline gains a "fee verified" entry.
  - "Reject fee" → note → badge REJECTED, order still PENDING, buttons hidden.
  - The buttons are not rendered when the order is not PENDING or `feeStatus` is not PENDING.
  - A non-fee COD order shows no panel and no fee rows.
- [ ] Setting a txn id from the order page saves and displays it. Entering an id already on another order:
  - the API returns 409 with a body `meta.existingOrderId` and `meta.existingOrderNumber`
  - the modal shows that order number
  - "Open order" links to `/dashboard/orders/<existingOrderId>` and that page returns 200
  - the value on the current order is unchanged after refetch
- [ ] The PENDING→CONFIRMED status button on a fee-pending order shows the "waive" confirm dialog. After confirming, `feeStatus` is `WAIVED` and the panel shows WAIVED.
- [ ] Payments page:
  - A fee-pending COD row shows Txn ID, Fee and Fee status, and "Verify fee" / "Reject fee" buttons with no cash Verify.
  - A plain COD row and a BANK_TRANSFER row look and behave as before.
  - `listPendingForVerification` returns `customerTxnId`, `feeCents` and `feeStatus` (service test).
  - Every Verify and Reject action asks for confirmation first.
- [ ] After a fee verify, the admin orders list, order detail and payments queries refetch without a manual reload.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` exit 0, with no new `any`.
- [ ] Commits: contract refine, settings API + hooks, uploader prop, settings form/page, order-detail panel + duplicate modal, payments page. Conventional format, no attribution trailers.

---

## Phase 4: Customer UI (checkout and order page)

**Scope**
- `src/server/checkout/cod-fee.ts` (add `buildCodFeeWarning`) + test
- `src/modules/checkout/hooks.ts` (`usePaymentConfig`, `useTxnCheck`)
- `src/modules/checkout/checkout-error.ts` + `__tests__/checkout-error.test.ts`
- `src/modules/orders/hooks.ts` (`useSubmitTxnId`)
- `src/modules/checkout/components/checkout-client.tsx`
- new `src/modules/checkout/components/cod-fee-notice.tsx`, `txn-id-field.tsx`, `add-txn-id-card.tsx`
- `src/app/(public)/orders/[id]/page.tsx`
- `src/constants/queryKeys.ts` (`paymentConfig`)

**Steps**
1. **Warning builder** (pure, TDD). `buildCodFeeWarning({type, value, feeCents, contactNumber})` returns `This order requires a confirmation fee (<describeCodFeeRule>) to be confirmed. Pay or contact admin at <contact>.` With a null contact it says "Pay or contact admin."
2. **Hooks.**
   - `usePaymentConfig` uses `queryKeys.paymentConfig` with `staleTime: 0` and `refetchOnMount: 'always'`.
   - `useTxnCheck` is a mutation to `/api/payments/txn-check`.
   - `useSubmitTxnId` posts to `/api/payments/txn-id` and invalidates the `['orders']` queries.
3. **`checkoutErrorMessage`.** Map code `TXN_ID_DUPLICATE` to the "already exists" copy. Map the disabled-method 400 to "That payment method is no longer available".
4. **Shared components.**
   - `cod-fee-notice.tsx`: warning `Alert`, QR via `next/image` (alt "Payment QR code"), note as plain text, contact number.
   - `txn-id-field.tsx`: input that calls `useTxnCheck` on **blur only**, never per keystroke. If the response is `{exists:true}`, show "Transaction ID already exists. You can place the order without a transaction ID and contact admin." and mark the value unusable.
   - `add-txn-id-card.tsx`: the order-page form with an `AlertDialog` confirm.
5. **Checkout client.**
   - Remove the hardcoded `PAYMENT_METHODS` list. Keep a static `id → {label, hint}` map, filtered by `config.methods`.
   - Default selection is COD if enabled, otherwise the first enabled method. Reset the selection if it disappears.
   - Config load failure shows an error state with retry and disables Place Order. No fallback to a hardcoded list.
   - Add `paymentMethod` to the quote body and effect deps.
   - Summary rows "Confirmation fee (advance)" and "Due on delivery" when `quote.codFeeCents > 0`.
   - When COD is selected and `cod.feeEnabled`: show the notice and the optional txn field.
   - Send `customerTxnId` only when non-empty and not flagged as existing.
   - A `TXN_ID_DUPLICATE` server response shows the inline message and clears the field; the cart is untouched.
6. **Order page.**
   - When the order is PENDING and `payments[0].feeStatus === 'PENDING'`: show the notice built from the **Payment snapshot** (`feeType`, `feeValue`, `feeCents`). Contact, QR and note come from `usePaymentConfig`.
   - If `customerTxnId` is null, show `add-txn-id-card`. The confirm dialog text: "Are you sure the transaction ID is correct? It cannot be edited after submission. If it is wrong, contact admin at <phone>. Your order and confirmation fee are safe."
   - If `customerTxnId` is set, show it read-only. No input is rendered anywhere.
   - `feeStatus === 'REJECTED'`: "Your confirmation fee could not be verified. Contact admin at <phone>." `VERIFIED`: "Confirmation fee verified". `WAIVED`, `NONE` or CANCELLED: no warning and no txn form.
   - Summary: fee rows when `feeCents > 0`. Total is unchanged.

**Acceptance criteria**
- [ ] `buildCodFeeWarning` tests, exact strings:
  - FLAT, fee 10000, contact `01800000000` → `This order requires a confirmation fee (flat ${formatBDT(10000)}) to be confirmed. Pay or contact admin at 01800000000.`
  - PERCENT 25, fee 13000 → `... (25% = ${formatBDT(13000)}) ...`
  - null contact → ends with `Pay or contact admin.`
- [ ] `checkoutErrorMessage` tests: code `TXN_ID_DUPLICATE` returns the "already exists" copy; the disabled-method 400 returns "That payment method is no longer available".
- [ ] Method list, in a browser:
  - With COD and Bank Transfer enabled and bKash and SSLCommerz off, checkout renders exactly 2 payment radios.
  - With only Bank Transfer enabled, it is preselected.
  - With the config request failing (devtools block), the page shows an error with a retry button, Place Order is disabled, and no hardcoded methods appear.
- [ ] Admin disables Bank Transfer after the customer loaded checkout. Place order returns 400; the UI toasts "That payment method is no longer available", refetches config and clears the selection; the cart is intact.
- [ ] COD with the fee off: no warning, no fee rows, totals identical to today. Placing the order redirects to `/orders/<id>` with status CONFIRMED.
- [ ] COD with FLAT 100 BDT:
  - The notice text equals the `buildCodFeeWarning` output, with the QR `<img>` from `res.cloudinary.com` and the admin note.
  - The summary shows "Confirmation fee (advance)" Tk 100.00 and "Due on delivery" = total − 100. The Total row value is unchanged.
  - Switching to Bank Transfer hides all of it; the network tab shows the re-quote with `codFeeCents: 0`.
- [ ] PERCENT 25 with total Tk 498.40: the notice shows "25% = Tk 130.00" and the fee row shows Tk 130.00.
- [ ] Txn field at checkout:
  - Blur with an existing id shows the "already exists… place the order without a transaction ID and contact admin" message; the subsequent `POST /api/checkout` body has no `customerTxnId`.
  - The network tab shows exactly 1 `/api/payments/txn-check` call per blur and none per keystroke.
  - Blur with a new id shows no message; after placing, `Payment.customerTxnId` is stored uppercased.
  - An empty field makes no txn-check call and the order places normally.
  - A server `TXN_ID_DUPLICATE` response shows the inline message, clears the field, creates no order, and leaves the cart items present.
- [ ] Privacy: the txn-check response body is exactly `{"exists":true|false}`. No order id or order number appears in the checkout or order-page DOM for a duplicate id.
- [ ] Order page for a fee-pending order shows the notice, the QR, the contact number and a txn section; the status badge says PENDING.
- [ ] Add txn id on the order page:
  - Clicking "Add transaction ID" with a value opens the dialog containing "cannot be edited" and the admin phone.
  - Cancel sends no request.
  - Confirm sends one `POST /api/payments/txn-id`; the page then shows the id read-only and the form is gone; it persists on reload.
  - A duplicate id shows "Transaction ID already exists. Please contact admin at <phone>.", with no link and nothing saved.
  - Once an id is set, the DOM has no editable txn input.
- [ ] Order states:
  - REJECTED shows the "could not be verified" alert.
  - After an admin verify, the page shows "Confirmation fee verified" and no warning or form.
  - WAIVED and CANCELLED show no warning and no form.
  - The txn form is absent whenever the order status is not PENDING.
- [ ] An order placed with the fee on still shows the warning (from its snapshot) plus the contact and QR after the admin turns the fee off. Subtotal − Discount + Shipping = Total still holds on the page.
- [ ] No `dangerouslySetInnerHTML` in the changed files (grep). At a 375px viewport, checkout and the order page have no horizontal scroll.
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` exit 0.
- [ ] Commits: warning builder + error copy, hooks, shared components, checkout client, order page. Conventional format, no attribution trailers.

---

## Phase 5: Cross-validation (final phase)

**Steps**
1. Confirm `DATABASE_URL` points at a dev DB. Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Invoke `ecc:verification-loop`.
2. Run the app with the `run` skill (browser-driven) and walk the end-to-end scenarios below.
3. Run `ecc:security-review` over the diff.
4. Sync docs: `CLAUDE.md` and `docs/context/*`, plus the `payment-gateways-paused` memory.
5. Reconcile against every P1–P4 criterion and the original requirements. Record unmet items.
6. Run a **single** final `ecc:code-review` over the whole branch diff. Fix CRITICAL and HIGH findings, re-run step 1.
7. Prepare the PR title and body per `git-hygiene` (target `dev`, standard merge, no AI attribution). Do not push, PR or merge without a separate explicit yes.

**Acceptance criteria**
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` exit 0. `npm run test` shows 0 failed; the pass count is ≥ 94 plus the new tests, and no test was skipped or deleted to get there.
- [ ] End-to-end scenarios, each passing as described:
  - **A, settings to customer.** Admin enables COD and Bank Transfer, disables the rest, saves → a customer's checkout shows exactly those two.
  - **B, flat fee.** Admin sets FLAT 100 BDT with contact, QR and note → the customer picks COD, sees the warning, QR and fee rows, places the order with a txn id → the order is PENDING and the admin sees the id in the order panel → admin "Fee received" → CONFIRMED, the customer page shows "verified", and the status email is sent (or the mailer logs a skip when `RESEND_API_KEY` is unset).
  - **C, percent.** PERCENT 25, total Tk 498.40 → fee Tk 130.00, due on delivery = total − 130.
  - **D, duplicate.** Customer 2 enters customer 1's txn id → message only, no link, and the order places without the id. The admin then enters that id on customer 2's order → modal links to customer 1's order and the id is not saved.
  - **E, waive.** Admin presses PENDING→CONFIRMED on a fee-pending order → the waive dialog appears, then `feeStatus='WAIVED'`.
  - **F, reject.** Admin rejects the fee → the order stays PENDING, the customer sees the "could not be verified" alert, and the admin cancels the order → stock restored.
  - **G, regression.** Fee off → COD auto-confirms exactly as before this branch.
  - **H, gateway guard.** `POST /api/checkout` with `paymentMethod:'BKASH'` when bKash is not enabled (and again when enabled without creds) → 400, no order.
- [ ] Security review leaves no open CRITICAL or HIGH finding. Specific checks:
  - every `/api/admin/settings/**` and `/api/admin/payments/[id]/(fee|txn-id)` handler calls `requireAdminSession()`
  - `/api/checkout/config`, `/api/payments/txn-check` and `/api/payments/txn-id` call `requireSession()`
  - `txn-check` and `txn-id` call `enforceRateLimit`
  - the config route sends `Cache-Control: no-store`
  - `curl` of the admin settings endpoint, grepped for `STORE_PASSWORD`, `APP_SECRET` and `BKASH_PASSWORD`, finds nothing
  - `qrImageUrl` rejects non-Cloudinary hosts
  - `paymentNote` and contact render as plain text
- [ ] Docs synced:
  - `CLAUDE.md` Payments section no longer says "cod (auto-confirm)" unconditionally; it states COD auto-confirms only when no fee applies.
  - The "API-level guard still outstanding" sentence is replaced by the settings-based enforcement description.
  - The stale "Failed/cancelled payments do not restock" line is corrected (`applyCallback` does restock).
  - The Checkout, Orders and Conventions sections mention the settings model, the config endpoint and the txn-id rules.
  - `docs/context/` API reference lists the new routes.
  - The `payment-gateways-paused` memory is updated: the API-level guard is done; the legal-page trim is still open.
- [ ] The reconciliation table lists every P1–P4 criterion as passed or explained. No criterion is silently dropped.
- [ ] One final code review ran over the full branch diff; its CRITICAL and HIGH findings are fixed and step 1 is green after the fixes.
- [ ] Git state:
  - `git status` is clean
  - `git log main..HEAD --format=%B` contains no `Co-Authored-By` and no "Generated with" text
  - every subject matches `<type>(<scope>): <description>`
  - the branch is `feature/admin-payment-methods-cod-fee`, based on `main`
  - nothing is pushed
- [ ] The handed-over PR body states: target `dev`, standard merge, CI must pass, **the migration must be applied to the production DB before or with the deploy**, and the manual-verification summary.

---

## Out of scope

- Admin-editable bank transfer details (the page stays hardcoded).
- Auto-cancel of unpaid fee-pending orders (admin cancels manually).
- Customer proof-image upload.
- Minimum-order fee threshold; multiple labeled QRs.
- Fee for non-COD methods; refunds of the fee.
- A pending-fee email to the customer (the existing neutral order email stays).
- A "fee pending" badge on the account orders list; a legal/terms page rewrite.
- Re-enabling gateways in production. The known `applyCallback` issues (double restock, SUCCEEDED over CANCELLED) must be fixed before that.
- Editing a customer txn id by the customer, in any state.

## Rollback note

- **Code (plain branch, working directory).** Nothing is pushed until the user says so. To abandon: commit or stash anything unrelated, `git switch main`, then delete the branch with `git branch -D feature/admin-payment-methods-cod-fee` after the user confirms. The working directory returns to `main`.
- **Dev DB.** The migration is additive. To undo it on dev, drop the new `Payment` and `Order` columns, the `PaymentSettings` table and the two enums, with reverse SQL reviewed by hand. Never run `migrate reset` on a shared DB.
- **Production.** All new columns have defaults or are nullable, so the previous app version runs unchanged against the migrated schema. Rolling back the app does not require reverting the DB.

## Execution Progress

**Status: COMPLETE, ready for PR**

_Last updated: 2026-10-08 — Branch: feature/admin-payment-methods-cod-fee — Workspace: main working directory (plain branch)_

Final commit list: `8c72f29` (schema + migration), `b0ee754` (contracts), `66a25d4` (calculator), `b7323eb` (gateway creds), `3fc6cb7` (settings service), `423334e` (totals + fee resolver), `341c89c` (effective methods + public config), `c6b42f3` (placeOrder enforcement + fee), `727d3d0` (waive on manual confirm), `0cf0545` (txn id + fee verification), `c9e672c` (config + txn routes), `72e7220` (admin txn + fee routes), `1baf7a0` (route tests), `ec3a858` (format/tidy), `24d6799`..`486b727` (Phase 3: contract refine, settings API + hooks, alert ui + uploader deferDelete, settings page/form, order-detail fee panel, payments page), `ab93d1e`..`4f39558` (Phase 4: warning builder, error mapping, pure ui helpers, config + txn hooks, notice + txn components, checkout client, order page), `14094a0`..`2e3777c` (Cross-Validation: 12 fix commits, see below)

| Phase | Status | Commit | Review | Notes |
| --- | --- | --- | --- | --- |
| 1. Foundation (schema, contracts, calculator, settings service) | done | `8c72f29`..`3fc6cb7` (5 commits) | deferred | general-purpose agent (schema + migration judgment). Verified: prisma validate, typecheck, 60 tests in touched dirs pass; full suite 144 pass (agent). Flags: `npm run lint` broken on main (`next lint` removed in Next 16); `prisma generate` EPERM while `next dev` runs (rerun when stopped); codFeeValue validated even when fee off, so P3 form must default to a valid value (e.g. 100 BDT); `update` is full replacement; `getEffective(client)` returns `PaymentMethod[]`, P2 must read `get(tx)` separately. |
| 2. Checkout server (enforcement, fee, txn id, admin fee verify) | done | `423334e`..`1baf7a0` (8 commits) + `ec3a858` (tidy) | deferred | general-purpose agent. Verified on local Postgres (`.env.dev`, localhost:5433/gadget_dev): typecheck 0, full suite 23 files / 218 tests pass in 8.8s; structural greps pass (no `prisma.paymentSettings` in checkout.service; first await in all 5 new routes is requireSession/requireAdminSession; `next/server` only in http.ts). Deviation (trivial, documented): `vitest.config.ts` split into `parallel` + `settings-serial` (singleFork) projects because tests share the PaymentSettings singleton; new settings-mutating test files must be added to `SETTINGS_SERIAL_FILES`. Flags: tests trigger real Resend calls (`mailer.send_failed` 422 on example.com addresses) — review in cross-validation; REJECTED fee cannot be re-decided via verifyCodFee (admin can waive/cancel/set txn id). |
| 3. Admin settings, fee verify and txn-id UI | done (UI browser checks deferred to Cross-Validation) | `24d6799`..`486b727` (6 commits) | deferred | general-purpose agent. Verified on local Postgres: typecheck 0, full suite 25 files / 230 tests pass; settings GET/PUT route tests (401/403/200/400/422), pending-list service test; no `any` added; package.json clean (agent had uninstalled a bogus `cn` pkg that shadcn CLI added). NOT yet observed in a browser: settings page, order-detail fee panel, duplicate modal, waive dialog, payments page actions (a user `next dev` on :3000 using remote `.env` blocked a second dev server; Cross-Validation must run on `.env.dev`). Decisions: form replaces invalid stored codFeeValue (0) with FLAT 10000 / PERCENT 10; turning COD off turns fee off; REJECTED fee row on payments page shows "Open order" instead of cash Verify. Known: QR uploaded then discarded unsaved stays orphaned in Cloudinary. |
| 4. Customer UI (checkout and order page) | done (browser checks deferred to Cross-Validation) | `ab93d1e`..`4f39558` (7 commits) | deferred | general-purpose agent. Verified on local Postgres: typecheck 0, full suite 28 files / 257 tests pass; no `dangerouslySetInnerHTML`, no added `any`. Pure helpers tested (`buildCodFeeWarning`, `checkoutErrorMessage`, `getFeeNoticeState`, `defaultPaymentMethod`, txn-id helpers). NOT yet observed in a browser: all rendering/interaction criteria of Phase 4. Deviations (trivial): added `TXN_ID_DUPLICATE` + `RATE_LIMITED` to `apiErrorSchema` (src/contracts/common.ts); `PaymentMethodUnavailableMeta` now inferred from a Zod schema. Decisions: vanished selection resolves to null (customer re-picks); invalid-format txn id disables Place Order; fee rows hidden on order page when WAIVED. |
| Cross-Validation | done | `14094a0`..`2e3777c` (12 commits) | clean (3 MEDIUM + 13 LOW code-review findings and 7 LOW security findings addressed or accepted) | Gap analysis + code review (no CRITICAL/HIGH), security review (no CRITICAL/HIGH, all plan security checks PASS), browser E2E S1-S9 all PASS. Typecheck, 282 tests, build all green on local Postgres. See Cross-Validation below. |


### Cross-Validation

Three read-only agents ran over `main..HEAD` (39 commits, 71 files), all against local Postgres `gadget_dev` loaded from `.env.dev`.

**1. Gap analysis + code review (combined).** No CRITICAL or HIGH findings; 3 MEDIUM and 13 LOW. Fixes landed in range `14094a0`..`2e3777c`.

| Finding | Severity | Resolution | Commit |
| --- | --- | --- | --- |
| Cash `verify()` could verify a REJECTED fee | MEDIUM | Now blocks REJECTED fee too | `deb1f5d` |
| Due-on-delivery shown wrong for WAIVED / REJECTED fee | MEDIUM | Shared `dueOnDeliveryCents` helper used in 3 UIs | `6e7c4ad` |
| Tests could mutate a non-local DB's PaymentSettings (also Resend calls in tests) | MEDIUM | `vitest.global-setup.ts` aborts unless `DATABASE_URL` host is localhost / 127.0.0.1 / ::1 (opt-out `ALLOW_NON_LOCAL_TEST_DB=1`); test env blanks `RESEND_API_KEY` / `EMAIL_FROM` | `14094a0` |
| Payments pending list included CANCELLED orders | LOW | Excluded | `deb1f5d` |
| REJECTED path and `adminSetTxnId` did not claim the order row | LOW | Both now claim it (lock order consistent), with race tests | `deb1f5d` |
| Order page gave no feedback when payment config failed | LOW | Shows error + Retry | `aed9390` |
| Reject-fee dialog did not say the note is customer-visible | LOW | Dialog text states it | `25f2cbf` |
| Comments unclear on `codFeeCents` and method enforcement | LOW | Clarified (`codFeeCents` is the placement snapshot, Payment is authoritative; method-enforcement docstring) | `eb4a7c1` |
| Remaining LOW items | LOW | Addressed within the commits above or accepted (see Waived / accepted) | — |

Hardening chosen by the user and done after the reviews:
- QR image URL pinned to our Cloudinary cloud: `parseCloudinaryUploadUrl`, service checks `CLOUDINARY_CLOUD_NAME` and folder prefix, `qrImagePublicId` tied to the URL (`482ad4c`).
- Per-user rate bucket (30 per 10 min) on txn-check and txn-id (`db00e74`).
- Customer order/payment responses use trimmed `CustomerPayment` fields; `rawPayload`, `bankRef`, `providerRef`, `verifiedById`, `feeVerifiedById`, `verifiedAt`, `feeVerifiedAt` are no longer returned (`abed148`).
- `customerTxnId` matched exactly so the unique index is used (`b804726`).

**2. Security review.** No CRITICAL or HIGH; 7 LOW and 1 INFO (addressed by the hardening above or accepted below). Every explicit plan security check PASS:
- `requireAdminSession` / `requireSession` is the first awaited call in the new routes.
- `enforceRateLimit` on txn-check and txn-id.
- Config endpoint is `force-dynamic` with `no-store`.
- Admin settings GET leaks no env values.
- `placeOrder` enforces enabled methods via the tx client.
- No IDOR.
- txn-check returns a boolean only.
- No order information is given to customers on duplicates.

**3. Browser E2E QA** (Chrome DevTools MCP, local DB). S1-S9 all PASS, including scenarios A-H from Phase 5, the 375px layout, privacy checks, and the new verify-after-reject flow.

**Gaps vs requirements:** none unresolved.

**Waived / accepted**
- `npm run lint` criteria in P2-P5 waived: `next lint` was removed in Next 16 and lint was broken on `main` before this branch. Typecheck + tests + build are the gates.
- A QR uploaded then discarded unsaved stays orphaned in Cloudinary. The E2E run left one test image, `gadget-website/settings/jsh30r07j9qmykemxwg5`; delete manually if desired.
- PaymentSettings `update` is a full replacement: the form sends every field, a hand-rolled PUT omitting QR fields clears them.
- Txn ids stay reserved on cancelled orders.
- The bank-ref vs `customerTxnId` duplicate namespace is one-way (`submitBankReference` does not check).
- Concurrent admin settings saves have no lock (single-admin MVP).

**Deviations from plan (approved by the user at the checkpoint)**
- `verifyCodFee` VERIFIED is now allowed from REJECTED as well as PENDING (the plan said a REJECTED fee only keeps the order PENDING). A VERIFIED-after-rejection event note records the earlier rejection (`67ddca4`, UI `2e3777c`).
- Earlier trivial deviations are listed in the Phase 2-4 rows.

**E2E observations (non-blocking)**
- Warning copy prints "Tk 100" (`formatBDT` has no decimals), not "Tk 100.00".
- FLAT `codFeeValue` 0 cannot be saved from the form (contract min 100); the original seed row FLAT/0 can only be restored via the DB.
- `next/image` with `fill` on the QR image logs a missing `sizes` warning on the settings page.
- Seeded users have `emailVerified` NULL, so the documented logins redirect to `/verify-email` until marked verified.
- `POST /api/cart` returned a line with `productId` "" (not investigated; outside this feature).
- The local dev DB now holds QA data: 8 orders, a deactivated coupon `QA498`, 2 users marked verified, stock changes.

## Final Status

**State: COMPLETE, ready for PR.** Branch `feature/admin-payment-methods-cod-fee`, plain branch in the main working directory, 39 commits ahead of `main`, 71 files, nothing pushed.

**What shipped**
- Admin-configured payment methods, enforced server-side in `placeOrder`, with gateways requiring credentials to count as enabled.
- Optional COD confirmation fee (flat BDT or integer percent), snapshotted on the Payment at checkout; COD orders stay PENDING until the admin verifies, waives, or rejects the fee.
- Customer txn-id flow with duplicate detection (customers get a message only, admins get a modal linking the existing order).
- Admin settings page, order-detail fee panel, and payments page actions; customer checkout warning and order-page add-txn dialog.
- Cross-Validation fixes `14094a0`..`2e3777c` (12 commits) listed above.

**Verification (final run, local Postgres `gadget_dev` via `.env.dev`)**
- `npm run typecheck`: exit 0.
- `npm run test`: 29 files / 282 tests passed, 0 failed (baseline before the feature 94; end of Phase 4 257); no `mailer.send_failed` lines.
- `npm run build`: exit 0 (Next 16, all routes built including `/dashboard/settings`, `/checkout`, `/orders/[id]`).
- `prisma migrate status`: 3 migrations, schema up to date.
- Git state: every subject matches `<type>(<scope>): <description>`; zero Co-Authored-By / "Generated with" lines in `main..HEAD`; nothing pushed.

**Uncommitted in the working tree:** the docs sync (`CLAUDE.md`, `docs/context/02-06`, and the `payment-gateways-paused` memory) is done but NOT committed, awaiting the user's go-ahead. This plan file is also uncommitted.

**PR notes**
- Target `dev`, standard merge, CI must pass.
- Migration `20261007120000_payment_settings_cod_fee` must be applied to the production DB before or with the deploy. All new columns have defaults or are nullable, so rolling the app back needs no DB revert.
- Remote `db.prisma.io` already has the Phase 1 migration applied (per the Phase 1 notes).

**What remains**
1. User go-ahead to commit the docs changes and this plan file.
2. User opens the PR by hand (no push/PR/merge without an explicit yes).
3. Delete `docs/plans/RESUME-admin-payment-methods-cod-fee.md` after the user confirms.
