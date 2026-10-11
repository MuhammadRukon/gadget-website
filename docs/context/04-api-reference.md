# API Reference

All routes live under `src/app/api/**`. Auth levels: **public**, **user** (`requireSession`), **admin** (`requireAdminSession`). Bodies/queries are validated with Zod contracts from `src/contracts/**`.

## Auth

| Route | Methods | Auth | Notes |
| --- | --- | --- | --- |
| `/api/auth/[...nextauth]` | GET/POST | public | Auth.js handlers |
| `/api/auth/signup` | POST | public | rate-limited; bcrypt hash |
| `/api/auth/forgot` | POST | public | rate-limited; no email enumeration; token only shown in dev |
| `/api/auth/reset` | POST | public | rate-limited; single-use hashed token |

## Catalog (public)

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/catalog/products` | GET | list published products; q/category/brand/price/stock/sort/page params |
| `/api/catalog/products/[slug]` | GET | product detail |
| `/api/catalog/categories` | GET | published categories |
| `/api/catalog/brands` | GET | published brands |

## Cart

| Route | Methods | Auth | Notes |
| --- | --- | --- | --- |
| `/api/cart` | GET/POST/PUT/DELETE | user | GET cart, add item, merge guest cart (PUT), clear |
| `/api/cart/[itemId]` | PATCH/DELETE | user | update qty / remove line |
| `/api/cart/hydrate` | POST | **public** | enrich guest-cart variant ids for display; no persistence |

## Checkout & orders

| Route | Methods | Auth | Notes |
| --- | --- | --- | --- |
| `/api/checkout/quote` | POST | user | totals + shipping + coupon validation, read-only |
| `/api/checkout` | POST | user | rate-limited; transactional order placement, then payment kickoff |
| `/api/orders` | GET | user | my orders |
| `/api/orders/[id]` | GET/POST | user | detail; `?action=cancel` self-cancel (restocks) |
| `/api/orders/[id]/warranty` | POST | user | file warranty claim (DELIVERED only) |

## Payments

| Route | Methods | Auth | Notes |
| --- | --- | --- | --- |
| `/api/payments/bank` | POST | user | submit bank transfer reference |
| `/api/payments/bkash/{success,fail,cancel}` | GET/POST | **public** | gateway callbacks → `_handlers.ts` |
| `/api/payments/sslcommerz/{success,fail,cancel,ipn}` | POST | **public** | gateway callbacks → `_handlers.ts` |
| `/api/payments/sandbox/{bkash,sslcommerz}` | GET | **public** | local sandbox harness pages (⚠ see issues 01) |

## Reviews & warranty (customer)

| Route | Methods | Auth | Notes |
| --- | --- | --- | --- |
| `/api/reviews` | GET/POST | GET public / POST user | GET: product reviews + summary; POST: create (delivered items only) |
| `/api/reviews/reviewable` | GET | user | delivered items eligible for review |
| `/api/warranty` | GET | user | my warranty requests |

## Account

| Route | Methods | Auth |
| --- | --- | --- |
| `/api/addresses` | GET/POST | user |
| `/api/addresses/[id]` | PATCH/DELETE | user |

## Admin (all `requireAdminSession`)

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/admin/analytics` | GET | 30-day overview: revenue, profit, orders, customers, top sellers, low stock |
| `/api/admin/catalog/products` (+`/[id]`) | GET/POST/PATCH/DELETE | full CRUD; smart delete (archive if referenced) |
| `/api/admin/catalog/categories` (+`/[id]`) | GET/POST/PATCH/DELETE | delete blocked if products attached |
| `/api/admin/catalog/brands` (+`/[id]`) | GET/POST/PATCH/DELETE | delete blocked if products attached |
| `/api/admin/coupons` (+`/[id]`) | GET/POST/PATCH/DELETE | delete blocked if used by orders |
| `/api/admin/orders` (+`/[id]`) | GET/PATCH | list all (no server pagination); status transition + note |
| `/api/admin/payments` | GET | pending COD/bank-transfer payments |
| `/api/admin/payments/[id]/verify` | POST | verify/reject (⚠ outcome defaults to SUCCEEDED) |
| `/api/admin/users` (+`/[id]`) | GET/POST/PATCH | list/create/edit users incl. role; no delete |
| `/api/admin/warranty` (+`/[id]`) | GET/PATCH | list/filter; status transition + resolution |
| `/api/admin/media/upload` | POST | Cloudinary upload, 5 MB, type allowlist |
| `/api/admin/media/delete` | POST | Cloudinary destroy |

## Misc

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/health` | GET | returns `{message:'OK'}`; no DB ping |
