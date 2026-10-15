---
target: customer storefront
total_score: 21
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 3
target_identity: "url:https://techavaly.vercel.app/"
timestamp: 2026-10-15T19-36-46Z
slug: techavaly-vercel-app
---
# Critique: Cryptech storefront (techavaly.vercel.app)

Heuristics (9 scored, #9 n/a): 1:2, 2:2, 3:3, 4:3, 5:2, 6:3, 7:2, 8:3, 9:n/a, 10:1 = 21/36 (58%, Acceptable).

Design specificity: generic. Neutral shadcn chrome, accent-less, hero is a decorative AI render with no headline/CTA, stock card. Nothing expresses Bangladesh, curated catalog, COD/bKash, delivery rules or warranty. Detector: 0 findings (clean mechanically; problems are compositional and content-level).

Priority issues
- [P1] Trust broken by placeholder/test content visible in production (Tk 0.15, wrong images, logo used as product image, personal Gmail). Fix: distinct image-missing state; data cleanup in admin. harden.
- [P1] No local-commerce facts at decision points (delivery Tk 60/120, free from Tk 5,000, payment methods, warranty, returns). Fix: delivery/payment block on PDP, strip site-wide, free-shipping progress in cart. clarify + layout.
- [P1] Hero has no job: big decorative image, no promise, no CTA, pushes products below fold on mobile. Fix: editorial split hero with category index and real featured product. bolder + optimize.
- [P2] Card/PDP hierarchy: price wraps (Tk / 170,000), no stock cue on cards, PDP description in heavy box, no specs table, "Go to cart" shown with empty cart, zero-star rating row. typeset + polish.
- [P2] Loading/resilience: grey tiles for seconds, header slots pop in, 3840w image for 375 viewport. optimize.
- [P3] Thin nav (3 categories), search hidden on mobile, header targets 18-40px. layout + adapt.

Persona red flags: Casey (no products in first viewport, sub-44px header targets, search hidden); Riley (Tk 0.15, OOS reachable without cue, guest blocked at cart "Sign in to checkout"); Jordan (no how-to-pay/delivery/returns on PDP; Gmail as support; "Cryptech" reads crypto).

Strengths: calm whitespace and type scale, sane mobile grid without overflow, honest empty states (reviews, cart), breadcrumbs, collapsible filters, 4.83:1 muted contrast.
