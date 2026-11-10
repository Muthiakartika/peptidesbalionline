# Page inventory — peptidesbali.online

**Phase 1 audit, 3 November 2026.** Everything here was collected from the public website only:
the sitemap, the public WordPress and WooCommerce REST APIs, a read-only crawl and the browser.
No admin, database or API-key access was used. Items that need backend access are listed at the end.

| What | Where the detail lives |
|---|---|
| Every crawled URL (title, meta, canonical, robots, **full H1–H6 outline**, forms, images, links, components) | [`data/page-inventory.json`](data/page-inventory.json) |
| The same, as a readable table | [`generated/url-inventory.md`](generated/url-inventory.md) |
| Every product, with variations and prices | [`generated/product-catalog.md`](generated/product-catalog.md) and [`data/products.json`](data/products.json) |
| Page and post SEO fields straight from Yoast | [`data/content.json`](data/content.json) |
| Reference screenshots of every template at 5 widths | [`visual-reference/screenshots/`](visual-reference/screenshots/) |
| How to re-run all of this | [`../../scripts/audit/README.md`](../../scripts/audit/README.md) |

> **About "full content".** The PRD asks for the full content of every page. Copying 340 pages into this
> Markdown file would make it unreadable, so the full HTML stays where it is authoritative: the WordPress
> REST API (`/wp-json/wp/v2/pages`, `/posts`, `/wc/store/v1/products`). The Phase 4 migration scripts
> import it from there, word for word. This document records the structure.

---

## 1. Totals

| Type | Count | Source | Notes |
|---|---|---|---|
| Pages | 80 | REST API | 74 in the sitemap, plus 6 `noindex` system or hidden pages |
| Blog posts | 54 | REST API + `post-sitemap.xml` | All written with the block or classic editor, **not** Elementor |
| Products | 182 | Store API + `product-sitemap.xml` | 105 simple, 77 variable |
| Product variations | 319 | Store API | Not separate URLs |
| Product categories | 25 | Store API + `product_cat-sitemap.xml` | 6 top-level, 19 children |
| Blog categories | 8 with posts (11 exist) | REST API + `category-sitemap.xml` | 41 of the 54 posts are "Uncategorized" |
| Blog tags | 59 exist, 0 used | REST API | No tag archive URLs in the sitemap |
| Media library items | 1,042 | REST API (`/wp/v2/media` total) | 841 unique upload images are referenced by crawled pages |
| Comments / product reviews | 0 / 0 | REST API | Comment forms are open on posts, but none exist |
| **URLs crawled** | **357** | sitemap + extra checks | 354 × 200, 3 × 404 (all expected) |

The crawler also found **20 paginated URLs** that are linked but not in the sitemap
(`/shop/page/2/` … `/shop/page/9/`, `/product-category/vial/page/2/` … `/page/5/`,
`/category/uncategorized/page/2/` … `/page/5/`) and one author archive (`/author/<user>/`).
They are listed in `data/page-inventory.json → linked_but_not_in_sitemap`.

---

## 2. Unique templates

Each row is one layout that has to be rebuilt once. The screenshot folder name is under
`visual-reference/screenshots/`.

