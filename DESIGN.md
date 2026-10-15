---
name: Ravyntech Storefront
description: A gadget shop for Bangladesh that reads like a well-made product datasheet; exact, calm, measured.
colors:
  paper: "oklch(0.968 0.003 250)"
  surface: "oklch(0.995 0.002 250)"
  field: "oklch(0.935 0.006 250)"
  ink: "oklch(0.19 0.012 255)"
  ink-2: "oklch(0.46 0.014 255)"
  rule: "oklch(0.875 0.007 250)"
  rule-strong: "oklch(0.78 0.01 250)"
  raven: "oklch(0.402 0.018 255)"
  raven-ink: "oklch(0.32 0.02 255)"
  raven-soft: "oklch(0.93 0.012 255)"
  on-raven: "oklch(0.985 0.003 255)"
  sale: "oklch(0.53 0.19 28)"
  eye: "oklch(0.7 0.15 235)"
typography:
  display:
    fontFamily: "Archivo, Google Sans, sans-serif"
    fontSize: "clamp(2.1rem, 5.4vw, 4rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, Google Sans, sans-serif"
    fontSize: "clamp(1.75rem, 3.6vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 125"
  section:
    fontFamily: "Archivo, Google Sans, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Archivo, Google Sans, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
    fontVariation: "'wdth' 112.5"
  price-lg:
    fontFamily: "Archivo, Google Sans, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 112.5"
  price-sm:
    fontFamily: "Archivo, Google Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 112.5"
  body:
    fontFamily: "Google Sans, Arial, Helvetica, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
    fontFeature: "'tnum' 1"
  body-sm:
    fontFamily: "Google Sans, Arial, Helvetica, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "'tnum' 1"
  label:
    fontFamily: "Google Sans, Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
  wordmark:
    fontFamily: "Archivo, Google Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 125"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  full: "9999px"
spacing:
  hair: "6px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "64px"
  section-wide: "96px"
  gutter: "16px"
  gutter-wide: "56px"
  target: "44px"
components:
  button-primary:
    backgroundColor: "{colors.raven}"
    textColor: "{colors.on-raven}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.raven-ink}"
    textColor: "{colors.on-raven}"
  button-primary-purchase:
    backgroundColor: "{colors.raven}"
    textColor: "{colors.on-raven}"
    rounded: "{rounded.md}"
    height: "48px"
    width: "100%"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  chip-category:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  chip-category-all:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  variant-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "56px"
  variant-option-selected:
    backgroundColor: "{colors.raven-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  product-image-field:
    backgroundColor: "{colors.field}"
    rounded: "{rounded.md}"
  product-image-field-hover:
    backgroundColor: "{colors.raven-soft}"
  sale-badge:
    backgroundColor: "{colors.sale}"
    textColor: "oklch(1 0 0)"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  cart-count:
    backgroundColor: "{colors.raven}"
    textColor: "{colors.on-raven}"
    rounded: "{rounded.full}"
    height: "20px"
  facts-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    height: "36px"
  header:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "64px"
  footer:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "48px 0"
---

# Design System: Ravyntech Storefront

Scope: the customer storefront only (everything under the `.sf` scope: home, listings, product page, cart, checkout, account, auth, policy pages). The admin dashboard keeps the default shadcn tokens and is not governed by this file.

## Overview

**Creative North Star: "The Spec Sheet"**

The shop reads like a well-made product datasheet: exact, calm, measured. Every surface is a sheet of cool paper ruled with hairlines, set in a wide engineering display face, with near-black ink for facts and a single raven-mask blue-gray for the things you act on. Information is the decoration. Prices, stock, delivery fees, warranty terms and payment methods are set as real, ruled facts rather than being hidden behind banners, and nothing is shown that the data does not back.

Density is moderate and even, tuned for phones in bright light on slow networks: generous 44px targets, short line lengths, no heavy imagery beyond the product photos themselves, which sit on tinted fields so a mixed catalogue of white-background shots reads as one set. The world explicitly rejects the category default of a decorative hero banner over identical card grids; the home page opens on a wide headline, a ruled category index and one real product at full scale.

