# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Everyday buyers in Bangladesh, mostly on mobile and often on slow networks, shopping for gadgets and electronics (phones, accessories, earphones, smartwatches). Price-aware, wary of fake or unsupported products, and used to paying cash on delivery or through bKash and SSLCommerz. Their job: find a gadget they can trust, pay in a way they are comfortable with, and know where the order is.

A second audience is the shop admin (owner and staff), who run catalog, orders, payment verification, coupons, warranty claims and analytics from the dashboard.

## Product Purpose

"Ravyntech" is a gadget/electronics e-commerce MVP for the Bangladesh market. Customers browse and filter a catalog, build a guest or logged-in cart, check out with local payment methods, track orders and leave verified-purchase reviews and warranty requests. Success is a real shop that takes orders and payments safely and can be run day to day by a small team.

## Positioning

A curated gadget catalog rather than an everything-marketplace. Positioning beyond curation (trust, price, warranty) is not yet decided.

## Operating Context

- Payments: COD (with an optional admin-configured confirmation fee), bKash, SSLCommerz, bank transfer with admin verification.
- Shipping: Dhaka 60 BDT, outside Dhaka 120 BDT, free at 5000 BDT and above. Money is stored as integer paisa.
- Orders move PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, or CANCELLED, with an audit trail shown to customers and admins.
- Hosted on Vercel free tier with Prisma-hosted Postgres; public catalog pages are ISR, filtered listings are dynamic.

## Capabilities and Constraints

- Customers: search/filter/sort, product variants, guest cart merged on login, address book, coupons, order history, self-cancellation, verified-buyer reviews, warranty requests, Google OAuth, password reset.
- Admins: products, categories, brands, coupons, orders, payment verification, warranty workflow, users, 30-day analytics.
- Copy is English only for now; Bangla and multi-currency display are later roadmap items.
- Cost-sensitive: free tier first, ISR on public pages, no heavy client JS or paid infrastructure.
- Undecided: the shop's core differentiator beyond curation.

## Brand Commitments

Name: "Ravyntech" (renamed from Cryptech in October 2026; the legal entity is Ravyntech Ltd). Personality: a raven, clever and technical. Mark: the angular raven head in `public/brand/ravyntech-mark.png` (full lockup `public/brand/ravyntech-logo.png`); the wordmark is set as live text, RAVYN in ink and TECH in the brand blue-gray. Brand colour: blue-gray #424952. The bank-transfer account name stays "Gadget Cryptech Ltd." until the bank account itself is renamed. Other assets in `public/`: banner.webp, earphone.svg, smartwatch.svg.

## Evidence on Hand

Trust pages exist (`/about`, `/privacy-policy`, `/terms`, `/refund-policy`, `/contact`); the owner should still review their copy. No real testimonials, customer counts, press or benchmarks exist; future work must not fabricate any.

## Product Principles

- Trust is earned with real information (policies, order timeline, verified reviews), never invented proof.
- Mobile on slow networks is the default case, not an edge case.
- Make local payment and delivery rules legible before checkout, not after.
- A small curated range should feel deliberate, not like a thin marketplace.
- Keep the admin tools fast and scannable; the owner runs the shop with them daily.
