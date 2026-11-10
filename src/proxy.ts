/**
 * Runs before a page is rendered (Next.js "proxy", formerly "middleware") and sends each request
 * where WordPress would answer it:
 *
 *   a landing page's address    -> its page, e.g. /peptide/jakarta/ -> /landing/peptide-jakarta/
 *                                  (rendered by src/app/(store)/landing/[name]/page.tsx; the address
 *                                  bar keeps /peptide/jakarta/). /landing/… itself -> the 404 page;
 *   a blog post's address       -> its page, e.g. /what-is-bpc-157/ -> /blog-post/what-is-bpc-157/
 *                                  (src/app/(store)/blog-post/[slug]/page.tsx); /blog-post/… -> 404;
 *   /category/<slug>/page/N/    -> the archive when that page exists, else the 404 page (with
 *                                  status 404, as on WordPress: /category/peptide-therapy/page/2/);
 *   cart, checkout and account addresses -> see woocommerce() below (e.g. /checkout/ with an empty
 *                                  cart -> 302 /cart/, /my-account/orders/ -> the login page);
 *   /?s=bpc&post_type=product   -> the product search, page 1 (rendered by /page/[page]);
 *   /page/1/ and /page/0/       -> 301 to "/" (as WordPress), keeping the query; /page/1/?s=… is
 *                                  the search's page 1, as there;
 *   /page/02/                   -> 301 to /page/2/;
 *   /page/2/ … /page/999/       -> the homepage (WordPress shows it there too, canonical "/");
 *   /page/2/?s=…                -> the product search, page 2 (unchanged);
 *   "/" without a search        -> the homepage, untouched;
 *   shop, category and product addresses that don't exist -> a real 404; see shopAddress() below.
 * The live site's old addresses (Redirection plugin) are answered before this file, by next.config.ts.
 *
 * Doing this here keeps these pages static: the homepage never reads the address's query, and the
 * landing pages are built in advance while unknown addresses still get a real 404 (see the landing
 * route). Their HTML is ready in advance and visible without JavaScript. Docs:
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 */
import { NextResponse, type NextRequest } from "next/server";

import { pickArchiveParams, VIEW_SEGMENT, viewSegment } from "@/components/shop/shop-url";
import { blogArchivePaths, blogPostSlugs } from "@/content/blog";
import { elementorPageNames } from "@/content/pages";
import { currentShopIndex, lastPage, normalisePerPage, type ShopIndex } from "@/lib/catalog/archive-index";
import { ACCOUNT_COOKIE, SESSION_COOKIES } from "@/lib/account/account-cookie";
import { CART_COOKIE, cartCount, decodeCart } from "@/lib/commerce/cart-cookie";

const PAGED = /^\/page\/(\d+)\/?$/;
/** "…/page/<n>/" at the end of an address: [the address before it, n as written]. */
const PAGE_SUFFIX = /^(.*\/)page\/([^/]+)\/$/;
/** A shop or category page's internal address with its archive arguments ("…/view/orderby%3Ddate/"). */
const VIEW_ADDRESS = new RegExp(`/${VIEW_SEGMENT}/[^/]*/$`);
/** Landing page address -> page name, e.g. "/peptide/jakarta/" -> "peptide-jakarta". */
const LANDING_PAGES = new Map<string, string>(Object.entries(elementorPageNames).filter(([path]) => path !== "/"));
/** Blog post address -> slug, e.g. "/what-is-bpc-157/" -> "what-is-bpc-157". */
const BLOG_POSTS = new Map<string, string>(Object.entries(blogPostSlugs));
/** The blog archive pages that exist (/category/uncategorized/page/2/ …). */
const BLOG_ARCHIVES = new Set<string>(blogArchivePaths);
/** Internal routes that only the rewrites above may reach. */
const INTERNAL = ["/landing/", "/blog-post/", "/woo/"];
/** Account endpoints with a page of their own and no value (/my-account/downloads/): a value after them
 * (/my-account/downloads/x/) is ignored, as WordPress does. */
const PLAIN_ENDPOINTS = new Set(["downloads", "edit-account", "payment-methods", "research-tools"]);
/** Account actions WooCommerce answers by going back to the payment methods. */
const PAYMENT_METHOD_ACTIONS = new Set(["delete-payment-method", "set-default-payment-method"]);