**Key Characteristics:**
- Cool paper ground, near-black ink, one raven-blue-gray accent; sale red only on real discounts.
- Archivo set wide (125% / 112.5% width) for headings, prices and model names; Google Sans for everything read.
- Tabular figures everywhere in the storefront scope.
- Hairline rules instead of boxes; a heavier ink rule opens each section.
- The spec ledger: ruled two-column term/value rows, echoed as a one-line spec run under every product card.
- Product photos always on a tinted field, never on bare paper.

## Colors

A near-monochrome cool-blue-gray neutral set with one deliberate raven-mask blue-gray and one reserved red.

### Primary
- **Raven Mask Blue-gray** (`raven`): the action colour. Primary buttons, the selected variant ring, the in-stock dot, the cart count, focus outlines, text selection and caret, the free-delivery progress fill, active filter dots.
- **Deep Raven** (`raven-ink`): the blue-gray as text and as the hover state of blue-gray fills. Links in running UI ("All 24 products", "See all"), the "In stock" word, hover colour of category rows and footer links.
- **Raven Wash** (`raven-soft`): the selected variant background and the hover tint of a product image field.
- **On Raven** (`on-raven`): text on blue-gray fills.

### Secondary
- **Discount Red** (`sale`): only for a real reduction against a stored original price: the "−N%" badge on a card, "Save Tk X" beside a price, and filter validation errors. Never decorative, never for urgency.

### Neutral
- **Cool Paper** (`paper`): the page ground and the sticky header.
- **Sheet White** (`surface`): raised working surfaces: inputs, chips, outline buttons, the footer, the featured product's text panel, dropdowns and sheets.
- **Photo Field** (`field`): the tinted plate every product photo sits on; also hover background for quiet controls.
- **Ink** (`ink`): primary text, the facts strip ground, the heavy section-opening rule, the "All N" chip.
- **Graphite** (`ink-2`): secondary text: brand names, spec runs, ledger terms, counts, placeholders, out-of-stock state.
- **Hairline** (`rule`): every divider and ledger row line.
- **Strong Hairline** (`rule-strong`): control borders (inputs, chips, outline buttons, unselected variant tiles).

Dark mode (`.dark`) re-points the same roles: paper `oklch(0.17 0.008 255)`, surface `oklch(0.205 0.01 255)`, field `oklch(0.24 0.012 255)`, ink `oklch(0.95 0.004 250)`, ink-2 `oklch(0.74 0.01 250)`, rule `oklch(0.32 0.012 255)`, rule-strong `oklch(0.42 0.014 255)`, raven `oklch(0.8 0.03 255)`, raven-ink `oklch(0.87 0.025 255)`, raven-soft `oklch(0.3 0.02 255)`, on-raven `oklch(0.18 0.012 255)`, sale `oklch(0.7 0.16 28)`. Photos drop `mix-blend-multiply` in dark mode.

### Named Rules
**The One Blue-Gray Rule.** Raven blue-gray marks what you can act on or what is selected, and nothing else. Headings, borders and decoration stay ink and hairline.

**The Real Discount Rule.** Sale red appears only when the current price is below a stored original price. No red for "hot", "limited" or countdowns.

**The Scoped Palette Rule.** Storefront colour comes from the `--sf-*` tokens through the `.sf` scope, which re-points the shadcn tokens (`--primary`, `--border`, `--ring` ...) so shared primitives inherit the world. Never hard-code storefront colours into shared components, and never let `--sf-*` leak into the admin dashboard.

## Typography

**Display Font:** Archivo variable, with the `wdth` axis loaded (fallback Google Sans, sans-serif)
**Body Font:** Google Sans, self-hosted at 400 / 500 / 600 (fallback Arial, Helvetica, sans-serif)
**Label/Mono Font:** system monospace, only for SKUs (13px)

**Character:** A wide, squared engineering face for anything you would read off a spec plate (headings, prices, model names), against a friendly humanist sans for everything you read in sentences. Width, not weight, is the main lever of emphasis.

