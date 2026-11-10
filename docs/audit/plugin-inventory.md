# Plugin and integration inventory — peptidesbali.online

Detected on 3 November 2026 from public evidence only: asset URLs under `/wp-content/plugins/`, REST API
namespaces at `/wp-json/`, HTML classes, cookies and third-party scripts. Versions and inactive plugins can't
be seen from outside. The **full plugin list must be confirmed in WP Admin → Plugins** (Q-24).

Server: **Cloudflare** in front (`cf-cache-status: HIT`), PHP 8.3, WordPress with a block-theme-capable core.

## Theme

| Item | Evidence | Migration approach |
|---|---|---|
| **Woodmart** (folder `woodmart-1-1`) | `themes/woodmart-1-1/…` CSS/JS, `wd-*` classes, CPTs `woodmart_layout`, `woodmart_woo_lv`, `woodmart_woo_fbt`, `wd_popup`, `wd_floating_block`, `cms_block` | Rebuilt in React/Tailwind. Woodmart's header builder, product layouts (#4118 single product, #9495 shop archive), swatches, quick view/shop, AJAX shop and search, sticky add-to-cart, cookie notice, side cart and mobile drawer all need equivalent components. |

## Plugins

| # | Plugin | Evidence | What it does here | In the new stack |
|---|---|---|---|---|
| 1 | **WooCommerce** | `wc/*` namespaces, assets | Shop, cart, checkout, orders, customers | Custom commerce module (Postgres + Next.js). See the feasibility report for the "custom vs platform" trade-off. |
| 2 | **Elementor** 4.3.5 | generator meta | Builds 70 of the 80 pages, header/footer templates, product and shop layouts | Rebuilt as React sections; content moves into Sanity page builder blocks |
| 3 | **PRO Elements** (`plugins/pro-elements`) | asset paths; `elementor-pro/v1` | A GPL **fork** of Elementor Pro: forms, popups (age gate #5870), theme builder, carousels, search | Not needed after migration. **Security note:** an unofficial fork of a commercial plugin; check where updates come from (R-10). |
| 4 | Unlimited Elements for Elementor | assets (Font Awesome 6, Owl Carousel, Fancybox) | Extra widgets | Rebuild the widgets that are actually used |
| 5 | Elementor One / Elementor AI / **Elementor MCP Composer** | REST `elementor-one/v1`, `elementor-ai/v1`, `elementor-mcp-composer/v1.0.19` | AI/MCP tools for editing the site | Not migrated. **Security note:** an MCP server is exposed on the production site (R-11). |
| 6 | **WordPress MCP / Abilities API** | REST `mcp`, `wp-abilities/v1` | Lets AI agents act on WordPress | Not migrated; review exposure (R-11) |
| 7 | **AffiliateWP** + **Affiliate Portal** | `affiliate-wp` assets; `affwp/v1`, `affwp/v2/portal` | Affiliate programme | Custom affiliate module (see the AffiliateWP audit) |
| 8 | **Yoast SEO** | sitemap XML, `yoast/v1`, `yoast_head_json` | Titles, meta, canonicals, schema graph, sitemaps, robots block | Next.js `generateMetadata`, `sitemap.ts`, `robots.ts`, JSON-LD components; Yoast fields imported into Sanity `seo` objects |
| 9 | **Redirection** | `redirection/v1` (private) | 301 rules + 404 log | Export rules → `next.config` redirects or a Postgres/Sanity redirect table + `src/proxy.ts` |
| 10 | **LiteSpeed Cache** | `litespeed/v1,v3`; `data-lazyloaded` images | Page cache, lazy load, image optimisation | Replaced by Vercel/Next.js caching + `next/image` |
| 11 | SiteGround Security | `sg-security/v1` | Login security / hardening | Replaced by Better Auth rate limits + Vercel firewall |
| 12 | Jetpack | `jetpack/v4` | Unknown modules (stats? CDN?) ❓ | Decide after admin review |
| 13 | **WP Mail SMTP** | `wp-mail-smtp/setup-wizard/v1` | Sends all e-mail through an SMTP/API provider ❓ | E-mail provider SDK (Resend, Postmark, SES…) after Q-08 |
| 14 | **GTranslate** | `plugins/gtranslate`, `.gtranslate_wrapper`, flags EN/ID | Client-side Google Translate (no `/id/` URLs) | Same embed, or a proper i18n route later (Q-09) |
| 15 | **Joinchat** (`creame-whatsapp-me`) | assets, `joinchat/v1/track-click` | Floating WhatsApp button + click tracking | Small React component; GA event for clicks |
| 16 | **Trustindex** | `trustindex/v1`, `cdn.trustindex.io/loader.js` | Google reviews widget | Same embed (widget ID from admin) |
| 17 | **Email Subscribers & Newsletters** (Icegram) | `[email-subscribers-form id="2"]` on `/subscribe/` | Newsletter list | Replace with the provider chosen for e-mail; export subscribers (with consent records) |
| 18 | **Atlas Emails** (custom) | `atlas-emails/v1/subscribe` | Custom subscribe endpoint, possibly custom transactional e-mails ❓ | Needs source code |
| 19 | **Atlas Research Planner** (custom, `atlas-research-planner`) | `atlas-planner/v1` (31 routes), `planner.css`, `tools-calculator.js` | **Protocol Builder** (catalogue, combinations, calculate, add-to-cart, saved plans, sharing, exports, consent) + **Reconstitution Calculator** + **usage tracker** (vials, entries, order sync, import/export) + admin product mappings | Rebuild as a Next.js feature module. **Needs the plugin source** to copy its exact arithmetic and rules (Q-15). |
| 20 | **PayRam** | `payram/v1` + `/payram/v1/webhook` | Crypto payments | Server adapter + webhook (needs PayRam API docs/keys) |
| 21 | **NOWPayments** | gateway id `nowpayments_gateway` | Crypto payments | Official NOWPayments API + IPN webhook |
| 22 | Sleeks Wise / Sleeks Revolut | gateway ids `sleeks_wise`, `sleeks_revolut` | Manual transfer instructions (probably) | "Offline" payment method with instructions + admin "mark paid" |
| 23 | **Atlas card gateway** (custom, probably on **Tagada**) | gateway id `atlas_card`; `tgd_*` cookies; `api.tagada.io/…/external-tracker.min.js`; inline `tgdgw_get_tracking_meta` script | Card / Apple Pay / Google Pay checkout | Depends on Tagada offering a headless API (Q-01) |
| 24 | **Atlas IDR account gateway** (custom) | gateway id `atlas_idr_account` | Indonesian bank / IDR transfer | Offline method with instructions |
| 25 | Cash on Delivery (core) | gateway id `cod` | COD | Offline method |
| 26 | **AdsAgent** | `adsagent/v1` (connect, cart/updateattributes) | Ad platform connector ❓ | Ask what it is for (Q-25) |
| 27 | WooCommerce POS (core feature) | `wc/pos/v1/catalog` | In-person point of sale ❓ | Only if used (Q-16) |
| 28 | WooCommerce push notifications / mobile app | `wc-push-notifications` | Order alerts on the WooCommerce mobile app | Replace with e-mail/Slack/WhatsApp order alerts (Q-26) |
| 29 | Microsoft Clarity | `clarity.ms/tag/…?ref=wordpress` | Session recordings | Same tag via GTM or `next/script` |
| 30 | Google Tag Manager / GA4 | `GTM-WXL8X6QM`, `G-51PJX01T9F` | Analytics, conversions | Same IDs; recreate the e-commerce dataLayer events |
| 31 | Tawk.to | `embed.tawk.to/6ab794d5…` | Live chat | Same embed |
| 32 | Cloudflare Web Analytics | `static.cloudflareinsights.com/beacon` | Analytics | Keep if DNS stays on Cloudflare |
| 33 | **Rewards / loyalty plugin** ❓ | `/rewards/` page, "Loyalty" strings, no REST namespace | Credits (1 per Rp 10,000), Rp 250,000 coupons, Rp 50,000 welcome reward, refer-a-friend | **Unknown plugin**, needs admin (Q-27). Probably custom or a coupon-based loyalty plugin. |
| 34 | Custom snippets ❓ | `atlas-usd-price`, `atlas-header-payments`, custom Store/Product/FAQ JSON-LD | USD hint, payment badge, schema | Needs source (Code Snippets plugin or theme `functions.php`?) |
| 35 | Rank Math (removed) | 37 products still contain `[rank_math_rich_snippet]` | — | Clean up with approval (Q-14) |

## Integrations summary

| Integration | Type | Keys/IDs needed for the new site |
|---|---|---|
| Tagada | Card payments | API key, webhook secret (from the owner; never in Git) |
| PayRam | Crypto | API key, webhook secret |
| NOWPayments | Crypto | API key, IPN secret |
| Wise / Revolut / IDR bank | Manual | Account instructions text |
| Google reCAPTCHA v3 | Anti-spam | Site key (public) + **new** secret stored in Vercel env |
| Google Tag Manager / GA4 / Clarity | Analytics | Container and tag IDs |
| Tawk.to / Trustindex / GTranslate | Widgets | Widget IDs |
| E-mail provider (TBD) | Transactional + newsletter | API key, verified domain |
| Janoshik | External COA verification links | none (links only) |
