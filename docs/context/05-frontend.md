# Frontend

## Route groups

- `src/app/(public)` — storefront, wrapped by header/footer layout.
- `src/app/(dashboard)` — admin, wrapped by sidebar layout that server-checks `role === 'ADMIN'`.
- Shared error surfaces: `error.tsx`, `global-error.tsx`, `not-found.tsx`. **No `loading.tsx` anywhere** (gap).

## Storefront pages

| Route | Rendering | Data | Metadata |
| --- | --- | --- | --- |
| `/` (home) | Server, `revalidate 120` | featured products server-fetched | static; **no h1** |
| `/products` | Server, `revalidate 60` | searchParams → server fetch | static |
| `/products/[slug]` | Server, `revalidate 120` | cached server fetch | `generateMetadata` + OG + Product JSON-LD |
| `/category/[slug]`, `/brand/[slug]` | Server, `revalidate 60` | server fetch, `notFound()` if unpublished | `generateMetadata` |
| `/cart`, `/checkout` | Client (checkout page server-gates auth) | React Query | none (noindexed via robots) |
| `/orders/[id]`, `/orders/[id]/bank-transfer` | Client | React Query | none |
| `/account/{orders,addresses,reviews}` | Client, redirect via `useEffect` | React Query | none |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Client (+ server actions for signup/forgot/reset) | — | none |

## Admin pages (`/dashboard/*`)

Dashboard (analytics cards), Orders (+detail with COD fee panel), Payments (with fee verify), Warranty, Products (+new/edit), Categories, Brands, Coupons, Users, Settings (payment methods, COD fee rule, QR upload, contact, note). All client components using React Query hooks from `src/modules/admin/**`; tables via shared `src/components/data-table.tsx` (client-side pagination/filtering only).

## Module structure (`src/modules/<domain>`)

Each domain has `hooks.ts` (React Query wrappers over `src/lib/fetcher.ts`) and `components/`. Key ones:

- `storefront/` — product-card, product-grid, product-filters, product-detail (server component + JSON-LD), gallery, purchase panel, pagination, deferred reviews.
- `cart/` — `guest-cart.ts` (Zustand + localStorage), `hooks.ts` (`useCart` branches guest/server; `useGuestCartMerge` on login), add-to-cart button (always qty 1).
- `checkout/` — `checkout-payment-card.tsx`, `order-summary-card.tsx`, `txn-id-input.tsx` (blur-validated), `add-txn-id-card.tsx` (order page), hooks (`useCheckoutQuote` keyed, `usePaymentConfig`, `usePaymentSelection`, `useCheckoutTxnId`, `useTxnCheck`).
- `orders/` — shared components (`order-items-card`, `order-events-card`, `order-totals-rows`, `cancel-order-card`, `warranty-request-card`, `order-fee-section`, `fee-summary-rows`, `format-ship-address`), admin dialogs (`admin-txn-id-dialog`, `reject-fee-dialog`, `pending-action.ts`).
- `auth/` — server actions (`actions.ts`: signup/forgot/reset), auth-card, google-button.
- `reviews/`, `orders/`, `account/`, `warranty/`, `admin/*` — hooks + forms.

## State management

- **Server state**: TanStack Query, keys centralized in `src/constants/queryKeys.ts` (includes `checkoutQuote` keyed per selection, `paymentConfig` staleTime 30s, admin: `adminOrders`, `adminOrdersList`, `adminOrderDetails`, `adminOrderDetail(id)`, `adminPaymentsPending`; narrower `invalidateAdminPaymentViews(qc, orderId)` for payment updates). Defaults: `staleTime 30s`, `retry 1`, no refetch on focus.
- **Client state**: Zustand only for guest cart.
- **Session**: `useSession` client-side; `auth()` in server components.
- Providers stack in `src/components/providers.tsx`: Session → QueryClient → Theme (next-themes) → CartBootstrap (guest-merge) → Toaster.

## Rendering conventions

- Catalog content is **server-rendered** (crawlable). Reviews on PDP are client-only (`next/dynamic ssr:false`) — invisible to crawlers.
- Header (`src/app/components/header/header.tsx`) is one big client component (menu, debounced search preview with abort, account dropdown, cart trigger).
- Images via `next/image` with Cloudinary remote pattern; fonts via `next/font/local` (Google Sans TTFs).

## Known frontend quirks (details in docs/issues/04-frontend-ux.md)

- Category page passes `brand={category}` to `CommonListPage` — locks the wrong filter.
- Cart panel wraps `<Link>` inside `<Button>` without `asChild` (invalid HTML; disabled state doesn't block navigation).
- Header search nests a form inside a `<button>`.
- Client account pages flash a loader before auth redirect (not server-gated).
- Footer policy/about links all point to `/`.
