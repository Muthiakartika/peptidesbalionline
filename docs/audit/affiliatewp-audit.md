# AffiliateWP audit — peptidesbali.online

**Phase 1, 3 November 2026.** This combines (a) the settings confirmed from the owner's AffiliateWP admin
screenshots (PRD §4.1) and (b) what the public site shows. The AffiliateWP REST API (`/wp-json/affwp/v1/…`)
and the Affiliate Portal API (`/wp-json/affwp/v2/portal/…`) both answered **401 Unauthorized**, so no affiliate
data or saved settings could be read. **No referral URL was visited**: visiting a real affiliate's link would
record a fake visit in the production database.

> Rule from the PRD: the **saved AffiliateWP settings** are the source of truth for business logic, not the
> marketing page. Section 4 shows why: the marketing copy contradicts itself.

---

## 1. Installed components (evidence)

| Component | Evidence | Meaning for the migration |
|---|---|---|
| AffiliateWP core | `plugins/affiliate-wp/assets/js/tracking.min.js` on every page; `affwp/v1` REST namespace | Affiliates, referrals, visits, payouts, creatives, **customers**, **sales**, **campaigns** endpoints exist (AffiliateWP 2.x data model) |
| **Affiliate Portal add-on** | REST namespace `affwp/v2/portal` (reports, datasets, views, sections, controls, routes, settings) | The Affiliate Area is probably the Portal's app, not the classic tabbed area. Its screens (dashboard, referrals, payouts, visits, URLs/creatives, settings) must be screenshotted while logged in as a test affiliate. |
| Front-end notifications | `affiliatewp-frontend-notifications.min.js` | Admin/affiliate notification bar. Low priority. |
| Forms CSS | `plugins/affiliate-wp/assets/css/forms.min.css` | Login and registration forms use AffiliateWP markup |
| reCAPTCHA v3 | `data-sitekey` + `data-action="affiliate_login_8871"` / `affiliate_register_…` on both forms | Confirms PRD §4.1. The **site key is public** (normal). The secret key must never be copied. |
| WooCommerce integration | WooCommerce active and referral → order linking expected | Settings ❓ |
| Coupon tracking | Marketing copy: "your own referral link **and promotional code**" | AffiliateWP WooCommerce coupon tracking is probably in use ❓ |

## 2. Confirmed settings (from the PRD's admin screenshots)

