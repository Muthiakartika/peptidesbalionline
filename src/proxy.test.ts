/**
 * Where src/proxy.ts sends each request (as WordPress answers it). NextResponse.rewrite marks the
 * new address in the "x-middleware-rewrite" header; NextResponse.next() in "x-middleware-next".
 */
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { CART_COOKIE, encodeCart } from "./lib/commerce/cart-cookie";
import { proxy } from "./proxy";

// trailingSlash as in next.config.ts, so the addresses keep their final "/".
const run = (address: string) => proxy(new NextRequest(new URL(address, "http://localhost:3000"), { nextConfig: { trailingSlash: true } }));
const rewrittenTo = async (address: string) => {
  const target = (await run(address)).headers.get("x-middleware-rewrite");
  return target ? new URL(target).pathname + new URL(target).search : null;
};

describe("proxy", () => {
  it("serves each landing page from the landing route, keeping the query", async () => {
    expect(await rewrittenTo("/bpc-157-bali/")).toBe("/landing/bpc-157-bali/");
    expect(await rewrittenTo("/peptide/")).toBe("/landing/peptide/");
    expect(await rewrittenTo("/peptide/jakarta/")).toBe("/landing/peptide-jakarta/");
    expect(await rewrittenTo("/fat-loss-peptides-bali/?utm_source=x")).toBe("/landing/fat-loss-peptides-bali/?utm_source=x");
  });

  it("serves each blog post from the post route", async () => {
    expect(await rewrittenTo("/what-is-bpc-157/")).toBe("/blog-post/what-is-bpc-157/");
    expect(await rewrittenTo("/bpc-157-vs-tb-500/?utm_source=x")).toBe("/blog-post/bpc-157-vs-tb-500/?utm_source=x");
    expect(await rewrittenTo("/blog-post/what-is-bpc-157/")).toBe("/blog-post/");
  });

  it("lets the blog archive pages through and sends archive pages that don't exist to the 404 page", async () => {
    expect((await run("/category/uncategorized/page/5/")).headers.get("x-middleware-next")).toBe("1");
    expect((await run("/category/peptide-therapy/")).headers.get("x-middleware-next")).toBe("1");
    expect(await rewrittenTo("/category/peptide-therapy/page/2/")).toBe("/category/");
    expect(await rewrittenTo("/category/no-such-category/")).toBe("/category/");
  });

  it("answers the landing route's own addresses with the 404 page", async () => {
    expect(await rewrittenTo("/landing/bpc-157-bali/")).toBe("/landing/");
    expect(await rewrittenTo("/landing/")).toBe("/landing/");
  });

  it("leaves other addresses to their routes (unknown ones get the 404 page there)", async () => {
    // /protocol-builder/ has its own route (src/app/(store)/protocol-builder/page.tsx); the others none.
    for (const address of ["/no-such-page/", "/peptide/nowhere/", "/protocol-builder/", "/protocol-builder/foo/"]) {
      expect((await run(address)).headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("answers the cart, checkout and account addresses as the live site does for a visitor", async () => {
    const redirectedTo = async (address: string) => {
      const response = await run(address);
      return `${response.status} ${new URL(response.headers.get("location")!).pathname}`;
    };
    // Checked on the live site on 5 Nov 2026 (empty cart, not logged in).
    expect(await redirectedTo("/checkout/")).toBe("302 /cart/");
    expect(await redirectedTo("/checkout/order-pay/")).toBe("302 /cart/");
    expect(await redirectedTo("/my-account/delete-payment-method/")).toBe("302 /my-account/payment-methods/");
    expect((await run("/checkout/order-received/123/")).headers.get("x-middleware-next")).toBe("1");
    expect((await run("/checkout/order-pay/123/")).headers.get("x-middleware-next")).toBe("1");
    expect(await rewrittenTo("/cart/?cancel_order=true&order=wc_order_x&order_id=1")).toBe("/woo/cancel-order/?cancel_order=true&order=wc_order_x&order_id=1");
    // A coupon's "[Remove]" followed as a link, on the cart and on the checkout (even with an empty cart).
    expect(await rewrittenTo("/cart/?remove_coupon=welcome5")).toBe("/woo/remove-coupon/?remove_coupon=welcome5&back=%2Fcart%2F");
    expect(await rewrittenTo("/checkout/?remove_coupon=welcome5")).toBe("/woo/remove-coupon/?remove_coupon=welcome5&back=%2Fcheckout%2F");
    // The account pages have routes of their own (each shows the login form to a visitor).
    for (const address of ["/my-account/orders/", "/my-account/orders/2/", "/my-account/view-order/123/", "/my-account/edit-address/", "/my-account/edit-address/billing/", "/my-account/edit-account/", "/my-account/downloads/", "/my-account/research-tools/", "/my-account/rewards/"]) {
      expect((await run(address)).headers.get("x-middleware-next"), address).toBe("1");
    }
    // Logging out without a session: the login page.
    expect(await rewrittenTo("/my-account/customer-logout/")).toBe("/my-account/");
    // WordPress ignores what doesn't fit an endpoint.
    expect(await rewrittenTo("/my-account/orders/abc/")).toBe("/my-account/orders/");
    expect(await rewrittenTo("/my-account/view-order/")).toBe("/my-account/view-order/0/");
    expect(await rewrittenTo("/my-account/edit-address/foo/")).toBe("/my-account/edit-address/");
    expect(await rewrittenTo("/my-account/downloads/x/")).toBe("/my-account/downloads/");
    expect(await rewrittenTo("/my-account/add-payment-method/")).toBe("/my-account/payment-methods/");
    expect(await rewrittenTo("/my-account/lost-password/?reset-link-sent=true")).toBe("/woo/reset-link-sent/?reset-link-sent=true");
    expect(await rewrittenTo("/my-account/lost-password/sent/")).toBe("/my-account/lost-password/");
    for (const address of ["/cart/", "/my-account/", "/my-account/lost-password/", "/my-account/lost-password/?reset-link-sent=0", "/checkout/order-received/", "/my-account/foo/", "/checkout/foo/"]) {
      expect((await run(address)).headers.get("x-middleware-next"), address).toBe("1");
    }
    expect(await rewrittenTo("/woo/order-invalid/")).toBe("/woo/");
  });

  it("sends a logged-in customer's logout to its route, and drops a stale logged-in cookie", async () => {
    const request = (path: string, cookies: Record<string, string>) => {
      const r = new NextRequest(new URL(path, "http://localhost:3000"), { nextConfig: { trailingSlash: true } });
      for (const [name, value] of Object.entries(cookies)) r.cookies.set(name, value);
      return proxy(r);
    };
    expect((await request("/my-account/customer-logout/", { "better-auth.session_token": "x" })).headers.get("x-middleware-next")).toBe("1");
    const stale = await request("/shop/", { atlas_account: "0123456789" });
    expect(stale.headers.get("set-cookie")).toContain("atlas_account=;");
    const fresh = await request("/shop/", { atlas_account: "0123456789", "better-auth.session_token": "x" });
    expect(fresh.headers.get("set-cookie")).toBeNull();
  });

  it("shows the checkout once the cart cookie holds items (a broken cookie is an empty cart)", async () => {
    const withCart = (value: string) => {
      const request = new NextRequest(new URL("/checkout/", "http://localhost:3000"), { nextConfig: { trailingSlash: true } });
      request.cookies.set(CART_COOKIE, value);
      return proxy(request);
    };
    expect((await withCart(encodeCart({ items: [{ productId: 1234, variationId: null, quantity: 1 }], coupons: [] }))).headers.get("x-middleware-next")).toBe("1");
    for (const value of [encodeCart({ items: [], coupons: [] }), "not-a-cart"]) {
      const response = await withCart(value);
      expect(`${response.status} ${new URL(response.headers.get("location")!).pathname}`).toBe("302 /cart/");
    }
  });

  it("answers unknown shop, category and product addresses with a real 404, as the live site", async () => {
    const passes = async (address: string) => (await run(address)).headers.get("x-middleware-next") === "1";
    const redirectedTo = async (address: string) => {
      const response = await run(address);
      const location = new URL(response.headers.get("location")!);
      return `${response.status} ${location.pathname}${location.search}`;
    };
    // Checked on the live site on 6 Nov 2026 (182 products, 21 per page: 9 shop pages).
    for (const address of ["/product/bpc-157/", "/product/bpc-157/?attribute_pa_size=10mg", "/shop/", "/shop/?orderby=date", "/shop/page/9/", "/product-category/vial/", "/product-category/vial/?utm_source=x", "/product-category/healing-recovery/", "/product-category/foo/healing-recovery/"]) {
      expect(await passes(address), address).toBe(true);
    }
    // Archive arguments travel in the address, so category pages and the shop's following pages stay static.
    expect(await rewrittenTo("/shop/page/10/?per_page=9")).toBe("/shop/page/10/view/per_page%3D9/?per_page=9");
    expect(await rewrittenTo("/shop/page/2/?s=bpc")).toBe("/shop/page/2/view/s%3Dbpc/?s=bpc");
    expect(await rewrittenTo("/product-category/vial/?orderby=date&utm_source=x")).toBe("/product-category/vial/view/orderby%3Ddate/?orderby=date&utm_source=x");
    expect(await rewrittenTo("/product-category/vial/page/2/?per_page=9&orderby=price")).toBe("/product-category/vial/page/2/view/orderby%3Dprice%26per_page%3D9/?per_page=9&orderby=price");
    expect(await rewrittenTo("/product-category/vial/page/0/?orderby=date")).toBe("/product-category/vial/view/orderby%3Ddate/?orderby=date");
    // Those internal addresses aren't pages themselves.
    expect(await rewrittenTo("/product-category/vial/view/orderby%3Ddate/")).toBe("/product-category/");
    expect(await rewrittenTo("/shop/page/2/view/orderby%3Ddate/")).toBe("/shop/page/");
    expect(await rewrittenTo("/product/no-such-product/")).toBe("/product/");
    expect(await rewrittenTo("/product/cagrilintide-semaglutide-blend-10mg-bali/")).toBe("/product/");
    expect(await rewrittenTo("/product-category/no-such-category/")).toBe("/product-category/");
    expect(await rewrittenTo("/product-category/vial/no-such-sub/")).toBe("/product-category/");
    expect(await rewrittenTo("/shop/page/10/")).toBe("/shop/page/");
    expect(await rewrittenTo("/shop/page/22/?per_page=9")).toBe("/shop/page/?per_page=9");
    expect(await rewrittenTo("/shop/page/abc/")).toBe("/shop/page/");
    expect(await rewrittenTo("/product-category/vial/healing-recovery/page/2/")).toBe("/product-category/");
    expect(await redirectedTo("/shop/page/1/")).toBe("301 /shop/");
    expect(await redirectedTo("/shop/page/01/?orderby=date")).toBe("301 /shop/?orderby=date");
    expect(await redirectedTo("/shop/page/02/")).toBe("301 /shop/page/2/");
    expect(await redirectedTo("/product-category/vial/page/1/")).toBe("301 /product-category/vial/");
    // Letter case doesn't matter, and page 0 is the first page (both 200 on live, canonical lower case / first page).
    expect(await rewrittenTo("/product/BPC-157/")).toBe("/product/bpc-157/");
    expect(await rewrittenTo("/product-category/VIAL/")).toBe("/product-category/vial/");
    expect(await rewrittenTo("/shop/page/0/?orderby=date")).toBe("/shop/?orderby=date");
    expect(await rewrittenTo("/product-category/vial/page/00/")).toBe("/product-category/vial/");
  });

  it("keeps the homepage and its search as before", async () => {
    expect((await run("/")).headers.get("x-middleware-next")).toBe("1");
    expect(await rewrittenTo("/?s=bpc&post_type=product")).toBe("/page/1/?s=bpc&post_type=product");
    expect((await run("/page/1/")).status).toBe(301);
    expect(await rewrittenTo("/page/2/")).toBe("/");
  });

  it("serves a post's comments feed, and keeps its internal address private", async () => {
    expect(await rewrittenTo("/bpc-157-vs-tb-500/feed/")).toBe("/feed/comments/bpc-157-vs-tb-500/");
    expect(await rewrittenTo("/feed/comments/bpc-157-vs-tb-500/")).toBe("/feed/comments/");
    // The site's own feeds have routes of their own.
    expect(await rewrittenTo("/feed/")).toBeNull();
    expect(await rewrittenTo("/comments/feed/")).toBeNull();
  });
});
