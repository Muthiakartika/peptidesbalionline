# WooCommerce audit — peptidesbali.online

**Phase 1, 3 November 2026. Public, read-only evidence only.**
Sources: the WooCommerce **Store API** (`/wp-json/wc/store/v1/…`, which is public by design), the product
pages, and **one guest cart session**. To read shipping rates and payment gateways, one item was added to an
anonymous guest cart through the Store API, the country/state was set (no personal data), and the cart was
emptied afterwards. No order was created, no form was submitted, and no admin page was opened.
The admin-only REST API (`/wp-json/wc/v3/…`) answered `401`, as expected.

Each finding is labelled:

* ✅ **Confirmed**: seen directly.
* 🟡 **Inferred**: strong evidence, but needs admin confirmation.
* ❓ **Unknown**: needs admin or database access.

---

## 1. The 20 PRD questions

| # | Question | Finding | Status |
|---|---|---|---|
| 1 | Total published products | **182** | ✅ |
| 2 | Product types | **105 simple, 77 variable.** No grouped, external or subscription products are visible. "Bundles" and "Stacks" are ordinary **simple** products with one price, not WooCommerce bundle products. | ✅ (private/draft products ❓) |
| 3 | Variations | **319** (2–21 per variable product). Every variation has its own image. | ✅ |
| 4 | Attributes | Global attributes: **MG** (`pa_mg`, used by 51 products), **Pen Type** (`pa_pen-type`: Disposable Pen / Reusable Pen / Cartridge, 43), **IU** (`pa_iu`, 5), **Storage** (`pa_storage`, 3); one product each uses Vial Size and Variation (local attributes). Purity and Primary Research Areas exist but aren't used for variations. Terms are ordered by "menu order". | ✅ |
| 5 | Categories | **25**, two levels deep, with images and some long descriptions (see the page inventory). 99 products sit in 2–3 categories. | ✅ |
| 6 | Tags | Product tags: **none used**. | ✅ |
| 7 | SKU structure | **No SKUs**: every product and variation has an empty SKU. The JSON-LD uses the WordPress post ID as `sku`. | ✅ |
| 8 | Pricing and sale pricing | **IDR**, shown as `Rp1,200,000.00` (prefix "Rp", `,` thousands, `.` decimals, 2 decimals). **No product is on sale** right now. Lowest price Rp 100,000; highest Rp 8,800,000. **Two variations have a price of 0** (CJC-1295 with DAC "10 MG", and a TB-500 variation with no MG value). That looks like a data error to confirm (Q-17). A custom snippet shows an approximate **USD** price (`~$72.73`) under every IDR price (about 16,500 IDR per USD). | ✅ (how the USD rate is set ❓) |
| 9 | Inventory behaviour | All 182 products are purchasable. 17 products and 38 variations show **"Available on backorder"**; 18 variations show **"Out of stock"**. No "only X left" counts are displayed, so stock quantities are either not managed or hidden. | ✅ visible / ❓ stock quantities |
| 10 | Shipping methods | Indonesia (tested Bali and Jakarta, same rate ID `flat_rate:1`): **Flat rate "Shipping" Rp 100,000**, or **"Free shipping"** (`free_shipping:2`). Free shipping applied to a cart with a bundle (Rp 4,480,000) and to a Rp 5,500,000 cart with no bundle; it did **not** apply to a Rp 400,000 cart. So there is a minimum-amount rule somewhere between Rp 400,001 and Rp 4,480,000, possibly plus a bundle rule. **Australia: no shipping methods at all**, so the store ships to Indonesia only. Same-day Bali dispatch is promised in copy but isn't a separate shipping method. | ✅ rates / ❓ exact free-shipping rule and zones |
| 11 | Payment methods | 7 gateways are enabled for guests: `atlas_card` (custom; card / Apple Pay / Google Pay, probably processed by **Tagada**), `nowpayments_gateway` (**NOWPayments**, crypto), `payram` (**PayRam**, crypto, webhook `/wp-json/payram/v1/webhook`), `sleeks_revolut` (**Revolut** transfer), `sleeks_wise` (**Wise** transfer), `atlas_idr_account` (custom: Indonesian bank / IDR account transfer), `cod` (**Cash on delivery**). | ✅ IDs / ❓ settings, fees, instructions |
| 12 | Tax configuration | The cart returned `total_tax: 0` and no tax lines for Bali and Jakarta, so taxes appear to be **disabled**. | 🟡 |
| 13 | Coupon rules | Coupons are enabled (the Store API validates codes). Coupon types in use, inferred from site copy: **affiliate promotional codes**, **rewards coupons** (Rp 250,000 off from credits; Rp 50,000 welcome; Rp 250,000 refer-a-friend), the "**one coupon per order**" rule, and minimum order values (Rp 2,500,000 / Rp 3,000,000). | 🟡 / ❓ the actual coupon list |
| 14 | Customer accounts | Registration on `/my-account/` asks for **e-mail only**; WooCommerce e-mails a link to set the password. A login form is in the header dropdown on every page. How many customers exist is unknown. | ✅ form / ❓ count |
| 15 | Order statuses | ❓ Needs admin. Gateways like bank transfer and COD normally use "On hold" / "Processing". Crypto gateways may add their own statuses. | ❓ |
| 16 | Refund procedures | ❓ Needs admin (manual refunds are likely for transfers, COD and crypto). The refund policy page exists: `/refund-returns-policy/`. | ❓ |
| 17 | E-mail notifications | **WP Mail SMTP** is installed (SMTP provider unknown). A custom **"Atlas Emails"** plugin exists (`/wp-json/atlas-emails/v1/subscribe`). WooCommerce default e-mails are probably customised (unknown). | 🟡 / ❓ |
| 18 | Checkout customisations | Classic (shortcode) checkout, not the block checkout: the Store API reports no checkout extensions. WooCommerce **order attribution** (sourcebuster) is active. Tagada adds tracking metadata (`tgd_*` cookies, `tgdgw_get_tracking_meta`). AdsAgent exposes `cart/updateattributes`. Custom checkout fields are unknown. | 🟡 / ❓ |
| 19 | WooCommerce extensions | See [`plugin-inventory.md`](plugin-inventory.md). | ✅ detected |
| 20 | External integrations | Tagada (cards), NOWPayments, PayRam, Wise/Revolut (manual), Google Tag Manager/GA4, Microsoft Clarity, Cloudflare, Tawk.to, Trustindex (Google reviews), Janoshik (COA verification links), WhatsApp. | ✅ detected |