| # | Template | Representative URL | How many URLs use it | Built with | Screenshots |
|---|---|---|---|---|---|
| 1 | Home | `/` | 1 | Elementor page (25 sections, about 15,300 px tall at 1440 and 22,200 px at 390; two blocks appear twice on purpose or by accident: "Collections" and the "Premium Products. Professional Service." banner, see Q-14) | `home/` (+ `-age-gate` first-visit shots) |
| 2 | Shop archive | `/shop/` | 1 (+ pagination) | Woodmart layout (Elementor) #9495 | `shop/` |
| 3 | Product category | `/product-category/vial/` | 25 (+ pagination) | Woodmart layout #9495 + category description | `product-category-parent/`, `-child/`, `-protocols/` |
| 4 | Single product | `/product/bpc-157/` | 182 | Woodmart layout #4118 + product description HTML | `product-simple/`, `product-variable-1-attribute/`, `product-variable-2-attributes/`, `product-stack/`, `product-bundle/`, `product-nasal-spray/` |
| 5 | Blog post | `/what-is-bpc-157/` | 54 | Woodmart single post (theme template) | `blog-post/` |
| 6 | Blog category archive | `/category/peptide-therapy/` | 8 (+ pagination) | Woodmart archive | `blog-category-archive/` |
| 7 | Insights (blog hub page) | `/insights/` | 1 | Elementor page with post grid | `insights-page/` |
| 8 | Compound landing page | `/bpc-157-bali/` | 16 | Elementor page | `landing-compound/` |
| 9 | Compound price page | `/bpc-157-bali-price/` | 5 (+ 1 dosage guide) | Elementor page + custom Product schema | `landing-price/` |
| 10 | Goal landing page | `/fat-loss-peptides-bali/` | 10 | Elementor page | `landing-goal/` |
| 11 | Bali area page | `/peptides-canggu/` | 8 (+ 2 delivery pages) | Elementor page | `landing-bali-area/` |
| 12 | Indonesian city page | `/peptide/jakarta/` | 9 | Elementor page (child of `/peptide/`) | `landing-city/` |
| 13 | Peptide hub | `/peptide/` | 1 | Elementor page | `peptide-hub/` |
| 14 | Info pages | `/about-atlas-longevity/`, `/contact-peptides-bali/`, `/peptides-bali-faq/`, `/peptide-consultation-bali/` | 4 | Elementor pages (contact and consultation have Elementor forms) | `about/`, `contact/`, `faq/`, `consultation/` |
| 15 | Lab results / COAs | `/lab-results-certificates-of-analysis/` | 1 | Elementor page | `lab-results/` |
| 16 | Legal page | `/privacy-policy/` | 6 | Elementor pages, text only | `legal-privacy/` |
| 17 | Affiliate program (marketing) | `/affiliate-program/` | 1 | Elementor page with application form | `affiliate-program/` |
| 18 | Affiliate login / registration / terms / area | `/affiliate-login/` etc. | 4 | Classic page + AffiliateWP shortcode | `affiliate-login/`, `affiliate-registration/`, `affiliate-terms/`, `affiliate-area-logged-out/` |
| 19 | Rewards | `/rewards/`, `/rewards-terms/` | 2 | Elementor pages (includes a rewards calculator) | `rewards/` |
| 20 | Protocol Builder | `/protocol-builder/` | 1 | Custom plugin "Atlas Research Planner" (JS app) | `protocol-builder/` |
| 21 | Reconstitution Calculator | `/calculator/` | 1 | Same custom plugin (`tools-calculator.js`) | `calculator/` |
| 22 | Cart | `/cart/` | 1 | WooCommerce + Woodmart | `cart-empty/` |
| 23 | Checkout | `/checkout/` | 1 | WooCommerce classic checkout | **not captured**: needs an item in the cart, see §8 |
| 24 | My Account (login/register, lost password) | `/my-account/` | 1 (+ endpoints) | WooCommerce + Woodmart | `my-account-logged-out/`, `lost-password/` |
| 25 | Search results | `/?s=bpc&post_type=product` | — | Woodmart product search | `search-products/` |
| 26 | 404 | any unknown URL | — | Woodmart 404 | `not-found-404/` |

