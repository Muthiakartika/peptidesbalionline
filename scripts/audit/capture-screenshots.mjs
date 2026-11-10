/**
 * Captures full-page reference screenshots of the live WordPress site
 * (https://peptidesbali.online) for every unique page template, at the five
 * viewports listed in the PRD. These images are the visual "source of truth"
 * we compare the Next.js rebuild against in Phase 3.
 *
 * Read-only: it only opens pages, scrolls them (so lazy images and Elementor
 * entrance animations load) and saves a picture. It never clicks buttons or
 * submits forms. The age-verification popup and the cookie bar (live and rebuild) are hidden
 * with CSS on every capture except the "first visit" homepage shots
 * (files ending in -age-gate.jpg).
 *
 * Requirements: Node 18+ and Google Chrome installed (playwright-core is a devDependency).
 *   npm run audit:screenshots
 * Optional environment variables: CAPTURE_BASE_URL, OUT_DIR, CHROME_PATH, ONLY (comma-separated
 * template names, e.g. ONLY=home,shop), MARKUP_DIR (also save the cart / checkout pages' HTML there).
 *
 * Output: docs/audit/visual-reference/screenshots/<template>/<viewport>.jpg
 *
 * Cart and checkout WITH products (templates with a `cart`, allowed by the owner's side on
 * 6 Nov 2026): the only captures that change something on the live site. Each cart is filled once as
 * a guest (WooCommerce's add-to-cart request; no login), and all viewports reuse that one session, so
 * WooCommerce keeps one temporary guest session per cart (it deletes it after 48 hours). Nothing is
 * typed into the checkout and no order is placed. Analytics, Clarity, Tawk and Facebook are blocked in
 * those browsers, so the visits don't show up in the owner's statistics or chat.
 */

import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Point CAPTURE_BASE_URL at the Next.js app (e.g. http://localhost:3000) to capture the
// rebuild with exactly the same settings, then compare with scripts/verification/compare-screenshots.mjs.
const SITE = (process.env.CAPTURE_BASE_URL ?? "https://peptidesbali.online").replace(/\/$/, "");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT_DIR = process.env.OUT_DIR ?? path.join(ROOT, "docs", "audit", "visual-reference", "screenshots");
const CHROME =
  process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "tablet-768", width: 768, height: 1024, mobile: true },
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-375", width: 375, height: 812, mobile: true },
];

// One representative URL per unique template found in the audit.
const TEMPLATES = [
  ["home", "/"],
  ["shop", "/shop/"],
  // The shop's list view (Woodmart "shop_view=list": image left, details and the short description right).
  ["shop-list", "/shop/?shop_view=list"],
  ["product-category-list", "/product-category/vial/healing-recovery/?shop_view=list"],
  ["product-category-parent", "/product-category/vial/"],
  ["product-category-child", "/product-category/vial/healing-recovery/"],
  ["product-category-protocols", "/product-category/peptide-protocols/"],
  ["product-simple", "/product/bacteriostatic-water-10ml/"],
  ["product-variable-1-attribute", "/product/bpc-157/"],
  ["product-variable-2-attributes", "/product/bpc157-5mg-pen/"],
  ["product-stack", "/product/atlas-wolverine-recovery-stack/"],
  ["product-bundle", "/product/glow-bundle/"],
  ["product-nasal-spray", "/product/semax-nasal-spray/"],
  ["blog-post", "/what-is-bpc-157/"],
  ["blog-category-archive", "/category/peptide-therapy/"],
  ["insights-page", "/insights/"],
  ["landing-compound", "/bpc-157-bali/"],
  ["landing-price", "/bpc-157-bali-price/"],
  ["landing-goal", "/fat-loss-peptides-bali/"],
  ["landing-bali-area", "/peptides-canggu/"],
  ["landing-city", "/peptide/jakarta/"],
  ["peptide-hub", "/peptide/"],
  ["about", "/about-atlas-longevity/"],
  ["contact", "/contact-peptides-bali/"],
  ["faq", "/peptides-bali-faq/"],
  ["consultation", "/peptide-consultation-bali/"],
  ["lab-results", "/lab-results-certificates-of-analysis/"],
  ["legal-privacy", "/privacy-policy/"],
  ["affiliate-program", "/affiliate-program/"],
  ["affiliate-login", "/affiliate-login/"],
  ["affiliate-registration", "/affiliate-registration/"],
  ["affiliate-area-logged-out", "/affiliate-area/"],
  ["affiliate-terms", "/affiliate-terms-of-use/"],
  ["rewards", "/rewards/"],
  ["rewards-terms", "/rewards-terms/"],
  ["legal-terms", "/terms-conditions/"],
  ["protocol-builder", "/protocol-builder/"],
  ["calculator", "/calculator/"],
  ["cart-empty", "/cart/"],
  ["cart-small", "/cart/", { cart: "small" }],
  ["cart-large", "/cart/", { cart: "large" }],
  ["checkout-small", "/checkout/", { cart: "small" }],
  ["checkout-large", "/checkout/", { cart: "large" }],
  ["my-account-logged-out", "/my-account/"],
  ["lost-password", "/my-account/lost-password/"],
  ["lost-password-sent", "/my-account/lost-password/?reset-link-sent=true"],
  ["order-received", "/checkout/order-received/"],
  ["search-products", "/?s=bpc&post_type=product"],
  ["not-found-404", "/this-page-does-not-exist-404-check/"],
];

