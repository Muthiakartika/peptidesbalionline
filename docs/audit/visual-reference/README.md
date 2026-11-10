# Visual reference — peptidesbali.online

This folder is the visual specification for the rebuild. The live WordPress site is the truth.
This folder records what it looked like on **3 November 2026**, so later phases can compare against it.

* [`design-tokens.json`](design-tokens.json): every colour, font, size, radius, shadow, breakpoint and timing
  that was measured, each with the element it was measured on. Phase 3 turns it into the Tailwind theme.
* [`screenshots/`](screenshots/): full-page captures of the 39 representative URLs (+ 4 cart / checkout
  states with products, added 6 Nov 2026, see below; + the shop and a category in the list view,
  `shop-list` and `product-category-list`, added 7 Nov 2026) at 5 widths
  (`desktop-1440`, `laptop-1280`, `tablet-768`, `mobile-390`, `mobile-375`), plus two first-visit
  homepage shots with the age gate open (`home/*-age-gate.jpg`). Re-create them with
  `scripts/audit/capture-screenshots.mjs`.

## How the screenshots were taken (read this before comparing)

* Headless Chrome, device scale 1, JPEG quality 60, full page.
* The **age-verification popup and the cookie bar are hidden** in the full-page shots so they don't cover
  the content, and the popup's scroll lock is undone (otherwise everything below the first screen is
  clipped). Both overlays are documented separately.
* Sticky and fixed elements (header, WhatsApp button, chat bubble) appear once, at their position in the
  first screen.
* **Animations are frozen at their first frame** (the top-bar marquee and the rotating payment badge), so two
  captures taken at different moments can be compared pixel by pixel.
* **Header height is restored after scrolling.** Woodmart's sticky-header script leaves the live header 15px
  shorter after the capture scrolls down and back up (which shifted every earlier capture up by 15px). The
  script now records the header height on load and puts it back. The screenshots in this folder were
  re-captured with this fix on 3 Nov 2026.
* **Related products are hidden on product pages** (their space is kept, at one fixed height on both sides):
  the live site picks and shuffles them on every visit, so no two captures would match. The cards themselves
  are compared one by one instead (same product → same height and look).
* **Only true `vh` heights are locked.** Sections sized in `vh` are locked to their pixel height before the
  full-page shot (otherwise they grow with the giant screenshot window). The script now tests which elements
  really change height with the window (it makes the window 600px taller for a moment) and locks only those;
  locking every element of a rule that merely mentions `vh` moved the live product pages' footer by 40px.
  The shop, category, search, 404 and product references were re-captured this way on 4 Nov 2026.
* **Fresh copies:** Cloudflare can serve a live page that is a day old, so the script adds an unused
  `_fresh=<time>` query argument. The shop, category and search references were re-captured this way on
  4 Nov 2026 (the cached `/shop/` still had an older footer).
* **Width:** live captures are 10px wider than the viewport (1450px at 1440px) because **the live site
  overflows sideways by about 10px**, a small bug on the WordPress site. The comparison script crops both
  images to their shared width instead of stretching one.
* **Privacy:** the `blog-post/` shots show the author name exactly as the live site does, and that name is an
  e-mail address (risk R-12). Keep this repository private.
* Elementor entrance animations are **forced to their final state**, and lazy images are loaded, before
  capture. A real visitor sees elements fade or slide in on scroll.
* Third-party widgets (Tawk.to chat, Trustindex reviews, Google Translate flags) load from other
  servers and may look slightly different between captures.
* **Cart and checkout with products** (`cart-small`, `cart-large`, `checkout-small`, `checkout-large`),
  captured on 6 Nov 2026 with the owner's side's permission: the only captures that touch the live site.
  Two guest carts (no login), each filled once with WooCommerce's add-to-cart request and shared by all five
  widths, so WooCommerce kept two temporary guest sessions (it deletes them after 48 hours). Nothing was typed
  into the checkout and no order was placed; analytics, Clarity, Tawk and Facebook were blocked.
  * *small*: KPV 10mg (Rp 1,200,000): Rp 100,000 shipping, "Top up your supplies", Card and COD locked,
    Crypto preselected.
  * *large*: GLP-3 RTA Pen, disposable pen 5mg (Rp 2,800,000): **only** "Free shipping" offered (the
    Rp 100,000 option is hidden then), Card preselected with "+5%" (total Rp 2,940,000).
  * Their HTML (main content, security tokens, keys and e-mail addresses removed) is in [`markup/`](markup/),
    for building the pages. Re-create with `ONLY=cart-small,cart-large,checkout-small,checkout-large
    MARKUP_DIR=… npm run audit:screenshots` (this creates new guest sessions on the live site: ask first).
  * `cart-empty` stays the empty cart; the checkout redirects to `/cart/` when the cart is empty.
