# Peptides Bali Online: WordPress → Next.js migration

This repository holds the Next.js rebuild of **https://peptidesbali.online** (Atlas Longevity).
The goal is a **1:1 copy** of the current WordPress + WooCommerce + AffiliateWP site: the same look, the same
content, the same URLs and the same business rules, running on Next.js, Sanity CMS and PostgreSQL. It is not a
redesign. The full specification is in [`PRD.md`](PRD.md).

## Where the project stands

| Phase | Status |
|---|---|
| 1. Discovery and audit | ✅ Done (public evidence). Backend settings, data exports and logged-in screens still needed. |
| 2. Foundations | 🟡 Local setup done (app, design tokens, fonts, Studio, database schema, checks). **Waiting for:** Git remote, Sanity project, Neon database, Vercel project (owner accounts). |
| 3. Frontend | 🟡 **3a done:** header, footer, menus, drawers, popups and the 404 page. **3b done:** shop, 25 category pages, product search, the header search suggestions and the list view (`?shop_view=list`, 7 Nov). **3c done:** all 182 product pages, the picture viewer and the quick-view popup. **3d done:** the homepage (all 25 sections and their carousels, reviews, gallery, search boxes, counters, "recently viewed"). **3e done:** the 52 landing pages (compounds, prices, goals, Bali areas, cities, the /peptide/ hub) with their FAQ accordions. **3f done:** the blog (54 posts, 8 category archives, /insights/) and the site search. **3g done:** the 20 information, legal, lab-results, rewards and affiliate pages (forms shown, sending held back). **3h done (pages only):** cart, checkout redirects, my account, lost password (Phase 5 since: the cart, side cart and checkout pages work with a cookie cart). **/calculator/ (6 Nov):** the live page with the owner's own calculator script, same results as live in 8 of 8 tested input sets. Still open in Phase 3: the Protocol Builder (Phase 6c). **Phase 4, done ahead from the live data:** XML sitemaps, structured data (JSON-LD), robots per page. 206 of the 207 visual-diff captures of the 41 built templates pass (the other one is a capture-method artifact, see the plan); 356 of 357 URLs match (left: the Protocol Builder, Phase 6c). |
| 4–8 | Not started |

Decided so far: **commerce is a custom Next.js + PostgreSQL module** (Option A, approved 3 Nov 2026).

## Run it on your computer