/**
 * The carts of the cart / checkout templates (WooCommerce product or variation IDs):
 *   small: KPV (Rp 1,200,000, simple): Rp 100,000 shipping; card and COD locked (minimums 2,000,000 / 2,500,000).
 *   large: GLP-3 RTA Pen, disposable pen 5mg (Rp 2,800,000, a variation): free shipping offered; card and COD open.
 */
const CARTS = {
  small: [{ product_id: 1234, quantity: 1 }],
  // On WooCommerce a variation's ID is enough; the rebuild's cart cookie also needs its product (parent).
  large: [{ product_id: 9752, parent: 4704, quantity: 1 }],
};

/** Third parties that would record the cart visits (statistics, session recordings, chat). */
const TRACKERS = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|clarity\.ms|tawk\.to|facebook\.(net|com)|doubleclick\.net/;

/**
 * Fills one cart as a guest and returns the browser state (its session cookie) for every viewport.
 * WooCommerce's own add-to-cart request (a POST, never cached); a variation's ID is enough there.
 */
async function fillCart(browser, items) {
  if (process.env.CAPTURE_BASE_URL) {
    // The rebuild keeps the cart in a cookie (src/lib/commerce/cart-cookie.ts): write it directly.
    const value = Buffer.from(
      JSON.stringify({ v: 1, items: items.map((i) => (i.parent ? [i.parent, i.product_id, i.quantity] : [i.product_id, 0, i.quantity])), coupons: [] }),
    ).toString("base64url");
    const { hostname } = new URL(SITE);
    return { cookies: [{ name: "atlas_cart", value, domain: hostname, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] };
  }
  const context = await browser.newContext();
  await context.route(TRACKERS, (route) => route.abort());
  for (const item of items) {
    const response = await context.request.post(`${SITE}/?wc-ajax=add_to_cart`, { form: { product_id: String(item.product_id), quantity: String(item.quantity) } });
    const body = await response.json().catch(() => null);
    if (!response.ok() || !body || body.error) throw new Error(`add to cart failed for ${item.product_id}: ${response.status()}`);
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

/** The page's main HTML without security tokens, session details or API keys (for MARKUP_DIR). */
async function cleanMarkup(page) {
  return page.evaluate(() => {
    const root = (document.querySelector(".wd-page-content, main, #main-content") ?? document.body).cloneNode(true);
    root.querySelectorAll("script, noscript, iframe").forEach((el) => el.remove());
    root.querySelectorAll("input").forEach((input) => {
      if (/nonce|security|_wp_http_referer|wc_order_attribution|token|key/i.test(input.name ?? "")) input.setAttribute("value", "");
    });
    let html = root.outerHTML;
    html = html.replace(/data-(nonce|security)="[^"]*"/gi, 'data-$1=""').replace(/AIza[0-9A-Za-z_-]{20,}/g, "[key]");
    // Tokens inside links too, e.g. the cart's remove link "?remove_item=…&_wpnonce=…".
    html = html.replace(/([?&](?:amp;)?(?:_wpnonce|nonce|security)=)[^&"'\s]+/gi, "$1");
    html = html.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]");
    return html;
  });
}

// Hides the age gate and the cookie bar (both are captured separately in the
// "-age-gate" shots) so they do not cover the page in full-page captures.
// The age gate also locks scrolling (body overflow hidden), which turns <body>
// into a 900px-tall clipping box, so the scroll lock is undone as well.
const HIDE_OVERLAYS_CSS = `
  .elementor-popup-modal, .wd-cookies-popup, .age-gate, .cookie-notice { display: none !important; }
  html, body, body.dialog-prevent-scroll { height: auto !important; overflow: visible !important; }
  /* …but not sideways: a header text on the live site sticks out 10px to the right, and with that
     overflow visible the page scrolls sideways (and Playwright's former full-page capture was taken
     1450px wide, laying the whole page out at that width). Visitors never see it: the theme hides
     sideways overflow. A clip on body itself doesn't change body.scrollWidth, so the header is
     clipped too, and Woodmart's .whb-main-header, which is positioned outside it. (Clipping more,
     e.g. every child of body, changed the live tablet layout.) */
  html, body, body.dialog-prevent-scroll { overflow-x: clip !important; }
  header, .whb-main-header { overflow-x: clip !important; }
  /* Freeze moving parts at their first frame so two captures can be compared pixel by pixel:
     the top-bar marquee and the rotating payment badge (live class names, then rebuild ones). */
  .wd-marquee-content, .marquee__track { animation: none !important; transform: none !important; }
  .atlas-header-payments .atlas-payment-brand, .payment-badge__brand { animation: none !important; opacity: 0 !important; transform: none !important; }
  .atlas-header-payments .atlas-pay-apple, .payment-badge__brand--apple { opacity: 1 !important; }
  /* Homepage carousels that play by themselves (same markup on both sides): the Google reviews
     (Trustindex moves every review's "left"), the testimonials (Swiper moves its wrapper) and the
     lab certificates (Owl moves its stage; autoplay since 5 Nov 2026). */
  .owl-carousel .owl-stage { transform: none !important; transition: none !important; }
  .ti-widget .ti-review-item { left: 0 !important; }
  .ti-widget .ti-controls .ti-prev { display: none !important; }
  .ti-widget .ti-controls .ti-next { display: block !important; }
  .ti-widget .ti-controls-line .dot { left: 0 !important; }
  .elementor-main-swiper .swiper-wrapper { transform: none !important; transition: none !important; }
  /* Blog: the author's public name on the live site is an e-mail address (risk R-12). It is blanked on
     both sides (same box, no text, no picture), so the screenshots carry no personal data and still
     compare equal (the rebuild shows a neutral name until the owner chooses one). */
  .wd-post-author .author { display: inline-block !important; width: 150px !important; overflow: hidden !important; color: transparent !important; white-space: nowrap !important; vertical-align: middle; }
  .wd-post-author img { visibility: hidden !important; }
  /* The homepage's gold stats bar: the owner's CSS animation "goldGradientMove" moves its gradient. */
  .elementor-element-e6a6b92 { animation: none !important; }
  /* Product pages: the live site picks and shuffles the related products on every visit, so the row's
     height depends on which cards it drew (cards with options are taller). Their cards are hidden and
     given one fixed height on both sides; the cards themselves are compared one by one instead
     (same product, same height). */
  .related-products .wd-carousel-item > * { visibility: hidden !important; height: 640px !important; }
  /* reCAPTCHA (affiliate application form, affiliate login and registration): Google's badge needs
     the owner's own keys (open question Q-43), so the rebuild has none yet. Hidden on both sides. */
  .grecaptcha-badge, .elementor-g-recaptcha { display: none !important; }
`;

// Headless full-page captures never trigger Elementor's scroll animations or
// LiteSpeed's lazy images, which leaves most of the page blank. This shows
// every element in its final (post-animation) state and loads every image.
async function revealEverything(page) {
  await page.evaluate(async () => {
    // Woodmart's sticky-header script leaves the live header 15px shorter after the page has
    // been scrolled down and back up. Remember its height on load and restore it afterwards so
    // the capture shows what a visitor sees when the page opens.
    const header = document.querySelector("header");
    const headerHeight = header?.getBoundingClientRect().height;
    document.querySelectorAll(".elementor-invisible").forEach((el) => el.classList.remove("elementor-invisible"));
    document.querySelectorAll("img[data-src], img[data-lazy-src]").forEach((img) => {
      const src = img.dataset.src || img.dataset.lazySrc;
      if (src) img.src = src;
      if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    });
    document.querySelectorAll("[data-bg]").forEach((el) => {
      el.style.backgroundImage = `url("${el.dataset.bg}")`;
    });
    const step = Math.round(window.innerHeight * 0.7);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 350));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
    if (header && headerHeight) header.style.setProperty("min-height", `${headerHeight}px`, "important");
  });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await freezeViewportHeights(page);
}

// The capture makes the window as tall as the page (makeWindowAsTallAsPage), so any
// section sized in `vh` (the homepage hero) would grow to fill the whole image and
// push the rest out of frame. Lock those heights to their real pixel values.
// Only elements whose height really follows the window height are locked: the window is made
// 600px taller for a moment and the elements that changed are the ones to lock. (Locking every
// element of a rule that merely mentions `vh` moved the live product pages' footer by 40px.)
async function freezeViewportHeights(page) {
  const viewport = page.viewportSize();
  const measure = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-vh-candidate]")].map((el) => {
        const cs = getComputedStyle(el);
        return `${cs.height}|${cs.minHeight}|${cs.maxHeight}`;
      }),
    );
  await markViewportHeightCandidates(page);
  const before = await measure();
  await page.setViewportSize({ width: viewport.width, height: viewport.height + 600 });
  await page.waitForTimeout(300);
  const taller = await measure();
  await page.setViewportSize(viewport);
  await page.waitForTimeout(300);
  const changed = before.map((value, i) => value !== taller[i]);
  await page.evaluate((changed) => {
    [...document.querySelectorAll("[data-vh-candidate]")].forEach((el, i) => {
      if (!changed[i]) return;
      const cs = getComputedStyle(el);
      el.style.setProperty("min-height", cs.minHeight === "auto" ? "0px" : cs.minHeight, "important");
      el.style.setProperty("height", cs.height, "important");
      el.style.setProperty("max-height", cs.maxHeight === "none" ? "none" : cs.maxHeight, "important");
    });
  }, changed);
}