* **Side cart (mini cart)** (`mini-cart/`, `mini-cart-after-add/`, markup `markup/mini-cart.html`), 6 Nov 2026,
  with the user's OK: one more guest session. "Add to cart" on `/product/kpv/` as a visitor (live: the
  button spins, then the side cart opens), then the open side cart at 5 widths in that session. These are
  window-sized pictures (the drawer is fixed), not full pages. The page behind the dark overlay is shifted
  by the live header's 15px change after the first mouse move (Q-38): compare the drawer area only.

## The design in plain words

**Overall feel:** "luxury biotech". Lots of white and warm cream, with gold as the only strong colour.
Black is used for big condensed display headings. The look is soft: large radii, pill buttons and
very light shadows.

**Fonts** (all Google Fonts):

| Use | Font | Typical size |
|---|---|---|
| Body text, nav, product names, prices, buttons | Urbanist | 15 px / 1.6 body, 14 px bold uppercase nav |
| Big homepage headings | Anton (uppercase, condensed) | 55 px H1, 48 px H2 |
| Small uppercase "eyebrow" labels above headings | Inter 500, wide letter-spacing (≈2.5 px) | 10–12 px |
| Stats labels | Jost 600 uppercase | 11 px |
| Gold italic accent words inside big headings ("…*Trusted Across Bali.*") | **Anton italic** (slanted by the browser), weight 500, `#B79127` | same size as the heading (48 or 57 px) |
| Counter numbers, icon-box titles ("The Atlas Standard") | Cormorant Garamond (normal, not italic) | 48 px / 600 gold · 24 px / 400 `#0B0B0B` |
| Also loaded (usage to map in Phase 3) | Poppins 600 | — |

**Colours:** the brand gold `#B8952A` (top bar, accents), a family of lighter and darker golds for prices and
borders (see tokens), cream backgrounds `#FEFBF4`, body text grey `#767676`, headings `#242424`, and a dark navy
`#132F3A` for product titles and buttons on product pages.

**Header:** a 40 px gold marquee bar, then a white **floating pill** header (max 1100 px, radius 35 px, soft
double shadow) that sticks on scroll. On mobile (≤1024 px) it turns into logo + flags + search + cart + burger,
and the menu opens as a left drawer.

**Containers:** the Woodmart container is 1222 px (1192 px content). Elementor sections on the homepage
use fluid padding (multiples of about 11.9 px at 1440 px wide).

**Product card:** white, 1 px gold border `#E7D6AA`, radius 20 px, very light shadow. Square image, category label
in small caps, 2-line title (Urbanist 700, 16 px, navy), gold price (18 px, 700) with a "~$" USD hint under it,
and a full-width pill "Add to cart" / "Select options" button with a thin gold border. 4 columns on desktop shop pages.

**Single product:** two cards side by side, gallery on the left (thumbnails under the main image) and a summary card
on the right: breadcrumbs, 42 px title, 29 px gold price + USD range, short description with emoji bullet list,
a cream notice ("10 Needles + 10 Alcohol pads included"), variation selectors (pill swatches or select),
pill quantity and pill add-to-cart, then "Calculate Your Dose", "Order on Whatsapp" and "view COA" buttons.
Tabs and related products follow.

**Breakpoints:** Elementor switches at **1024 px** (tablet) and **767 px** (mobile). Woodmart's header
changes to the mobile header below 1025 px, and carousels use 0–768 / 769–1024 / 1025+.

## Template-by-template notes for Phase 3

| Template | Things that are easy to miss |
|---|---|
| Home | 25 sections (about 14,000 px tall at 1440). Hero has a background image and an Anton headline (second line gold); a 4-icon USP row; a gold gradient Google-reviews strip; a dark (#111) testimonial band; carousels; counters; a form; "Shop by goal" on a cream gradient. |
| Shop / category | Grey title band with a round category carousel on the right; left sidebar "PRODUCT CATEGORIES" with counts and expand arrows; toolbar with result count, "Show: 9 / 12 / 18 / 24", 3 view icons and the sort dropdown. |
| Product | Cards with a thin gold border and 20 px radius; a sticky add-to-cart bar after 250 px of scroll; a raw `[rank_math_rich_snippet]` text on 37 products (existing bug, see Q-14). |
| Blog post | Black title band, "Posted by", date, comment count; share icons; comment form. |
| Legal | Plain Elementor text pages. |
| Affiliate login / registration | Default AffiliateWP form styling inside the theme (legend, labels, inputs with 35 px radius from Woodmart). |
| Protocol Builder | Its own design system (`arp-*` classes and CSS variables) inside the theme. A skeleton loader shows until the JS app boots. |
