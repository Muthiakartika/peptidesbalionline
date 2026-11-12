# Implementation plan, checklist and open questions

**Written at the end of Phase 1 (3 November 2026).** This turns the audit into an order of work. Each phase ends
with something you can check (screenshots, tests, a reconciliation report) before the next one starts. Nothing
in Phases 2–8 has started.

Read first: [feasibility report](../audit/technical-feasibility-report.md) ·
[page inventory](../audit/page-inventory.md) · [WooCommerce audit](../audit/woocommerce-audit.md) ·
[AffiliateWP audit](../audit/affiliatewp-audit.md) · [plugins](../audit/plugin-inventory.md) ·
[architecture](../architecture/system-architecture.md) · [database](../architecture/database-schema.md)

---

## 1. Recommended order of development

Why this order: build **what's visible and risk-free first** (the pages, from public data we already have),
while the owner gathers backend access. Money-related modules come last, when their real rules are known.

| Phase | What gets built | Needs before starting | Done when |
|---|---|---|---|
| **2. Foundations** (about 1 week) | Git repo; Next.js (latest stable) + TypeScript + Tailwind + ESLint; folder structure; design tokens → Tailwind theme; fonts; Sanity project + base schemas; Neon Postgres + Drizzle (catalogue + system tables; auth tables come from Better Auth's CLI in Phase 5); visual-diff harness pointing at `docs/audit/visual-reference/screenshots/` | Q-28 (custom commerce OK?), Q-29 (provider terms), Q-30 (Git hosting) | `npm run dev` shows an empty shell; `npm run test:visual` runs; Studio opens at `/studio` |
| **3. Frontend replication** (3–5 weeks) | 3a layout shell: top-bar marquee, pill header + sticky, mega dropdowns, payment badge, mobile drawer, search overlay, cart drawer (UI), footer, age gate, cookie notice, WhatsApp + Tawk + GTranslate embeds → 3b product card + shop + category archives (sort, per-page, views, pagination) → 3c single product (gallery, swatches, tabs, sticky add-to-cart, USD hint, WhatsApp/COA/calculator buttons) → 3d homepage → 3e section library + landing families (compound, price, goal, area, city, hub) → 3f blog post + archives + Insights → 3g info, legal, lab results, rewards, affiliate public pages → 3h cart, checkout and account **UI only** | Content can come from the exported JSON at first. Q-09, Q-10, Q-13, Q-14 decided | Every template matches its reference screenshots at 5 widths (diff report attached) |
| **4. CMS + content migration** (1–2 weeks, overlaps Phase 3) | Sanity schemas finalised (product, variant labels, attribute, category, page builder blocks, post, author, COA, settings, menus, popups); migration scripts for categories, attributes, products, media (keep `/wp-content/uploads/…` paths working), posts, pages, Yoast SEO; preview; webhook revalidation; sitemap + robots; redirects table | A2 (WooCommerce read key) for full product data; A7 (Redirection export) | Script counts match the audit (182 / 319 / 25 / 54 / 80); the URL-parity test passes for all 357 URLs |
| **5. Commerce backend** (3–4 weeks) | Better Auth (+ legacy WordPress hash login, Q-07) → product sync Sanity→Postgres + store admin for prices/stock → cart (server totals) → shipping rules → coupons (one per order) → checkout with **offline** methods (COD, IDR transfer, Wise, Revolut) → e-mails → My Account (orders, addresses, details) → admin order screens → **online payments in sandbox only** (Tagada? PayRam, NOWPayments) | Q-01 to Q-08, Q-17; A1/A5 for settings | Vitest covers money/coupons/shipping; E2E: place an offline order, see it in admin, receive e-mails; sandbox crypto payment confirmed via webhook |
| **6a. Affiliate module** (2–3 weeks) | Settings copied from AffiliateWP → `src/proxy.ts` for `?ref=` and `/ref/<user>/` → visits + attribution → registration (reCAPTCHA v3, terms, pending) + admin approve/reject → commission engine (rates, tiers if live, exclusions, refunds) → payouts (admin-only, audited) → affiliate dashboard matching the Portal screens (incl. Facebook/Email/QR sharing) → **read-only import of history** → reconciliation report | Q-18 to Q-23; A3/A4 (data); Portal screenshots | The reconciliation report matches old totals to the rupiah; tests for duplicates, self-referral, refund reversal |
| **6b. Rewards module** (1–2 weeks) | Credits ledger, welcome reward, redemption coupon, refer-a-friend, the "affiliate vs friend, never both" rule, balance import | Q-21, Q-27, rewards data export | Balances reconcile; rule tests from `/rewards-terms/` pass |
| **6c. Protocol Builder, Calculator, Tracker** (1–2 weeks) | Port the plugin's logic and UI, with plans, sharing, exports, consent, and the tracker | Q-15 (source code + compliance review) | Same inputs give the same outputs as the old tool (golden tests) |
| **7. QA + rehearsal** (1–2 weeks) | Full staging migration rehearsal; reconciliation (orders, affiliates, rewards); SEO parity; visual regression; security review (auth, webhooks, RBAC, rate limits); performance; analytics events | Everything above | All acceptance criteria in PRD §18 checked, or listed as open |
| **8. Cutover** (1–2 days + monitoring) | Order freeze window → final incremental import → DNS switch → watch payments, e-mails, referrals → WordPress kept read-only for rollback | Explicit owner go-ahead | 7 days of clean monitoring |

Time estimates assume one developer working with Claude and the owner answering questions quickly. They are
rough until Q-15 and Q-27 reveal how big the custom plugins really are.

## 2. Dependency map

```
Q-28 commerce approach ─┐
A2 WooCommerce key ─────┼──▶ Phase 4 product import ──▶ Phase 5 cart/checkout ──▶ 6a commissions
Q-01/Q-02 payments ─────┼──────────────────────────────▶ Phase 5 online payments (sandbox → live)
A3/A4 AffiliateWP data ─┼──────────────────────────────────────────────────────▶ 6a import + reconcile
Q-27 rewards plugin ────┼──────────────────────────────────────────────────────▶ 6b
Q-15 planner source ────┴──────────────────────────────────────────────────────▶ 6c
Phase 3 (frontend) only depends on Phase 2 + public data we already have ✅
```

## 3. Migration implementation checklist

**Phase 1: discovery** ✅
- [x] URL inventory (357 URLs) with SEO, headings, forms, components
- [x] Product / variation / category export (public)
- [x] Design tokens + 197 reference screenshots (39 templates × 5 widths + 2 age-gate)
- [x] Plugin and integration inventory
- [x] WooCommerce audit (public parts)
- [x] AffiliateWP audit (public parts + PRD screenshots)
- [x] Feasibility report, risk register, architecture and database proposals
- [ ] Logged-in captures (account, checkout, order received, Affiliate Portal, rewards area): needs A1
- [x] Backend settings audit (A5), 6 Nov 2026, read-only in wp-admin: [backend-settings.md](../audit/backend-settings.md)
  (shipping, payments and their fees/minimums, checkout fields, stock, orders, coupon rules, e-mail, AffiliateWP,
  rewards, forms, plugins, snippets). Answers Q-03, Q-04, Q-06, Q-12, Q-19, Q-24, Q-25, Q-32; partly Q-01, Q-08,
  Q-13, Q-18, Q-20, Q-22, Q-27; new Q-46 to Q-49. The Redirection rules (A7) are in `src/content/seo/redirects.json`.

**Access to collect** (see the feasibility report §5): A1 staging · A2 WooCommerce read key · A3 AffiliateWP read key ·
A4 DB export · A5 settings screenshots · A6 custom plugin source · A7 Redirection export · A8 Elementor forms/popups ·
A9 payment sandboxes · A10 analytics access

**Phase 2: foundations** (started 3 Nov 2026; local parts done)
- [x] `.env.example` with every variable name (no secrets)
- [ ] `git init` + private remote + branch protection (Q-30)
- [x] Next.js 16.4 App Router + TypeScript + Tailwind 4 + ESLint; `trailingSlash: true`; Cache Components on
- [x] Tailwind theme from `design-tokens.json` (`src/app/globals.css`); `next/font` for the 6 fonts (`src/lib/fonts.ts`)
- [x] Money helper with unit tests (`src/lib/money.ts`, Vitest)
- [x] Sanity Studio embedded at `/studio/` with base schemas (product, category, attribute, page, post, author, blog category, site settings)
- [x] Create the Sanity project (datasets `production` + `staging`) and add its ID to `.env.local`. **Done 9 Nov
  2026** (guide: [docs/setup/sanity.md](../setup/sanity.md)): project `nlsai15w`, `production` and `staging`
  both public, the write token works (checked with a dry run, nothing saved), `/studio/` loads Sanity's login
  with no CORS error from `localhost:3005`. Both datasets hold only Sanity's own system documents: the content
  move (Phase 4) is next.
- [x] Drizzle config + catalogue/system tables + first SQL migration (`src/db/migrations/0000_initial_catalog.sql`)
- [x] **Neon connected (9 Nov 2026):** AWS ap-southeast-1 (Singapore), Postgres 18.6, pooled and direct strings in
  `.env.local` (owner). `npm run db:migrate` created every table (0000–0007), and the WordPress import filled
  it: every reconciliation line "ok" (45 accounts, 253 orders, 1,457 notes, 10 coupons, AffiliateWP). Found on
  the way: postgres.js JSON-encodes a text parameter cast with `::jsonb` a second time (PGlite doesn't), so
  the importer now casts `$n::text::jsonb` (the first run failed inside its transaction: nothing was half
  written). Checked on the site: accounts and coupons come from Neon. One foreign-key name is longer than
  Postgres's 63 characters and is stored shortened (harmless).
- [ ] Create the Neon project and run `npm run db:migrate`: needs the owner's account (done 9 Nov 2026, above). Neon chosen on
  6 Nov 2026 (region Singapore; branch `dev` for development; `DATABASE_URL` pooled + `DATABASE_URL_UNPOOLED`
  direct for migrations, both pasted into `.env.local` by the owner). Check Neon's acceptable-use rules first (Q-29).
- [x] Visual-diff script (`npm run verify:visual`) and URL-parity script (`npm run verify:urls`), both smoke-tested
- [x] Non-production = noindex (`robots.txt` disallow-all + `noindex` meta); production `robots.txt` = the WordPress rules
- [ ] Vercel project + environment variables (needs the owner's Vercel account; check Q-29 first)

**Phase 3: frontend** (one checkbox per template in the page inventory §2: 26 templates)
- [x] **3a layout shell** (3 Nov 2026): top-bar marquee, floating pill header (sticky), desktop menu with
  2-level dropdowns, rotating payment badge, GTranslate flags, account login dropdown, full-screen search,
  cart drawer (empty state), mobile header + menu drawer, footer, age-verification popup, cookie bar,
  floating cart + WhatsApp buttons, production-only analytics/chat scripts, 404 page.
  **Measured result:** the 404 template passes the visual diff at all 5 widths (0.29–0.92% pixels differ,
  0px height difference), measured against the references re-captured on 3 Nov 2026. Header, 404 content, footer and age-gate elements sit at Δ = 0px from the live site.
  Known differences: Tawk.to chat bubble (production only), cart count always 0 until Phase 5.
- [x] **3b shop, categories, search results** (4 Nov 2026): `/shop/` + `/shop/page/N/`, all 25
  `/product-category/…/` pages (+ `/page/N/`), product search `/?s=…&post_type=product` (+ `/page/N/`),
  grey title band with breadcrumbs and the round category carousel, category sidebar (accordion, sticky on
  desktop, drawer on phones), toolbar (result count, per page 9/12/18/24, grid 3/4 columns, the 5 sort
  options), product cards (hover image, quick-view button, quick-shop options that change price, image and
  button), pagination, "no products found", and live suggestions in the header search (categories, 20
  products, the owner's option pills). Data: `src/content/catalog.json`, a snapshot made by
  `scripts/audit/export_shop_snapshot.py` (Phase 4 replaces it with Sanity + PostgreSQL).
  **Measured result:** the 5 shop templates pass the visual diff at all 5 widths (25/25, 0.09–0.82%
  pixels differ, 0px height difference). Every measured element (band, sidebar, toolbar, 21 cards,
  pagination, footer) sits at Δ = 0px from the live site at 1440, 1280, 768 and 390px; the search
  suggestions too (22/22 elements). Card hover, quick-shop and sidebar states match the live values.
  The rules behind order, search and prices are unit-tested against the live site (37 tests);
  shop, category and search SEO tags match the live site (31 of 32 URLs, the other one is the blog search).
  **List view done (7 Nov 2026):** `?shop_view=list` on the shop, category and search pages shows
  Woodmart's list item as live (theme file `woo-product-loop-list` under the owner's card CSS): from 769px
  the picture (300px) on the left and on the right the options, the short description (the product page's
  own, at most 11em then a thin scrollbar), categories, a larger title and price and the gold "accented"
  button; up to 768px a one-column card without the description. Card 1px shorter than the grid's (no
  bottom border, "products with background"). Two new templates, `shop-list` (/shop/?shop_view=list) and
  `product-category-list` (/product-category/vial/healing-recovery/?shop_view=list): 10 of 10 captures
  pass (0.20–0.88%, 0px); every measured element of the first cards at Δ = 0px at 1440px; the grid
  templates and the homepage still pass (32 of 32). Code: `ProductCard` `view="list"`
  (`src/components/shop/ProductCard.tsx`), styles under "List view" in `src/styles/shop.css`.
  Not done yet at the time: the quick-view popup (3c, it reuses the product summary) and every "Add to cart" (Phase 5; until then
  the buttons open the product page with the chosen options). Searches without `post_type=product` use the
  blog search template on the live site (3f); `/page/N/` without a search is the homepage (3d).
  Out-of-range pages (`/shop/page/99/`) show the 404 page but with a 200 status, because the number of
  pages depends on `?per_page=` (soft 404, noindex).
- [x] **3c single product** (4 Nov 2026): all 182 `/product/<slug>/` pages. Gallery (one picture at a time,
  thumbnails, arrows on hover, hover zoom with the full-size file, sticky on desktop), "Click to enlarge"
  viewer (PhotoSwipe 4 look and behaviour: fit between 44px bars, zoom, drag, fullscreen, share menu, loop,
  Esc / background click / scroll closes, taps on touch screens), breadcrumbs, price that becomes the
  variation's price, short description, included-supplies note, option form (pills or dropdowns, "Clear"
  once every option is chosen, the chosen value next to the label on phones, out-of-stock message and
  WooCommerce's button states, the variation's picture in the gallery), quantity ±, the Elementor buttons
  block, "Also available as", tabs on desktop / accordion on tablets and phones, Elementor descriptions with
  their own CSS, related products carousel. Plus the **quick-view popup** of every product card (shop,
  categories, search, related products). Data: `src/content/product-pages.json`, made by
  `scripts/audit/export_product_pages.py`; Elementor CSS by `scripts/audit/vendor_elementor_css.py`.
  **Measured result** (production build, references re-captured 4 Nov 2026): the 6 product templates pass
  the visual diff in 29 of 30 captures (0.06–0.77% pixels differ, 0–1px height difference). The one that
  fails (`product-variable-2-attributes` at 768px, 2.82%, 0px height) is a capture artifact on the live
  side: the live header script moves that capture's text by 1–2px while scrolling; measured directly, every
  text box sits at the same position (to 0.01px). The shop, category, search and 404 templates were
  re-checked after the global fixes below: 30/30 (0.09–0.86%, 0px).
  Every product URL keeps its status, title, description, canonical, robots and H1 (182/182). Viewer and
  quick-view positions match the live site to the pixel (e.g. picture at 314,44 · 812×812 on a 1440×900
  screen; popup 920×682.5 at 260,108.8). 12 new unit tests (picture placement, product data, quick-view API; 56 in total).
  Found and fixed on the way (they also apply to 3a/3b pages): the page could scroll sideways and phones
  zoomed out (the theme's `html { overflow-x: hidden }` was missing); Tailwind turned class names inside the
  copied HTML into utilities (`mb-3`, `flex`…); CSS order differed between dev and production; Urbanist was
  declared as one variable face instead of the live site's four weights (text drew slightly differently);
  the theme's text rendering (`text-rendering: optimizeLegibility`, font smoothing) was missing.
  Not done yet: "Add to cart" (Phase 5; the button shows WooCommerce's messages but adds nothing). The live
  site has no sticky add-to-cart bar on product pages, so none was built. Open questions Q-38, Q-39.
- [x] **3d homepage** (4 Nov 2026): `/`, and `/page/N/`, which WordPress also answers with the homepage.
  The Elementor page keeps its original markup and its own Elementor CSS, rendered on the server
  (`src/content/pages/home.json`, made by `scripts/audit/export_elementor_pages.py`; CSS by
  `vendor_elementor_css.py`). The widgets that need JavaScript became components that do what the live
  scripts do, measured on the live page:
  * the 4 product grids: catalogue cards with quick shop and quick view, plus Woodmart's "bordered grid" option;
  * "recently viewed": hidden until the visitor has viewed a Peptide Vials product, newest first;
  * the lab-certificate carousel (Owl: 4/3/2 per view, remote arrows, drag, loop, whole-pixel item widths,
    autoplay every 5s that pauses on hover);
  * the testimonial carousel (Swiper 8.4.5 with Elementor's options: 5s autoplay, pause on hover, loop, bullets);
  * the Google reviews slider (Trustindex: 3/2/1 columns, arrows, 6s back-and-forth autoplay that a click
    stops, "Read more", progress bar on phones, realigned after a resize);
  * the photo gallery (grid and lazy loading), the two search boxes, the counters, the stretched sections.

  The homepage is a static page. `src/proxy.ts` sends `/?s=…` searches to the search results and `/page/N/`
  to the homepage, with WordPress's redirects for `/page/1/`, `/page/0/` and `/page/02/`. Paged search
  results now also get their live title ("- Page 2 of 7 - Atlas Longevity").
  **Measured result:** (production build, live references re-captured 5 Nov 2026 after the owner's change): the
  homepage passes the visual diff at all 5 widths (0.34–0.90% pixels differ, 0px height difference) and
  in both first-visit age-gate shots (0.31% and 1.24%). Across all 13 built templates, 66 of 67 captures
  pass. The other one (`product-variable-2-attributes` at 768px, 4.21%, 0px) is the live-side artifact
  noted under 3c: two live captures of that page differ from each other by 4.09%, and against the second
  one the rebuild differs by 0.23%. Two live captures of the homepage now agree to 0.00–0.23%, so the
  comparison is reproducible. Element by element (every Elementor element at 1440, 768 and 390px), the
  homepage sits at the same position and size as on live; the only exception is the reviews widget,
  which live hasn't started yet at measuring time (its finished state matches). Every interactive widget
  was also compared step by step against live. URL parity: 215 of 357 URLs (`/` and `/page/2/` added;
  `/?s=bpc`, the blog search, is 3f). 69 unit tests (13 new: widget arithmetic, HTML cleaning, the
  products API).
  Found and fixed on the way:
  * The live page's Elementor CSS contains code that browsers skip but Next.js's CSS parser rejects
    (Markdown fences pasted into the owner's custom CSS, an Elementor placeholder `{{VALUE}}`). It is
    removed exactly as the browser skips it; checked on live that those two rules really don't apply there.
  * Six more class names in the copied HTML were Tailwind utilities (`mt-4`, `hidden`, `relative`,
    `uppercase`, `h-full`, `max-w-2xl`). Tailwind's reset also made iframes and SVG icons blocks, which
    made the map 7px shorter.
  * Shop cards inside page content needed Woodmart's "bordered grid" option and its variation-table reset.
  * Chrome 152 no longer counts the scrollbar in `100vw`, so stretched sections are sized with a CSS
    container instead.
  * Age gate (a 3a template): on phones the popup had 20px of room around it (350 instead of 375px wide)
    and missed Elementor's 1% spacing round the heading and the taller last divider; the owner has since
    added a line break to the heading. Like the live popup, it now puts the focus on "I'm 21+", with the
    theme's dotted keyboard-focus outline (now used site-wide, as on the live site).
  * Capture script: the page is clipped sideways (the live header sticks out 10px; Playwright then took
    1450px-wide full-page captures and the page was laid out again at that width, which moved stretched
    backgrounds at random), and things that move by themselves are frozen at their first frame.
  * The owner changed the lab-certificate carousel on 5 Nov 2026 (4 instead of 6 per view, autoplay on,
    new card design with portrait pictures). The snapshot was re-exported and the carousel learned
    autoplay, measured on the live page; nothing else on the homepage had changed.

  Copied from live as they are (Q-40): two Woodmart "stretched" bands are 15px narrower than the window on
  desktops with a classic scrollbar; the search boxes have "live results" switched on but show none.
  Not shipped: Fancybox's CSS (unused here; needs a commercial licence).
  Not done yet: submitting a homepage search box goes to `/?s=…` without `post_type=product`, the blog/site
  search (3f; until then the 404 page); every "Add to cart" (Phase 5). The map is the live Google embed.
- [x] **3e landing families** (5 Nov 2026): the 52 Elementor landing pages: 16 compound pages
  (`/bpc-157-bali/` …), 6 price and dosage pages, 10 goal pages, 10 Bali area and delivery pages, the hub
  `/peptide/` and 9 Indonesian city pages (`/peptide/jakarta/` …). Built like the homepage: each page keeps
  its original Elementor markup and its own Elementor CSS (`src/content/pages/<name>.json`, by
  `export_elementor_pages.py`; CSS by `vendor_elementor_css.py`, linked inside the page from
  `public/legacy/elementor/`). The "section library" of the original plan becomes Sanity's page builder in
  Phase 4; until then these pages are snapshots, like the homepage.
  * Routing: `src/proxy.ts` sends each landing address to `src/app/(store)/landing/[name]/page.tsx` (the
    address bar keeps the real one), so all 52 pages are built in advance and unknown addresses keep a real
    404 status from the catch-all. Built on request instead, a catch-all route answered unknown addresses with
    the 404 page but status 200, because Cache Components sends the header and footer before the page runs.
    `/landing/…` itself answers 404. Next.js 16's "optimistic routing" is switched off: it made links guess
    the 404 route for landing addresses they hadn't seen and skip the proxy (`next.config.ts`).
  * New widgets, measured on live and rebuilt: Woodmart's FAQ accordion (15 pages; one answer open at a time,
    300 ms slide with jQuery's easing, fade, Enter key) and Unlimited Elements' "Content Accordion"
    (`/hgh-bali/`: 400 ms, closes the others, plus/minus icons). Product descriptions use the same
    accordion code now, so their FAQs slide too, as on live.
  * Theme rules added (measured): Woodmart's "wider" grid item and the categories widget's own corner radius
    (the hub's category grid), nested list spacing, the alignment classes. Fonts: `/hgh-bali/` needs Inter
    Tight and Cormorant Garamond 500 / 500 italic, which Elementor loads only there; added (a browser only
    downloads a font when a page uses it).
  **Measured result** (production build, live references re-captured 5 Nov 2026): element by element (every
  Elementor element of every page), all 52 pages sit at the same position and size as on live at 1440, 768
  and 390px (156 measurements; document heights 0px apart, except 1px on 3 city pages at 390px from sub-pixel rounding, with no element off by more than 1px). The 6 landing templates pass the visual diff at all 5 widths (30 of 30 captures, 0.06–0.82% pixels differ, 0px height difference); across all 19 built templates 96 of 97 captures pass. The other one is the homepage at 768px (6.16%, 0px): the page is over 16,000px tall there, so it is still captured with Playwright's full-page option, which draws our hero picture at a different scale from one capture to the next (two of our own captures differ by 4.35%); in a normal 768×1024 window the homepage top matches live to 0.20%, and element by element the page matches live as in 3d. The two accordions were compared step
  by step against live (open, switch, close, keyboard): same curve, timing and end state. Moving between
  pages with the menu links (no reload) shows each landing page with its own CSS already applied. URL parity: 267 of 357 URLs (all
  52 landing pages added). 77 unit tests (8 new: the page snapshot and the proxy's routing).
  Found on the way (3f): the theme's --wd-scroll-w / --wd-sticky-nav-w default to .001px on the live site (only a
  scrollbar that takes room changes them); the rebuild used 0, which made Woodmart's stretched sections 1/64px
  wider and moved the pictures below them by up to half a pixel (/insights/). React 19 preloads every <img> that
  isn't lazy, also for pages that only prefetch a link to it: the post's picture is lazy now, as on live, so
  /insights/ no longer downloads the posts' full-size pictures in advance (checked: the shop pages download no
  product pictures in advance).
  Found on the way: the capture script now photographs a page by making the window as tall as the page; with
  Playwright's full-page option, Chrome drew the homepage differently from one capture to the next (two live
  captures 7.9% apart). Pages taller than 16,000px still use the full-page option (Chrome can't draw a taller
  window). All references of the 19 built templates were captured again this way on 5 Nov 2026.
  Not done yet: the links inside these pages to blog posts, info pages and the cart lead to the 404 page
  until 3f–3h; "Add to cart" (Phase 5).
- [x] **3f blog** (5 Nov 2026): the 54 posts (`/what-is-bpc-157/` …, at the root of the site as on
  WordPress), the 8 category archives with their pages (`/category/uncategorized/page/2/` … `/page/5/`),
  `/insights/` (an Elementor page with the newest posts and "Load more posts") and the site search
  (`/?s=bpc`, `/page/2/?s=bpc`: products, posts and pages; `post_type=post` for posts only). Snapshot:
  `scripts/audit/export_blog.py` → `src/content/blog/` (and `src/content/search/pages.json`); the theme's
  blog rules are rewritten in `src/styles/blog.css` (Q-34). Posts are served like the landing pages:
  `src/proxy.ts` sends each post's address to `/blog-post/<slug>/`, so all 54 are built in advance and
  unknown addresses keep a real 404.
  * The live title band, post header (category, title, dates, comment count, picture), share buttons,
    "Newer / Back to list / Older" and the comment form are copied with their markup; the archive and
    search cards, their excerpts and the page links follow the theme's rules (Woodmart's paging: at most
    5 numbers, then ‹ › « »), checked against every date and page link the live pages print.
  * The site search runs WordPress's own rules (every word in the title, excerpt or text; title matches
    first, then newest first; 10 per page), with the owner's compound-name replacement ("tirzepatide" is
    searched as "GLP-2 TRZ", Q-35). Against all live results of 4 searches: "bpc" (85) and "tirzepatide"
    (39) give exactly the same list in the same order, "glow" the same 13 in order plus the homepage,
    "bali peptides" 184 of 185 with the first 109 in order plus 4 plugin pages. The differences come from
    WordPress searching its database copy of the text, which isn't public (backend access would close them).
  * **Privacy (R-12, Q-14):** the live author name is an e-mail address. It is never copied: the export
    removes it (and the Gravatar hash, author links) and stops if any is left; the rebuild shows "Atlas
    Longevity" and Gravatar's standard avatar until the owner chooses a name (`src/lib/blog/author.ts`); the
    capture script blanks the author line on both sides, so no screenshot contains it. The old blog
    references from 3 Nov (which showed it) were replaced.
  **Measured result** (production build, live references captured 5 Nov 2026): The 3 blog templates pass the visual diff at all 5 widths (15 of 15, 0.02–1.19% pixels differ, 0px height difference); across all 22 built templates 111 of 112 captures pass (the other one is the homepage at 768px, the capture artifact of pages taller than 16,000px, see 3e). Element by element
  (computed styles of every element of the title band and the content), the post, the archive, /insights/
  and the search results match live at 1440, 768 and 390px (differences under 0.2px). URL parity:
  331 of 357 URLs (all 54 posts, the 8 archives, /insights/, /?s=bpc and the archive page that doesn't exist, which
  answers 404 as on live); left: 22 info pages (3g) and cart / account (3h). 92 unit tests (15 new: blog data, dates, page links, site search against live results, the
  proxy's blog routes).
  Not done yet: posting a comment (the form shows, sending does nothing; Q-41); the author archive
  (`/author/<user>/`, its address contains the e-mail address: owner's decision with R-12); JSON-LD
  (Phase 4). As on the product categories, an unknown category or page number shows the 404 page with
  status 200 (the route is built in advance); unknown addresses elsewhere answer 404.
- [x] **3g info, legal, lab results, rewards, affiliate pages** (5 Nov 2026): 20 pages, served like the
  landing pages (`src/content/pages/<name>.json` by `export_elementor_pages.py`, the landing route): about,
  contact, FAQ, consultation, lab results, rewards, rewards terms, subscribe, banner, the 6 legal pages,
  the affiliate program, and AffiliateWP's affiliate area / login / registration / terms, which are plain
  WordPress pages (no Elementor: their `<article>` is kept). The export empties the forms' security tokens,
  the reCAPTCHA key and the visitor-IP field, and stops if an IP address or key is left.
  * New widgets, measured on live and rebuilt: Elementor's "Toggle" FAQ (`/affiliate-program/`: 400 ms
    slide, the others stay open, Enter / Space, the ARIA attributes and `hidden` as live), the owner's
    snippet 21 "lab copy icon" (copies the code, shows ✓ for a second), the forms (`PendingForm.tsx`: the
    browser checks the fields as live; sending is held back and nothing pretends to be sent; Q-12, Q-43).
  * Theme rules added (measured): the theme's form look (fieldset, legend, select with its chevron,
    textarea, checkboxes, `.required`), Woodmart's Elementor-form rules (field height, radius, no caret),
    AffiliateWP's form CSS (GPL, bundled before the theme as live: `src/styles/legacy/affiliate-wp-forms.css`),
    and the theme's border reset inside copied HTML (Tailwind's reset made a rule that only sets a
    border width draw a border). Fonts the pages need: Poppins 300/400 (legal pages), Cormorant Garamond
    700, Inter italic, Roboto 400 (consultation fields), Montserrat 600 italic (one line).
  * Copied as they are: `/subscribe/` shows the raw newsletter shortcode (Q-44); `/affiliate-area/`
    shows AffiliateWP's "please log in" notice to visitors.
  **Measured result** (production build): element by element, the 16 Elementor pages sit at the same
  position and size as on live at 1440, 768 and 390px, except the reCAPTCHA box in the partner form
  (59px, needs the owner's keys, Q-43; hidden on both sides in the screenshots); the 4 plain pages match
  live style by style. Visual diff (live references captured 5 Nov 2026): the 13 3g templates and the 6 3h
  templates pass at all 5 widths (95 of 95 captures, 0.02–0.98% pixels differ, 0px height difference).
  Across all 41 built templates 206 of 207 captures pass; the other one is the homepage at 768px, the
  capture artifact of pages taller than 16,000px (see 3e). The site-wide changes of this phase (border
  reset, fonts, form rules) left every earlier template passing. URL parity: 355 of 357 URLs; left:
  `/protocol-builder/` and `/calculator/` (6c). 102 unit tests (10 new: the snapshot's pages and tokens,
  the cart / checkout / account routes, sitemaps, structured data, Yoast robots).
  Not done yet: sending the forms (Q-12, Q-43); the reCAPTCHA badge; the affiliate area itself (6a);
  `/protocol-builder/` (6c, Q-15). `/calculator/` was added on 6 Nov 2026 (see Phase 6).
- [x] **3h cart, checkout and account UI** (5 Nov 2026): `/cart/` (checkout steps + WooCommerce's empty
  cart), `/my-account/` (login | registration with Woodmart's switch, the password eye button),
  `/my-account/lost-password/` (+ `?reset-link-sent=true`), `/checkout/order-received/(<n>/)` and
  `/checkout/order-pay/<n>/` ("invalid order"), as live shows them to a visitor with an empty cart who is
  not logged in: WooCommerce's markup as components (`src/components/woocommerce/`), the theme's rules
  rewritten in `src/styles/woocommerce.css`. `src/proxy.ts` answers the other addresses as live:
  `/checkout/` and `/checkout/order-pay/` → 302 `/cart/`, every account address (`/my-account/orders/`,
  `/my-account/edit-address/billing/` …) → the login page, `delete-` / `set-default-payment-method` → 302,
  unknown ones → 404 (checked against live on 5 Nov 2026).
  **Measured result** (production build): style by style (title band and content) the cart, account,
  lost-password, "email sent", "thank you" and "invalid order" pages match live at 1440, 768 and 390px;
  the Register / Login switch and the password button behave as live (measured).
  Not done yet (Phase 5): the cart itself, orders, accounts, logging in; WooCommerce's order-attribution
  fields.
- [x] **Gaps found on 6 Nov 2026** (reported by the owner's side, each measured on live and rebuilt):
  * The searches' **compound-name note** ("GLP-3 RTA: Known as retatrutide, … →", the owner's inline
    script): in the header search, the mobile menu's search and the search results pages, with the same
    matching, links, × and fade (`src/components/layout/search/AliasNotice.tsx`, data
    `src/lib/search/aliases.ts`). The script also answers Q-35: these 3 names are the whole list. The
    searches now translate shortened names as live does ("reta", "tirz", "semag"; not "ret" or "sema"):
    product search results identical to live for 6 of 6 tested texts, the site search for "tirz" too
    ("reta" and "semag" add 1–3 pages whose stored text isn't public, as in 3f). On the site search the
    note sits inside the post grid and is stretched to the row's height, as live (copied, Q-14).
  * The **mobile menu's search** had no suggestions: it now opens Woodmart's dropdown under the box (the
    same suggestions as the header search, the note, "View all results", a × to clear), measured at
    390px. **"View all results"** was missing in the header search too (3b). Suggestion prices no longer
    wrap (the shop's card rule made the amount a block; also in the header search since 3b).
  * The homepage's **"Get 5% off your first order" popup** (Elementor #5869: opens when the visitor
    scrolls down, at most 5 times, counted in Elementor's own storage key) and its **sign-up form**
    (#6534, opened by "Claim My 5%"; name, e-mail, country code, WhatsApp number; sending held back,
    Q-12): their Elementor documents in Elementor's popup frame (`ElementorPopup.tsx`,
    `scripts/audit/export_popups.py`); same size and place as live at 1440 and 390px, the popups'
    pixels 0.00–0.02% apart, same closing and scroll-lock behaviour.
  * On the live site the age gate and these popups are on the **homepage only** (no other page prints
    them); the rebuild showed the age gate everywhere. It now follows live (Q-45).
  * The **Tawk.to chat** stays production-only; `ENABLE_LIVE_CHAT=true` shows it on a local or staging
    site (analytics stay off).
  * **Owner's decision (6 Nov 2026), a change from live: popup order.** On live the 5% popup opens on
    the first scroll, even on top of the age gate. Now the age gate comes first; the 5% popup doesn't
    open while it is waiting or open, and opens 3 seconds after "I'm 21+" (`ageGate.offerDelayAfterConfirmMs`
    in `src/content/site-chrome.ts`; state in `src/lib/elementor/age-gate-state.ts`). "Take me back"
    opens nothing. When the age gate doesn't open (already shown its 3 times) the 5% popup keeps its live
    trigger (scrolling down); its limit of 5 times is unchanged. Tested in 4 cases on the build.
    Also fixed: the 5% popup had a horizontal scrollbar at ~1200px (the theme's
    `.elementor-location-popup { overflow-x: hidden }` was missing; now 640 = 640 as live).
  * Tawk.to checked after "the chat doesn't work": it loads, is "online", sends the owner's automatic
    welcome messages and opens/closes as live (the owner's black button is copied 1:1). A visitor's
    message is answered only by a person in the Tawk dashboard (same account as live); a local test
    chat lands in the same inbox as real customers. Owner's choice: the Tawk property can now be set
    in `.env` (`TAWK_PROPERTY_ID` + `TAWK_WIDGET_ID`, `src/lib/tawk.ts`, 4 unit tests); empty = the
    live chat; one alone or a malformed ID stops the build. Checked with a build using test IDs and one
    without. **Done 6 Nov 2026:** the owner's side created the Tawk test property "Atlas test" (site URL
    https://test.peptidesbali.online, because Tawk refuses localhost; the widget works anywhere) and its two
    IDs are in `.env.local`: the local copy now loads that property (checked: "online", the black button
    shows). Put them in the staging environment later too, never on the live domain. A wrong value stops the build; a running
    server (`next start` reads `.env.local` again) leaves the chat out and logs the message instead of
    breaking its pages (`checkedTawkUrl()` in ThirdPartyScripts.tsx).
- [x] **Owner's decision (12 Nov 2026), a change from live: every page uses the homepage's font format**
  ("Btw fonts for the new site can we follow the same format as the homepage"). On live the pages had
  three looks: the homepage (Anton headings, Inter text), the 52 landing pages and the product
  descriptions (all Urbanist, the legal pages' text Poppins), and /hgh-bali/, /rewards/, the consultation,
  lab results and affiliate pages (Cormorant Garamond headings, Inter or Inter Tight text, Montserrat,
  Roboto in the forms). Now everywhere: headings of 28px and more and every H1 in Anton (H1 600 and
  uppercase, the others 500, letter spacing 1.11px, the gold italic words in Anton italic); all other
  text, smaller headings, FAQ questions, buttons, labels and form fields in Inter, with each page's own
  sizes; Cormorant Garamond only for numbers and accent lines, as the homepage's counters and quotes.
  * Elementor pages and product descriptions: `scripts/audit/homepage_typography.py` rewrote the fonts
    in `public/legacy/elementor/post-*.css` (112 files) and the kit's global fonts
    (`src/styles/legacy/elementor-kit.css`: Anton headings, Inter text, also for widgets added in Sanity).
    `vendor_elementor_css.py` runs it after every copy from live (`--keep-live-fonts` to skip it).
  * Templates: the title band, the shop/search band title, the 404 page, the blog archives, the
    Insights page and posts (`insights.css`), the COA library, the plain-HTML pages (affiliate terms
    and forms) and the owner's tools (Calculator, Protocol Builder).
  * The shop's pages too (the user, 12 Nov 2026: "samakan saja semua pages font seperti font di
    homepage"): the "Shop" / category / product search title and the title band of the cart, checkout
    and account pages (with the checkout steps) are Anton like the homepage's titles; the buttons block
    under "Add to cart" (#701) is Inter like the homepage's buttons.
  * Unchanged, because the homepage shows them this way: the header, menus and footer, and the shop's
    data and forms in Urbanist like the homepage's product cards (product cards, prices, the product
    page's title and buy box, the cart, checkout and account forms and tables).
  * No longer loaded: Inter Tight, Montserrat, Roboto, Poppins 300/400, Cormorant Garamond 700
    (`src/lib/fonts.ts`). Clone visual diffs against live no longer apply to these pages' text.

**Phase 4: content**

**Sanity CRUD + R2 (9 Nov 2026, staging):** owner's brief: every section editable, sections shown in many
places edited once, an editor like Elementor's (heading levels, pictures), pictures in Cloudflare R2.
- [x] Content model like Elementor: page → sections → columns ("slots") → widgets (heading with H1–H6/P/DIV/SPAN
  level, rich text, button, picture, icon box, icon list, FAQ/accordion, HTML widget for the rest). Sections and
  widgets: add, remove, reorder, duplicate, hide. Hidden fields keep Elementor's ids/classes/settings so each
  page's Elementor CSS still applies (`src/sanity/schemas/objects/elementor.ts`, `scripts/sanity/lib/elementor.mjs`).
- [x] Rich text like Elementor's TinyMCE: paragraph / Heading 1–6 / quote, bold, italic, underline, strike,
  code, sup, sub, link, text colour (site palette), lists, pictures, HTML block, boxes
  (`src/sanity/schemas/objects/richText.ts`, converter `scripts/sanity/lib/rich-text.mjs`, renderer
  `src/lib/content/render/rich-text.ts`).
- [x] Shared sections: copies of one section on several pages (6 groups, 29 placements) and block #701 (under
  "Add to cart" on all 182 products) are one `sharedSection` document each; pages keep their own Elementor ids
  ("skin"). Popups #5869/#6534 are `popup` documents. Site settings: top bar, main menu, footer, cookie bar,
  age gate texts.
- [x] Imported to the `staging` dataset (`node scripts/sanity/import-content.mjs --dataset staging`; safe by
  default, `--overwrite` replaces): 75 pages, 7 shared sections, 2 popups, Site settings, 54 post bodies,
  182 products' texts (short description, included supplies, "Also available as", tabs). Sanity's 20-level
  depth limit: boxes inside boxes stop after 3 levels (deeper ones stay HTML).
- [x] Proof: `src/lib/content/render/round-trip.test.ts` (every page, popup, block, post, product text and
  Site settings render back as the live copy; 1,900 widgets editable, 84 kept as HTML widgets);
  `SANITY_VERIFY_DATASET=staging npx vitest run src/lib/content/render/sanity-dataset.test.ts` (the same, read
  back from Sanity: 315 checks); `src/sanity/schemas/schemas.test.ts` (Sanity's own schema check). Visual diff
  of the Sanity build vs live: 126 of 127 captures pass; the failing one (homepage at 768px, 5.9%) is the known
  unstable capture (two captures of the same build differ 4.1%; the old file-based build differs 5.4%).
- [x] The site reads Sanity with `CONTENT_SOURCE=sanity` (`src/lib/content/sanity.ts`, "use cache" +
  tag "sanity", webhook `POST /api/sanity/revalidate`); anything missing falls back to `src/content/`. On this
  computer `.env.production.local` switches production builds to the staging dataset.
- [x] Pictures: R2 field with Upload + Media library in the Studio (`src/sanity/components/R2ImageInput.tsx`),
  `POST /api/media/upload` / `GET /api/media/list` (Studio editors only, checked with Sanity),
  `scripts/media/copy-uploads-to-r2.mjs` (3,216 files, same paths), `NEXT_PUBLIC_MEDIA_BASE_URL` switch +
  301 from `/wp-content/uploads/`. Done 9 Nov 2026: 3,215 of 3,216 pictures copied to bucket `peptides-bali-storage`
  (the missing one is already 404 on live) and the site shows them from R2. Before launch: a custom domain
  instead of the r2.dev address (`docs/setup/r2.md`, Status).
- [ ] Owner review of the Studio on staging, then the same import into `production` and `CONTENT_SOURCE=sanity`
  on Vercel; the Sanity webhook (`docs/setup/sanity.md` §8).
- [ ] Still from the WordPress copy: post titles/dates/categories/SEO, product SEO (names, variations,
  prices and stock are in the store admin, see below; pictures come from Sanity once chosen there), the
  pages' search text (`src/content/search/pages.json`), the blog and shop archives' texts.
- [x] The site search (`/?s=…`) reads products' short descriptions and descriptions and posts' bodies as
  their pages show them, from Sanity when the site reads Sanity (9 Nov 2026,
  `src/lib/search/product-texts.ts`, `src/lib/catalog/product-content.ts` `searchTextsFor`); products
  and posts are rebuilt on each search, so an edit or a new admin product is found in the next one.
  One cached query, which already leaves out the Elementor blocks embedded in the descriptions, as
  WordPress's search does (4.4 MB, about 3 s instead of 12 MB and 6–10 s; 1.6 MB kept in the cache). `site-search-sanity.test.ts`: the converted documents give the
  same results as the copy (the live samples and 7 more queries), edits and removals show; the
  dataset check compares the search texts of all 182 staging products with the copy.

- [x] Products (182), variations (319), prices, stock into PostgreSQL (9 Nov 2026,
  `node scripts/import/import-catalog.mjs`, migration 0008) and the store admin **/admin/products/**:
  create (simple / variable with attributes and generated variations), edit prices, sale prices with dates,
  stock (status or counted, backorders; every count change in `inventory_movements`), categories, status;
  archive / restore; delete for good only when archived and never ordered. The shop, product pages, cart,
  checkout, search and quick view read it (`src/lib/catalog/store.ts` + `build.ts`; `build.test.ts` proves
  the catalogue from the imported rows equals the live snapshot exactly); the proxy learns new and archived
  addresses from `/api/catalog/index/`. Products are created and deleted only in the admin, which keeps
  their Sanity document in step (the Studio can't create/delete products). Tested end to end on the local
  database (create → sale price → archive → delete). Guide: `docs/content/store-admin-products.md`.
  Sale prices show WooCommerce's struck-through regular price (cards, product page, variation price, quick
  view, search suggestions, cart top-up; Woodmart / owner CSS values). Still open: the "Sale" / "-20%" picture
  label (the live theme's label settings can't be seen while nothing is on sale).
- [x] Categories (25) and shop-wide attributes (4: MG, Pen Type, IU, Storage; Purity and Primary Research
  Areas aren't used by variations, so not imported) as editable records (9 Nov 2026, migration 0009,
  `product_categories` / `product_attributes`, imported into Neon and `.data/pglite`): **/admin/categories/**
  (create under a parent, rename, move, heading, carousel position, picture from the R2 media library or
  uploaded, SEO title / description with live's automatic pattern; the address is fixed once made; delete
  only when no product, coupon or sub-category uses it) and **/admin/attributes/** (name, pills or
  dropdown, values renamed / reordered / added; removed only when unused). The catalogue renames and moves
  categories on every card, breadcrumb and product detail, counts products per category from the
  published products, and shows the attributes' current names, display and order; `build.test.ts` proves
  the imported rows still give the live snapshot exactly. Category pages and the shop's following pages
  are now `ensureStatic = "navigation"`, with ?orderby= / ?per_page= moved into the address by the proxy
  (`…/view/…`), so a category or page made after the build gets its complete page on the first visit
  (before: Next 16's App Shell, "Page Not Found" and noindex, for good). Also fixed: a product-only
  attribute typed in the product form saved its variations under other keys than the form used.
  Product-only attributes are now `attribute_<slug>`. Guide: `docs/content/store-admin-products.md`.
- [ ] Posts (54), blog categories, author (public display name, R-12)
- [x] Pages as page-builder documents; legal pages (75 in staging, see above)
- [ ] Yoast SEO → Sanity `seo` fields; custom JSON-LD rebuilt. Done ahead from the live data (5 Nov 2026,
  no account needed): every page prints the live site's structured data (Yoast's graph and the owner's
  Product / FAQPage / … blocks) from a snapshot (`scripts/audit/export_jsonld.py` →
  `src/content/seo/jsonld.json`, `src/components/seo/JsonLd.tsx`), with this site's domain in the
  addresses; the blog author's e-mail name is replaced by the neutral name (R-12). Left for Sanity:
  generating them from the content instead of the snapshot.
- [ ] XML sitemaps. Done ahead from the live data (5 Nov 2026): `/sitemap_index.xml` and its five parts
  (post, page, product, category, product_cat) with Yoast's addresses, dates and pictures
  (`scripts/audit/export_sitemaps.py` → `src/content/seo/sitemaps.json`, `src/lib/seo/sitemaps.ts`;
  XML, `X-Robots-Tag: noindex, follow` as live). Left for Sanity: dates from the content.
- [ ] Redirects imported; `sitemap.xml` (same sub-sitemap URLs as Yoast, or a redirect from them); `robots.txt`.
  Besides the Redirection plugin's rules (A7), WordPress itself answers some unknown addresses with a 301 to
  the page whose slug ends the address (`/my-account/rewards/` → `/rewards/`, `/my-account/affiliate-area/` →
  `/affiliate-area/`, seen 5 Nov 2026); decide which of these guesses to keep as fixed redirects.
  **Done for the Redirection plugin (6 Nov 2026):** its 196 rules (`src/content/seo/redirects.json`: 195 × 301,
  one 404) are answered by `next.config.ts` `redirects()` (`src/lib/seo/redirects.ts`, 3 unit tests), before any
  page, so also for `/product/` addresses. Compared with live for all 196: identical status and target; all
  161 targets open. Like live, letter case is ignored. Two small differences, documented in the file: an
  address without the final "/" gets Next.js's usual 308 first, and a query is kept (on live WordPress itself
  answers those, and drops it for products). Still open: the WordPress slug guesses above, and old product
  slugs WordPress remembers outside the plugin (`_wp_old_slug`, not readable from the REST API).
  Found while checking: unknown product and category addresses, and shop/category pages past the last page,
  answered **200** with the 404 page ("soft 404", since Phase 3b/3c). `src/proxy.ts` now covers `/product/`,
  `/product-category/` and `/shop/` (`shopAddress()`, data `src/lib/catalog/archive-index.ts`) and answers as
  live: real 404s, `…/page/1/` and `/page/01/` → 301 to the first page, `/page/02/` → 301 `/page/2/`, page 0 =
  the first page, `?per_page=` respected, letter case ignored. 30 of 30 edge addresses identical to live;
  URL parity unchanged (356/357).
- [ ] URL-parity test green for all 357 URLs

**Phase 5: commerce** (started 6 Nov 2026; database: Neon, waiting for the owner's `DATABASE_URL`)
- [ ] Auth + roles + legacy password check. **Started:** Better Auth 1.7.12 (`src/lib/auth/`: e-mail +
  password and WordPress-style usernames, as WooCommerce's "Username or email address"; endpoints under
  `/api/auth/`, a clear 503 until the database is set; 3 tests with an in-memory database). **Wired (7 Nov
  2026):** log in on `/my-account/`, in the header dropdown and on the checkout; register (e-mail only, the
  user name made up as WooCommerce does); log out with the session's token, see My Account below. Since
  done: roles (customer / shop_manager / administrator, see "Admin order screens" below), the "set your
  password" and lost-password e-mails (saved locally until Q-08), a limit on login attempts. Still to do:
  the WordPress password check for migrated customers. **Built (9 Nov 2026), waiting for the hashes:** the
  check follows WordPress 7.1.4's wp_check_password ("$wp" bcrypt with the SHA-384 pre-hash, phpass "$P$",
  plain bcrypt, old MD5; tested against hashes PHP made the WordPress way, `src/lib/auth/fixtures/`). At the
  first login with the old password it becomes the site's own password and the old hash is deleted;
  "Lost your password?" deletes it too. Tested end to end with a made-up imported account
  (`scripts/dev/seed-legacy-login-test.mjs`). The hashes aren't in any API, so they need a database export of
  the users table (columns ID and user_pass) → `node scripts/import/import-wordpress-passwords.mjs <file>`.
  The owner doesn't hold the hosting login (9 Nov 2026): whoever manages the hosting can export those two
  columns; otherwise customers use "Lost your password?" (which needs the e-mail provider, Q-08).
- [x] Database tables for accounts and commerce, as one migration: `src/db/migrations/0001_commerce_and_auth.sql`
  (Better Auth's tables generated from `src/lib/auth/options.ts`; `src/db/schema/commerce.ts`: addresses,
  carts, orders with delivery slot / map pin / attribution, order lines and fee lines, coupons and their
  use, payments, webhook events, refunds). Applied with `npm run db:migrate` once Neon exists.
- [ ] Product sync and store admin
- [ ] Cart, shipping, coupons, checkout (offline methods). **The rules are done** as tested code
  (`src/lib/commerce/`, 9 tests), with the live values: shipping Rp 100,000 / free from Rp 2,500,000 after
  coupons, Indonesia only; card +5% and only from Rp 2,000,000; COD only from Rp 2,500,000, with the live
  lock texts; coupons as WooCommerce counts them (not sequential, rounding, individual use, exclusions,
  limits, minimum / maximum spend). Cart contents → priced lines from the catalogue on the server
  (`cart-lines.ts`, 5 tests: WooCommerce's add-to-cart checks and texts; gone products removed with a
  notice, out-of-stock ones kept but blocking; parent categories counted for coupons). Still to do: the cart
  and checkout pages and Server Actions on top. **References captured 6 Nov 2026:** the live cart and
  checkout with products (a small and a large guest cart, 5 widths each, plus their HTML:
  `docs/audit/visual-reference/screenshots/{cart,checkout}-{small,large}/` and `…/markup/`). They showed two
  rules now in `totals.ts`: free shipping replaces the Rp 100,000 option (Q-51), and the first open payment
  method is preselected (on the checkout only: the cart page shows no card fee).
  **Cart page done (6 Nov 2026):** `/cart/` shows the visitor's cart as on live (cart table, "Top up your
  supplies", totals with "Change address", Proceed to checkout), 15 of 15 captures identical to live
  (empty, small and large cart × 5 widths, 0.12–0.94%, 0px). Quantity (saved by itself, as live), remove
  with "Undo?", top-up "+ Add", "Change address" ("Shipping costs updated.") work; tested end to end. "Add to
  cart" works on product pages and in the quick view; the header and floating cart counts follow the cart.
  Until Neon is set up the cart is kept in a cookie (`src/lib/commerce/cart-cookie.ts`: product, variation,
  quantity, coupons, destination; prices always from the server), 48 hours like a WooCommerce guest cart.
  Theme CSS: `src/styles/cart.css`; the owner's: `cart-owner.css` (snippets 10, 11) and
  `usd-prices-owner.css` (snippet 09, moved out of product-owner.css).
  **Side cart done (6 Nov 2026, captured on live with one more guest cart, user's OK):** after "Add to cart"
  live shows the button's spinner, then opens the side cart; the count reads "1 item". The rebuild does the
  same (`src/components/layout/CartDrawer.tsx`, data from the Server Action `getMiniCart`; WooCommerce's
  mini-cart markup; styles `src/styles/mini-cart.css`). The drawer area matches live: 0.15% (1440) and
  0.17% (1280); on tablets and phones the side panels are 300px wide as on live (fixed in site-chrome.css).
  **"Add to cart" everywhere (6 Nov 2026):** product cards (shop, categories, homepage, related, recently
  viewed: a simple product, or the variation picked in the card, is added and the side cart opens; "Select
  options" and out-of-stock products open the product page) and the search suggestions (the owner's "search
  buy" texts from the live script: "Adding…", "Added ✓", "Added to cart" in green, "Unable to add this
  option to the cart.", back to "Add to cart" after 1.4 s). Tested end to end; shop, category and search
  pages still identical to live (20 of 20). Not seen on live: whether the side cart opens over the search
  after adding there (live fires WooCommerce's "added_to_cart"); here it stays closed.
  **Checkout page done (6 Nov 2026):** `/checkout/` shows the visitor's cart as on live once the cart cookie
  holds items (an empty cart still gets 302 → `/cart/`, `src/proxy.ts`; a cart whose products are all gone
  is sent back by the page): "Returning customer?" with the login form, the billing details with the owner's
  "Delivery location" box, WhatsApp country code (245 codes), delivery slot (today + 7 days, UTC as
  WordPress, Q-50) and instructions, "Ship to a different address?", "Your order" with the coupon box, the 8
  payment methods (card / COD locks and the card's 5% fee message, the fee row and total following the
  chosen method), the terms checkbox, "Place order" and the WhatsApp order link. 10 of 10 captures pass
  (small and large cart × 5 widths, 0.49–1.54%, 0px; what is left is mostly the Google map, Q-33).
  "Place order" checks everything again on the server with the live texts and order
  (`src/lib/commerce/checkout-validation.ts`, 5 tests; Server Action `src/app/(store)/checkout/actions.ts`)
  and scrolls to the messages as WooCommerce does. Tested end to end: empty form (10 messages), a complete
  order, "Ship to a different address?", the coupon box (empty code, unknown code), the login toggle, the
  payment switch on a large cart (card +Rp140,000 → Wise → COD → card). Found on the way: WPCode prints the
  owner's CSS snippets from the highest number down (… 17 → 13, 11, 10, 09), so `checkout-owner.css` and
  `cart-owner.css` now follow that order, and both pages import the theme's CSS before the owner's.
  Theme rules added from the live theme files (`woo-page-checkout-el-payment-methods`, `woo-lib-select2`,
  `woo-mod-shop-table`, `base.css`'s notices and placeholders): `src/styles/checkout.css`, `woocommerce.css`.
  **Not working yet, said so on the page and not faked:** saving the order (valid orders get "Orders can't
  be placed on this copy of the shop yet: … the shop's database, which isn't connected"), logging in (same
  kind of message), coupons (none imported: every code gets WooCommerce's "does not exist"), the map (needs
  a Google Maps key for the new site, Q-33: the typed address is kept), "Create an account?".
  **Orders saved (7 Nov 2026):** "Place order" now saves the order (`src/lib/commerce/orders.ts`: lines with
  their options, the card fee line, shipping, addresses, delivery slot and address, note; the WhatsApp
  number complete as the owner's snippet 8811 does, "+62…"; the status per payment method as the owner's
  gateway snippets set it: Card / Revolut / Wise "On hold", IDR Account "Pending payment", COD
  "Processing"), empties the cart and goes on as live: IDR Account to WhatsApp with "Hi, I've placed order
  #…", the others to `/checkout/order-received/<n>/?key=wc_order_…`, WooCommerce 11.2.1's thank-you page
  (overview, the gateway's instructions read in wp-admin, order details, addresses; theme CSS
  woo-thank-you-page). "Create an account?" creates the account (and its "set your password" e-mail) and
  logs in; a logged-in customer gets the form filled from the saved billing address, no login toggle and
  no "Create an account?", and the address is kept after the order. The online providers (NOWPayments,
  PayRam, BitBridge Pay) say they aren't connected yet (Q-01) and save nothing. Tested end to end on the
  local database: a guest order (Wise), an order creating an account (Revolut), My Account → Orders / View
  order. No live order page could be compared (placing an order on the live shop isn't allowed), so the
  thank-you and order pages use WooCommerce's own templates and the theme's CSS files. Migration 0003 adds
  `orders.order_key` and the lines' options and product address.
  **"Available on backorder" done (7 Nov 2026):** which products and variations are on backorder comes
  from WooCommerce's public Store API (`python scripts/audit/export_stock_status.py` →
  `src/content/stock-status.json`, 28 of 501 today, all set to "notify"): WooCommerce's own line in the cart
  ("Available on backorder" under the options), the owner's green badge in the side cart (PHP snippet
  10824, its CSS in `src/styles/backorder-owner.css`) and the availability on the product page and for a
  chosen variation, as live (checked on /product/eloralintide-5mg/). Re-run the export when the owner
  changes stock.
  **Pay / Cancel and the order-pay page (7 Nov 2026):** an order still to pay ("Pending payment" or
  "Failed", e.g. IDR Account) shows Pay / View / Cancel in My Account → Orders, as WooCommerce does. Pay
  opens `/checkout/order-pay/<n>/?pay_for_order=true&key=…` (WooCommerce's form-pay: lines, totals, the
  payment methods, terms, "Pay for order"; the key, owner and status are checked again, with WooCommerce's
  refusals) and goes on as at checkout (Wise → "On hold" and the thank-you page, IDR Account → WhatsApp).
  Cancel is WooCommerce's link `/cart/?cancel_order=true&order=…&order_id=…&_wpnonce=…` (the token tied to
  the order and the session): "Your order was cancelled." and the note "Order cancelled by customer. Order
  status changed from Pending payment to Cancelled." Status changes are noted as
  `WC_Order::status_transition` does and set the paid / completed dates. Tested end to end on the local
  database. Still to do: coupons in the database (needs the coupon import), the other order e-mails
  (new order, processing, completed…: they need the e-mail provider, Q-08).
- [ ] E-mails, My Account, admin orders. **My Account done (7 Nov 2026):** every page of a logged-in
  customer as live shows it (read on live with the owner's own session, personal data left out): the menu
  Dashboard / Orders / Downloads / Addresses / Account details / the owner's "Research tools" / Logout, the
  dashboard and its link tiles, orders (the customer's own, 10 a page, "View"; the empty state and
  WooCommerce 11's "Confirm email address" note), view order ("Invalid order." for anyone else's), downloads,
  addresses and the billing / shipping forms (the owner's fields), account details with password change,
  payment methods, Research tools (the plugin's teaser for accounts without a paid order, its CSS vendored
  in `public/legacy/vendor/atlas-research-planner/`), logout ("Are you sure you want to log out?" without
  the token), the header's account menu. Texts and rules from WooCommerce 11.2.1 and WordPress 7.1.4's own
  source (login errors, registration, `save_account_details`, `save_address`, address format), not from
  memory. Measured against live element by element at 1440, 768 and 390px: every measured box at Δ 0px
  (dashboard, menu, tiles, forms, notices, addresses, Research tools, header dropdown; the live pages sit
  32px lower only because the owner's admin bar shows). Tested end to end on the local database: register,
  log out, the 6 login errors, log in, address errors and save, account-details errors, wrong current
  password, password change and back, every endpoint. Code: `src/components/woocommerce/account/`, routes
  `src/app/(store)/my-account/`, actions `src/app/(store)/my-account/actions.ts`, rules
  `src/lib/account/` (7 tests), styles `src/styles/account.css`. Found on the way: the header's account
  dropdowns (logged in and out) opened 8px too low (their anchor box was the header's height, live's is
  the 40px icon), fixed. **The local database:** while `DATABASE_URL` is empty the site uses a local
  Postgres in `.data/pglite` (PGlite, development only; never in production) so accounts can be tried
  before Neon; `npm run db:migrate` creates its tables, `node scripts/dev/seed-test-customer.mjs` a test
  customer. **E-mails and passwords (7 Nov 2026):** WooCommerce's "Your Atlas Longevity account has been
  created!" (set-password link) and "Password Reset Request" e-mails with its texts, the lost-password
  form ("Enter a username or email address.", "Invalid username or email.") and the reset form ("Enter a
  new password below.", "Passwords do not match.", "This key is invalid or has already been used…", then
  "Your password has been reset successfully."); links /my-account/lost-password/?key=…&id=…, valid a day.
  With no e-mail provider yet (Q-08) every e-mail is saved as a text file in `.data/mail/` on this
  computer (`src/lib/email/`), and the pages say so; a live server sends nothing and says it couldn't. A
  limit on wrong passwords was added (5 in 15 minutes per account and address; live has none). Tested end
  to end. **Not working yet, said so on the page:** sending e-mails for real (Q-08), the "Confirm email
  address" link and the Research tools claim link (they need e-mail too), the Research tools themselves
  (6c). **Done since (7 Nov 2026):** WooCommerce's temporary-password reminder ("Your account is using a
  temporary password…" with "Resend", on the dashboard and Account details, until a password is set;
  "We have emailed you a new link to change your password."), "Order updates" on View order (the notes
  sent to the customer, WooCommerce's date format), the "Customer note" e-mail. **Admin order screens
  (7 Nov 2026):** `/admin/orders/` (every order, newest first, 20 a page, the status filter with counts;
  columns Order / Date / Status / Billing / Ship to / Total) and `/admin/orders/<n>/` (billing and shipping
  with e-mail and phone, the owner's delivery details and delivery location with the Google Maps link as
  snippets 6140 / 6865 show them, lines and totals, the customer's note, the status form, order notes with
  "Private note" / "Note to customer"). A plain staff layout, not wp-admin's look (wp-admin isn't copied),
  never indexed. Only accounts with the `administrator` or `shop_manager` role get in; customers get
  "Sorry, you are not allowed to access this page." Roles: migration 0004 (`user.role`, default
  `customer`), set with `node scripts/dev/set-role.mjs <e-mail> administrator` (site stopped when the
  database is the local one), never from a form. Every action checks the role again. Tested end to end.
- [ ] Customers, orders and coupons from WooCommerce. **Imported (7 Nov 2026)** into the local database (Neon
  gets the same command once it exists): 45 WordPress accounts (6 administrators, 32 customers, 7
  subscribers; WooCommerce's temporary-password reminder kept for 25), 28 saved addresses, 252 orders
  (numbers 7328–12778, so new orders count on from #12779) with 572 lines and their options, 155 fee lines
  (the old 5% Wise / Revolut / Crypto discounts are negative), 82 coupon lines, 1,454 order notes, the
  owner's delivery slot, map pin, WhatsApp code and WooCommerce's attribution, 25 provider payment IDs
  (NOWPayments, BitBridge), and the 10 coupons with WooCommerce's usage counters. Every reconciliation line
  matches live ([wordpress-import-report.md](wordpress-import-report.md): counts and totals per status, to the
  rupiah). How: `scripts/import/export-wordpress.browser.js` runs in the owner's signed-in wp-admin tab and
  only reads the REST API (allow-listed fields); the file goes outside the project folder;
  `node scripts/import/import-wordpress.mjs <file> --report …` writes it in one transaction, finds every row
  again by its WordPress ID (safe to run again before launch to bring in new orders) and prints counts only
  (12 tests on an in-memory database with every migration). Left out on purpose: 74 orders in the trash, 17
  comments held for moderation (none approved: nothing is public), IP addresses (only a keyed hash).
  **Not available through any API:** WordPress password hashes, so imported customers set a new password with
  "Lost your password?" (Better Auth then creates the password; the WordPress hash check of Q-07 needs a
  database export); Atlas Research Planner's saved plans and tracker (6c); Atlas Email Automations' contacts.
  Found on the way: prices below zero lost their minus sign (`CartAmount`), now "-Rp…" as `wc_price`, and
  the order "Discount:" row is WooCommerce's "-" + price. **Coupons work (7 Nov 2026):** the 10 live
  coupons (all published, none expired or used up) are read from the database
  (`src/lib/commerce/coupon-store.ts`). The checkout's box is the owner's snippet 6479 ("Have a coupon or
  Affiliate code?", slide 200 ms, "Applying...", Enter applies, its texts "Please enter a coupon or affiliate
  code.", "This coupon is already applied.", "Coupon applied successfully.") on top of WooCommerce 11.2.1's
  apply_coupon, whose own notice "Coupon code applied successfully." then shows at the top of the form, as
  update_checkout does on live. The totals get WooCommerce's "Coupon: <code> -Rp… [Remove]" rows on the cart
  and the checkout (the theme's × icon; measured against live with a guest cart and the public 5% welcome
  coupon: same sizes, fonts, colours and position at 1440 and 390). "[Remove]" works with and without the
  page's script ("Coupon has been removed."). A cart change that makes a coupon invalid (e.g. under its
  minimum spend) drops it with "Sorry, it seems the coupon "…" is invalid - it has now been removed from your
  order." At "Place order" the coupons are checked again (validity, "Allowed emails", a guest's
  once-per-customer limit by billing e-mail), the discount goes on the order and its lines, a
  coupon_redemptions row is written and the coupon's usage_count / used_by go up; cancelling or failing the
  order gives the use back, restoring it counts it again (wc_update_coupon_usage_counts; migration 0006 adds
  orders.coupon_usage_recorded). All texts are WooCommerce 11.2.1's (they mention the code now, e.g. "The
  minimum spend for coupon "…" is Rp800,000.00."). A coupon's "free shipping" doesn't open free shipping:
  live's free-shipping method is set to "minimum amount" only. Tested end to end with two local test
  coupons (`node scripts/dev/seed-test-coupons.mjs`, `--remove` takes them out) and the imported welcome
  coupon; 5 database tests. Q-47 still stands: the free-order coupon works here as on live.
- [x] **Data check against live (7 Nov 2026):** every data source compared with live by counts, field by field
  where it matters: [data-inventory.md](data-inventory.md). Found and fixed: one order placed after the first
  export (imported again: 253 of 253, every reconciliation line "ok"); 6 GLP-3 RTA Pen variations back in
  stock and 17 products edited on live since the catalogue export (the three catalogue exports run again).
  Exported for later: the Research Planner's 424 product mappings, 147 store protocols and settings
  (`docs/audit/data/planner/`, for 6c). Nothing to take over: AffiliateWP payouts / creatives, saved
  protocols, access grants, reviews, public comments; the 45 e-mail contacts are the orders' buyers (no
  marketing consent). Still on live: the 3,211 images (507 MB) until the media move; one image is already
  missing on live (`/tirzepatide-bali/`). URL parity: 356 of 357 (`/protocol-builder/`, 6c). Found by the
  full visual run: the admin screens' Tailwind classes (`mt-3`, `p-6`, `text-white`, …) had become real
  utilities that also hit the owner's copied HTML (`/peptide-consultation-bali/` grew 12px from a
  `<p class="mt-3">`). The 9 new names are now in globals.css's `[data-legacy-html]` rule, and
  `check_tailwind_collisions.py` reads and prints escaped names (`.text-\[11px\]`). Run it after every build
  that adds Tailwind classes.
- [ ] Online gateways in sandbox, with webhook signature + idempotency tests

**Phase 6: affiliate, rewards, tools**
- [ ] Referral handling in `src/proxy.ts` + visits + attribution
- [ ] Registration / approval / dashboard / payouts
- [ ] History import + **reconciliation report signed off**. **Imported (7 Nov 2026)**, waiting for the
  owner's sign-off: AffiliateWP holds very little, 1 affiliate (active; its WordPress user was deleted, so it
  is kept without an account and nobody can log in to it on live either), 1 referral (rejected, Rp 140,250;
  its order was deleted from WooCommerce, so only the reference is kept), 1 visit (converted), 1 AffiliateWP
  customer, no payouts, no creatives, no campaigns. Tables `affiliates`, `affiliate_settings` (the 27 settings
  read in wp-admin), `affiliate_customers`, `affiliate_visits` (IP as a keyed hash), `affiliate_referrals`,
  `affiliate_commissions` (the ledger: rejected = earn + reversal), `affiliate_payouts` and
  `affiliate_payout_items` (migration 0005, `src/db/schema/affiliate.ts`). Reconciliation:
  [wordpress-import-report.md](wordpress-import-report.md), every line matches (AffiliateWP's own earnings
  counters too). No affiliate coupon is linked to an affiliate on live (no `affwp_discount_affiliate` meta).
- [ ] Rewards ledger + import + reconciliation. **Nothing to import (checked 7 Nov 2026):** RewardsWP Pro is
  switched off, so its data has no API; 5 orders carry its `_rewardswp_first_order_points_skipped` mark (it
  ran for a while) and the refer-a-friend coupon came over with the coupons. Whatever points it saved can only
  come from a database export, and only if the owner keeps the programme (Q-27).
- [ ] Protocol Builder / Calculator / Tracker with golden tests.
  `/calculator/` is live ahead (6 Nov 2026, the owner asked for it): the page is the live one (a plain
  page, exported like 3g) and the calculator is the owner's own plugin script (Atlas Research Planner,
  GPL-2.0-or-later), copied to `public/legacy/vendor/atlas-research-planner/` with its stylesheet and
  run as on live, from the same configuration (`src/components/elementor/PluginScripts.tsx`). It only
  does arithmetic on the visitor's values and needs no server (its inventory link is off). Checked: 8 of 8
  input sets (vial and pen, mg / mcg, U-100 / U-40, all syringe sizes, an empty and an invalid field)
  give exactly the same results as live; the page passes the visual diff at 5 widths (0.13–0.39%, 0px);
  opening it from the menu without a reload works. Still for 6c: porting it to this project's own code
  (the plugin's source map is public, which helps) with those cases as golden tests, and the PRD's
  compliance review of the tool (§7.2) before launch.

**Phases 7–8: QA and cutover**: see PRD §15 and §13 Phase 8.

## 4. Open questions <a id="open-questions"></a>

Answering the ones marked **🔴** first unblocks the most work.

| # | Question | Blocks |
|---|---|---|
| 🔴 Q-01 | Which payment providers will the new site use? Can Tagada (card / Apple Pay / Google Pay), PayRam and NOWPayments be integrated without WooCommerce (do they offer a server API and signed webhooks)? **Today (6 Nov 2026, [backend-settings](../audit/backend-settings.md) §3): card by payment link (`atlas_card`, +5%), NOWPayments, PayRam, BitBridge Pay (card, not in the PRD), Revolut / Wise / IDR account (manual), COD in Bali; Tagada is off. Still open: which ones the new site uses and their APIs.** | Phase 5 online payments |
| 🔴 Q-02 | Has each provider approved this catalogue (research peptides, HGH, HCG, testosterone)? | Launch |
| ✅ Q-03 | Exact free-shipping rule (minimum amount? bundle? coupon?) and the full list of shipping zones **Answered 6 Nov 2026 ([backend-settings](../audit/backend-settings.md) §2): Indonesia only; flat rate Rp 100,000; free shipping from Rp 2,500,000 (after coupons).** | — |
| ✅ Q-04 | Are stock quantities managed? Which products may be backordered? **Answered 6 Nov 2026 ([backend-settings](../audit/backend-settings.md) §5): no quantities are tracked; in stock / on backorder / out of stock are set by hand.** | — |
| 🔴 Q-05 | Can we get a staging copy (or a test admin on a backup) for logged-in and checkout captures and safe referral tests? **Partly done 6 Nov 2026:** the cart and checkout with products were captured on live with two guest carts (owner's side's OK; `docs/audit/visual-reference/`). A staging copy is still needed for logged-in pages, a placed order and referral tests. | Phase 3h, 6a |
| ✅ Q-06 | Which order statuses (incl. custom crypto ones) are used? **Answered 6 Nov 2026 ([backend-settings](../audit/backend-settings.md) §6): only WooCommerce's own statuses; 248 orders so far.** | — |
| Q-07 | Migrate WordPress password hashes (recommended) or ask everyone to reset? | Auth |
| Q-08 | Which e-mail provider and sender domain? Keep WooCommerce e-mail wording? **Today ([backend-settings](../audit/backend-settings.md) §8): WP Mail SMTP through the hosting's mail server, from name "Peptides Bali", plus the owner's Atlas Email Automations (5 flows). Still open: the provider for the new site.** | E-mails |
| Q-09 | Translation: keep the GTranslate client-side widget as today (recommended for a "no change" migration), or build real Indonesian pages later? | Header |
| Q-10 | Age gate: show up to 3 times (current Elementor setting) or remember for 30 days (current popup text)? | Layout |
| Q-11 | Keep the same GTM / GA4 / Clarity / Tawk.to / Trustindex IDs? Who owns the GTM container (it has e-commerce events to rebuild)? | Analytics |
| ✅ Q-12 | Where do the Elementor form submissions go (home, contact, consultation, partner application)? **Answered 6 Nov 2026 ([backend-settings](../audit/backend-settings.md) §11): all 4 forms send an e-mail to the owner and are kept in Elementor's submissions list.** | — |
| Q-13 | USD hint: fixed rate (about 16,500) or a live rate? Who updates it? **Today: fixed Rp 16,500 per USD in a snippet (also used for fees) ([backend-settings](../audit/backend-settings.md) §4).** | Product UI |
| Q-14 | Existing bugs: copy them for a 1:1 match or fix them? Raw `[rank_math_rich_snippet]` text on 37 products; "WHATSAAP" typo in the marquee; broken "PUBLISHED COAS" link; e-mail shown as the blog author name; 2 duplicate GHK-Cu pages; two homepage blocks shown twice ("Collections", "Premium Products. Professional Service.") | Content |
| 🔴 Q-15 | Can you share the source of the custom plugins (Atlas Research Planner, Atlas Emails, Atlas card + IDR gateways, the USD and schema snippets)? The Protocol Builder and Calculator do dosing arithmetic, so the PRD requires a compliance review before they're rebuilt. | Phase 6c |
| Q-16 | Is WooCommerce POS (in-person sales) used? | Scope |
| Q-17 | Two variations are priced Rp 0 (CJC-1295 with DAC 10 MG; a TB-500 variation): fix, hide or keep? | Import |
| 🔴 Q-18 | The real commission rate (10% or 15%?), and whether the 15%/20% rolling-30-day tiers are live (and on what basis) **Settings (6 Nov 2026, [backend-settings](../audit/backend-settings.md) §9): 10% of the product amount, no tier setting switched on. To confirm whether the 15%/20% tiers in the terms are applied by hand.** | Phase 6a |
| ✅ Q-19 | Referral cookie duration and credit mode (first or last referrer) **Answered 6 Nov 2026 ([backend-settings](../audit/backend-settings.md) §9): 30 days; the first referrer keeps the credit.** | — |
| Q-20 | Payout method, schedule and minimum **Settings ([backend-settings](../audit/backend-settings.md) §9): no payout service connected, so payouts are done by hand. Schedule and minimum still to confirm.** | Phase 6a |
| Q-21 | When both an affiliate and a rewards "refer a friend" link apply, who gets credit? | 6a/6b |
| Q-22 | Does the Elementor partner application on `/affiliate-program/` create affiliates, or only send an e-mail? Keep both forms? **Answered in part ([backend-settings](../audit/backend-settings.md) §11): it only sends an e-mail, it does not create an affiliate. Still open: keep both forms?** | 6a |
| Q-23 | Any affiliates with custom rates or allowed self-referrals? | 6a |
| ✅ Q-24 | Full plugin list from WP Admin (active + inactive) **Answered 6 Nov 2026 ([backend-settings](../audit/backend-settings.md) §12): 30 plugins, 28 active.** | — |
| ✅ Q-25 | What is AdsAgent used for? **Answered 6 Nov 2026: AdsAgent is no longer installed ([backend-settings](../audit/backend-settings.md) §12).** | — |
| Q-26 | New-order alerts: who uses the WooCommerce mobile app today, and what should replace it? | Admin |
| 🔴 Q-27 | Which plugin runs Rewards (credits, welcome, refer-a-friend)? Can we export balances? **Answered in part ([backend-settings](../audit/backend-settings.md) §10): RewardsWP Pro 1.7.1, installed but switched off. Still open: should rewards exist in the new site, and are there balances to move?** | Phase 6b |
| ✅ Q-28 | **Decided 3 Nov 2026: Option A approved.** Commerce is a custom module in Next.js + PostgreSQL (Drizzle); no Medusa, no headless WooCommerce. | — |
| Q-29 | Have Vercel, Sanity and Neon/Supabase been checked for acceptable-use rules on this product category? | Phase 2 |
| Q-30 | Where should the Git repository live (GitHub private repo?) | Phase 2 |
| Q-31 | Does DNS stay on Cloudflare? (Cloudflare analytics and caching depend on it) | Phase 8 |
| ✅ Q-32 | Checkout delivery slots (snippet 15): fixed time slots, capacity limits, same-day cut-off? **Answered 6 Nov 2026 ([backend-settings](../audit/backend-settings.md) §4): fixed slots 07–09 … 21–23, today + 7 days, no capacity limit, no cut-off.** | — |
| Q-33 | Checkout address map (snippet 16): which maps provider and API key? | Phase 5 |
| Q-34 | The live site's theme icon font (Woodmart) is reused for pixel-identical icons, and many of the theme's CSS rules are rewritten with the same selectors and values (`src/styles/product.css`, `quick-view.css`, and for the Elementor pages `elementor-page.css` and `legacy-content.css`: product categories, buttons, form fields, the FAQ accordion; the accordion's behaviour is rewritten too, `src/lib/elementor/accordion.ts`; for the blog `blog.css`: title band, post cards, single post, share icons, comment form; for the cart, checkout and account pages `woocommerce.css`: checkout steps, empty cart, login / registration, messages). Is the owner's Woodmart licence OK with that for the rebuilt site, or should we switch to look-alike SVG icons and our own CSS? The same question for the Google-reviews widget's icons, copied from Trustindex's CDN (`public/legacy/vendor/cdn.trustindex.io/`). (Elementor's CSS is GPL-3.0, AffiliateWP's form CSS GPL-2.0; PhotoSwipe, Owl Carousel and Swiper are MIT; Font Awesome Free is CC BY / OFL / MIT; so those are fine.) | Phase 3 |
| ✅ Q-35 | **Answered 6 Nov 2026 from the owner's script on the live pages:** exactly 3 names ("semaglutide" → "GLP-1 SMA" from 5 letters, "tirzepatide" → "GLP-2 TRZ" and "retatrutide" → "GLP-3 RTA" from 4), also shortened, with a note each (`src/lib/search/aliases.ts`). | — |
| Q-36 | Cloudflare serves cached copies of shop and category pages that can be a day old (on 4 Nov 2026 the cached `/shop/` still lacked the "Affiliate Registration" footer link). Is that intended? It decides how long price or stock changes take to show. | Phase 8 |
| Q-37 | The sort option labelled "Sort by popularity" really sorts by the owner's custom product order (`orderby=menu_order`). Keep the label as it is (current behaviour, rebuilt as is), or rename it? | Phase 3 |
| Q-38 | On the live site the theme's scripts only start after the visitor's first mouse move, tap or scroll. At that moment the header area becomes 15px shorter, so the whole page jumps up 15px. The rebuild shows the page as it first opens (the state all reference screenshots show) and does not jump. Keep it like this, or copy the jump? | Phase 3 |
| Q-39 | Two small live bugs on product pages that the rebuild does **not** copy (it looks the same): (1) on tablets the "Clear" link sits under the quantity "−" button and cannot be clicked; (2) setting a dropdown back to "Choose an option" leaves the last variation's price at the top (only "Clear" restores the price range). Keep them fixed, or copy them (see Q-14)? | Phase 3 |
| Q-40 | Two homepage quirks that the rebuild **copies** (see Q-14): (1) on desktops with a classic scrollbar (Windows), the dark Google-reviews band and the band above it are 15px narrower than the window, leaving a white strip on the right. Woodmart's width formula subtracts the scrollbar twice in current Chrome. (2) Both homepage search boxes have Elementor's "live results" switched on, but typing shows nothing (no request is made). Keep them as they are, or fix them (and for (2): show results while typing, like the header search)? | Phase 3 |
| Q-41 | Blog comments: the live site has comments switched on under every post, but there are none (0 on 54 posts). The rebuild shows the same form; sending it does nothing yet. Keep comments (then: moderated where, and with what spam protection?) or switch them off? | Phase 5 |
| Q-42 | The "Email" button in the shared buttons block (43 product pages, 30 landing pages) opens a personal-looking gmail address, while the footer and the business details use hello@peptidesbali.online. The rebuild copies the button as it is (it is public, working content). Keep that address, or point the button to hello@peptidesbali.online? | Content |
| Q-43 | Spam protection of the forms: the partner application (`/affiliate-program/`) and AffiliateWP's login and registration use Google reCAPTCHA v3 (the badge in the form, or at the bottom right). It needs the owner's own keys: the site key (public) and the secret key, which goes only into the server's environment variables, never into the code or the docs. Keep reCAPTCHA v3 (then: create keys for the new domain), or use another check (e.g. Cloudflare Turnstile)? Until then the rebuild shows no badge and its forms send nothing (Q-12). | Phase 5–6a |
| 🔴 Q-45 | On the live site the "Research use only · Age 21+" gate (and the 5% popup) appear on the **homepage only**: a visitor who lands on a product, category or blog page from Google never sees the age gate. The rebuild copies that. Is that intended, or should the age gate show on every page (on the first page a visitor opens)? (Already decided, 6 Nov 2026: on the homepage the 5% popup now waits for the age gate and opens 3 s after "I'm 21+".) **The Elementor settings say "front page only" for both popups ([backend-settings](../audit/backend-settings.md) §11), so live does this on purpose; the compliance question stays.** | Compliance |
| Q-44 | `/subscribe/` shows the raw text `[email-subscribers-form id="2"]`: the newsletter plugin behind it no longer runs. The rebuild copies the page as it is (Q-14). Keep it, remove the page, or build a real newsletter sign-up (which provider)? | Content |
| Q-46 | Card minimum: the snippet is named "Card Payment Minimum Rp200,000" but enforces Rp 2,000,000. Which amount is right? | Phase 5 |
| Q-47 | One coupon gives any order for free (Rp 100,000,000 off + free shipping, no limits). Keep it, limit it, or delete it? (Code not written in the docs.) | Phase 5 |
| Q-48 | "IDR Account" tells buyers stock is held 24 h, but WooCommerce cancels unpaid orders after 60 min (the owner's e-mail plugin warns about it too). Which hold time? | Phase 5 |
| Q-49 | BitBridge Pay (credit card, hosted) is active on live and not in the PRD. Keep it in the new site (then: sandbox and API, as Q-01)? | Phase 5 |
| Q-50 | WordPress's time zone is set to **UTC+0**, not Bali time. So the checkout's delivery slot "Today" is the UTC date: from 00:00 to 08:00 Bali time it still offers yesterday's date, and order times show 8 hours early. The rebuild copies it for now (`src/lib/commerce/store-settings.ts`). Switch to Bali time (Asia/Makassar, recommended)? | Phase 5 |
| ✅ Q-51 | When an order reaches free shipping (Rp 2,500,000), does the live checkout preselect "Free shipping"? **Answered 6 Nov 2026 (captured with a guest cart):** live then offers ONLY "Free shipping" (the Rp 100,000 option is hidden); the payment preselected is the first open method (Card, or Crypto when Card is locked). The rebuild does the same (`src/lib/commerce/totals.ts`). | — |
