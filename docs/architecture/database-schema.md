# Database schema

> **Status (6 Nov 2026):** §1 (accounts) and §2 (commerce) are written as Drizzle code and one migration,
> `src/db/migrations/0001_commerce_and_auth.sql`, not yet applied (waiting for Neon). Differences from the
> draft below, from the live settings (docs/audit/backend-settings.md): Better Auth's own tables and text IDs
> (`users`, `sessions`, `accounts`, `verifications`, a WordPress-style `username`); several coupons per cart
> (`carts.coupon_codes`), as WooCommerce allows unless a coupon is "individual use"; fee lines
> (`order_fees`, e.g. card +5%); delivery day / slot / map pin on `orders`; `order_number` continues after
> the highest WooCommerce number. Shipping zones stay in code for now (one zone). §3–§6 are still a draft:
> columns marked **❓** depend on settings not seen yet.

## 0. Rules every table follows

* **Money** is `bigint` in **minor units** plus a `currency char(3)` (today always `IDR`). `Rp 850,000.00` is
  stored as `85000000`, exactly like WooCommerce's Store API. Never `float`, never JavaScript `number` maths
  for money. One helper, `src/lib/money.ts`, does all arithmetic with `BigInt`.
* **IDs**: `uuid` primary keys, plus `legacy_*_id` columns (WooCommerce / WordPress / AffiliateWP IDs) where
  data is migrated. They are unique and indexed, so old links and reports still match.
* **Timestamps**: `created_at`, `updated_at` (`timestamptz`, UTC). The shop's display timezone is Asia/Makassar (WITA).
* **Ledgers are append-only.** Commissions, payouts and reward credits are never edited in place. A correction
  is a new row that points to the row it corrects.
* **Idempotency**: unique constraints stop the same event being recorded twice (see ★ below).