### Hierarchy
- **Display** (700, clamp(2.1rem, 5.4vw, 4rem), 0.95, width 125%): the home opening line only. Balanced wrap.
- **Headline** (700, clamp(1.75rem, 3.6vw, 2.6rem), 1.02, width 125%): the product name on the product page.
- **Section** (700, 24px rising to 32px at md, width 125%, −0.02em): section heads ("New in", "What you know before you pay", "More in ...").
- **Title** (600, 18px, width 112.5%): sub-section heads ("Specifications", "About this product", "Order summary", sheet titles, empty-state line) and category index rows (20px).
- **Price** (600, 15px / 18px / 30-36px, width 112.5%, −0.01em, tabular): every price, always one unbreakable run of "Tk" plus amount. Struck original price in 14px Graphite; saving in 14px Discount Red.
- **Body** (400, 15px, 1.625): descriptions and the home intro, held to a prose measure (`max-w-prose` / ~28rem for intros). Small body (14px) for UI text, ledgers and controls.
- **Label** (500, 12px): brand names above product names, stock marks, spec runs, counts, footer column heads, the facts strip.

Every `h1` and `h2` inside `.sf` defaults to Archivo at 112.5% width with −0.015em tracking, so new storefront pages inherit the voice without opting in.

### Named Rules
**The Wide Figures Rule.** Numbers that matter (prices, delivery fees, thresholds) are set in Archivo semi-expanded with tabular figures. All other storefront numbers are tabular by inheritance from `.sf`.

**The Width-Not-Weight Rule.** Emphasis climbs by width (100% → 112.5% → 125%) before it climbs by weight. Nothing in the storefront goes above 700.

## Layout

A single centred sheet: max 1280px wide, 16px side gutter on phones and 56px from 640px up. Breakpoints are 480 / 640 / 768 / 1024 / 1280px.

The shell stacks a 36px ink facts strip (free-delivery threshold, delivery fees, enabled payment methods, returns link), then a sticky paper header (56px phone / 64px desktop: logo, persistent search, account, cart) with a 44px category nav row on desktop. Search never hides: on phones it drops to its own row under the logo.

Sections are separated by 64px (96px from 768px) and each opens with a heading over a 1px ink rule (or a 2px ink rule for the terms ledger). Product grids run 2 / 3 / 4 columns with 16px (24px at lg) column gaps and 32px row gaps. On phones, horizontal rails (category chips, "New in") scroll edge to edge with snap, bleeding into the gutter by the gutter width.

The product page is a 1.1 : 1 two-column split at 1024px with the gallery sticky beside the purchase column; below 1024px a fixed bottom bar with price and Add to cart slides up once the main button leaves the viewport. Listings put filters in a sticky 1024px+ sidebar and in a bottom sheet (max 85dvh) on smaller screens.

### Named Rules
**The Facts-First Rule.** Delivery fees, the free-delivery threshold and payment methods are visible before checkout on every page: in the facts strip, on the product page terms ledger, on the home ledger and in the footer. All values are read live from settings, never typed in.

## Elevation & Depth

