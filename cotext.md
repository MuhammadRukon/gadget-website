# Gadget Website Context Index

This file is a fast orientation guide for AI/human contributors working in this repo.

## What this project is

- Full-stack e-commerce app for gadgets (`Next.js App Router` + `TypeScript`)
- UI stack: `Tailwind CSS`, `shadcn/radix` components
- Backend: route handlers under `src/app/api/**` with service/repo layers in `src/server/**`
- Data/auth/tooling: `Prisma`, `PostgreSQL`, `NextAuth`, `TanStack Query`, `Vitest`

## Runtime and scripts

- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Tests: `npm run test`
- Prisma seed/studio: `npm run db:seed`, `npm run db:studio`

## High-level structure

- `src/app` - App Router pages/layouts and API routes
  - `src/app/(public)` - storefront/public pages
  - `src/app/(dashboard)` - admin/dashboard pages
  - `src/app/api` - HTTP endpoints
- `src/server` - domain services/repos/shared backend utilities
  - Notable domains: `auth`, `catalog`, `cart`, `checkout`, `payments`, `reviews`, `warranty`, `coupons`
- `src/modules` - client-side domain modules (hooks + components)
- `src/components` - shared UI + providers
- `src/contracts` - shared API/domain contracts and DTO typing
- `src/constants` - query keys and constants
- `src/lib` - shared utilities (e.g. fetcher)

## Request flow (mental model)

1. UI in `src/app` or `src/modules` calls API/fetch hooks.
2. API route in `src/app/api/**` validates/parses request.
3. Route delegates to service layer in `src/server/**`.
4. Service uses repo layer and shared contracts/errors/http helpers.
5. UI consumes typed responses via hooks/query keys.

## Auth and access control

- Auth uses `next-auth` (v5 beta in dependencies) with options in `src/server/auth/authOptions.ts`.
- `src/proxy.ts` enforces auth for:
  - `/dashboard/:path*`
  - `/api/admin/:path*`
- If no session cookie token is found:
  - Admin API returns `401` JSON
  - Dashboard routes redirect to `/login?callbackUrl=...`

## Current active work areas (from local git status snapshot)

- Storefront pages:
  - `src/app/(public)/page.tsx`
  - `src/app/(public)/products/page.tsx`
  - `src/app/(public)/products/[slug]/page.tsx`
  - `src/app/(public)/brand/[slug]/page.tsx`
  - `src/app/(public)/category/[slug]/page.tsx`
- Catalog/cart API and backend:
  - `src/app/api/cart/route.ts`
  - `src/app/api/catalog/products/[slug]/route.ts`
  - `src/server/cart/cart.service.ts`
  - `src/server/catalog/catalog.service.ts`
  - `src/server/checkout/checkout.service.ts`
- Contracts/query/hooks/components:
  - `src/contracts/cart.ts`
  - `src/contracts/catalog.ts`
  - `src/constants/queryKeys.ts`
  - `src/modules/cart/hooks.ts`
  - `src/modules/storefront/components/product-detail.tsx`
  - `src/components/ui/navigation-menu.tsx`
- Auth:
  - `src/server/auth/authOptions.ts`

## Useful conventions for future prompts

- Prefer updating contracts in `src/contracts/**` before wiring service/route/UI changes.
- Keep API and frontend query keys in sync (`src/constants/queryKeys.ts`).
- For cart/catalog changes, usually touch all of:
  - route handler (`src/app/api/**`)
  - service (`src/server/**`)
  - contracts (`src/contracts/**`)
  - client hooks/components (`src/modules/**`)

