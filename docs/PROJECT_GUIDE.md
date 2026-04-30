# Gadget Ecommerce - Project Guide

## 1) Brief Overview

`gadget-website` is a modern full-stack ecommerce platform built with Next.js App Router.  
It supports customer shopping flows (browse -> cart -> checkout -> payment -> orders) and an admin dashboard for catalog, orders, coupons, payments, warranty, and analytics.

The codebase is structured so core business logic lives in `src/server/*` and transport/UI layers are thin. This keeps the system maintainable today and easier to move to a separate backend service later.

---

## 2) What Has Been Implemented

### Customer-facing Features

- Authentication with Auth.js (credentials + Google), signup/login/logout, forgot/reset password.
- Product catalog with:
  - Listing, filtering, search, pagination.
  - Product detail page with gallery, variant selection, and SEO metadata.
  - Category and brand routes.
- Cart and checkout:
  - Guest cart + server cart merge on login.
  - Address management.
  - Shipping rule calculation.
  - Coupon apply/validate.
  - Transactional order placement with item snapshots and stock decrement.
- Payments:
  - COD.
  - SSLCommerz.
  - bKash.
  - Bank transfer (manual reference + admin verification).
  - Payment callback handling with idempotency.
- Order experience:
  - Order history and order details.
  - Tracking through order events.
  - Cancel before shipping.
- Post-purchase:
  - Verified-buyer reviews.
  - Warranty request submission and tracking.

### Admin Features

- Catalog management for brands, categories, and products.
- Inventory handling via product variants/SKU and stock.
- Order list + detail management with status transitions and event audit trail.
- Payment verification panel for manual/COD flows.
- Coupon CRUD (percentage/fixed, limits, date windows, active/inactive).
- Warranty management workflow.
- Analytics dashboard with real metrics:
  - Revenue.
  - Profit.
  - Customer/order counts.
  - Top sellers.
  - Low stock alerts.

### Platform Hardening

- Rate limiting on sensitive endpoints (auth + checkout).
- Structured server logging.
- Standardized API error transport.
- `robots.ts` + `sitemap.ts` for SEO.
- Global/page error boundaries + improved not-found page.
- Smoke tests for critical pure logic (money, rate-limit, errors, shipping, slug, fetcher).

---

## 3) How It Works (High-Level Flow)

1. **UI Layer** (`src/app`, `src/modules`, `src/components`) collects user input and calls APIs.
2. **API Layer** (`src/app/api/*`) validates payloads using Zod contracts and handles auth checks.
3. **Service Layer** (`src/server/*`) runs business logic (checkout rules, payment orchestration, coupon validation, etc).
4. **Data Layer** uses Prisma (`src/lib/prisma.ts`) to persist and query PostgreSQL.
5. **Response Handling** is normalized through shared HTTP helpers and typed client fetchers.

This layered approach keeps UI and business/data concerns separated and reduces coupling.

---

## 4) Architecture Notes

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Auth.js with JWT session strategy
- **Validation:** Zod contracts in `src/contracts`
- **Server state/UI state:** TanStack Query + Zustand (client-only state where needed)
- **UI:** Tailwind CSS + shadcn/ui
- **Media:** Cloudinary
- **Testing:** Vitest

### Design decisions

- Money stored as integer cents to avoid floating-point issues.
- Order item snapshots protect historical order correctness.
- Payment provider strategy interface makes payment methods pluggable.
- Error and HTTP helpers centralize transport behavior.
- Server logic is framework-agnostic enough to migrate into standalone backend services later.

---

## 5) Folder & File Structure

```text
gadget-website/
  prisma/
    schema.prisma              # Database schema (products, variants, orders, coupons, etc.)
    migrations/                # Prisma migrations
    seed.ts                    # Dev seed script

  src/
    app/
      (public)/                # Storefront routes (home, products, checkout, account, orders)
      (dashboard)/             # Admin dashboard routes
      api/                     # Route handlers (transport layer)
      error.tsx                # Route segment error boundary
      global-error.tsx         # App-level fallback boundary
      not-found.tsx            # 404 page
      robots.ts                # Robots rules
      sitemap.ts               # Dynamic sitemap

    auth.ts / middleware.ts    # Auth config + route protection

    components/                # Shared UI components (shadcn + custom)
    modules/                   # Feature-focused frontend modules/hooks/components
    contracts/                 # Zod schemas + typed DTO contracts
    server/                    # Business logic (services, repos, common utilities)
      common/                  # Errors, logging, money, rate-limit, HTTP helpers
      checkout/                # Checkout and shipping logic
      payments/                # Payment strategy + providers + orchestration
      analytics/               # Admin metrics logic
      coupons/                 # Coupon business rules
      reviews/                 # Review logic
      warranty/                # Warranty workflow
      ...                      # Catalog/orders/auth related server modules

    lib/
      prisma.ts                # Prisma client
      fetcher.ts               # Typed API fetch helper
      queryClient.ts           # React Query client config

  docs/
    PROJECT_GUIDE.md           # This document
```

---

## 6) API/Business Workflow (Examples)

### Checkout + Payment

- Client submits checkout payload to `/api/checkout`.
- API validates request + enforces rate limit + resolves session.
- Checkout service creates order transactionally:
  - validates cart/stock/coupon/address,
  - writes order + order items snapshots,
  - decrements stock.
- Payment service kicks off provider flow (COD/SSLCommerz/bKash/Bank).
- Provider callback routes apply idempotent status updates.

### Reviews

- User can only review delivered order items.
- Each order item can receive one review.
- Public product page shows review list + summary stats.

### Warranty

- User submits warranty for eligible delivered order.
- Admin can list, transition status, and attach resolution notes.

---

## 7) Current Status

This project has completed its planned refactor and implementation phases (foundation through hardening).  
It is now in a maintainable state with production-oriented patterns, while still keeping complexity practical for ecommerce needs.