The world is flat. Depth comes from tone (paper → surface → field) and from rules, not from shadows. Shadows appear only on elements that genuinely float over content, and they are soft, ink-tinted and pulled in with a negative spread.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 12px 32px -12px oklch(0.2 0.02 165 / 0.25)`): the search preview dropdown.
- **Dock** (`box-shadow: 0 -8px 24px -12px oklch(0.2 0.02 165 / 0.2)`): the mobile sticky purchase bar, over a 95% surface.

### Named Rules
**The Ruled-Not-Boxed Rule.** Group content with hairlines (top/bottom rules, divided lists), not with bordered or shadowed cards. A product card has no frame: image field, then text, then a hairline over the price row.

**The Floating-Only Shadow Rule.** A shadow means "this is above the page right now." Resting surfaces never carry one.

## Shapes

Small, precise corners. The `.sf` scope sets the base radius to 6px, which yields 2px (badges, filter rows, search thumbnails), 4px (buttons, inputs, selects, variant tiles, product image fields, dropdowns) and 6px (the featured product panel, main product gallery image, sheet top corners). Pills (full radius) are reserved for chips: category chips, removable active-filter chips, and the cart count. Product photos are `object-contain` with ~8% inset on their field, so silhouettes float, never crop. Stock dots are 6px circles: filled blue-gray for in stock, an empty graphite ring for out of stock.

## Components

### Buttons
Quiet, exact, never decorative.
- **Shape:** gently squared (4px).
- **Primary:** Raven Blue-gray fill, On Raven text, 14-15px medium. Height 44px minimum in storefront use; the add-to-cart and checkout buttons are 48px and full width.
- **Hover / Focus / Active:** fill deepens to Deep Raven; `:focus-visible` draws a 2px raven outline at 2px offset (from the `.sf` scope); press scales to 0.98 over 100ms. Disabled is 50% opacity with the label changed to the reason ("Out of stock").
- **Outline:** Sheet White fill, Strong Hairline border, ink text, 44px high; border darkens to Graphite on hover. Used for pagination and the mobile Filters trigger.
- **Text link action:** Deep Raven 14px medium with an arrow, at least 44px tall ("All 24 products ->").

### Chips
- **Category chip (mobile index):** 44px pill, Sheet White, Strong Hairline border, name plus a Graphite count. The final "All N" chip inverts to Ink with Paper text.
- **Active filter chip:** 44px pill, Sheet White, Strong Hairline border, label plus a 14px x; border darkens on hover.

### Cards / Containers
- **Product card:** no frame. A 4:5 Photo Field (16:10 for a feature card) with 4px corners, then Graphite brand label, two-line clamped name (14px medium; feature cards use the Title face at 20px), the one-line spec run, then a hairline and the price row with the stock mark. The whole card is one link via a stretched pseudo-element; focus draws the raven outline around it. Hover tints the field to Raven Wash over 300ms. A discount shows a 2px-corner red "−N%" badge at the field's top left.
- **Product row:** compact 96px / 120px square field beside brand, name, spec run, price and stock; used in divided lists beside a feature card.
- **Featured product:** one product at full scale on a 6px-corner Photo Field, with a Sheet White text panel ruled off from the photo; carries the large price, saving, warranty and a solid "View product" pseudo-button.
- **Order summary:** Sheet White card with 16px padding, Title heading, ruled subtotal in wide figures, a 4px free-delivery progress bar in raven with the remaining amount spelled out.

### Inputs / Fields
- **Style:** Sheet White fill, Strong Hairline 1px border, 4px corners, 44px high (search is 40px on desktop), 14-15px text with a raven caret. Search has a 16px leading icon in Graphite.
- **Hover:** border to Graphite.
- **Focus:** border turns Raven Blue-gray with a 2px 25% raven ring.
- **Error:** border and helper text in Discount Red, with the message in words ("Minimum is higher than maximum.").

### Navigation
- **Facts strip:** 36px Ink band, 12px Paper text, items separated by slashes; scrolls horizontally on phones rather than wrapping.
- **Header:** sticky Paper bar with a single bottom hairline. Logo plus the Archivo uppercase wordmark (hidden below 360px). Account and cart are 44px icon-plus-label targets (labels become screen-reader only under 640px), hovering to a Photo Field wash. The cart count is a 20px raven pill that pops in.
- **Category nav (desktop):** 44px row of 14px medium links, hover to Deep Raven.
- **Category index (home, desktop):** a ruled list under a 1px ink top rule: 56px rows with the name in the 20px Title face, a Graphite count, and a trailing arrow that nudges 4px right on hover.
- **Footer:** Sheet White, 48px vertical padding, four columns from 1024px; the brand column carries a small delivery/payment ledger. All links are 44px-tall targets, hover to Deep Raven with underline.
- **Pagination:** outline buttons for Previous / Next around a tabular "1–24 of 120" count, over a top hairline.

### Variant Selector
Tiles in a 2 / 3 column grid, 56px minimum, 4px corners, label over a tabular price. Unselected: Sheet White with Strong Hairline. Selected: Raven Wash fill, raven border plus a 1px raven ring, announced with `aria-pressed`. Out of stock: Graphite text, label struck through, price replaced by "Out of stock".

### Stock Mark
A 6px dot plus words, never colour alone: "In stock" in Deep Raven with a filled raven dot, "Out of stock" in Graphite with an empty ring. 12px medium (14px on the product page).

### The Spec Ledger (signature)
The world's signature move. Facts are set as a ruled two-column datasheet: a term column (Graphite, min 7-8rem or 38%) and a value column, each row 10-12px tall in padding with a hairline beneath, the whole ledger opened by an ink rule. It carries variant attributes and SKU (mono 13px) on the product page, the delivery / payment / warranty / returns terms beside the buy button, the "What you know before you pay" block on home, and the footer's delivery facts. Every product card and row echoes it as a single spec run: the key attributes joined with " · " in 12px Graphite, truncated to one line. Values that are numbers use tabular, and prices in a ledger use the wide figure face.

### Motion
Short and functional. Arrows nudge 4px right over 300ms ease-out on hover; image fields tint over 300ms; the cart count pops in over 320ms on `cubic-bezier(0.16, 1, 0.3, 1)` from 40% scale; the mobile purchase bar slides 300ms ease-out; the free-delivery bar grows over 500ms ease-out; buttons press to 0.98 over 100ms. Under `prefers-reduced-motion: reduce`, every storefront animation and transition collapses to near zero.

## Do's and Don'ts

### Do:
- **Do** scope every storefront page under `.sf` and take colour from the `--sf-*` roles (via `bg-paper`, `text-ink-2`, `border-rule`, `bg-raven` ...).
- **Do** give every interactive element a 44px minimum target (`h-11` / `min-h-11`); buy and checkout buttons are 48px.
- **Do** rely on the scope's focus ring: 2px solid raven outline, 2px offset. When a control replaces it (inputs), use a raven border plus a 2px 25% raven ring.
- **Do** set facts as a spec ledger (ruled term/value rows with tabular figures) and under products as a one-line " · " spec run.
- **Do** put every product photo on the Photo Field with `object-contain` and an inset, and show the "Photo coming soon" plate with the brand set wide when there is no photo.
- **Do** set prices with the Price component: wide Archivo, tabular, no wrap between "Tk" and the amount, struck original with a screen-reader "Was".
- **Do** open sections with a heading over an ink rule and separate them by 64px / 96px.
- **Do** pair every state colour with words or shape (stock dot plus "In stock", strike plus "Out of stock").

### Don't:
- **Don't** add a decorative hero banner or a carousel; the home page opens on a headline, the category index and one real product.
- **Don't** show invented proof, counts, delivery times, stock numbers or discounts; every fact on the page is read from data or settings.
- **Don't** use raven blue-gray for headings, borders or decoration, and don't use sale red for anything except a real price reduction or a validation error.
- **Don't** wrap groups in bordered or shadowed cards where a hairline will do; shadows belong only to floating layers.
- **Don't** set prices or model names in the body face, or push Archivo past 700 weight.
- **Don't** put product photos on bare paper or crop them to fill.
- **Don't** apply the `--sf-*` palette or `.sf` overrides to the admin dashboard.


## Brand update (October 2026)

The shop is now **Ravyntech**: a raven, clever and technical. The action colour is the brand blue-gray **#424952** (`raven`, oklch(0.402 0.018 255)); paper, ink and rules are cool neutrals tinted toward the same hue. **Eye** (`--sf-eye`, oklch(0.7 0.15 235)) is the raven's eye from the logo: a small live signal only (in-stock dot, cart count), never text and never a fill larger than a badge. The mark lives in `public/brand/ravyntech-mark.png`; the wordmark is live Archivo text, RAVYN in ink and TECH in raven.
