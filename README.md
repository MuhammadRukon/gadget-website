# Cryptech — Gadget E-commerce (Next.js)

A full-stack e-commerce MVP for gadgets/electronics targeting the Bangladesh market. Customers get catalog browsing, search/filters, guest + logged-in cart, checkout with local payment methods (COD, bKash, SSLCommerz, bank transfer), order tracking, verified-purchase reviews, and warranty claims. Admins get a dashboard for catalog, orders, payment verification, coupons, warranty, users, and analytics.

**📚 Full documentation lives in [`docs/`](./docs/context/00-INDEX.md)** — architecture, data model, API reference, known flaws, feature roadmap, and SEO audit.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database & ORM:** PostgreSQL (Prisma-hosted) + Prisma 6
- **Auth:** Auth.js v5 (next-auth) — credentials + Google OAuth, JWT sessions
- **Validation:** Zod contracts shared client/server (`src/contracts/`)
- **State:** TanStack Query (server state) + Zustand (guest cart)
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix)
- **Media:** Cloudinary
- **Testing:** Vitest + React Testing Library
- **Deployment:** Vercel (free tier) — `main` auto-deploys

## Features

**Customers:** catalog with search/filter/sort/pagination · product variants · guest cart with login merge · address book · coupon codes · checkout quote (shipping rules for Dhaka/outside) · COD / bKash / SSLCommerz / bank transfer · order history with event timeline · self-cancellation · verified-buyer reviews · warranty requests · Google OAuth · password reset

**Admins:** products (variants, images, SEO fields, smart archive-on-delete) · categories (tree) · brands · coupons (percent/fixed, limits, windows) · order management with audit trail · manual payment verification (COD/bank) · warranty workflow · user management · 30-day analytics (revenue, profit, top sellers, low stock)

## Getting Started

```bash
npm install                 # also runs prisma generate
# create .env — see docs/context/01-overview.md for the required variables
npx prisma migrate dev      # apply migrations
npm run db:seed             # seed admin + demo catalog (set SEED_ADMIN_EMAIL/PASSWORD!)
npm run dev                 # http://localhost:3000
```

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run db:seed` / `db:studio` | Seed DB / Prisma Studio |

## Architecture (short version)

```
UI (src/app, src/modules)  →  API routes (src/app/api/**)  →  Services (src/server/**)  →  Prisma
```

- Contracts-first: Zod schemas in `src/contracts/` validate on the server and type the client.
- Money is integer cents everywhere; order items are snapshotted for historical correctness.
- Payments use a strategy interface (`src/server/payments/`) — providers are pluggable and DB-free.
- Auth guard: `src/proxy.ts` (edge) + `requireAdminSession()` in every admin route + role check in the dashboard layout.

Details: [docs/context/02-architecture.md](./docs/context/02-architecture.md)

## Project Structure

```
prisma/                 # schema, migrations, seed
src/
  app/(public)/         # storefront pages
  app/(dashboard)/      # admin pages
  app/api/              # route handlers (transport layer)
  server/               # business logic: services, repos, common utils
  modules/              # client-side feature modules (hooks + components)
  contracts/            # zod schemas + DTO types
  components/           # shared UI (shadcn + custom)
  lib/                  # prisma client, fetcher, query client
docs/
  context/              # orientation docs (start at 00-INDEX.md)
  issues/               # known flaws / fix list
  product/              # feature gap analysis
  SEO-AUDIT.md          # SEO findings
```

## Git Flow

`main` = production (auto-deploy) · `dev` = integration · `feature/*` from `main`, PR → `dev`, then `dev` → `main`.

## Known Issues & Roadmap

- ⚠️ **Before taking live payments**, read [docs/issues/01-security.md](./docs/issues/01-security.md) — there is a critical payment-callback forgery issue.
- Full fix list: [docs/issues/](./docs/issues/README.md)
- What to build next: [docs/product/FEATURE-GAPS.md](./docs/product/FEATURE-GAPS.md)
- Scale-up roadmap (post-success): [docs/product/SCALE-UP-TODO.md](./docs/product/SCALE-UP-TODO.md)