/**
 * WooCommerce's cart, checkout and account addresses, answered as the live site answers them (Phase 3h;
 * carts, checkout and accounts: Phase 5). Every account page shows the login form to a visitor:
 *
 *   /checkout/                            -> the checkout when the cart cookie holds items, else
 *                                            302 to /cart/ (as WooCommerce does for an empty cart);
 *   /checkout/order-pay/                  -> 302 to /cart/;
 *   /checkout/order-received/<n>/         -> the "thank you" page with the order (its own route);
 *   /checkout/order-pay/<n>/              -> paying for the order (its own route; "this order is invalid"
 *                                            without the right ?key=);
 *   /cart/?cancel_order=true&…            -> cancelling an order (the route /woo/cancel-order/);
 *   /cart/?remove_coupon=<code>, /checkout/?remove_coupon=<code> -> removing that coupon (/woo/remove-coupon/);
 *   /my-account/orders/<n>/               -> that page of orders (a whole number), else page 1;
 *   /my-account/view-order/               -> "Invalid order." (/my-account/view-order/0/);
 *   /my-account/edit-address/<type>/      -> the billing / shipping form; any other type the Addresses page;
 *   /my-account/<downloads, edit-account, payment-methods, research-tools>/<value>/ -> the endpoint itself;
 *   /my-account/add-payment-method/       -> the payment methods (no method here saves cards);
 *   /my-account/customer-logout/          -> logging out (its route) with a session cookie, else the
 *                                            login page (/my-account/);
 *   /my-account/delete-payment-method/    -> 302 to /my-account/payment-methods/ (same for
 *                                            set-default-payment-method);
 *   /my-account/lost-password/?reset-link-sent=true -> the "email sent" message (/woo/reset-link-sent/);
 *   /my-account/lost-password/<value>/    -> the lost-password form.
 * Anything else under /checkout/ or /my-account/ (e.g. /my-account/foo/) has no page: 404.
 * null: not one of these addresses.
 */
function woocommerce(url: NextRequest["nextUrl"], hasCart: boolean, loggedIn: boolean): NextResponse | null {
  const [section, endpoint, ...rest] = url.pathname.split("/").filter(Boolean);
  const to = (pathname: string, redirect = false) => {
    const target = url.clone();
    target.pathname = pathname;
    if (redirect) {
      target.search = "";
      return NextResponse.redirect(target, 302);
    }
    return NextResponse.rewrite(target);
  };
  // "Resend" on My Account (a new link to set the password): its route, for a visitor with a session.
  if (section === "my-account" && !endpoint && url.searchParams.has("wc-resend-set-password") && loggedIn) return to("/woo/resend-set-password/");
  // An order's "Cancel" link (WooCommerce puts it on the cart address).
  if (section === "cart" && !endpoint && url.searchParams.get("cancel_order") === "true") return to("/woo/cancel-order/");
  // A coupon's "[Remove]" followed as a link, on the cart or the checkout.
  if ((section === "cart" || section === "checkout") && !endpoint && url.searchParams.has("remove_coupon")) {
    const target = url.clone();
    target.pathname = "/woo/remove-coupon/";
    target.searchParams.set("back", `/${section}/`);
    return NextResponse.rewrite(target);
  }
  if (section === "checkout") {
    if (!endpoint) return hasCart ? null : to("/cart/", true);
    if (endpoint === "order-pay" && rest.length === 0) return to("/cart/", true);
    // A number: the thank-you page's own route (it shows the order when the ?key= matches).
    if (endpoint === "order-received" && rest.length === 1) return null;
    // A number: the order-pay page's own route (it checks the order's key and owner).
    if (endpoint === "order-pay" && rest.length === 1) return null;
    return null;
  }
  if (section !== "my-account" || !endpoint) return null;
  if (endpoint === "lost-password") {
    // WordPress's "not empty": "0" counts as empty.
    const sent = url.searchParams.get("reset-link-sent");
    if (sent && sent !== "0") return to("/woo/reset-link-sent/");
    return rest.length ? to("/my-account/lost-password/") : null;
  }
  if (PAYMENT_METHOD_ACTIONS.has(endpoint)) return to("/my-account/payment-methods/", true);
  if (endpoint === "customer-logout") return loggedIn ? (rest.length ? to("/my-account/customer-logout/") : null) : to("/my-account/");
  if (endpoint === "add-payment-method") return to("/my-account/payment-methods/");
  if (PLAIN_ENDPOINTS.has(endpoint)) return rest.length ? to(`/my-account/${endpoint}/`) : null;
  if (endpoint === "orders") {
    if (!rest.length) return null;
    return /^\d+$/.test(rest[0]) && rest.length === 1 ? null : to("/my-account/orders/");
  }
  if (endpoint === "view-order") {
    if (rest.length === 1) return null;
    return to(`/my-account/view-order/${rest[0] ?? "0"}/`);
  }
  if (endpoint === "edit-address") {
    if (!rest.length) return null;
    if ((rest[0] === "billing" || rest[0] === "shipping") && rest.length === 1) return null;
    return to(rest[0] === "billing" || rest[0] === "shipping" ? `/my-account/edit-address/${rest[0]}/` : "/my-account/edit-address/");
  }
  return null;
}