## 1. Authentication (Better Auth)

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, email (unique), email_verified, name, display_name, phone, `legacy_wp_user_id` (unique) | **Built (9 Nov 2026, migration 0007):** the WordPress hash lives in its own table, `legacy_passwords` (user_id → users, hash, imported_at), not on `users` (Better Auth generates that table). It is checked once at the first login (`src/lib/auth/legacy-password.ts`), replaced with a Better Auth password and deleted; "Lost your password?" deletes it too (Q-07) |
| `sessions` | id, user_id → users, expires_at, ip, user_agent | Better Auth |
| `accounts` | id, user_id, provider_id, password_hash | Better Auth credential storage |
| `verification_tokens` | identifier, token, expires_at | E-mail verification and password reset |
| `user_roles` | user_id, role (`customer`, `affiliate`, `shop_manager`, `admin`) | One user can be customer **and** affiliate. **Built so far (7 Nov 2026, migration 0004):** one WordPress-style role on the user, `user.role` (`customer` by default, `shop_manager`, `administrator`), which the admin order screens check; set with `scripts/dev/set-role.mjs`, never from a form. The same migration adds `user.temporary_password` (WooCommerce's `default_password_nag`) and `user.set_password_resent_at` (when "Resend" last sent a link). The affiliate role arrives with 6a, as this table or as the `affiliates` row itself. |
| `addresses` | id, user_id, type (`billing`/`shipping`), first/last name, company, address_1/2, city, state, postcode, country, phone, is_default | WooCommerce billing/shipping fields |

## 2. Commerce

| Table | Key columns | Notes |
|---|---|---|
| `product_records` | id, `sanity_id` (unique), `legacy_wc_product_id` (unique), slug (unique), `old_slugs` (text[], migration 0011), type (`simple`/`variable`), status, tax_status | One per Sanity product. No content here. `old_slugs`: the addresses it had before its slug was changed in /admin/products/ (WordPress's `_wp_old_slug`); /product/&lt;old&gt;/ answers 301 to the current one (src/proxy.ts). |
| `product_variants` | id, product_id → product_records, `legacy_wc_variation_id` (unique), variant_key (e.g. `pen-type=disposable-pen;mg=5`), sku (nullable: today none exist), price_minor, regular_price_minor, sale_price_minor, sale_from/to, status, sort_order | A simple product has exactly one variant |
| `inventory` | variant_id (PK), manage_stock, stock_quantity, stock_status (`instock`/`outofstock`/`onbackorder`), backorders (`no`/`notify`/`yes`) | Mirrors WooCommerce (Q-04) |
| `inventory_movements` | id, variant_id, delta, reason (`order`, `refund`, `manual`, `migration`), order_id, actor_user_id | Append-only |
| `carts` | id, user_id (nullable), token (unique, cookie), coupon_code, referral_snapshot, expires_at | Guest and logged-in carts |
| `cart_items` | id, cart_id, variant_id, quantity (1–9999) | No price stored: always re-read |
| `orders` | id, `legacy_wc_order_id` (unique), order_number, user_id, status, currency, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor, billing_* / shipping_* snapshot (jsonb), customer_note, payment_method, shipping_method, attribution (jsonb: UTM/source from WC order attribution), created_via, paid_at, completed_at | Status list after Q-06 |
| `order_items` | id, order_id, variant_id, product_name_snapshot, variant_label_snapshot, quantity, unit_price_minor, line_subtotal_minor, line_discount_minor, line_total_minor | Snapshots keep history stable |
| `order_notes` | id, order_id, author_user_id, is_customer_note, body, `legacy_wc_note_id` (unique, migration 0005) | WooCommerce order notes; the legacy ID lets the import run again without doubling them |
| `payments` | id, order_id, provider (`tagada`, `payram`, `nowpayments`, `wise`, `revolut`, `idr_transfer`, `cod`), provider_payment_id, status, amount_minor, currency, raw (jsonb), **★ unique(provider, provider_payment_id)** | |
| `payment_events` | id, provider, **★ provider_event_id unique**, payment_id, type, payload (jsonb), received_at, processed_at | Webhook idempotency |
| `refunds` | id, order_id, payment_id, amount_minor, reason, actor_user_id, provider_refund_id | Triggers commission/reward reversals |
| `shipments` | id, order_id, method, carrier, tracking_number, shipped_at, delivered_at | |
| `shipping_zones` / `shipping_methods` | zone (countries/states), method (`flat_rate`, `free_shipping`), cost_minor, min_amount_minor, requires (`min_amount` / `coupon` / `either`) | Values from WooCommerce (Q-03) |
| `coupons` | id, `legacy_wc_coupon_id`, code (unique, case-insensitive), type (`percent`, `fixed_cart`, `fixed_product`), amount, minimum_spend_minor, maximum_spend_minor, usage_limit, usage_limit_per_user, individual_use, exclude_sale_items, product/category include/exclude (jsonb), expires_at, free_shipping, **affiliate_id** (nullable), **source** (`manual`, `affiliate`, `rewards_redemption`, `rewards_welcome`, `rewards_referral`) | One-coupon-per-order rule enforced in checkout **Since migration 0005:** `usage_count` and `used_by` (WooCommerce's own counters, imported as they are) and a foreign key from `affiliate_id` to `affiliates`. |
| `coupon_redemptions` | id, coupon_id, order_id, user_id, email, amount_minor, **★ unique(coupon_id, order_id)** | |

**Migration 0006 (7 Nov 2026):** `orders.coupon_usage_recorded` (WooCommerce's `_recorded_coupon_usage_counts`): whether the order's coupons are counted in `coupons.usage_count` / `used_by`; set for every order that isn't cancelled, failed or a draft, and kept in step by `src/lib/commerce/coupon-store.ts` when the status changes.

## 3. Affiliate (replaces AffiliateWP)

**Built (7 Nov 2026, migration 0005, `src/db/schema/affiliate.ts`):** `affiliates` (user_id may be empty: live has an affiliate whose WordPress user was deleted; `legacy_totals` keeps AffiliateWP's counters), `affiliate_settings` (+ `source`), `affiliate_customers` (AffiliateWP's customers, IP hashed), `affiliate_visits`, `affiliate_referrals` (`reference` keeps AffiliateWP's own reference when the order is gone), `affiliate_commissions`, `affiliate_payouts`, `affiliate_payout_items`. Not built yet, no data needs them: `affiliate_links`, `affiliate_attributions`, `affiliate_tiers` (no tiers on live), `affiliate_audit_logs` (with the admin screens). Filled by `scripts/import/import-wordpress.mjs`.

| Table | Key columns | Notes |
|---|---|---|
| `affiliates` | id, user_id (unique), `legacy_affwp_affiliate_id` (unique), username_slug (unique, used in `/ref/<x>/`), status (`active`/`pending`/`rejected`/`inactive`), rate, rate_type (`percentage`/`flat`) nullable = use default, payment_email, website_url, promotion_method, date_registered, approved_by, approved_at | The legacy numeric ID also works in `?ref=8` if AffiliateWP allowed it |
| `affiliate_settings` | key (PK), value (jsonb), updated_by | Cookie days, credit mode (first/last), default rate, rate type, exclude shipping/tax, refund behaviour, minimum payout, self-referral rule… all copied from AffiliateWP (❓ until exported) |
| `affiliate_links` | id, affiliate_id, slug/campaign, target_path | Only if creatives/custom links are used ❓ |
| `affiliate_visits` | id, `legacy_affwp_visit_id`, affiliate_id, url, referrer, campaign, ip_hash, user_agent_hash, landed_at, referral_id (nullable) | IPs are stored hashed (privacy) |
| `affiliate_attributions` | id, cart_id / order_id, affiliate_id, visit_id, source (`cookie`, `coupon`), decided_at, rule_version | Records *why* an order was credited |
| `affiliate_referrals` | id, `legacy_affwp_referral_id`, affiliate_id, order_id, visit_id, customer_id, amount_minor, currency, status (`pending`/`unpaid`/`paid`/`rejected`), description, campaign, **★ unique(order_id, affiliate_id)** | One referral per order |
| `affiliate_commissions` | id, referral_id, entry_type (`earn`, `reversal`, `adjustment`), amount_minor, reason, actor_user_id, created_at | **Ledger**: balance = sum of entries |
| `affiliate_tiers` | id, name, rate, min_sales_minor, window_days (e.g. 30), basis (`net_sales`/`gross_sales`) | Only if tiers are live (Q-18) |
| `affiliate_payouts` | id, `legacy_affwp_payout_id`, affiliate_id, amount_minor, method, status (`processing`/`paid`/`failed`), paid_at, reference, owner_user_id, note | Marked paid only by an admin Server Action |
| `affiliate_payout_items` | payout_id, referral_id, **★ unique(referral_id)** | A referral can only be paid once |
| `affiliate_audit_logs` | id, actor_user_id, action, target_type, target_id, before (jsonb), after (jsonb), ip_hash, created_at | Every approval, rate change, payout and correction |

## 4. Rewards / loyalty (advertised on `/rewards/`, terms on `/rewards-terms/`)

**Built (12–13 Nov 2026, migration 0010, `src/db/schema/loyalty.ts`; rules in `src/lib/loyalty/rules.ts`, database
code in `src/lib/loyalty/store.ts`; how it works and what the owner should confirm: [rewards.md](../setup/rewards.md)).**
RewardsWP's data came from the owner's database dump (`scripts/import/import-rewardswp.mjs`).

| Table | Key columns | Notes |
|---|---|---|
| `loyalty_members` | user_id (PK → users), referral_code (unique, case-insensitive), joined_at, `legacy_rewardswp_member_id` (unique) | One per account. Imported members keep RewardsWP's code, so links already shared (`/share/<code>/`) still work |
| `loyalty_transactions` | id, user_id, type (`earn`, `redeem`, `reverse`, `restore`, `adjust`, `migration`), credits (signed int), source (`welcome`, `order`, `redemption`, `import`, `admin`), order_id, coupon_code, reason, created_at | **Ledger, append-only: the balance is the sum of `credits`.** An order's credits are kept in step by `syncOrderCredits` (issued when the order is completed, taken back when cancelled / refunded, recalculated after a partial refund: it writes only the difference). **★ unique(user_id) where source = 'welcome'**: the welcome credits are given once |
| `loyalty_referrals` | id, referrer_user_id, referred_user_id, referred_email, status (`pending`, `rewarded`, `reversed`, `rejected`), friend_coupon_code, reward_coupon_code, referred_order_id, note, `legacy_rewardswp_referral_id`, converted_at | One row per friend. **★ unique(referred_user_id)** (one claim per person), **unique(friend_coupon_code)** |

Money-off rewards are not a table of their own: redeemed credits, the friend's coupon and the member's reward are
ordinary rows of `coupons` (`source` = `rewards_redemption` / `rewards_referral`; fixed cart amount, used once,
restricted to the owner's e-mail address, "individual use" so never combined with another coupon).

## 5. Protocol Builder / Tracker (from the custom plugin: after Q-15)

`planner_product_mappings` (product → format, capacity, pack count, display group/order), `planner_plans`
(user_id, uuid, name, lines jsonb, consent_at), `planner_plan_shares`, `planner_exports`, `tracker_vials`,
`tracker_entries`. Exact columns are copied from the plugin's tables once the source is available.

## 6. Other

| Table | Purpose |
|---|---|
| `admin_audit_logs` | Every admin action outside the affiliate module (price change, order status change, manual payment mark) |
| `legacy_id_mappings` | (entity_type, legacy_id, new_id): one place to look up any old ID |
| `legacy_passwords` | (user_id, hash, imported_at): imported customers' WordPress password hashes until their first login (migration 0007; `scripts/import/import-wordpress-passwords.mjs`, `--forget-all` deletes the rest) |
| `migration_logs` | run_id, step, source_count, imported_count, skipped, errors (jsonb), started/finished_at |
| `redirects` | from_path (unique), to_path, status_code, source (`redirection-plugin`, `manual`): from the Redirection export |
| `newsletter_subscribers` | email, status, consent_source, consent_at, `legacy_icegram_id` |

## 7. How this maps from WordPress (summary)

| WordPress / plugin source | → New table |
|---|---|
| `wp_users` + `wp_usermeta` (billing/shipping) | `users`, `addresses`, `user_roles` |
| `wp_posts` (product, product_variation) + `wp_postmeta` (_price, _regular_price, _sale_price, _stock, _stock_status, _backorders, _manage_stock) | `product_records`, `product_variants`, `inventory` (content goes to Sanity) |
| `wp_wc_orders`, `wp_wc_orders_meta`, `wp_wc_order_addresses`, `wp_woocommerce_order_items`, `…_itemmeta` (or legacy `shop_order` posts) | `orders`, `order_items`, `order_notes` (from `wp_comments` type `order_note`), `payments` (from gateway meta), `refunds` (`shop_order_refund`) |
| `shop_coupon` posts + meta | `coupons` (+ `affiliate_id` from `affwp_discount_affiliate`) |
| `affiliate_wp_affiliates` / `_affiliatemeta` | `affiliates`, `affiliate_settings` (per affiliate overrides) |
| `affiliate_wp_referrals` / `_referralmeta` | `affiliate_referrals` + one `earn` row (and `reversal` rows for rejected) in `affiliate_commissions` |
| `affiliate_wp_visits` | `affiliate_visits` |
| `affiliate_wp_payouts` | `affiliate_payouts` + `affiliate_payout_items` (from the payout's `referrals` list) |
| `affiliate_wp_customers`, `affiliate_wp_sales` | used for reconciliation and attribution history |
| rewards plugin tables ❓ | `loyalty_*` |
| Atlas Research Planner tables ❓ | `planner_*`, `tracker_*` |
| Redirection `wp_redirection_items` | `redirects` |
| Icegram `wp_ig_contacts` / lists | `newsletter_subscribers` |

## 8. Drizzle commands (once the project is scaffolded)

```bash
npx drizzle-kit generate   # create SQL migration files from src/db/schema/*.ts
npx drizzle-kit migrate    # apply them to the database (DATABASE_URL_UNPOOLED, else DATABASE_URL)
npx drizzle-kit studio     # browse the data locally
```

Before Neon (and on any computer for trying things): with `DATABASE_URL` empty the same migrations run on a
local Postgres in `.data/pglite` (PGlite: Postgres compiled to WebAssembly, inside the Node.js process;
`src/db/index.ts` keeps one instance per process; never used in production). Migration 0002 (7 Nov 2026)
adds `users.first_name` and `users.last_name` (My Account → Account details).

Database host: **Neon** (owner's choice, 6 Nov 2026), region Singapore, closest to Bali. Branch `dev` for
local development, `main` for the live site later. The site connects with the pooled string (`DATABASE_URL`,
`prepare: false` in `src/db/index.ts`); migrations use the direct one (`DATABASE_URL_UNPOOLED`).