**Also asked by the PRD:**

* *Custom order metadata needed by other plugins:* very likely. AffiliateWP (referral ↔ order links),
  the rewards plugin (credits per order), Tagada / PayRam / NOWPayments (transaction IDs, payment status),
  order attribution, and the Protocol Builder's "tracker sync-orders" all read or write order meta. ❓ Needs a database export.
* *Subscriptions / recurring payments:* none visible. ❓ confirm.
* *Product bundles:* sold as single simple products. How component stock is reduced (if at all) is ❓.
* *Custom checkout fields:* ❓.

## 2. Catalogue facts useful for the data model

* Product descriptions are **large custom HTML**: median 13 KB, largest 211 KB, with tables, inline SVG icons,
  `<details>` FAQ blocks and leftover Elementor markup (43 products). 37 contain a dead
  `[rank_math_rich_snippet]` shortcode that shows as raw text. This HTML must be migrated faithfully.
  Converting all of it to Portable Text would risk visual loss, see the architecture proposal.
* Images: 136 products have 1 image, 45 have 4, 1 has 3. Variation images are separate.
* No weights or dimensions are set (shipping isn't weight-based).
* Linked variations (`woodmart_woo_lv`) and Frequently-bought-together (`woodmart_woo_fbt`) post types exist in
  Woodmart, but no FBT block was seen on the sampled product. ❓ check whether any are configured.
* The **Protocol Builder** keeps its own product mapping (`/wp-json/atlas-planner/v1/catalog`: 103 items with
  "formats" vial/pen/nasal_spray, sizes, pack counts and display groups). This is extra product data the
  migration must carry over.

### Shop behaviour measured while rebuilding it (Phase 3b, 4 Nov 2026)

Each rule below is reproduced in `src/lib/catalog/` and checked by `catalog.test.ts` against recorded
live answers.

* **Default order** is the owner's custom order (`menu_order`). Its dropdown label says "Sort by
  popularity" (Q-37). The other options: latest, price low → high, price high → low, A–Z. Category pages use
  the same order, filtered (products of sub-categories included). 21 per page; `?per_page=` takes any number.
* **Search** (`/?s=…&post_type=product`) only matches product **titles** (every word, `-word` excludes),
  plus three name aliases (Q-35). It compares with the title as stored, so "women's" (straight apostrophe)
  matches "Women’s…" and "blend - tb" matches "Blend – TB", but the curly forms do not. The results are listed in the default order even though the dropdown
  says "Relevance". Exactly one match redirects to that product.
* **Header search suggestions** (Woodmart AJAX, from 3 characters, 300ms pause): matching categories
  (name or slug, A–Z), then up to 20 products, newest first (same-second ties: lowest id first). Each
  product shows the owner's "search buy" pills; options without an in-stock variation are disabled. No
  search history is kept, although Woodmart has the setting.
* **USD hint** (snippet 09-secondary-usd-prices): IDR ÷ 16,500, rounded to cents, `~$` prefix, en dash
  for ranges. This reproduces all 182 product prices.
* **Quick shop in cards**: picking every option swaps in the variation price (as a second `.price`
  inside the first, so it sits 17px further right; kept on purpose), its image, and "Add to cart" as the
  button label. Out-of-stock variations stay selectable (18 exist).
* **Cloudflare** serves cached shop pages up to a day old (Q-36).

## 3. Cart and checkout behaviour

| Behaviour | Observed |
|---|---|
| Add to cart | AJAX on archives and single pages (`woocommerce_ajax_add_to_cart: yes`); quick shop in grids |
| Cart drawer | Right-side drawer with mini-cart; header badge with count |
| Cart page | `/cart/` (noindex). Empty state has "Return to shop". |
| Quantity limits | Min 1, max 9,999, step 1 (Store API) |
| Cart persistence | WooCommerce session cookie (guest) plus a persistent cart for logged-in users (WooCommerce default) |
| Coupon errors | e.g. *Coupon "X" cannot be applied because it does not exist.* (exact wording to keep) |
| Empty checkout | `/checkout/` redirects to `/cart/` |
| Currency display | `Rp` prefix, 2 decimals, `~$` USD hint (custom) |

The checkout page itself (field list, layout, terms checkbox, order notes, account creation, gateway instructions)
**still has to be captured in a normal browser session**. See the open question below.

**Found in Phase 3a (3 Nov 2026):** every page loads the owner's numbered CSS "snippets" (Atlas Longevity
| Snippet NN). Their names reveal cart and checkout features that the public audit couldn't see. Each needs
its PHP/JS behaviour from the source (A6) before it can be rebuilt:

| Snippet | Feature it styles | Status |
|---|---|---|
| 04-single-product-variations-and-cart | Variation pickers and add-to-cart block | seen on product pages |
| 06-product-description-accordions | Accordions inside product descriptions | seen |
| 07-product-bundles | Bundle product layout | seen |
| 08-connected-product-formats | Links between a product's vial / pen / nasal-spray versions | **new**, behaviour unknown |
| 09-secondary-usd-prices | The "~$" USD hint | seen (Q-13) |
| 10-cart-top-up-products | Suggested "top-up" products in the cart | **new** |
| 11-cart-affiliate-coupon | A coupon / affiliate-code field in the cart | **new**, ties into AffiliateWP coupons |
| 13-checkout-form-and-terms | Custom checkout form and terms box | **new** |
| 14-checkout-payment-methods | Styled payment-method list | **new** |
| 15-checkout-delivery-slots | **Delivery time-slot picker** | **new**, needs data model (slots, cut-off 5 PM?) |
| 16-checkout-address-map | **Address picked on a map** | **new**, needs a maps provider + key |
| 17-checkout-whatsapp-help | WhatsApp help box at checkout | **new** |
| 21-lab-copy-icon | Copy-to-clipboard icon on the lab results page | seen |

These go into Phase 5 (commerce) and add two new open questions: **Q-32** how delivery slots work
(fixed slots? capacity? same-day cut-off?) and **Q-33** which maps provider/API key the address map uses.

## 4. Existing-feature → Next.js mapping

