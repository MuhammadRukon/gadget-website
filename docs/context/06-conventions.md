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

- Vitest (`npm run test`), config in `vitest.config.ts` (jsdom + vite-tsconfig-paths).
- Existing tests cover pure logic: `src/server/common/__tests__/*`, `src/server/checkout/__tests__/shipping.test.ts`, `src/lib/__tests__/fetcher.test.ts`.
- Pattern: pure functions in `src/server/common` are the easiest test targets; services need a mocked prisma (none exist yet).

## Git flow

- `main` = production (auto-deploys on Vercel). `dev` = integration. `feature/*` branches from `main`, PR into `dev`, then `dev → main` when stable.
- Commit style: `feat:`, `fix:`, `refactor:`, `chore:` (see git log).

## Prisma

- Schema changes: edit `prisma/schema.prisma` → `npm run db:migrate` (`prisma migrate dev`). The shadow DB is wired (`shadowDatabaseUrl = env("SHADOW_DATABASE_URL")`, local `gadget_shadow`) and is needed only by `migrate dev`.
- `migrate dev`, `migrate reset` and `npm run db:seed` are local-only. `db:seed` seeds admin + demo catalog (`prisma/seed.ts`); never run it against production (default admin credentials — see issues).
- Guard, shell-variable precedence, production migrations and `NODE_ENV=production` caveats: see README "Local vs production notes".

## UI components

- `src/components/ui/*` — shadcn/ui primitives (generated; edit sparingly).
- `src/components/*` — shared app components (data-table, sidebar, nav).
- `src/app/components/*` and `src/app/common/*` — legacy/storefront-specific shared components (header, footer, modal, etc.). Note the duplication between these trees; prefer `src/components` for new shared work.
