# Data inventory: everything on the live site, and where it is now

Checked against https://peptidesbali.online on **7 Nov 2026** (counts only, read-only; personal data never in
this file). "Here" is this project: the content snapshots in `src/content/`, the local database
(`.data/pglite`, the same tables Neon gets), or the reference files in `docs/audit/data/`.

| Data on live | Live | Here | Where | How it gets there |
|---|---:|---:|---|---|
| Products | 182 | 182 | `src/content/catalog.json` | `python scripts/audit/export_shop_snapshot.py` (public Store API + shop pages) |
| Variations | 319 | 319 | same | same |
| Product pages (descriptions, tabs, FAQs, SEO) | 182 | 182 | `src/content/product-pages.json` | `python scripts/audit/export_product_pages.py` |
| Stock status (in / out of stock) | 182 + 319 | same | `catalog.json` (`inStock`) | with the catalogue |
| Items on backorder ("Available on backorder") | 28 | 28 | `src/content/stock-status.json` | `python scripts/audit/export_stock_status.py` |
| Product categories | 25 | 25 | `catalog.json` | with the catalogue |
| Pages | 80 | 80 | 75 in `src/content/pages/` + 5 with their own routes (shop, cart, checkout, my-account, protocol-builder) | `export_elementor_pages.py` |
| Blog posts | 54 | 54 | `src/content/blog/` | `export_blog.py` |
| Redirects (Redirection) | 196 | 196 | `src/content/seo/redirects.json` | read in wp-admin, 6 Nov 2026 |
| Yoast SEO + JSON-LD | every page | every page | `src/content/seo/` | `export_jsonld.py`, `export_sitemaps.py` |
| Images under `/wp-content/uploads/` | 3,211 referenced (507 MB); 3,216 with the Sanity content (9 Nov 2026) | still served by live | target: Cloudflare R2, same paths (`scripts/media/copy-uploads-to-r2.mjs`, `docs/setup/r2.md`); new uploads from the Studio go straight to R2 | **moved 9 Nov 2026**: 3,215 files (533 MB) in R2 bucket `peptides-bali-storage`, all answering on its public address; the site shows them from there (`NEXT_PUBLIC_MEDIA_BASE_URL`). Missing: the one file already 404 on live (`/tirzepatide-bali/`). Before launch: a custom domain instead of r2.dev |
| WordPress accounts | 45 (7 Nov) → **69** (12 Nov dump) | 69 | `users` + `addresses` (42) | `scripts/import/` (see below). **13 Nov 2026:** the owner's database dump (`import-wordpress.mjs <dump.sql.gz>`) brought the 24 accounts made 7–12 Nov |
| Orders (not in the trash) | 253 (7 Nov) → **284** | 284 | `orders`, `order_items` (634), `order_fees` (164), `coupon_redemptions` (92), `order_notes` (1,629), `payments` (27) | same; 272 completed, 9 cancelled, 1 processing, 2 on-hold. The 31 new orders are from 7–12 Nov (Rp 106,955,572). 71 orders in the trash stay out on purpose |
| Coupons | 10 (7 Nov) → **13** | 13 | `coupons` (with usage counters) | same; usable at checkout. New: `welcome20`, `20atl`, `tom10` |
| AffiliateWP: affiliates / referrals / visits / customers | 1 / 1 / 1 / 1 (the 7 Nov API view was incomplete) → **7 / 8 / 368 / 7** | same | `affiliates` (6 active, 1 pending), `affiliate_referrals` (+ ledger: 4 unpaid = Rp 3,594,000, 3 rejected, 1 pending), `affiliate_visits`, `affiliate_customers` | same |
| AffiliateWP: payouts / creatives / campaigns | 0 / 0 / 0 | — | — | nothing to import |
| AffiliateWP settings | 27 values | 27 | `affiliate_settings` | read in wp-admin, 6 Nov 2026 |
| Atlas Research Planner: product mappings / store protocols / settings | 424 / 147 / 79 fields | same | `docs/audit/data/planner/planner-export.json` | read in wp-admin (admin REST), 7 Nov 2026; for the Protocol Builder (6c) |
| Atlas Research Planner: customers' saved protocols, share links | 0 / 0 | — | — | nothing to import |
| Atlas Research Tools: document access grants | 0 | — | — | nothing to import |
| Atlas Email Automations: contacts | 45 | (in the orders) | — | all 45 come from checkout / an order, with marketing "none" and no consent recorded: the same buyers and e-mails as the orders. Rebuild the list from the orders when the e-mail flows are rebuilt (Q-08) |
| Product reviews | 0 | — | — | nothing to import |
| Blog comments | 17, all held for moderation | — | — | none is public; the owner can review them in wp-admin |
| Orders in the trash | 74 | — | — | left out on purpose (not shown anywhere on live) |

**Not available without a database export** (no API gives them; the owner's dump of 12 Nov 2026 has them):
- WordPress password hashes: the site accepts the old passwords (Q-07, built 9 Nov 2026). **Imported 12–13 Nov 2026
  for all 69 accounts** (`import-wordpress-passwords.mjs`, all `$wp$2y$`); each customer's first login with the old
  password converts it;
- RewardsWP Pro's data: the plugin is switched off, but its tables are in the owner's database dump: 4 members,
  5 point records, 1 referral, 1 issued coupon. Imported 13 Nov 2026 by `scripts/import/import-rewardswp.mjs`
  (docs/setup/rewards.md);
- Atlas Research Tools' per-customer vial inventory and log. **In the dump but not imported (13 Nov 2026):**
  4 vials and 2 access grants (the admin REST view showed 0); the planner's other tables (`arp_audit` 1,928 rows,
  `arp_kb_links` 318) were not looked at;
- Also in the dump, left for the e-mail flows (Q-08) or not needed: 363 Elementor form submissions (170 "New Form",
  193 "Subscriber"), Icegram 11 contacts, Atlas Email Automation 67 subscribers (+ 164 enrollments), AEM 72 contacts and
  101 abandoned carts, 10 Trustindex Google reviews (a widget), 1 wishlist, 7 webhooks, and the logs (Action Scheduler,
  security, SEO analytics).

**What changed on live since the earlier exports (found 7 Nov 2026, now in the snapshots):** 6 GLP-3 RTA Pen
variations back in stock; new pictures on 3 products (and their search thumbnails) and 2 variations; another
main category in the breadcrumbs of 4 products; the short description of both bacteriostatic waters now in
bold; one order (#12780). WooCommerce shuffles the "related products" on every page load, so the product-page
export keeps the previous draw (`export_product_pages.py`) and a new export shows only real edits.

**Checks run with this data (7 Nov 2026):** every reconciliation line "ok" (253 orders, totals per status to the
rupiah); URL parity 356 of 357 (`/protocol-builder/`, 6c); the visual comparison of every template at 5 widths
241 passing, the rest being `/protocol-builder/` (6c) and the homepage at 768px (a capture artifact of pages
taller than 16,000px); the side cart's drawer area 1.30% / 1.47% (1440 / 1280; only live's floating
WhatsApp button differs); 176 unit tests. The local database also holds the test accounts and orders made
while testing (3 accounts, 5 orders: their WordPress ID is empty); Neon only gets the import.

**At launch:** live keeps changing until the switch. Run the export and the import once more just before
(the import updates by WordPress ID, so it is safe to repeat), refresh the three catalogue exports, then compare
again with `scripts/import/import-wordpress.mjs --report` (every line must say "ok").