/**
 * The shop, its categories and the products, answered as WordPress answers them. Their routes are
 * built in advance, and with Cache Components an address they don't know would get the 404 page with
 * status 200 ("soft 404"); here it gets the 404 page with status 404 (checked on live, 6 Nov 2026):
 *
 *   /product/<slug>/ that isn't a product     -> 404 (the address "/product/" has no page);
 *   /product-category/…/<slug>/ whose last slug isn't a category -> 404 (only the last slug counts,
 *                                                as on WordPress: /product-category/foo/healing-recovery/ works);
 *   letter case doesn't matter: /product/BPC-157/ shows /product/bpc-157/ (its canonical is lower case);
 *   /shop/page/1/, …/page/01/                 -> 301 to the first page (query kept);
 *   …/page/0/, …/page/00/                     -> the first page itself (200, canonical the first page);
 *   …/page/02/                                -> 301 to …/page/2/;
 *   …/page/<n>/ after the last page for the address's ?per_page= (21 by default), or not a number
 *                                             -> 404 (/shop/page/10/ is 404, /shop/page/10/?per_page=9 a page).
 * Search results (?s=) keep their own paging. null: an address this doesn't change.
 *
 * A category page or a shop page after the first with archive arguments (?orderby=, ?per_page=, …) is
 * served from the same route with the arguments in the address (…/view/orderby%3Ddate/, see
 * VIEW_SEGMENT): those routes read no query, so every one of their pages is static, also for a category
 * or a page number made after the build. Those internal addresses themselves are 404.
 */
function shopAddress(url: NextRequest["nextUrl"], { productPaths, shopProductCount, categoryProductCounts }: ShopIndex): NextResponse | null {
  const pathname = url.pathname.toLowerCase();
  const serve = (path: string) => {
    if (path === url.pathname) return null;
    const target = url.clone();
    target.pathname = path;
    return NextResponse.rewrite(target);
  };
  // The same rewrite: to an address that has no page, so its route answers with a real 404.
  const notFound = serve;
  if (pathname.startsWith("/product/")) {
    if (pathname.split("/").filter(Boolean).length !== 2) return null;
    return productPaths.has(pathname) ? serve(pathname) : notFound("/product/");
  }
  const isShop = pathname.startsWith("/shop/");
  if (!isShop && !pathname.startsWith("/product-category/")) return null;

  const missingPage = isShop ? "/shop/page/" : "/product-category/";
  if (VIEW_ADDRESS.test(pathname)) return notFound(missingPage);
  const view = viewSegment(pickArchiveParams(Object.fromEntries(url.searchParams)));
  /** The page itself, with its archive arguments in the address (not for /shop/, which reads its query). */
  const page = (path: string) => serve(view && path !== "/shop/" ? `${path}${VIEW_SEGMENT}/${encodeURIComponent(view)}/` : path);

  const paged = PAGE_SUFFIX.exec(pathname);
  const base = paged ? paged[1] : pathname;
  let count: number | undefined;
  if (isShop) {
    if (base !== "/shop/") return null; // other /shop/… addresses: no route, a real 404 already
    count = shopProductCount;
  } else {
    const slug = base.split("/").filter(Boolean).slice(1).at(-1);
    count = slug ? categoryProductCounts.get(slug) : undefined;
    if (count === undefined) return notFound(missingPage);
  }
  if (!paged) return page(pathname);

  const written = paged[2];
  if (!/^\d+$/.test(written)) return notFound(missingPage);
  const number = Number(written);
  if (number === 0) return page(base);
  if (number === 1 || String(number) !== written) {
    const tidy = url.clone();
    tidy.pathname = number === 1 ? base : `${base}page/${number}/`;
    return NextResponse.redirect(tidy, 301);
  }
  if (url.searchParams.has("s")) return page(pathname);
  const perPage = normalisePerPage(url.searchParams.get("per_page"));
  return number > lastPage(count, perPage) ? notFound(missingPage) : page(pathname);
}

