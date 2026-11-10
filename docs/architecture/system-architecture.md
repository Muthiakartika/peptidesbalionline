# System architecture (proposal: not built yet)

> **Status: draft, partly approved.** It follows PRD §5 and the Phase 1 findings.
> **Approved 3 Nov 2026:** commerce is a custom Next.js + PostgreSQL module (feasibility report §3.3, Option A).
> Decisions that still need the owner are marked **(decision)**.

## 1. The big picture

```
                    ┌────────────────────────────────────────────────────────┐
 Visitor ──HTTPS──▶ │  Vercel: Next.js app (App Router, TypeScript)          │
                    │                                                        │
                    │  proxy.ts ── referral URLs (?ref=, /ref/x/),           │
                    │                   staging noindex, legacy redirects    │
                    │                                                        │
                    │  Server Components ── read content ──▶ Sanity (CDN)    │
                    │  Server Actions / Route Handlers ──▶ PostgreSQL        │
                    │        (cart, checkout, auth, affiliate, rewards)      │
                    │  /api/webhooks/* ◀── payment providers (signed)        │
                    │  /api/revalidate ◀── Sanity webhook (signed)           │
                    └────────────────────────────────────────────────────────┘
                          │                    │                  │
                          ▼                    ▼                  ▼
                   Sanity Content Lake   Neon/Supabase        E-mail provider
                   (+ Studio at /studio)  PostgreSQL          (decision Q-08)
```

**Rule of thumb for a beginner:** *words and pictures* live in **Sanity**; *money, people and anything that
must never be lost* live in **PostgreSQL**.

| Lives in Sanity (editable content) | Lives in PostgreSQL (transactions) |
|---|---|
| Product name, slug, descriptions, images, gallery, categories, attributes and labels, COA documents, FAQs, SEO | Sellable variants: price, stock, backorder, status (keyed by `productId` + `variantKey`) |
| Pages (page builder sections), blog posts, legal pages | Users, sessions, roles, addresses |
| Header/footer/menus, announcement marquee, popups text | Carts, orders, payments, refunds, shipments |
| Lab results / COA entries | Coupons and redemptions |
| Site settings (contact, WhatsApp number, USD rate if fixed) | Affiliates, visits, referrals, commissions, payouts (ledger) |
| | Rewards accounts and transactions (ledger) |
| | Protocol Builder plans and tracker data (user data) |
| | Audit logs, legacy ID mappings, migration logs |

## 2. Keeping products consistent between Sanity and Postgres

This is the part editors are most likely to break, so it's kept simple:

1. **The product is created in Sanity.** Each product and each variation gets a stable key
   (`legacyWooId` for migrated items, a UUID for new ones).
2. **A Sanity webhook** (or a "Sync to store" document action) calls `/api/sync/products`, which **upserts** the
   matching `product_records` / `product_variants` rows in Postgres. Prices and stock are edited in a small
   **Store admin** screen inside the Next.js app (`/admin/products/[id]`), not in Sanity.
   Optional: a custom Sanity input that *shows* the Postgres price read-only.
3. A product that exists in Sanity but has no sellable variant in Postgres shows "unavailable" and can't be added to the cart.
4. Postgres never invents product content, and Sanity never stores the authoritative price.

**(decision)** Some teams prefer prices in Sanity for convenience. The PRD forbids that for authoritative
prices, so the plan follows the PRD.

## 3. Request flows

### Browsing a product page
`app/(store)/product/[slug]/page.tsx` (Server Component) → GROQ query to Sanity for content → Drizzle query to
Postgres for variant prices and stock → renders HTML. It is cached with `revalidateTag('product:<slug>')`,
which the Sanity webhook or a price change clears.

### Add to cart
Client component `VariantSelector` → Server Action `addToCart(variantId, qty)` → validates with Zod → reads the
**price from Postgres** → writes `cart_items` → returns the new cart. The browser never sends a price.

### Checkout
`/checkout/` → Server Action `placeOrder` runs inside **one DB transaction**: recalculates totals, validates the
coupon, applies the shipping rule, reserves stock, creates the `order` with status `pending_payment`, and
resolves the referral attribution (affiliate **or** rewards friend, never both).
* Offline methods → status `on_hold` + instructions page + e-mail.
* Online methods → redirect to the provider → the provider calls `/api/webhooks/<provider>` → the signature is
  checked → an **idempotent** update (unique `provider_event_id`) → `processing` → commission and rewards rows
  are created as *pending*.

