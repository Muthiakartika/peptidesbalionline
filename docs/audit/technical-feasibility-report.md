# Technical feasibility report

**Phase 1 result, 3 November 2026.** Plain-language summary for the owner and the developer.

## 1. Short answer

**A faithful Next.js + Sanity + PostgreSQL rebuild is technically feasible.** Nothing on the public site needs
WordPress-only technology. But three things decide whether it can **launch**, and none of them can be solved
with code alone:

1. **Payments.** The store sells research peptides, HGH, HCG and testosterone. Most card processors and some
   hosting providers restrict these product types. The current card gateway (custom, probably on Tagada) and
   the two crypto gateways (PayRam, NOWPayments) must confirm they support a headless / API integration
   **and** this catalogue. Until they do, checkout can only be built against sandboxes. (R-01, R-16)
2. **Backend data and source code.** The affiliate programme, the rewards programme, the Protocol Builder /
   tracker and the custom gateways hold business rules and money-related records that are invisible from the
   public site. We need read-only exports and the custom plugin source code. (R-02, R-03)
3. **Owner decisions** on about 25 open questions. The most important ones are commission rules, the
   free-shipping rule, password migration, translations, and whether to keep known bugs. All questions are
   listed in the [implementation plan](../migration/implementation-plan.md#open-questions).

## 2. Size of the job

| Area | Size | Difficulty |
|---|---|---|
| Public URLs to reproduce | 340 indexable (+ system pages) | Medium: many share families |
| Unique templates | 26 (see the page inventory) | Medium |
| Elementor pages | 70 (of 80), in about 20 layout families | **High**: Elementor layouts have to be rebuilt as React sections and their content moved into Sanity blocks |
| Products / variations | 182 / 319, no SKUs | Low–medium (heavy HTML descriptions) |
| Blog posts | 54, block/classic HTML | Low: converts cleanly to Portable Text |
| Media | 1,042 library items, 841 referenced images, 5 COA PDFs | Medium: keep the old `/wp-content/uploads/…` URLs working |
| Payment gateways | 7 (3 online, 4 offline) | **High / blocked** by provider approval |
| Affiliate system | AffiliateWP + Portal, unknown add-ons | **High**: financial data, reconciliation |
| Rewards / loyalty | credits, welcome, refer-a-friend, coupons | **High**: plugin unknown |
| Protocol Builder + Calculator + Tracker | custom plugin, 31 REST routes | **High**: needs source code |
| Integrations | GTM/GA4, Clarity, Tawk.to, Trustindex, GTranslate, Joinchat, reCAPTCHA | Low |

## 3. Feasibility by area

### 3.1 Frontend replication: feasible

* Woodmart and Elementor produce plain HTML/CSS, so every measurement can be read from the live site.
  The design tokens are already in `visual-reference/design-tokens.json`.
* All fonts are Google Fonts (Urbanist, Anton, Inter, Jost, Cormorant Garamond, Poppins), so they can be loaded with `next/font`.
* Images and PDFs can be downloaded from `/wp-content/uploads/` and moved to Sanity's asset CDN.
* Hard parts: the homepage (25 sections), the scroll animations, and the many landing pages. Plan: build a
  **section library** (hero, USP row, review strip, product carousel, FAQ, CTA band…) that the landing
  families reuse, with content in Sanity.
* Visual regression: Playwright screenshots compared against `visual-reference/screenshots/` at 5 widths.

### 3.2 CMS (Sanity): feasible

* Blog posts, legal pages and categories map directly to Sanity documents.
* Elementor pages become a Sanity **page builder** (an array of section blocks). Each block type is one React component.
* Product descriptions are long, hand-built HTML (tables, inline SVG, `<details>` FAQs). Two options:
  * **A (recommended to start):** store them as a sanitised **"legacy HTML" block** in Sanity, rendered as is.
    It's pixel-faithful on day one and editors can still replace it.
  * **B:** convert each to Portable Text plus custom blocks (tables, FAQ). It's cleaner, but needs manual
    review of 182 products. This can be done gradually after launch.

### 3.3 Commerce backend: feasible, with one decision to make

The commerce needs are modest: simple and variable products, IDR only, no tax, flat or free shipping inside
Indonesia, coupons, 7 payment methods (4 of them "offline" with instructions), no subscriptions.

| Option | Pros | Cons |
|---|---|---|
| **A. Custom module in Next.js + Postgres (Drizzle)** (the PRD default) | One codebase, runs on Vercel, the data model fits this store exactly, full control of affiliate/rewards logic | More code to write and test (cart, orders, coupons, refunds, admin screens) |
| B. Medusa v2 (open-source headless commerce on Postgres) | Cart, orders, promotions, payments and admin come built in | A second server outside Vercel, its own admin next to Sanity, a steeper learning curve for a Next.js beginner, and the affiliate/rewards logic still has to be custom |
| C. Keep WooCommerce headless | Least migration work | Contradicts the goal "WordPress removable"; two systems forever |

**Recommendation:** Option A, kept deliberately small. The scope above is well within what a custom module
can do safely, *if* money is stored as integers, totals are computed only on the server, and every payment
webhook is verified and idempotent.

**Decision (3 November 2026): Option A approved** (Q-28).

### 3.4 Payments: technically feasible, commercially blocked

* **Offline methods** (COD, IDR bank transfer, Wise, Revolut): easy. Create the order as "awaiting payment",
  show the instructions, and an admin marks it paid. This needs an audit log entry.
* **Crypto (PayRam, NOWPayments):** both offer server APIs and signed webhooks, so an integration is feasible.
  Needs API keys and sandbox access.
* **Cards / Apple Pay / Google Pay (`atlas_card`, probably Tagada):** depends on whether Tagada supports a
  non-WooCommerce integration and approves the move. If it doesn't, a new processor must be found that
  knowingly accepts this catalogue. **We won't build a live card integration until this is confirmed** (PRD §7.4).

### 3.5 Affiliate replacement: feasible after the data and settings are known

The model is standard (affiliates → visits → referrals → payouts). Legacy URLs `?ref=username` and
`/ref/username/` are easy to support with Next.js `proxy.ts` (formerly "middleware"). The risk is not the code; it's **unknown rules**
(rates, tiers, cookie days, credit mode) and **reconciling historical money**.

### 3.6 Rewards programme: feasible once the plugin is identified

Rules are clearly written on `/rewards-terms/` (1 credit per Rp 10,000 net of discounts excluding shipping/tax,
rounded down, issued on completion; 250 credits = Rp 250,000 coupon; minimum order Rp 2,500,000; max 250 per
order; no expiry; welcome Rp 50,000; refer-a-friend Rp 250,000 both ways with a Rp 3,000,000 minimum; one coupon
per order; reversals on refund). Existing balances must be migrated, so the plugin and its tables must be known (Q-27).

### 3.7 Protocol Builder / Calculator / Tracker: feasible, needs source code

The front-end JS bundles are public, but the server logic (combinations, quantity calculation, plan storage,
sharing, exports, consent, tracker order sync) lives in the custom plugin's PHP. Rebuilding it from observation
alone would risk wrong results in a tool that does dosing-related arithmetic. **We should get the plugin source
code before rebuilding it** (Q-15). The PRD also asks for a compliance review of such tools before implementation.

### 3.8 SEO: feasible

All URLs can be kept identical, including trailing slashes (`trailingSlash: true` in Next.js). Yoast titles,
descriptions, canonicals, robots and OG data are in the REST API (`yoast_head_json`) and will be imported.
The custom JSON-LD (Store, Product, FAQPage, Article) will be rebuilt. The sitemap can be regenerated
from Sanity + Postgres. **Missing:** the Redirection plugin rules.

## 4. Risk register

| ID | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R-01 | Card or crypto processors refuse the new integration or the catalogue (peptides, HGH, HCG, testosterone) | Launch blocker | High | Confirm with each provider **before** building checkout; build against sandboxes; keep offline methods as fallback |
| R-02 | Custom plugin rules unknown (Protocol Builder, tracker, rewards, gateways, USD hint, schema) | Wrong behaviour | High | Get source code + database tables; write tests from the original behaviour |
| R-03 | Affiliate/rewards financial history doesn't reconcile | Lost money / disputes | Medium | Read-only DB export, legacy ID mapping, automated reconciliation report, owner sign-off |
| R-04 | Visual drift when rebuilding 70 Elementor pages | Fails the "no redesign" rule | Medium | Section library + Playwright visual diffs at 5 widths per template |
| R-05 | Customer passwords can't be migrated | Customers must reset | Low–medium | Verify WordPress hashes (phpass/bcrypt) inside Better Auth on first login, then re-hash; fallback: reset e-mail |
| R-06 | SEO loss (URL, canonical, schema or redirect mismatch) | Traffic loss | Medium | Automated URL-parity test over all 357 URLs; export Redirection rules; keep `/wp-content/uploads/` paths |
| R-07 | Orders or affiliate events created during the cutover are lost | Data loss | Medium | Final incremental sync + short order freeze; WordPress stays read-only as rollback |
| R-08 | Third-party scripts slow the site or break hydration | Performance | Medium | Load with `next/script` strategies; keep IDs identical |
| R-09 | Existing bug: cached nonces and a visitor IP baked into the affiliate login/registration HTML | Login failures, small privacy leak | Already present | Render auth forms per request; don't copy this |
| R-10 | PRO Elements is an unofficial fork of Elementor Pro | Supply-chain risk on the **current** site | Unknown | Tell the owner; it goes away after migration |
| R-11 | MCP / Abilities / Elementor MCP endpoints are exposed on production | Security risk on the **current** site | Unknown | Owner should review and restrict them now |
| R-12 | Public user list (`/wp-json/wp/v2/users`) shows e-mail-style display names; the blog author name shown on all posts is an e-mail address | PII exposure | Present | New blog author model with a public display name; owner decides the displayed name |
| R-13 | Compliance UI (age gate, research-use disclaimers, popups) is accidentally weakened | Legal/compliance | Low | Treat it as a required feature with tests |
| R-14 | Affiliate commission and rewards referral both credited for one order | Overpayment | Medium | Single attribution resolver with a tested priority rule (Q-21) |
| R-15 | Project size vs beginner maintainability | Delays | Medium | Strict phases, small modules, docs per folder, no hidden magic |
| R-16 | Hosting/CMS/DB providers' acceptable-use policies for regulated products | Account suspension | Unknown | Owner to check the Vercel, Sanity and Neon/Supabase terms for this catalogue before committing |
| R-17 | Old image and PDF URLs (`/wp-content/uploads/…`) linked from Google Images, COAs and other sites break | SEO + broken COA links | High if ignored | Keep the path: rewrite or redirect `/wp-content/uploads/*` to the new asset location |
| R-18 | The age gate and cookie notice rely on browser storage | Repeated prompts or no prompt | Low | Reproduce the exact rules after Q-10 |

## 5. Access checklist (please provide; all read-only)

| # | What | Why | Format |
|---|---|---|---|
| A1 | Staging copy of the site (or a full backup to restore locally) | Logged-in screenshots, checkout capture, safe testing of referral URLs | Hosting staging / backup file |
| A2 | Read-only WooCommerce REST API key | Products, variations, coupons, customers, orders | Consumer key + secret (shared privately, never in Git) |
| A3 | Read-only AffiliateWP API key | Affiliates, referrals, visits, payouts, creatives, customers | Public key + token |
| A4 | Database export (or read-only DB user) | HPOS orders + meta, AffiliateWP tables, rewards tables, planner tables, Redirection rules | `.sql.gz` |
| A5 | Screenshots/exports of all AffiliateWP and WooCommerce settings tabs | Business rules | PNG/PDF |
| A6 | Source code of custom plugins and snippets | Exact logic | ZIP |
| A7 | Redirection plugin export | 301 rules | CSV/JSON |
| A8 | Elementor form actions + popup conditions | Where form data goes; age gate rules | Screenshots |
| A9 | Payment provider contacts / sandbox accounts (Tagada, PayRam, NOWPayments) | Checkout | Dashboard access for the owner; keys via Vercel env |
| A10 | GTM / GA4 / Clarity / Tawk.to / Trustindex access | Keep tracking identical | Viewer access |
