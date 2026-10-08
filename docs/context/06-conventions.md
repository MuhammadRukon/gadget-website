# Conventions & Workflows

## Adding or changing a feature (contracts-first)

Touch layers in this order:

1. **Contract** — `src/contracts/<domain>.ts`: Zod schema + inferred types. Shared by server validation and client typing.
2. **Service** — `src/server/<domain>/<domain>.service.ts`: business logic. Throw `AppError` subclasses from `src/server/common/errors.ts`; never return raw errors.
3. **Route** — `src/app/api/**/route.ts`: thin — parse contract, `requireSession()`/`requireAdminSession()` as needed, call service, `NextResponse.json`, `catch → jsonError(err)`.
4. **Query key** — `src/constants/queryKeys.ts`: add/extend the key factory.
5. **Hook** — `src/modules/<domain>/hooks.ts`: React Query wrapper using `src/lib/fetcher.ts` (`apiGet`/`apiSend`, throws typed `ApiClientError`).
6. **UI** — `src/modules/<domain>/components/` or page under `src/app`.

Rules of thumb:

- Only `src/server/common/http.ts` imports `next/server` in server-layer code.
- Money is always integer cents; use helpers in `src/server/common/money.ts`.
- Slugs via `src/server/common/slug.ts`.
- Multi-step DB writes go inside `prisma.$transaction` — and pass the `tx` client to any service helpers called within (a known existing violation: coupon validate in checkout).
- Forms: react-hook-form + `zodResolver` with the same contract schema.
- Toasts via `sonner`; loading states per-component.

## Testing

- Vitest (`npm run test`), config in `vitest.config.ts` (**node** environment, not jsdom; two projects: `parallel` and `settings-serial` for singleton-mutating tests).
- **Test DB must be local** (`localhost:5433` or configured in `.env.dev`); `vitest.global-setup.ts` aborts on non-local `DATABASE_URL` unless `ALLOW_NON_LOCAL_TEST_DB=1`. Test env blanks `RESEND_API_KEY` and `EMAIL_FROM` to prevent mailer calls.
- Tests cover pure logic and some services (live Prisma, not mocked). Pattern: pure functions in `src/server/common` are easiest; checkout/payments/orders services use real DB fixtures. Any test touching `placeOrder`, `quote`, `PaymentSettings`, or COD fee logic must be named `*.serial.test.ts` to run serialized (one forked worker); fixture helpers throw if called from non-serial files.
- Single test file: `npx vitest run src/server/common/__tests__/money.test.ts`; single test by name: `npx vitest run -t "free shipping"`.

## Git flow

- `main` = production (auto-deploys on Vercel). `dev` = integration. `feature/*` branches from `main`, PR into `dev`, then `dev → main` when stable.
- Commit style: `feat:`, `fix:`, `refactor:`, `chore:` (see git log).

## Prisma

- Schema changes: edit `prisma/schema.prisma` → `npx prisma migrate dev` (uses `SHADOW_DATABASE_URL`). For **dev DB only** — never `migrate dev` on shared/production databases. Hand-written SQL migrations should use `npx prisma migrate deploy`.
- `npm run db:seed` seeds admin + demo catalog (`prisma/seed.ts`). Never run against production (default admin credentials — see issues).
- After migration or schema changes, run `npx prisma generate` to update the client.

## UI components

- `src/components/ui/*` — shadcn/ui primitives (generated; edit sparingly).
- `src/components/*` — shared app components (data-table, sidebar, nav).
- `src/app/components/*` and `src/app/common/*` — legacy/storefront-specific shared components (header, footer, modal, etc.). Note the duplication between these trees; prefer `src/components` for new shared work.