### Referral visit
`src/proxy.ts` (Next.js 16 renamed "middleware" to "proxy") sees `?ref=alice` or `/ref/alice/...` → rewrites to the clean URL → calls
`/api/affiliate/visit` (or does it inline) → checks the affiliate is **active** → inserts an `affiliate_visits` row
→ sets a signed `affwp_ref`-style cookie whose lifetime comes from `affiliate_settings` (never hard-coded).

## 4. Folder structure (PRD §12, applied to this project)

```text
src/
├── app/
│   ├── (store)/                 # public pages with the normal header/footer
│   │   ├── page.tsx             # home (Sanity page builder)
│   │   ├── shop/                # /shop/ and /shop/page/[n]/
│   │   ├── product/[slug]/      # /product/<slug>/
│   │   ├── product-category/[...slug]/
│   │   ├── cart/  checkout/
│   │   ├── [slug]/              # pages and blog posts at the root (/about-atlas-longevity/, /what-is-bpc-157/)
│   │   ├── peptide/[city]/      # /peptide/jakarta/ …
│   │   ├── category/[slug]/     # blog category archives
│   │   ├── protocol-builder/  calculator/  rewards/
│   │   └── affiliate-login/  affiliate-registration/  affiliate-area/
│   ├── my-account/              # WooCommerce-compatible account URLs
│   ├── admin/                   # store admin (orders, prices, affiliates, payouts)
│   ├── studio/[[...tool]]/      # Sanity Studio
│   └── api/                     # webhooks, revalidate, sync
├── components/                  # presentation only (no database calls)
│   ├── layout/   (Header, TopBarMarquee, Footer, MobileNav, CartDrawer, AgeGate, CookieNotice)
│   ├── sections/ (one file per page-builder block)
│   ├── products/ (ProductCard, ProductGallery, VariantSelector, PriceWithUsdHint)
│   ├── cart/  forms/  affiliate/  ui/
├── features/                    # business logic (no JSX)
│   ├── catalog/  cart/  checkout/  orders/  shipping/  coupons/
│   ├── auth/  affiliate/  rewards/  planner/
├── sanity/  (schemas/, queries/, lib/)
├── db/      (schema/*.ts, migrations/, index.ts)
├── lib/     (payments/<provider>.ts, email/, security/, money.ts)
└── types/
scripts/  (audit/ ✅ exists, migration/, verification/)
docs/
```

## 5. Key technical choices

| Topic | Choice | Why |
|---|---|---|
| Next.js | Latest stable, security-patched version at setup time, App Router, `trailingSlash: true` | The PRD asks for it; trailing slashes keep every WordPress URL identical |
| Styling | Tailwind CSS with the observed tokens (`design-tokens.json`) | Beginner-friendly, and the tokens map 1:1 |
| Fonts | `next/font/google`: Urbanist, Anton, Inter, Jost, Cormorant Garamond, Poppins | Same fonts, self-hosted by Next.js |
| Images | Sanity image CDN through `next/image`; legacy `/wp-content/uploads/*` rewritten | Performance + SEO continuity |
| Auth | Better Auth (e-mail + password, e-mail verification, password reset), roles `customer`, `affiliate`, `shop_manager`, `admin` | PRD; one identity can be both customer and affiliate |
| Validation | Zod on every Server Action and Route Handler | PRD |
| Money | `bigint` minor units (IDR × 100, same as WooCommerce's Store API) plus a `currency` column | No floating point |
| Rate limiting | Upstash Redis or a Postgres-based limiter on auth, coupon and referral endpoints | PRD §14 |
| CAPTCHA | reCAPTCHA v3 with a **new** secret in Vercel env (the old secret is not reused) | Matches current behaviour |
| E-mail | Provider decided at Q-08; templates in React Email | — |
| Testing | Vitest (logic: money, coupons, commissions, rewards), Playwright (E2E + visual regression) | — |
| Environments | `local` → Vercel `preview` (noindex) → `staging` (noindex, sandbox payments) → `production` | PRD §11, §15 |

## 6. Security basics (built in from day one)

* Secrets only in Vercel environment variables. `.env.local` stays out of Git, and `.env.example` documents names only.
* Admin routes check the role on the server, every time.
* Payment webhooks: verify the signature, check the amount and currency against the order, and process each event once.
* Payouts and commission corrections only through admin Server Actions that write `affiliate_audit_logs`.
* Customers and affiliates can only read their own data (row-level checks in every query helper).