/** Whether the visitor has a session cookie (whether it is still valid, the page checks). */
const hasSession = (request: NextRequest) => SESSION_COOKIES.some((name) => request.cookies.has(name));

/** Shop addresses need the current list of products (products are added and archived in the admin). */
const SHOP_PREFIXES = ["/product/", "/shop/", "/product-category/"];

export async function proxy(request: NextRequest) {
  const lower = request.nextUrl.pathname.toLowerCase();
  let index = SHOP_PREFIXES.some((prefix) => lower.startsWith(prefix)) ? await currentShopIndex(request.nextUrl.origin) : null;
  // An unknown product or category address: check once more with a fresh list (it may have just been added).
  if (index && lower.startsWith("/product/") && lower.split("/").filter(Boolean).length === 2 && !index.productPaths.has(lower)) {
    index = await currentShopIndex(request.nextUrl.origin, true);
  } else if (index && lower.startsWith("/product-category/")) {
    const slug = (PAGE_SUFFIX.exec(lower)?.[1] ?? lower).split("/").filter(Boolean).slice(1).at(-1);
    if (slug && !index.categoryProductCounts.has(slug)) index = await currentShopIndex(request.nextUrl.origin, true);
  }
  const response = route(request, index);
  // The header's "logged in" cookie without a session (it expired, or was removed): remove it too.
  if (request.cookies.has(ACCOUNT_COOKIE) && !hasSession(request)) response.cookies.delete(ACCOUNT_COOKIE);
  return response;
}

function route(request: NextRequest, index: ShopIndex | null): NextResponse {
  const url = request.nextUrl;
  const isSearch = url.searchParams.has("s");

  const shop = index ? shopAddress(url, index) : null;
  if (shop) return shop;

  const landing = LANDING_PAGES.get(url.pathname);
  if (landing) {
    const target = url.clone();
    target.pathname = `/landing/${landing}/`;
    return NextResponse.rewrite(target);
  }
  const post = BLOG_POSTS.get(url.pathname);
  if (post) {
    const target = url.clone();
    target.pathname = `/blog-post/${post}/`;
    return NextResponse.rewrite(target);
  }
  if (url.pathname.startsWith("/category/") && !BLOG_ARCHIVES.has(url.pathname)) {
    // An archive page that doesn't exist. The archive route is built in advance, so it would answer
    // with the 404 page but status 200; "/category/" itself has no page, so the catch-all answers
    // it with a real 404.
    const missing = url.clone();
    missing.pathname = "/category/";
    return NextResponse.rewrite(missing);
  }
  const internal = INTERNAL.find((prefix) => url.pathname.startsWith(prefix));
  if (internal) {
    // Those routes' own addresses aren't pages of the site: "/landing/", "/blog-post/" and "/woo/"
    // have no page, so the catch-all answers them with the 404 page.
    const missing = url.clone();
    missing.pathname = internal;
    return NextResponse.rewrite(missing);
  }
  // Only whether the cart holds anything: the checkout itself prices the cart again (a cart whose
  // products are all gone is sent back to /cart/ by the page).
  const hasCart = cartCount(decodeCart(request.cookies.get(CART_COOKIE)?.value)) > 0;
  const account = woocommerce(url, hasCart, hasSession(request));
  if (account) return account;

  if (url.pathname === "/") {
    if (!isSearch) return NextResponse.next();
    const search = url.clone();
    search.pathname = "/page/1/";
    return NextResponse.rewrite(search);
  }

  const page = PAGED.exec(url.pathname);
  if (!page) return NextResponse.next(); // e.g. /page/abc/: the route answers 404; any other page
  const number = Number(page[1]);
  if (number === 0 || (number === 1 && !isSearch)) {
    const home = url.clone();
    home.pathname = "/";
    return NextResponse.redirect(home, 301);
  }
  if (String(number) !== page[1]) {
    // /page/02/ -> /page/2/, as WordPress does.
    const tidy = url.clone();
    tidy.pathname = `/page/${number}/`;
    return NextResponse.redirect(tidy, 301);
  }
  if (isSearch) return NextResponse.next();
  const home = url.clone();
  home.pathname = "/";
  home.search = "";
  return NextResponse.rewrite(home);
}

export const config = {
  // Every page address except those of routes this file never changes (the API, the Studio) and files
  // (anything with a dot: /legacy/…/post-1588.css, /robots.txt).
  matcher: ["/((?!_next/|api/|studio/|.*\\.).*)"],
};