| Setting | Value |
|---|---|
| Registration | Enabled, **admin approval required**, dedicated login and registration pages, Terms of Use page configured, automatic registration modes off |
| Starting affiliate ID | 8 (doesn't tell how many affiliates exist) |
| Referral variable | `ref` |
| Default referral format | **username** |
| Pretty affiliate URLs | **Enabled**, so `/ref/<username>/` works alongside `?ref=<username>` |
| reCAPTCHA v3 | On registration **and** login |
| Sharing | Facebook ✅, Email ✅, QR code ✅; LinkedIn ❌, X/Twitter ❌ |
| Logout link | Enabled |
| Affiliate landing pages | Disabled |
| Global direct link tracking | Disabled (per-affiliate settings or add-ons still ❓) |

## 3. Public pages and forms

| URL | Content |
|---|---|
| `/affiliate-program/` | Elementor marketing page with its **own Elementor application form** (name, email, about 20 custom questions, checkboxes, message). It is **separate from** the AffiliateWP registration form. Where its submissions go is ❓ (Q-12). |
| `/affiliate-registration/` | AffiliateWP form. Fields: **Your Name** (required), **Username** (required, max 60), **Account Email** (required), **Payment Email**, **Website URL** (required), **How will you promote us?**, **Password** + **Confirm Password**, **Terms** checkbox (links to `/affiliate-terms-of-use/`), hidden honeypot, reCAPTCHA v3. After submit it redirects to `/affiliate-login/`. |
| `/affiliate-login/` | AffiliateWP login: Username, Password, Remember Me, reCAPTCHA v3, "Lost password" link (`?affwp_lost…`). |
| `/affiliate-area/` | noindex. Logged-out visitors see: *"You're unauthorized to view this page. Please log in and try again."* with a link to the login page. |
| `/affiliate-terms-of-use/` | Terms text (see §4) |
| Footer | "Affiliates", "Affiliate Login", "Affiliate Registration" links |

## 4. What the public copy claims, and why it can't be trusted for business rules

| Topic | Marketing page `/affiliate-program/` | Terms `/affiliate-terms-of-use/` | Conflict |
|---|---|---|---|
| Base commission | "10% Partner Commission", "Earn 10% commission on qualifying sales" | — | The FAQ on the same page says **"Approved Atlas Partners start at 15% commission"** |
| Tiers | 10% → **15%** with "*Suggested* requirement 15,000,000 IDR qualifying referred sales within a rolling 30-day period" → **20%** at 30,000,000 IDR / rolling 30 days | — | The word "Suggested" reads like a draft. Tiers need the "Tiered Affiliate Rates" add-on or custom code. ❓ |
| Customer discount | "10% off their first qualifying order" | — | Implies an affiliate coupon ❓ |
| Payouts | "Monthly payouts", "once the minimum payout threshold has been reached", "Recommended minimum payout" (no figure shown) | "Commissions will be paid once a month" | Threshold value ❓ |
| Refunds / cancellations | "Cancelled, fraudulent, chargeback or refunded transactions do not qualify… may be reversed before payment" | "…chargebacks or refunds will not be paid out" | Consistent |
| Self-referral | "Self-referrals do not qualify unless specifically authorised" | "You cannot refer yourself" | Consistent, but per-affiliate exceptions ❓ |
| Holding period | — | "the referred account must remain active for a minimum of **31 days**" | Looks like template text from a membership site ❓ |
| Paid ads | "Only with prior written approval" | Coupon/deal-site and cookie-stuffing rules | Policy only |
| Dashboard preview | Shows example numbers ("2.96%", "Rp 42,750,000", "Rp 6,412,500") | — | Illustration only; must not be treated as data |

**Interaction with the Rewards programme** (`/rewards-terms/` §6): *"An order cannot generate both a customer
referral acquisition reward and an affiliate acquisition commission."* So the new system needs one rule that
decides, for each order, whether the AffiliateWP-style affiliate or the rewards "refer a friend" link gets credit.
How this is enforced today is ❓ (Q-21).

## 5. Tracking behaviour (from the code on the page)

* `tracking.min.js` loads on every page. On full-page-cached sites (Cloudflare `cf-cache-status: HIT`, LiteSpeed)
  AffiliateWP tracks **in JavaScript**: it reads `?ref=` or `/ref/…`, calls `admin-ajax.php` to validate the
  affiliate and log the visit, and sets the `affwp_ref`, `affwp_ref_visit_id` and (if used) `affwp_campaign` cookies.
* The cookie lifetime (AffiliateWP "Referral cookie expiration", default 1 day), the credit mode (first or last
  referrer) and IP/visit settings are **not visible publicly** ❓.
* **Caching bug spotted:** the cached HTML of the affiliate login and registration pages contains a fixed
  `g-recaptcha-remoteip` value (a previous visitor's IP address) and fixed nonces. This is a small privacy leak,
  and it can make logins fail when the cached nonce has expired. The rebuild must render these per request.
  Don't copy this behaviour (risk R-09).

## 6. The 20 behaviours the PRD asks about

| # | Behaviour | Status | Where it will come from |
|---|---|---|---|
| 1 | Referral tracking | 🟡 JS tracking, `ref` variable, username format, pretty URLs | Settings → General / Advanced |
| 2 | Cookie duration | ❓ | Settings → General → "Cookie Expiration" |
| 3 | Attribution (first/last) | ❓ | Settings → General → "Credit Last Referrer" |
| 4 | Commission % | ❓ (copy says 10% **and** 15%) | Settings → Commissions → Referral Rate + rate type |
| 5 | Flat vs percentage | ❓ | Rate type |
| 6 | Per-product overrides | ❓ | Product edit screen → AffiliateWP tab (`_affwp_woocommerce_product_rate` meta) |
| 7 | Affiliate-specific rates | ❓ | Each affiliate's profile (`rate`, `rate_type` in `affiliate_wp_affiliates`) |
| 8 | Tiers | ❓ | Tiered Rates add-on settings, or none |
| 9 | Commission approval | ❓ | "Referral status" when an order completes |
| 10 | Referral rejection | ❓ | Integration setting: reject on refund/cancel |
| 11 | Refund handling | 🟡 "reversed before payment" | Integration → "Reject Unpaid Referrals on Refund" |
| 12 | Coupon attribution | 🟡 promo codes exist | WooCommerce coupons with an affiliate assigned + "Affiliate coupons" settings |
| 13 | Payout processing | 🟡 monthly, manual? | Payouts tab; Payouts Service add-on? |
| 14 | Manual vs automated payouts | ❓ | Payout methods |
| 15 | Notifications | ❓ | Emails tab (registration, approval, new referral…) |
| 16 | Anti-fraud | ❓ (reCAPTCHA v3 confirmed) | Anti-Fraud / Misc tab |
| 17 | Profile management | ❓ | Portal → Settings section (payment email, etc.) |
| 18 | Earnings reports | ❓ | Portal reports/datasets |
| 19 | Visit tracking | 🟡 enabled by default | Settings |
| 20 | Campaign tracking | 🟡 the `campaigns` endpoint exists | `?campaign=` usage ❓ |

## 7. Data that must be migrated (and reconciled)

AffiliateWP stores its data in custom tables (with the WordPress prefix): `affiliate_wp_affiliates`,
`affiliate_wp_affiliatemeta`, `affiliate_wp_referrals`, `affiliate_wp_referralmeta`, `affiliate_wp_visits`,
`affiliate_wp_payouts`, `affiliate_wp_creatives`, `affiliate_wp_customers`, `affiliate_wp_customermeta`,
`affiliate_wp_sales`, `affiliate_wp_campaigns` (a view), `affiliate_wp_coupons` (if dynamic coupons are used),
`affiliate_wp_notifications`, plus WordPress `usermeta` and WooCommerce coupon meta (`affwp_discount_affiliate`).

The mapping draft is in [`../architecture/database-schema.md`](../architecture/database-schema.md) §3 (tables) and §7 (old → new).
**Before launch, these totals must match exactly** between the old and new systems:

* affiliates by status (active / pending / rejected / inactive)
* referrals by status (unpaid / paid / pending / rejected) with their amount sums
* total earnings, unpaid earnings, paid earnings (per affiliate and overall)
* payouts: count and amount sum, per affiliate
* visits count per affiliate, and visits converted
* coupons assigned to each affiliate

## 8. Backend access needed (read-only)

1. Screenshots or an export of **every AffiliateWP settings tab**: General, Commissions, Payouts, Integrations
   (WooCommerce), Emails, Anti-Fraud/Misc, Advanced, Coupons, Affiliate Area Tabs, **Affiliate Portal**, Add-ons.
2. A **read-only AffiliateWP REST API key** (Affiliates → Tools → API Keys), or a database export of the tables above.
3. One **test affiliate account** on a staging copy, to screenshot every Portal screen.
4. Confirmation of which add-ons are active (Tiered Rates? Recurring? Store Credit? Payouts Service? Lifetime Commissions?).

## 9. Open questions (affiliates)

* **Q-18** Which commission is correct today: 10% or 15%? Are the 15%/20% rolling-30-day tiers live, and if so,
  are they calculated on referred **gross** sales, **net of discounts**, including or excluding shipping?
* **Q-19** What are the cookie duration and credit mode (first vs last referrer)?
* **Q-20** Are payouts made manually (Wise/bank) and marked paid by hand, or through the Payouts Service?
  What is the minimum payout?
* **Q-21** How is the "affiliate vs rewards refer-a-friend, never both" rule enforced today, and which wins when both apply?
* **Q-22** Does the Elementor partner application form on `/affiliate-program/` create AffiliateWP affiliates,
  or is it only an e-mail to the team? Should both forms continue to exist?
* **Q-23** Are any affiliates allowed self-referrals or custom rates?
