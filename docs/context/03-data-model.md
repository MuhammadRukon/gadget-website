# Data Model

Source of truth: [`prisma/schema.prisma`](../../prisma/schema.prisma). PostgreSQL. All money fields are **integer cents** (`*Cents`).

## Entities

### Identity & auth
- **User** — email (unique), optional `passwordHash` (null for OAuth-only), `role` (`CUSTOMER` | `ADMIN`), phone, image.
- **Account / Session / VerificationToken** — standard Auth.js adapter tables (JWT strategy is used, so `Session` is mostly unused).
- **PasswordResetToken** — `tokenHash` (SHA-256, unique), `expiresAt`, `usedAt` (single-use).
- **Address** — per-user shipping addresses; `isDefault` flag; `country` defaults `"BD"`.

### Catalog
- **Category** — slug/name unique, optional `iconUrl`, `isPopular`, `status` (`DRAFT`/`PUBLISHED`/`ARCHIVED`), self-referential tree via `parentId`.
- **Brand** — slug/name unique, `logoUrl`, `isPopular`, `status`.
- **Product** — slug unique, description, `brandId` (1:N brand→products), `status`, `isPopular`, `warrantyMonths`, SEO `metaTitle`/`metaDescription`.
- **ProductCategory** — M:N join product↔category.
- **ProductImage** — Cloudinary `url` + `publicId`, `alt`, `sortOrder`.
- **ProductVariant** — the sellable unit: unique `sku`, free-form JSON `attributes`, `buyingPriceCents`, `sellingPriceCents`, `discountCents`, `stock`, `lowStockThreshold`, `isActive`. Cart and order items reference variants, never products directly.

### Commerce
- **Cart** — one per user (`userId` unique). **CartItem** — unique per (cartId, variantId), quantity.
- **Order** — `orderNumber` unique, `status` (`PENDING/CONFIRMED/PROCESSING/SHIPPED/DELIVERED/CANCELLED`), denormalized shipping address snapshot (`ship*` fields), `subtotal/discount/shipping/totalCents`, optional coupon ref + code snapshot, `cancelledAt`/`cancelReason`.
- **OrderItem** — snapshot of product at purchase time: `productName`, `variantName`, `sku`, `imageUrl`, `buyingPriceCents`, `unitPriceCents`, quantity. `variantId`/`productId` are nullable so catalog deletions don't break history.
- **OrderEvent** — audit trail: status, note, optional `actorId`, timestamp.
- **Payment** — method (`COD/SSLCOMMERZ/BKASH/BANK_TRANSFER`), status (`PENDING/SUCCEEDED/FAILED/REFUNDED/CANCELLED`), `amountCents`, `providerRef` (unique), `bankRef`, `rawPayload` JSON, `verifiedById`/`verifiedAt` for manual verification. Note: `REFUNDED` is defined but never set anywhere in code.

### Post-purchase
- **Review** — one per `orderItemId` (unique), rating + title + body, tied to user & product.
- **WarrantyRequest** — per order+user, reason, status (`OPEN/APPROVED/REJECTED/RESOLVED`), resolution note.

### Marketing
- **Coupon** — code unique, `PERCENT`|`FIXED`, `value`, `minSubtotalCents`, `maxDiscountCents`, start/expiry window, `usageLimit`/`usedCount`, `perUserLimit`, `isActive`.

## Key relations

```
User 1—N Order, Address, Review, WarrantyRequest ; 1—1 Cart
Brand 1—N Product ; Product N—M Category ; Product 1—N Variant, Image
Cart 1—N CartItem N—1 ProductVariant
Order 1—N OrderItem, OrderEvent, Payment ; N—1 Address, Coupon(optional)
OrderItem 1—0..1 Review
```

## Design notes

- **Snapshots everywhere history matters**: order items copy name/sku/price; orders copy the shipping address; orders copy `couponCode`. Catalog edits/deletes never corrupt past orders.
- **Archival over deletion**: products referenced by order items are archived, not deleted; variants deactivated.
- **Money**: integer cents only; helpers in `src/server/common/money.ts` (rounding, percent discounts).
- **Indexes** exist on the hot paths (status+createdAt on orders, productId+sortOrder on images, etc.).
- **Gaps to be aware of**: no `AuditLog` beyond OrderEvent; no shipment/tracking entity; no stock-movement ledger; coupon `usedCount` is a plain counter (race-prone; see issues); category tree has no cycle guard.
