# Project Overview

## What this is

**Cryptech** — a full-stack e-commerce MVP for gadgets/electronics targeting the Bangladesh market. Customers browse a catalog, manage a cart (guest or logged-in), check out with local payment methods (COD, bKash, SSLCommerz, bank transfer), track orders, leave verified-purchase reviews, and file warranty requests. Admins manage catalog, orders, payments, coupons, warranty, and users from a dashboard with an analytics overview.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL (Prisma-hosted) via Prisma ORM 6 |
| Auth | Auth.js v5 beta (next-auth) — JWT strategy, credentials + Google OAuth |
| Validation | Zod 4 contracts shared client/server (`src/contracts/`) |
| Server state | TanStack Query 5 |
| Client state | Zustand (guest cart) |
| UI | Tailwind CSS 4 + shadcn/ui (Radix), lucide/tabler icons, sonner toasts |
| Media | Cloudinary (server-side upload, admin-only) |
| Charts/tables | Recharts, TanStack Table |
| Testing | Vitest + React Testing Library (unit tests for pure logic) |
| Analytics | Vercel Analytics |
| Deployment | Vercel — `main` branch auto-deploys |

## Hosting & cost constraints

- **Vercel free tier**: serverless functions — no shared memory between invocations (affects rate limiting), no background jobs, cold starts.
- **Prisma-hosted Postgres**: connection limits apply; keep query counts low.
- **Design rule**: prefer solutions that stay on free tiers — DB-based mechanisms, conditional SQL updates, Resend/Brevo free email tiers, Upstash free Redis tier — before anything paid.

## Environment variables

Local values live in `.env.dev` (not committed); copy `.env.example` to `.env.dev` to start. Production values live only in the Vercel dashboard. Keep `.env` free of database URLs; see README "Local vs production notes".

| Group | Variables |
| --- | --- |
| App | `APP_NAME`, `APP_DEFAULT_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL` |
| Database | `DATABASE_URL`, `SHADOW_DATABASE_URL` |
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AUTH_TRUST_HOST`, optional `AUTH_SECRET` (fallback read in `src/proxy.ts`) |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (provider only registers if both present) |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_FOLDER`, `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` |
| SSLCommerz | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX` |
| bKash | `BKASH_BASE_URL`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` |
| Seed | `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CUSTOMER_EMAIL`, `SEED_CUSTOMER_PASSWORD` (defaults exist in `prisma/seed.ts` — see issues) |

Note: `src/app/sitemap.ts` and `src/app/robots.ts` read `NEXT_PUBLIC_APP_URL` (falling back to `NEXTAUTH_URL`); `src/env.ts` requires it.

## Scripts

The scripts table, guard behavior and local build command live in the README ([Scripts](../../README.md#scripts), [Local vs production notes](../../README.md#local-vs-production-notes)). `postinstall` runs `prisma generate`.

## Payment sandbox mode

When gateway credentials are missing from env, bKash and SSLCommerz fall back to local sandbox harness routes (`/api/payments/sandbox/*`) that render Approve/Decline pages. **Warning:** the sandbox trust branch is currently exploitable in production — see `docs/issues/01-security.md` before deploying with real payments.