| Existing WordPress feature | Data source | Next.js implementation (proposed) | Migration method | Status |
|---|---|---|---|---|
| Product content (title, slug, descriptions, images, categories, SEO) | `wp_posts`, `wp_postmeta`, Yoast meta, media | Sanity `product` documents | Script: WC REST v3 (admin key) → Sanity | Waiting for API key |
| Sellable variants, prices, stock, backorder flags | WC products/variations | Postgres `product_variants` + `inventory` (integer minor units) | Script: WC REST v3 → Postgres, keyed by WooCommerce ID | Waiting for API key |
| Attributes and terms (MG, Pen Type, IU, Storage…) | `pa_*` taxonomies | Sanity `attribute` + term order; variants reference terms | Script | Waiting |
| Categories (25, nested) | `product_cat` | Sanity `productCategory` (parent ref, order, image, SEO) | Store API (public) or REST v3 | Data already exported |
| Variation swatches (text pills vs select) | Woodmart attribute settings | `VariantSelector` component with per-attribute display type | Manual config from Woodmart settings | Needs admin screenshot |
| USD price hint | custom snippet | `formatUsdHint()` helper + rate in Sanity settings or a server-side rate | Confirm rate source first | Q-13 |
| Shop archive (sort, per-page, view modes, AJAX) | WooCommerce + Woodmart | Server-rendered listing with URL params `orderby`, `per_page`, `shop_view` + client transitions | Rebuild | Done (3b; list view 7 Nov 2026) |
| Product search (AJAX, history) | Woodmart | Search API route + client component; history in localStorage | Rebuild | Not started |
| Cart (drawer + page, fragments) | WC session | Postgres `carts` / `cart_items`, cart cookie, server-side totals | Rebuild (no migration of live carts) | Not started |
| Shipping: flat rate Rp 100,000; free shipping rule; Indonesia only | WC shipping zones | `shipping_zones` / `shipping_methods` config in DB | Copy settings from admin | Q-03 |
| Tax | disabled | No tax engine (keep a `tax_minor` column at 0) | — | Confirm |
| Coupons (affiliate, rewards, promotional) | `shop_coupon` posts + meta | Postgres `coupons`, `coupon_redemptions` | Script: WC REST v3 coupons | Waiting |
| Gateways: card (Tagada), NOWPayments, PayRam, Wise, Revolut, IDR transfer, COD | gateway plugins | `lib/payments/<provider>` adapters with webhook verification; manual methods produce "awaiting payment" orders | Needs provider accounts/sandboxes and owner approval | **Blocked: Q-01, Q-02** |
| Orders, order items, notes, refunds | `wp_wc_orders` (HPOS) or `wp_posts` | Postgres `orders`, `order_items`, `payments`, `refunds`, `order_notes` | DB export → import script with legacy IDs | Waiting for DB export |
| Customers and addresses | `wp_users`, `wp_usermeta`, `wc_customer_lookup` | Better Auth `users` + `addresses` | Import; passwords via hash migration or reset flow | Q-07 |
| My Account (dashboard, orders, addresses, account details, downloads?) | WooCommerce endpoints | `/my-account/*` routes with the same URLs | Rebuild | Needs logged-in screenshots |
| Transactional e-mails | WooCommerce + WP Mail SMTP + Atlas Emails | React Email templates + chosen provider | Copy the templates' wording | Q-08 |
| Order attribution (UTM source) | WC order attribution | Store first/last-touch UTM on the order | Import existing meta | Not started |
| Protocol Builder product mapping | Atlas Research Planner tables | Postgres `planner_product_mappings` (or Sanity) | DB export + plugin source review | Q-15 |
| Bundles / stacks | simple products | Simple products (same as today) | Same as products | — |
| Backorders / out-of-stock display | stock status | `inventory.backorders_allowed`, `stock_status` | Script | Waiting |
| WooCommerce POS | `wc/pos/v1/catalog` | Not migrated unless used (Q-16) | — | Q-16 |

## 5. What needs admin or database access

1. WooCommerce → Settings: General (selling locations, currency), Products (inventory, stock), Shipping (zones,
   free-shipping rule), Payments (each gateway's settings, titles, instructions), Accounts & Privacy, E-mails.
2. A **read-only** WooCommerce REST API key (`read` permission only) for products, variations, coupons,
   customers and orders.
3. A database export (or read-only DB user) for HPOS order tables, order meta, refunds, notes, and plugin tables.
4. Logged-in screenshots of: checkout (with an item), order-received page, My Account dashboard, orders, order
   detail, addresses, account details, rewards tab.
5. The source code of custom plugins and snippets: `atlas-research-planner`, Atlas Emails, `atlas_card` and
   `atlas_idr_account` gateways, the USD price snippet and the custom JSON-LD snippet.

## 6. Open questions (WooCommerce)

* **Q-01** Which payment providers will the new site use? Is Tagada contractually OK with a non-WooCommerce
  integration (does it have a server API/SDK)? Same question for PayRam and NOWPayments.
* **Q-02** Is each provider aware of and approving the product category sold? Research peptides, HGH, HCG and
  testosterone are restricted by most card processors (see the feasibility report, risk R-01).
* **Q-03** What is the exact free-shipping rule (minimum amount and/or bundle or coupon condition), and is
  Indonesia the only shipping zone?
* **Q-04** Are stock quantities managed for any product? Which products are allowed to backorder?
* **Q-05** Can we get a staging copy of the site (or temporary test admin) to capture the checkout, order-received
  and account pages without touching production?
* **Q-06** Which order statuses are in use, and which custom statuses do the crypto gateways add?
* **Q-07** Do you accept that customers may need to reset their passwords once, or should we migrate WordPress
  password hashes (possible: WordPress uses phpass/bcrypt and Better Auth supports custom verification)?
* **Q-08** Which e-mail provider sends today (WP Mail SMTP settings), and which sender domain?
* **Q-17** Should the two Rp 0 variations (CJC-1295 with DAC 10 MG; TB-500 variation without an MG value)
  be migrated as they are, hidden, or fixed? Today they may be purchasable for free.
