---
version: 1
slug: "src-app-public-layout-tsx"
primary_target: "src/app/(public)/layout.tsx"
related_targets: ["src/app/(public)/page.tsx","src/app/(public)/products/[slug]/page.tsx"]
---

# Storefront surface brief

Scope: customer storefront (home, listings, product page, cart, checkout, account, auth, policy pages). Mode: Operate for listing/PDP/cart/checkout/account; home leans Persuade but stays a working shop. Build path: code-led (no image generation available).

Audience/job: everyday Bangladesh buyers on phones, bright light, patchy network; find a gadget they trust, see delivery and payment terms before checkout, buy.
Constraints: no invented proof, prices, stock counts, delivery times or discounts; payment methods read live from settings (ISR-safe, no cookies); comparison and wishlist deferred (no data behind them); footer contact details unchanged.

## Direction contract

THESIS: The shop reads like a well-made product datasheet: exact, calm, measured. It refuses the category default of a decorative hero banner over identical card grids.

OWN-WORLD: Cool paper ground (#F3F4F1 family), near-black ink, one solder-mask green accent for actions, selection and price emphasis; sale red only for real discounts. Archivo (wide/expanded widths) for display, prices and model names with tabular figures; Google Sans for body. Hairline rules instead of boxes, 6-8px radii, product images on tinted fields. Signature move: the spec ledger, key variant attributes set as a ruled two-column datasheet with tabular figures, echoed in a one-line spec run under each product card.

STORY: Visitor sees immediately what is sold, how delivery and payment work in Bangladesh, and one product worth looking at; trusts it because every fact shown is real; reaches a product in one tap.

FIRST VIEWPORT: Slim facts strip (delivery fees, free from Tk 5,000, enabled payment methods). Header: logo, persistent search, cart with count, account. Home first viewport: left column wide Archivo headline + category index list with arrows; right a large featured product (isPopular, else newest) on a tinted field with name, price, and View product action. On mobile the category index becomes a horizontal chip rail and the first product row starts inside the first screen.

FORM: Spec sheet, choice 1 of 3 presented (user-pinned direction: refined minimalism, precision-tech detail, editorial presentation). Seed key: user-pinned, no concept-seed roll.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