Every page shares **one header** (Woodmart header builder, `default_header`) and **one footer**
(Elementor footer template #267). No header or footer variations per page were found.

---

## 3. Pages by family (80)

| Family | URLs |
|---|---|
| Home | `/` |
| Compound landing pages (16) | `/bpc-157-bali/`, `/tb-500-bali/`, `/semaglutide-bali/`, `/tirzepatide-bali/`, `/retatrutide-bali/`, `/ghk-cu-bali/`, `/ghk-cu-bali-2/`, `/epitalon-bali/`, `/igf-1-lr3-bali/`, `/ipamorelin-bali/`, `/melanotan-ii-bali/`, `/mots-c-bali/`, `/nad-bali/`, `/cjc-1295-bali/`, `/tesamorelin-bali/`, `/hgh-bali/` |
| Price and dosage pages (6) | `/bpc-157-bali-price/`, `/tb-500-bali-price/`, `/semaglutide-bali-price/`, `/tirzepatide-bali-price/`, `/retatrutide-bali-price/`, `/tirzepatide-dosage-guide-bali/` |
| Goal landing pages (10) | `/anti-aging-peptides-bali/`, `/cognitive-enhancement-peptides-bali/`, `/fat-loss-peptides-bali/`, `/injury-healing-peptides-bali/`, `/libido-peptides-bali/`, `/longevity-peptides-bali/`, `/muscle-growth-peptides-bali/`, `/performance-peptides-bali/`, `/recovery-peptides-bali/`, `/weight-loss-injections-bali/` |
| Bali area and delivery pages (10) | `/peptides-bali/`, `/peptides-canggu/`, `/peptides-seminyak/`, `/peptides-ubud/`, `/peptides-sanur/`, `/peptides-nusa-dua/`, `/peptides-uluwatu/`, `/peptides-denpasar/`, `/peptide-delivery-bali/`, `/peptides-bali-same-day-delivery/` |
| Indonesian city pages (10) | `/peptide/` (hub) and `/peptide/{jakarta, surabaya, bandung, medan, makassar, balikpapan, batam, yogyakarta, lombok}/` |
| Info (6) | `/about-atlas-longevity/`, `/contact-peptides-bali/`, `/peptides-bali-faq/`, `/peptide-consultation-bali/`, `/insights/`, `/lab-results-certificates-of-analysis/` |
| Legal (6) | `/privacy-policy/`, `/terms-conditions/`, `/disclaimer/`, `/no-medical-advice-disclaimer/`, `/refund-returns-policy/`, `/abuse-policy/` |
| Affiliate (5) | `/affiliate-program/`, `/affiliate-login/`, `/affiliate-registration/`, `/affiliate-terms-of-use/`, `/affiliate-area/` (noindex) |
| Rewards (2) | `/rewards/`, `/rewards-terms/` |
| Tools (2) | `/protocol-builder/`, `/calculator/` |
| WooCommerce system (4) | `/shop/`, `/cart/` (noindex), `/checkout/` (noindex, redirects to `/cart/` when empty), `/my-account/` (noindex) |
| Hidden / unlisted (2) | `/banner/` (noindex, an Elementor scratch page with 2 H1s), `/subscribe/` (noindex, newsletter form) |

## 4. Blog

* 54 posts, all by one author account, published 5 Apr – 16 Aug 2026, last modified 2 Nov 2026.
* Post URLs sit at the root: `/<post-slug>/` (WordPress "post name" permalinks). There is **no `/blog/`** (it is a 404).
* The blog listing that visitors see is the Elementor page `/insights/`. Category archives exist at `/category/<slug>/`, paginated as `/category/<slug>/page/N/`.
* Blog categories with posts: Uncategorized (41), Weight Management (4), Recovery & Performance (3), Bali Wellness Guides (2), Peptide Therapy (2), Hormones & Healthy Ageing (1), Men's Health (1), Anti-Ageing & Longevity (1).
* Single post layout: black page-title band (60 px padding) with breadcrumbs, then post meta ("Posted by …", date, comment count), then content (average about 1,250 words), share icons (Facebook, X, Pinterest, LinkedIn, Telegram) and the comment form. No sidebar, no related posts.
* **Privacy issue to fix before migration:** the author's public display name is an e-mail address. It appears in the post meta and in the Article JSON-LD on all 54 posts, and the WordPress user list (`/wp-json/wp/v2/users`) is public. See the feasibility report, risk R-12.

## 5. Products and categories

The full catalogue is in [`generated/product-catalog.md`](generated/product-catalog.md). Category tree:

```
Peptide Vials (/product-category/vial/) .................. 104
├── Brain & Cognitive Enhancement ......................... 12
├── Fat Loss & Metabolic Health ........................... 15
├── Healing & Recovery .................................... 11
├── Hormone Optimization ................................... 6
├── Libido & Sexual Wellness ............................... 5
├── Longevity & Healthy Ageing ............................ 12
├── Muscle Growth & Performance ........................... 11
├── Peptide Blends Bali (slug: blends) .................... 13
├── Research Compounds ..................................... 4
├── Supplies .............................................. 22
└── Vitamins & Wellness Injections ......................... 8
Peptide Pens (/product-category/pen-peptides/) ............ 51
└── Atlas Longevity ....................................... 43
Peptide Nasal Sprays ...................................... 17
Bundles ................................................... 5
Peptide Protocols ......................................... 12
├── Fat Loss Stacks (3), Muscle Growth Stacks (2), Recovery Stacks (2),
├── Longevity / Wellness Stacks (2), Beauty/ Skin Stacks (1),
└── Men's Performance Stacks (1), VIP Stacks (1)
Other ..................................................... 30
```

Category archive URLs are nested (`/product-category/vial/healing-recovery/`). Every category has an image;
several have long SEO descriptions (Peptide Blends Bali: about 1,660 characters of HTML).

---

## 6. Global elements (on every page)

| Element | What it does | Notes for the rebuild |
|---|---|---|
| **Top bar marquee** | Gold bar (40 px; 43 px on mobile) with an endlessly scrolling message: "Lab-tested research peptides · Same-day Bali dispatch before 5 PM", "Bundles: 20% off + free Bali delivery — Shop bundles", "Same day delivery across Bali contact us on WhatsApp" | Woodmart `wd_marquee`. Text is uppercase. Keep the existing wording exactly, including the "WHATSAAP" typo, unless the owner approves a fix. |
| **Floating pill header** | White rounded bar (1100 px wide, radius 35 px, soft shadow) floating 15 px below the top bar. It becomes sticky on scroll. | Woodmart header builder. Mobile: logo, flags, search, cart, burger. |
| Logo | PNG logo, 90 × 56 px in the header | Asset: `/wp-content/uploads/2026/08/WhatsApp_Image_2026-08-07_at_4.13.04_PM-removebg-preview.png` |
| Main navigation | PEPTIDE (dropdown: Peptide Vials + 11 sub-categories, Pens, Nasal Sprays, Protocols, Bundles, Other), LAB RESULTS, REWARDS, PROTOCOL BUILDER, CALCULATOR (dropdown: Insights, Consulting) | Dark dropdowns, open on hover. Underline style, 14 px Urbanist 700 uppercase. |
| Rotating payment badge | Pill that cycles Apple Pay → Google Pay → Visa → Mastercard, 3 s each (12 s loop) | Custom HTML/CSS in a Woodmart header text block |
| Language switcher | English / Indonesian flag buttons | **GTranslate**, client-side Google Translate: no `/id/` URLs and no hreflang. Decision needed (Q-09). |
| Search | Opens a full-screen AJAX product search with "search history" (5 items) | Woodmart AJAX search, 300 ms debounce |
| Account icon | Hover dropdown (dark) with a login form, "Create an Account" and "Lost your password?" | Woodmart |
| Cart icon | Count badge; opens a right-side cart drawer | Woodmart + WooCommerce cart fragments |
| Mobile menu | Left-side drawer, drill-down sub-menus ("Back to menu") | Woodmart `mobile-nav wd-left` |
| **Age-verification popup** | Shown 1 s after load: "Research use only · Age 21+ … Before you continue, confirm your intent." English + Indonesian text, buttons "I'm 21+ — enter for research" and "Take me back". Can't be closed with Esc or a click on the background. | Elementor Pro popup #5870. Its settings say "show up to 3 times", but the text says the confirmation lasts 30 days. Real behaviour must be confirmed (Q-10). |
| Cookie notice | Bottom bar: "We use cookies to improve your experience…" + ACCEPT | Woodmart cookie notice (no consent categories) |
| WhatsApp button | Floating bottom-right, with tooltip | Joinchat plugin, `wa.me/6282326300167` |
| Live chat | Tawk.to widget, bottom-right | Third-party embed |
| Footer | Brand text; columns NAVIGATION, LEGAL INFORMATION, CONTACT, PEPTIDES DELIVERY IN BALI, NATIONWIDE DELIVERY, PRICING & GUIDES; payment method chips (Visa, Mastercard, Apple Pay, Google Pay, Crypto, Wise, Revolut, Cash on Delivery); research-use disclaimer; © 2026 Atlas Longevity | Elementor footer #267 |
| Analytics and tracking | Google Tag Manager `GTM-WXL8X6QM`, GA4 `G-51PJX01T9F`, Microsoft Clarity, Cloudflare Web Analytics, Tagada tracker, WooCommerce order attribution (sourcebuster), AffiliateWP tracking script | Must be re-added with the same IDs (Q-11) |

## 7. Forms found

| Form | Where | Fields | Handled by |
|---|---|---|---|
| Header login | every page (account dropdown) | username, password, remember me | WooCommerce login |
| My Account login | `/my-account/` | username, password, remember me | WooCommerce |
| My Account register | `/my-account/` | email only (password is set by e-mail link) | WooCommerce |
| Lost password | `/my-account/lost-password/` | username or email | WooCommerce |
| Product search | header and some pages | `s` | Woodmart AJAX search / Elementor search |
| Shop sorting | shop and categories | orderby | WooCommerce |
| Add to cart / variation forms | product pages, product grids (quick shop) | attributes, quantity | WooCommerce |
| Blog comments | 54 posts | comment, name, email, website, cookie consent | WordPress |
| Contact form | `/contact-peptides-bali/` | name, email, 1 custom field, message | Elementor Pro form |
| Consultation questionnaire | `/peptide-consultation-bali/` | name + 24 custom fields (including a multi-choice checkbox group) | Elementor Pro form |
| Partner application | `/affiliate-program/` | name, email, about 20 custom fields, checkboxes, message | Elementor Pro form (**separate from** the AffiliateWP registration) |
| Homepage form | `/` | name, email, 2 custom fields | Elementor Pro form |
| Affiliate login | `/affiliate-login/` | username, password, remember me + reCAPTCHA v3 | AffiliateWP |
| Affiliate registration | `/affiliate-registration/` | your name, username, account email, payment email, website URL (required), "How will you promote us?", password ×2, Terms checkbox, honeypot + reCAPTCHA v3 | AffiliateWP |
| Newsletter | `/subscribe/` (hidden page) | email | Icegram "Email Subscribers" `[email-subscribers-form id="2"]`, plus custom `atlas-emails/v1/subscribe` endpoint |
| Protocol Builder / Calculator | tool pages | many numeric inputs | Custom plugin (client-side JS + REST) |
| Rewards calculator | `/rewards/` | order value | Elementor custom HTML (client-side) |

Where Elementor form submissions go (e-mail recipients, webhooks, CRM) is only visible in the editor (Q-12).

## 8. Interactive components inventory

| Component | Where | Behaviour observed |
|---|---|---|
| Variation swatches | product pages and quick shop in grids | Text "pill" swatches for MG/IU; dropdown for Pen Type. Picking a variation changes price, image and stock text. |
| Quick view / quick shop | product cards | "Select options" opens variation selection in the card; quick-view button opens a modal |
| AJAX shop | shop and categories | Sorting, per-page (9/12/18/24, default 21), view toggle (list / 3 col / 4 col), category widget and pagination load without a full page reload |
| Category carousel | shop header | Round category images (Vials, Pens, Nasal Sprays, Bundles, Protocols, Other) |
| Product tabs | product pages | Description + Woodmart custom tab ("Key Benefits", "Delivery in Bali", "Why Atlas Longevity" inside the content) |
| Sticky add-to-cart bar | product pages | Woodmart, appears after scrolling 250 px |
| USD price hint | product pages and grids | "~$72.73–$212.12" under IDR prices. Custom code (`atlas-usd-price`, `atlas-grid-usd-dynamic`). The rate works out to about 16,500 IDR/USD; whether it is fixed or live is unknown (Q-13). |
| "Calculate Your Dose" | product pages | Link to `/calculator/` |
| "Order on WhatsApp" | product pages | `wa.me/6282326300167` (no pre-filled message) |
| "view COA" | product pages | Goes to the general `/lab-results-certificates-of-analysis/` page, **not** a product-specific COA |
| Lab results | lab-results page | 23 compound cards; 5 PDF COAs hosted in uploads; 18 links to `verify.janoshik.com` test pages |
| Related products | product pages | 8-product carousel |
| Google reviews | home and others | Trustindex widget (rating "5.0", reviewer names) |
| Counters | home | Animated numbers (Elementor counter) |
| Testimonial and gallery carousels | home | Swiper (Elementor Pro) |
| FAQ toggles | FAQ page, affiliate program, product descriptions (`<details>`) | Accordion/toggle |
| Rewards calculator | `/rewards/` | Estimates credits from an order value (client-side) |
| Protocol Builder | `/protocol-builder/` | Choose products or a combination, enter amounts per use, frequency and duration; computes whole units and adds everything to the cart in one step. Supports saving plans (logged-in), sharing, export and a usage tracker (vials, entries, order sync). Feature flags today: account plans enabled, sharing on, exports on, WhatsApp off, prices shown. |
| Reconstitution calculator | `/calculator/` | Vial/pen, vial content (mg/mcg), diluent mL, amount per use (mcg/mg), syringe scale (U-100/U-40) and size (0.3/0.5/1 mL). Outputs volume per use, concentration, whole uses per vial and leftover. |
| Sticky header | all | Becomes fixed on scroll (`whb-sticky-real`) |
| Marquee and payment badge | all | Continuous CSS animations |
| Entrance animations | Elementor pages | Elements fade or slide in on scroll (Elementor `animated` classes) |

## 9. SEO observations (to preserve, or fix only with approval)

* **Yoast SEO** controls titles, descriptions, canonicals, robots and the sitemap. 340 URLs are `index, follow` with large image previews; 11 are `noindex, follow`.
* All indexable pages have one H1, except `/banner/` (2, noindexed). Meta descriptions are missing only on system pages, search and 404.
* JSON-LD on almost every page: Yoast graph (WebSite with SearchAction, Organization, WebPage, BreadcrumbList) **plus** a custom block: `Store` (address Jl. Pantai Cemongkak, Pecatu; phone; geo; Mon–Sat 07:00–22:00; areaServed Bali); `Product` + `AggregateOffer`/`Offer` on products **and on the landing and price pages**; `FAQPage` on 87 URLs; `Article` on posts. Products use the WordPress post ID as `sku`. No reviews or ratings (good: none may be invented).
* No hreflang (GTranslate is client-side only).
* 5,054 of 16,764 `<img>` tags have empty alt text (most are repeated header, footer and card images). Product images do carry alt text.
* 37 product descriptions show a raw `[rank_math_rich_snippet]` shortcode as visible text, a leftover from a previous SEO plugin (Q-14).
* `/page/2/` serves the homepage with canonical `/`; `/shop/page/N/` and category pagination are crawlable.
* Two pages share a topic: `/ghk-cu-bali/` and `/ghk-cu-bali-2/` (different titles, both indexed).
* 3 outbound links go to `balipeptides.online` (a different domain), and 2 links on the homepage point at the literal text `PUBLISHED%20COAS` (broken relative link).

## 10. What could not be inspected without backend access

* Logged-in states: My Account dashboard, orders, addresses, account details, the **rewards / credits area**, and the **AffiliateWP Affiliate Area / Portal**.
* The checkout page HTML and design (needs an item in the cart in a normal browser session; checkout fields and gateways were confirmed through the Store API instead, see the WooCommerce audit).
* Order-received / thank-you page, e-mail templates, and the payment gateway screens (Tagada card form, PayRam and NOWPayments crypto screens, Wise/Revolut and bank transfer instructions).
* Elementor form actions, popup display conditions, and Woodmart theme settings.
* Redirection plugin rules, 404 log and any `.htaccess` or Cloudflare rules.
* Custom plugin source code (Atlas Research Planner, Atlas Emails, Atlas card / IDR gateways, the USD price snippet, the custom schema snippet).
