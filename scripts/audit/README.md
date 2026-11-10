# Audit scripts (Phase 1)

These scripts **only read** the public website. They never log in, submit forms or change anything.
Run them from the project root. Python 3.10+ and Node 18+ are enough. The only extra package is
`playwright-core` for screenshots, which uses your installed Google Chrome.

| Order | Command | What it produces | Time |
|---|---|---|---|
| 1 | `python scripts/audit/crawl_inventory.py` | `docs/audit/data/page-inventory.json`: every sitemap URL + extra checks, with title, meta, canonical, robots, H1–H6 outline, JSON-LD types, forms, images, links, detected components | about 4 min |
| 2 | `python scripts/audit/export_public_catalog.py` | `docs/audit/data/products.json`, `product-categories.json`, `content.json`, `blog-categories.json` from the public Store API and WP REST API | about 1 min |
| 3 | `python scripts/audit/build_audit_tables.py` | `docs/audit/generated/url-inventory.md`, `generated/product-catalog.md`, `docs/migration/seo-url-mapping.md` | seconds |
| 3b | `python scripts/audit/export_shop_snapshot.py` | `src/content/catalog.json`: the catalogue snapshot the shop pages read (product order per sort option, card data, variations, categories, SEO tags, search thumbnails). Bypasses the Cloudflare cache. | about 10 min |
| 3c | `python scripts/audit/export_product_pages.py` | `src/content/product-pages.json`: every product page (gallery with the zoom files, breadcrumbs, short description, the option form and each variation's picture, tabs, related products, SEO tags, SKU and categories for the quick view). Run after 3b. | about 5 min |
| 3d, 3e | `python scripts/audit/export_elementor_pages.py` (or with addresses, e.g. `… /bpc-157-bali/`, to refresh only those) | `src/content/pages/<name>.json` for the homepage and the 52 landing pages: each Elementor document as WordPress printed it, with marks on the widgets the rebuild turns into components (product grids, the Owl carousel and its arrows), its family, SEO tags and the Elementor documents whose CSS it needs; `src/content/pages/index.ts` (address → page) and `files.ts` (how to load each page); plus `public/legacy/vendor/` (the plugins' stylesheets they link, with their fonts and icons). | about 1 min |
| 3f | `python scripts/audit/export_blog.py` | `src/content/blog/`: the 54 posts (each post's text in `posts/<slug>.json`; titles, dates, pictures, excerpts, "Newer / Older" and SEO tags in `posts.json`), the 8 categories and their archive pages' SEO tags (`categories.json`), `index.ts` (address → post) and `files.ts`; `src/content/search/pages.json` (the 80 pages' title, date and plain text, for the site search). The author's e-mail address is never written (the script stops if any is left). | about 2 min |
| 3c′ | `python scripts/audit/vendor_elementor_css.py` | `src/styles/legacy/` (Elementor core + the global kit + the homepage's own CSS, `post-7282.css`) and `public/legacy/elementor/` (one file per Elementor document of the product pages and per landing page). Run after 3c, 3d and 3e. | about 2 min |
| 4 | `npm run audit:screenshots` | `docs/audit/visual-reference/screenshots/<template>/<viewport>.jpg` (39 templates × 5 widths + 2 age-gate shots) | about 10 min |

The same steps are available as `npm run audit:crawl`, `audit:export` and `audit:tables`.

**Checking the rebuild** (`scripts/verification/`):

* Screenshots of the Next.js app with identical settings:
  `CAPTURE_BASE_URL=http://localhost:3000 OUT_DIR=test-results/screenshots npm run audit:screenshots`
  (add `ONLY=home,shop` to capture a few templates), then `npm run verify:visual`. The report is in
  `test-results/visual-diff/report.md`.
* URLs and SEO tags: `BASE_URL=http://localhost:3000 npm run verify:urls` (add `TYPES=product,page` to narrow
  it down). The report is in `test-results/url-parity.md`. As a self-test, running it against the live site itself
  matched **87 of 87** sampled URLs (all pages + home, shop, cart, account, 404). Network errors are retried
  twice; use `CONCURRENCY=2` if the live server starts rate-limiting.

* `python scripts/audit/check_tailwind_collisions.py` (after `npm run build` or while `npm run dev` runs): finds
  class names in the copied live HTML (product pages and `src/content/pages/`) that are also Tailwind
  utilities of this project (e.g. `flex`, `mt-4`) and checks that `src/app/globals.css` switches them off
  inside that HTML. Run it after every re-export.
* `node scripts/audit/style-dump.mjs <url> <width> <selectors.json>` prints the box and computed styles of
  each selector (example list: `style-dump-shop.json`). It was used to measure the shop pages.

Notes:

* `vendor_elementor_css.py` can report a document as "missing" (HTTP 404) when the owner has just cleared
  Elementor's CSS cache: Elementor writes the file again the next time a page that uses it is opened. Open
  that page on the live site once and run the script again; the copy already in the project stays until
  then (5 Nov 2026: `post-3629.css` and `post-3695.css`, back the same minute, unchanged).
* Some of the live site's Elementor CSS is broken in ways browsers silently skip: Markdown fences
  (```` ```css ````) pasted into the owner's custom CSS, an Elementor placeholder that was never filled in
  (`text-align:{{VALUE}}`), an empty `{}` block. Next.js's CSS parser rejects such a file, so
  `vendor_elementor_css.py` removes exactly what the browser skips (the fenced rule, the one declaration,
  the empty block) and nothing else; checked on the live page (4 Nov 2026).
* Screenshots: things that move by themselves are frozen at their first frame on both sides (the top-bar
  marquee, the payment badge, the homepage's three carousels, the gold bar's moving gradient), and the
  page is clipped sideways. The live header sticks out 10px, and Playwright sizes a full-page capture
  from `body.scrollWidth`, so it took 1450px-wide captures and laid the page out again at that width.
  So the header is clipped as well, because a clip on body itself doesn't change its `scrollWidth`.
* Screenshots of a whole page are taken by making the window as tall as the page, not with Playwright's
  `fullPage` option (since 5 Nov 2026). With `fullPage`, Chrome drew the homepage differently from one capture
  to the next, on the live site as much as on the rebuild (two live captures 7.9% apart: the hero picture
  scaled differently, text a pixel lower); two "tall window" captures agree to 0.00–0.06%. Chrome can't draw a
  window taller than about 16,000px (the picture never comes), so pages taller than that (the homepage and
  some product pages on tablets and phones) are still taken with `fullPage`. All references of the built
  templates were captured again this way. `CONCURRENCY=1` captures one page at a time (default 3).

* Cloudflare can serve day-old copies of live pages. The screenshot script and the shop snapshot add an
  unused `_fresh=<time>` query argument to get the current page.
* The crawler deliberately skips `/ref/<username>/` URLs, because visiting a real affiliate link would log a
  visit in the live AffiliateWP database.
* Prices in `products.json` are integers in minor units (`85000000` = Rp 850,000.00). Keep it that way.
* To capture with a different Chrome, set `CHROME_PATH`. To write screenshots elsewhere, set `OUT_DIR`.