You need **Node.js 22+** (check with `node --version`) and, for the audit scripts, Python 3.10+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Then open http://localhost:3000. Today `/` shows a temporary **style guide** (the measured fonts and colours),
`/shop/` and `/product-category/vial/` show the shop, `/?s=bpc&post_type=product` the search results, and
`/studio/` shows the Sanity Studio, or setup instructions until a Sanity project ID is configured.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` / `npm start` | Production build / run it |
| `npm run lint` · `npm run typecheck` · `npm test` | Code style, TypeScript, unit tests (Vitest) |
| `npm run db:generate` · `db:migrate` · `db:studio` | Create SQL migrations from `src/db/schema/`, apply them, browse the DB |
| `npm run audit:crawl` · `audit:export` · `audit:tables` · `audit:screenshots` | Re-run the Phase 1 audit (read-only) |
| `npm run verify:visual` | Compare screenshots of the rebuild with the live-site references |
| `npm run verify:urls` | Check all 357 URLs against the live site (status, title, description, canonical, H1) |

## Environment variables

All names are listed, with explanations, in [`.env.example`](.env.example). Copy it to `.env.local` (never
committed). The important rule: **`SITE_ENV=production` only on the real domain.** Every other environment is
automatically `noindex` and its `robots.txt` blocks all crawlers, so staging can never compete with the live
site in Google.

Live chat outside production: `ENABLE_LIVE_CHAT=true` shows Tawk.to there too. With `TAWK_PROPERTY_ID` and
`TAWK_WIDGET_ID` empty that is the owner's **real** chat (test messages reach the inbox of real customers);
fill both with a separate Tawk test property to keep tests apart (`src/lib/tawk.ts`). Leave them empty on the
live domain.

## Where to edit things

| I want to change… | Edit this |
|---|---|
| Colours, radii, shadows, breakpoints | `src/app/globals.css` (`@theme` block). Values come from `docs/audit/visual-reference/design-tokens.json`. |
| Fonts | `src/lib/fonts.ts` |
| Page `<title>` defaults, noindex rule | `src/app/layout.tsx`, `src/lib/site.ts` |
| robots.txt | `src/app/robots.ts` |
| Money formatting / arithmetic | `src/lib/money.ts` (always `bigint` minor units) |
| What editors see in Sanity | `src/sanity/schemas/` (types), `src/sanity/structure.ts` (menu), `sanity.config.ts` |
| Database tables | `src/db/schema/*.ts`, then `npm run db:generate` |
| Next.js settings (trailing slashes, images) | `next.config.ts` |
| Header/footer **text and links**, top-bar messages, age-gate and cookie wording | Sanity → **Site settings** when `CONTENT_SOURCE=sanity`; defaults in `src/content/site-chrome.ts` |
| Header layout | `src/components/layout/header/` (`SiteHeader.tsx` puts it together; `MainNav.tsx` = menu) |
| Footer layout | `src/components/layout/footer/SiteFooter.tsx` |
| Header/footer/popup **styles** | `src/styles/site-chrome.css` (every value is commented with where it came from) |
| Cart drawer, mobile menu, search, age gate, cookie bar, WhatsApp button | `src/components/layout/*.tsx` (one file each) |
| Icons (search, cart, menu…) | `src/components/ui/Icon.tsx` (uses the live site's icon font) |
| 404 page | `src/app/(store)/not-found.tsx` |
| Products, categories, prices shown in the shop | `src/content/catalog.json` (generated: re-run `python scripts/audit/export_shop_snapshot.py`; moves to Sanity + PostgreSQL in Phase 4) |
| Sort orders, paging, search rules, the "~$" USD hint | `src/lib/catalog/` (`index.ts`, `search.ts`, `usd.ts`; tests in `catalog.test.ts`) |
| Shop / category / search page layout | `src/components/shop/ShopArchive.tsx` (+ `ProductCard.tsx`, `ShopToolbar.tsx`, `CategorySidebar.tsx`, `CategoryCarousel.tsx`, `Pagination.tsx`) |
| Shop page styles | `src/styles/shop.css` (every value measured on the live shop) |
| Header search suggestions | `src/components/layout/SearchOverlay.tsx`, `src/components/layout/search/`, `src/app/api/search-suggestions/route.ts` |
| Product page layout | `src/components/product/ProductPage.tsx` (+ `ProductGallery.tsx`, `AddToCartForm.tsx`, `ProductTabs.tsx`, `RelatedProducts.tsx`) and the route `src/app/(store)/product/[slug]/page.tsx` |
| Product page content (gallery, descriptions, tabs, options, SEO tags) | `src/content/product-pages.json` (generated: re-run `python scripts/audit/export_product_pages.py`; moves to Sanity in Phase 4) |
| Product page styles | `src/styles/product.css` (the theme's rules, measured) and `src/styles/product-owner.css` (the owner's own CSS snippets, copied as they are) |
| "Click to enlarge" picture viewer | `src/components/product/PhotoSwipe.tsx` (+ `photoswipe-layout.ts`), styles `src/styles/photoswipe.css` |
| "Quick view" popup of the product cards | `src/components/product/QuickView.tsx`, data `src/app/api/quick-view/route.ts`, styles `src/styles/quick-view.css` |
| Elementor CSS used inside descriptions | `src/styles/legacy/` (core + kit) and `public/legacy/elementor/` (one file per description); both generated by `python scripts/audit/vendor_elementor_css.py` |
| Homepage and landing page content (texts, pictures, sections) | `src/content/pages/<name>.json`, e.g. `home.json`, `bpc-157-bali.json`, `peptide-jakarta.json`; which page lives at which address: `src/content/pages/index.ts` (all generated: re-run `python scripts/audit/export_elementor_pages.py`, then `vendor_elementor_css.py`; moves to Sanity in Phase 4) |
| Homepage and landing page frame and routes | `src/components/elementor/ElementorPage.tsx`; routes `src/app/(store)/page.tsx` (homepage) and `src/app/(store)/landing/[name]/page.tsx` (the 52 landing pages, which `src/proxy.ts` serves at their real addresses) |
| Their widgets that move or react (product grids, carousels, reviews, gallery, search boxes, counters, "recently viewed", FAQ accordions) | `src/components/elementor/` (`ElementorContent.tsx` decides which widget becomes which component; their arithmetic is in `src/lib/elementor/widgets.ts`, tested in `widgets.test.ts`; the accordions' behaviour in `src/lib/elementor/accordion.ts` and `slide.ts`) |
| Their styles | each page's own Elementor CSS (homepage: `src/styles/legacy/post-7282.css`; landing pages: `public/legacy/elementor/post-<id>.css`, both generated) and `src/styles/elementor-page.css` (the theme's rules they need, measured) |
| What "/?s=…", "/page/N/", the landing and blog addresses show | `src/proxy.ts` (sends searches to the search results, `/page/N/` to the homepage and each landing page's or post's address to its page, as WordPress does) |
| Blog posts, categories (texts, pictures, dates, SEO tags) | `src/content/blog/` (generated: re-run `python scripts/audit/export_blog.py`; moves to Sanity in Phase 4); the author name shown on posts: `src/lib/blog/author.ts` |
| Blog layout (post page, archive cards, title band, page links) and styles | `src/components/blog/` (`BlogPostPage.tsx`, `BlogPostCard.tsx`, `BlogLoop.tsx`, `PageTitle.tsx`), routes `src/app/(store)/blog-post/[slug]/` and `src/app/(store)/category/[...segments]/`; styles `src/styles/blog.css` |
| Site search (`/?s=bpc`: products, posts, pages) | `src/lib/search/site-search.ts` (WordPress's rules, tested against live results in `site-search.test.ts`), page `src/components/blog/SiteSearch.tsx` |
| Information, legal and affiliate pages (about, contact, FAQ, consultation, lab results, rewards, privacy, terms, affiliate program / login / registration …) | the same as the landing pages: `src/content/pages/<name>.json` (generated by `export_elementor_pages.py`), served by the landing route; their forms: `src/components/elementor/PendingForm.tsx` (sending held back, Q-12 / Q-43), the "Toggle" FAQ and the copy icons: `Accordions.tsx`, `CopyIcon.tsx` |
| Cart, checkout and account pages (`/cart/`, `/my-account/`, `/my-account/lost-password/`, `/checkout/order-received/`) | `src/components/woocommerce/` (WooCommerce's markup as components), routes `src/app/(store)/cart/`, `my-account/`, `checkout/`; which address shows what (e.g. `/checkout/` with an empty cart → `/cart/`): `woocommerce()` in `src/proxy.ts`; styles `src/styles/woocommerce.css`. Orders and accounts come with the database (Phase 5) |
| Compound-name notes in the searches ("GLP-3 RTA: Known as retatrutide …") and the names the searches translate | `src/lib/search/aliases.ts` (the owner's 3 names and notes), shown by `src/components/layout/search/AliasNotice.tsx` |
| Shop money rules: shipping, payment methods (card +5%, minimums, lock texts), coupons, totals | `src/lib/commerce/` (`store-settings.ts` holds the live values) |
| The cart page and its actions (add, quantity, remove, change address) | `src/components/woocommerce/cart/`, Server Actions `src/app/(store)/cart/actions.ts`, cart cookie `src/lib/commerce/cart-cookie.ts`; styles `src/styles/cart.css` + `cart-owner.css` |
| The checkout page (fields, delivery slot, payment methods, "Place order", coupon box) | `src/components/woocommerce/checkout/CheckoutForm.tsx` (markup and texts) + `CheckoutContents.tsx`, Server Actions `src/app/(store)/checkout/actions.ts`, the "Place order" checks `src/lib/commerce/checkout-validation.ts`, delivery days `delivery.ts`, country codes `phone-country-codes.ts`; styles `src/styles/checkout.css` (theme) + `checkout-owner.css` (owner's snippets, in the live order: 17 → 13) |
| Accounts / login (Better Auth) | `src/lib/auth/options.ts`; tables generated into `src/db/schema/auth.ts` (command in `src/lib/auth/cli-config.ts`) |
| My Account pages (dashboard, orders, addresses, account details, Research tools) and the login / registration / logout behaviour | `src/components/woocommerce/account/` (markup), routes `src/app/(store)/my-account/`, Server Actions `src/app/(store)/my-account/actions.ts`, logout `my-account/customer-logout/route.ts`, rules and texts `src/lib/account/`; styles `src/styles/account.css`; header menu `src/components/layout/header/AccountMenu.tsx` |
| Saving orders, the thank-you page, the order pages | `src/lib/commerce/orders.ts`, Server Action `placeOrder` in `src/app/(store)/checkout/actions.ts`, `src/components/woocommerce/order/` (ThankYou, OrderDetails), route `src/app/(store)/checkout/order-received/[number]/` |
| "Available on backorder" (which products / variations) | `src/content/stock-status.json`, made by `python scripts/audit/export_stock_status.py` (live's public Store API); shown in the cart, the side cart and on product pages |
| The shop's e-mails (account created, password reset) | `src/lib/email/` (texts in `account-emails.ts`). No provider yet (Q-08): on this computer they are saved in `.data/mail/` |
| Trying accounts on this computer without Neon | leave `DATABASE_URL` empty: the site uses a local database in `.data/pglite` (`src/db/index.ts`). Stop the site, run `npm run db:migrate`, start it, then `node scripts/dev/seed-test-customer.mjs` for a test customer |
| Importing customers, orders, coupons and AffiliateWP from the live site | 1) in the owner's signed-in wp-admin tab, run `scripts/import/export-wordpress.browser.js` (DevTools console; it only reads) and save the file it offers **outside this folder**; 2) stop the site, `npm run db:migrate`; 3) `node scripts/import/import-wordpress.mjs <file> --report docs/migration/wordpress-import-report.md`. It can run again (it updates by WordPress ID). The file holds personal data: delete it afterwards |
| Letting imported customers keep their WordPress password | export the users table's columns `ID` and `user_pass` (phpMyAdmin or the host's tool) to a file **outside this folder**, stop the site, `npm run db:migrate`, then `node scripts/import/import-wordpress-passwords.mjs <file>`; delete the file afterwards. `--forget-all` deletes the hashes no one used. Try it locally with `node scripts/dev/seed-legacy-login-test.mjs` (`--remove` takes the test account out) |
| Setting up Sanity | follow [docs/setup/sanity.md](docs/setup/sanity.md) |
| Editing pages, sections, menus, posts and product texts in Sanity | [docs/content/editing-in-sanity.md](docs/content/editing-in-sanity.md) (import: `node scripts/sanity/import-content.mjs --dataset staging`) |
| Pictures in Cloudflare R2 (upload, media library, moving the WordPress files) | follow [docs/setup/r2.md](docs/setup/r2.md) |
| Connecting Neon | follow [docs/setup/neon.md](docs/setup/neon.md) (a `dev` branch on this computer, `main` for the live site) |
| Trying coupons on this computer without typing a real code | stop the site, `node scripts/dev/seed-test-coupons.mjs` adds `local-test-5` (5%, from Rp 800,000, once per customer) and `local-test-fixed` (Rp 250,000 off from Rp 2,500,000); `--remove` takes them out again |
| Opening the staff order screens (`/admin/orders/`) | give an account a staff role: stop the site (the local database allows one process), run `node scripts/dev/set-role.mjs <e-mail> administrator` (or `shop_manager`, or `customer` to take it back), start it again and log in with that account |
| Database tables | `src/db/schema/*.ts` → `npm run db:generate` → `npm run db:migrate` (needs `DATABASE_URL` in `.env.local`) |
| Old addresses that redirect (the live site's 196 Redirection rules) | `src/content/seo/redirects.json`, applied in `next.config.ts` via `src/lib/seo/redirects.ts` |
| Which shop, category and product addresses exist (real 404s, page-number rules) | `shopAddress()` in `src/proxy.ts`, data `src/lib/catalog/archive-index.ts` |
| The homepage's "5% off" popup and its sign-up form; the age gate | `src/components/elementor/HomePopups.tsx` + `ElementorPopup.tsx` (data `src/content/popups/`, generated by `python scripts/audit/export_popups.py`); `src/components/layout/AgeGate.tsx`. All three on the homepage only, as live (Q-45). The 5% popup waits for the age gate (owner's decision): the delay after "I'm 21+" is `ageGate.offerDelayAfterConfirmMs` in `src/content/site-chrome.ts` |
| XML sitemaps (`/sitemap_index.xml` …), structured data (JSON-LD), robots per page | `src/lib/seo/sitemaps.ts` + `src/app/*sitemap*.xml/`, `src/components/seo/JsonLd.tsx`, `yoastRobots()` in `src/components/shop/archive-metadata.ts`; data `src/content/seo/` (generated: `python scripts/audit/export_sitemaps.py`, `export_jsonld.py`; built from Sanity in Phase 4) |
| Checkout logic, affiliate rules | *Phases 5–6:* `src/features/checkout/`, `src/features/affiliate/` |

## Start reading here

1. [`docs/audit/technical-feasibility-report.md`](docs/audit/technical-feasibility-report.md): the short answer, risks, and what access is needed
2. [`docs/migration/implementation-plan.md`](docs/migration/implementation-plan.md): the order of work, the checklist, and **all open questions**
3. [`docs/audit/page-inventory.md`](docs/audit/page-inventory.md): every page, template, form and interactive component
4. [`docs/audit/visual-reference/`](docs/audit/visual-reference/): design tokens + reference screenshots at 5 widths
5. [`docs/audit/woocommerce-audit.md`](docs/audit/woocommerce-audit.md) · [`docs/audit/affiliatewp-audit.md`](docs/audit/affiliatewp-audit.md) · [`docs/audit/plugin-inventory.md`](docs/audit/plugin-inventory.md)
6. [`docs/architecture/`](docs/architecture/): system and database design
7. [`docs/migration/seo-url-mapping.md`](docs/migration/seo-url-mapping.md): every old URL and its new URL

## Folder map

```text
PRD.md                     master specification
AGENTS.md                  Next.js 16 notes for AI coding agents (generated by Next.js, keep it)
src/
  app/                     layout.tsx (html/body), robots.ts, studio/ (Sanity)
    (store)/               every public page: layout.tsx (header+footer), page.tsx (homepage),
                           shop/, product-category/, product/, page/ (search results), not-found.tsx (404),
                           landing/[name]/ (the 52 landing pages, /insights/, the 20 information
                           pages), blog-post/[slug]/ (the 54 posts), category/ (blog archives), cart/,
                           my-account/, checkout/order-received/, woo/ (internal: two WooCommerce
                           messages), [...slug]/ (the 404 page for every other address)
    api/                   search-suggestions/ (header search), quick-view/, products/ ("recently viewed")
  proxy.ts                 "/?s=…" → search results, "/page/N/" → homepage, landing addresses → their
                           page (runs before the pages are rendered; + proxy.test.ts)
  components/layout/       header/, footer/, search/, drawers, popups, floating buttons
  components/shop/         shop, category and search pages (cards, toolbar, sidebar, carousel)
  components/product/      product pages, picture viewer, quick view
  components/elementor/    pages copied from Elementor (homepage, landing pages) and their interactive widgets
  components/blog/         blog posts, archives, the site search results, the /insights/ post grid
  components/woocommerce/  cart, checkout and account pages (empty cart, login / registration, lost password)
  components/ui/           small shared pieces (Icon)
  content/                 site-chrome.ts (header/footer text), catalog.json, product-pages.json and
                           pages/ (the Elementor pages), blog/ (posts, categories), search/ (pages' text
                           for the site search); all generated snapshots of the live site
  styles/                  site-chrome.css (header, footer, popups, search), shop.css (shop pages),
                           product*.css, elementor-page.css (Elementor pages), legacy/ (Elementor CSS, generated)
  lib/                     fonts.ts, money.ts (+ tests), site.ts, catalog/ (shop data rules + tests),
                           elementor/ (page data, widget arithmetic, accordions + tests), blog/ (data,
                           dates, page links + tests), search/ (site search + tests), legacy-html.ts (+ tests)
  sanity/                  env.ts, schemas/, structure.ts, lib/client.ts
  db/                      schema/ (Drizzle tables), migrations/ (generated SQL), index.ts (connection)
sanity.config.ts           Sanity Studio configuration
drizzle.config.ts          database migration tool configuration
scripts/
  audit/                   read-only scripts that produced docs/audit
  verification/            visual diff + URL parity checks
docs/                      audit, architecture, migration plan
```

## Notes for a developer learning Next.js

* **Content lives in Sanity** (things editors change). **Money, people and orders live in PostgreSQL.**
  Every price and total is calculated on the server, never in the browser.
* Pages are React **Server Components** by default: they run on the server and send HTML. Small interactive
  parts (variation picker, cart drawer, menus) will be **Client Components** (files starting with `"use client"`).
* This project uses **Next.js 16**, which differs from most tutorials:
  * **Cache Components** is on, so data is fetched fresh unless a function or component says `"use cache"`.
  * `middleware.ts` is now called **`proxy.ts`**.
  * The Next.js docs that match the installed version are in `node_modules/next/dist/docs/`.
* **HTML copied from the live site** (product descriptions, Elementor blocks) is shown with
  `dangerouslySetInnerHTML` inside elements marked `data-legacy-html`. Two rules keep it looking like the
  live site: Tailwind does not read `src/content/` (so its class names never become utilities), and
  `src/app/globals.css` switches off the few utilities whose names that HTML also uses
  (`python scripts/audit/check_tailwind_collisions.py` lists them).
* **CSS order matters for that HTML.** On the live site Elementor's core CSS comes first, then its "kit",
  then the theme and the owner's CSS, then each description's own Elementor CSS. `ProductPage.tsx`
  imports the first three in that order and links the last one inside the page (a `<link>` without
  `precedence` stays where it is), so the order is the same in `next dev` and in a production build.
  Measure product pages on a production build (`npm run build && npx next start -p 3005`).
* **The homepage is a static page.** WordPress also answers searches on "/" (`/?s=bpc`), which would make
  the page depend on the address and render on every request. `src/proxy.ts` sends searches to the search
  results route instead, so the homepage's HTML is built once, in advance, and shows without JavaScript.
* **Elementor pages keep their original markup.** `ElementorContent.tsx` turns the copied HTML into React
  on the server and swaps only the widgets that need JavaScript for small components ("islands"), which
  then do what the live site's scripts did (measured on the live page; each file says what and where).
* **Blog posts work the same way** (`/what-is-bpc-157/` is served by `/blog-post/what-is-bpc-157/`). The live
  author name is an e-mail address: it is never copied (the export removes it and stops if any is left); posts
  show the name in `src/lib/blog/author.ts` until the owner chooses one (R-12, Q-14).
* **Landing pages live at their real addresses, but the route is `/landing/[name]/`.** A catch-all route at
  `/[...slug]/` also answers every unknown address, and with Cache Components an unknown address would then
  get the 404 page with status 200. So `src/proxy.ts` sends each landing address (from
  `src/content/pages/index.ts`) to `/landing/<name>/` (the address bar keeps the real one), all 52 pages are
  built in advance, and `[...slug]` stays a ready-made 404 page with status 404. `/landing/…` itself answers 404.
* **Forms copied from the live site don't send anything yet.** The contact, consultation and partner
  forms, the affiliate login / registration and WooCommerce's login, registration and lost-password forms
  keep their markup and the browser's checks, but sending is held back until something receives the
  answers (Phase 5–6, Q-12, Q-43). They never show a "sent" message for something that wasn't sent. Their
  security tokens (nonces) and the reCAPTCHA key are never copied.
* **Accounts work on this computer before Neon**: with `DATABASE_URL` empty the site keeps accounts in a
  local database (`.data/pglite`, development only; production refuses to start without `DATABASE_URL`).
  E-mails can't be sent yet (Q-08), so a new account gets no set-password link; the site says so.
* **The cart lives in a cookie until the database is connected** (`src/lib/commerce/cart-cookie.ts`;
  prices always come from the server). `/checkout/` with an empty cart sends visitors to `/cart/` with a
  302, as WooCommerce does. "Place order" checks the order but can't save it yet (no database): it says so.