// A whole-page picture is taken by making the window as tall as the page and photographing the
// window, not with Playwright's `fullPage` option. On 5 Nov 2026 (Chrome 152), `fullPage` drew the
// homepage differently from one capture to the next, on the live site as much as on the rebuild
// (two live captures 7.9% apart: the hero picture scaled differently, text shifted by a pixel),
// while two "tall window" captures agree to 0.00–0.06%. The window keeps its width, so a page that
// sticks out sideways is still photographed at the window's width.
// Chrome can't draw a window much taller than 16,384px (its largest texture): the picture then never
// comes. Pages taller than that (the homepage and some product pages on tablets and phones) are still
// taken with `fullPage`, which draws them in pieces; returns false for those.
const TALLEST_WINDOW = 16_000;
async function makeWindowAsTallAsPage(page, viewport) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    if (height > TALLEST_WINDOW) {
      await page.setViewportSize(viewport);
      return false;
    }
    if (page.viewportSize()?.height === height) return true;
    await page.setViewportSize({ width: viewport.width, height });
    await page.waitForTimeout(1000);
  }
  return true;
}

// Marks every element that a CSS rule mentioning vh/svh/dvh/lvh applies to.
async function markViewportHeightCandidates(page) {
  await page.evaluate(() => {
    const vhSelectors = [];
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.cssRules) walk(rule.cssRules);
        if (!rule.style || !rule.selectorText) continue;
        const text = rule.style.cssText;
        if (/vh|svh|dvh|lvh/.test(text)) vhSelectors.push(rule.selectorText);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
        // cross-origin stylesheet (Google Fonts etc.): nothing to freeze
      }
    }
    const targets = new Set();
    for (const selector of vhSelectors) {
      try {
        document.querySelectorAll(selector).forEach((el) => targets.add(el));
      } catch {
        // selector with pseudo-elements, ignore
      }
    }
    document.querySelectorAll("[style*='vh']").forEach((el) => targets.add(el));
    for (const el of targets) el.setAttribute("data-vh-candidate", "");
  });
}

