# E2E suite (Playwright)

Smoke suite over the core storefront and admin flows, plus guards for the perf/waterfall work. Plan: `docs/plans/playwright-e2e-testing-plan.md`.

## Setup

1. Local Postgres on `localhost:5433` (the same server as `.env.dev`).
2. Create a gitignored `.env.e2e` in the repo root with one variable, `E2E_DATABASE_URL`, pointing at database `gadget_e2e` on `localhost`, `127.0.0.1` or `[::1]`. Any other host or database name is refused (`e2e/support/db-guard.ts`) before a server starts or a DB is touched.
3. `npx playwright install chromium` once.

## Run

```bash
npm run test:e2e                          # both browser projects, line reporter (failures only)
npm run test:e2e -- -g "E2E-CHECKOUT"     # by ID prefix
npm run test:e2e -- --project=chromium-mobile
```

- Projects: `infra` (no browser), `setup` (logs in admin and customer, writes `e2e/.auth/`), `chromium-desktop` (Desktop Chrome), `chromium-mobile` (Pixel 7). Both browser projects run every spec. They send different `x-forwarded-for` headers so the per-IP signup limit (5 per 15 min) is not shared.
- Port 3100. Playwright starts its own `next dev` there and never reuses a running server, so a busy port 3100 fails the run.
- **The DB is wiped each run**: global setup runs `prisma migrate reset`, seeds, and marks the seeded users verified. Never point `E2E_DATABASE_URL` at data you want to keep.
- Failure artifacts: `test-results/` and `playwright-report/` (gitignored).

## Prisma AI-safety gate

When Claude Code (or another AI agent) runs the suite, Prisma refuses `migrate reset` unless the environment variable `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` holds the user's consent text. Pass it inline on the command, only after the user consented to resetting `gadget_e2e`. A human running `npm run test:e2e` is not gated. Never write the value into a file or commit it.

## Spec IDs

Every test title starts with its ID. Cite the ID in new specs. Keep this table in sync: a grep of `\[E2E-[A-Z]+-\d+\]` across `e2e/` must give exactly these IDs.

| ID | Flow | Covers |
| --- | --- | --- |
| `[E2E-INFRA-01]` | DB guard accepts local `gadget_e2e` URLs and refuses everything else | `e2e/support/db-guard.ts`; CLAUDE.md "Commands" (localhost DB guard) |
| `[E2E-INFRA-02]` | Home page renders the 4 seeded products | `docs/context/05-frontend.md` Storefront pages |
| `[E2E-BROWSE-01]` | Catalog lists products; detail page shows the price | `docs/context/05-frontend.md` Storefront pages; `docs/context/04-api-reference.md` Catalog |
| `[E2E-BROWSE-02]` | Unknown product returns 404 | `docs/context/05-frontend.md` Storefront pages |
| `[E2E-CART-01]` | Guest adds twice, cart persists across reload | CLAUDE.md "Cart" (guest cart in localStorage) |
| `[E2E-CART-02]` | Guest increases then removes a line | CLAUDE.md "Cart" |
| `[E2E-AUTH-01]` | Signup, verify with dev code, login | CLAUDE.md "Auth & RBAC"; `docs/context/04-api-reference.md` Auth |
| `[E2E-AUTH-02]` | Wrong password is rejected | CLAUDE.md "Auth & RBAC" |
| `[E2E-AUTH-03]` | Unverified user is sent to `/verify-email` | CLAUDE.md "Auth & RBAC" |
| `[E2E-AUTH-04]` | Signup with an existing email is rejected | `docs/context/04-api-reference.md` Auth |
| `[E2E-GUARD-01]` | Anonymous: guarded pages redirect to `/login`, admin API returns 401 | CLAUDE.md "Auth & RBAC" (`src/proxy.ts`) |
| `[E2E-GUARD-02]` | Customer cannot reach `/dashboard` or the admin API | CLAUDE.md "Auth & RBAC" (RBAC layers) |
| `[E2E-CHECKOUT-01]` | Customer places a COD order through the UI | CLAUDE.md "Checkout"; `docs/context/02-architecture.md` Checkout |
| `[E2E-CHECKOUT-02]` | Empty cart offers no way to place an order | CLAUDE.md "Checkout" |
| `[E2E-ORDER-01]` | Customer cancels an order, stock is restored | CLAUDE.md "Orders" (cancel restocks) |
| `[E2E-ADMIN-01]` | Admin finds an order and moves it to PROCESSING | CLAUDE.md "Orders" (`ALLOWED_TRANSITIONS`, audit trail) |
| `[E2E-ADMIN-02]` | Admin cannot skip PROCESSING to DELIVERED (409) | CLAUDE.md "Orders" (`ALLOWED_TRANSITIONS`) |
| `[E2E-PERF-01]` | Reviews are in the HTML; full list loads on one click | `docs/context/02-architecture.md` Reviews & warranty |
| `[E2E-PERF-02]` | Fresh guest makes no cart or session requests | CLAUDE.md "Cart"; `docs/context/02-architecture.md` Cart |
| `[E2E-PERF-03]` | Auth hint is set on login, drives the summary request, cleared on logout; forged hint gets 401 and is cleared quietly (two tests share this ID: login/logout and forged hint) | `docs/context/02-architecture.md` Cart, Auth & RBAC |
| `[E2E-PERF-04]` | Guest cart edits stay local (only `POST /api/cart/hydrate`) | CLAUDE.md "Cart" |
| `[E2E-PERF-05]` | Unavailable lines stay visible, vanished variants pruned, corrupt storage survivable | CLAUDE.md "Cart" |
| `[E2E-PERF-06]` | Login merges the guest cart: clamped server cart, store cleared, adjustments toast | CLAUDE.md "Cart" (`useGuestCartMerge`) |
| `[E2E-PERF-07]` | Checkout is never blocked by an unavailable line | CLAUDE.md "Checkout"; `docs/context/02-architecture.md` Checkout |
| `[E2E-PERF-08]` | Header search waits for 3 characters and caches the result | `docs/context/02-architecture.md` Rate limiting & logging, Caching / ISR (catalog `q`) |
| `[E2E-PERF-09]` | Home page ships small woff2 fonts and the banner once | `docs/plans/perf-waterfall-and-docs-cleanup-plan.md` Phase 4 (banner and fonts) |

## Conventions

- Mobile-specific adaptations are comments inside the test, never skips.
- Specs restore the shared state they change: the variant `isActive` flag (reset to active, with an `afterAll` safety net), perf reviews and their users, and guest state (each test uses a fresh context or clears the cart). They do NOT restore stock, orders or addresses: every run consumes about 6 of the 25 iPhone units, and the DB is wiped at the next run anyway.
- Seed constants (slugs, SKU, credentials) are hard-coded in `e2e/support`; `prisma/seed.ts` is the source.