/**
 * Cloudflare can serve a copy of a live page that is a day old (seen on 4 Nov 2026: the cached /shop/
 * lacked a footer link the owner had added since). An extra, unused query argument skips that cache,
 * so references show the live site as it is now. The rebuild is captured with the plain URL.
 */
function freshPath(urlPath) {
  if (process.env.CAPTURE_BASE_URL) return urlPath;
  return urlPath + (urlPath.includes("?") ? "&" : "?") + `_fresh=${Date.now()}`;
}

async function capture(browser, [name, urlPath], viewport, { hideAgeGate = true, suffix = "", cartState = null } = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.mobile),
    hasTouch: Boolean(viewport.mobile),
    deviceScaleFactor: 1,
    ...(cartState ? { storageState: cartState } : {}),
  });
  if (cartState) await context.route(TRACKERS, (route) => route.abort());
  const page = await context.newPage();
  const file = path.join(OUT_DIR, name, `${viewport.name}${suffix}.jpg`);
  try {
    await page.goto(SITE + freshPath(urlPath), { waitUntil: "load", timeout: 90_000 });
    // A cart page that redirected (e.g. the checkout to /cart/) means the cart was empty: no picture.
    if (cartState && new URL(page.url()).pathname !== urlPath) throw new Error(`redirected to ${new URL(page.url()).pathname}`);
    if (hideAgeGate) {
      await page.addStyleTag({ content: HIDE_OVERLAYS_CSS });
      await revealEverything(page);
    } else {
      await page.waitForTimeout(2500); // popup opens after a 1s delay
    }
    await mkdir(path.dirname(file), { recursive: true });
    if (cartState && process.env.MARKUP_DIR && viewport.name === "desktop-1440") {
      await mkdir(process.env.MARKUP_DIR, { recursive: true });
      await writeFile(path.join(process.env.MARKUP_DIR, `${name}.html`), await cleanMarkup(page), "utf8");
    }
    const tallWindow = hideAgeGate && (await makeWindowAsTallAsPage(page, viewport));
    await page.screenshot({ path: file, fullPage: hideAgeGate && !tallWindow, type: "jpeg", quality: 60, timeout: 120_000 });
    console.log("ok   ", name, viewport.name + suffix);
  } catch (error) {
    console.log("FAIL ", name, viewport.name, error.message.split("\n")[0]);
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((name) => name.trim())) : null;
  const templates = only ? TEMPLATES.filter(([name]) => only.has(name)) : TEMPLATES;
  // One guest cart per kind, shared by every viewport of its templates.
  const cartStates = {};
  for (const [, , options] of templates) {
    if (options?.cart && !cartStates[options.cart]) {
      cartStates[options.cart] = await fillCart(browser, CARTS[options.cart]);
      console.log("cart ", options.cart, "filled");
    }
  }
  const jobs = [];
  for (const template of templates) {
    const cartState = template[2]?.cart ? cartStates[template[2].cart] : null;
    for (const viewport of VIEWPORTS) jobs.push([template, viewport, { cartState }]);
  }
  // First-visit state with the age-verification popup open.
  if (!only || only.has("home")) {
    jobs.push([TEMPLATES[0], VIEWPORTS[0], { hideAgeGate: false, suffix: "-age-gate" }]);
    jobs.push([TEMPLATES[0], VIEWPORTS[3], { hideAgeGate: false, suffix: "-age-gate" }]);
  }

  const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const [template, viewport, options] = jobs[next++];
        await capture(browser, template, viewport, options);
      }
    }),
  );
  await browser.close();
}

main();
