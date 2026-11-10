/**
 * The frame WordPress prints around a WooCommerce page (cart, checkout, my account), with the
 * theme's default template:
 *
 *   the black title band (`band`: the checkout steps or a title with breadcrumbs)
 *   main.wd-content-layout.container.wd-builder-off > div.wd-content-area > article#post-<id> >
 *   div.woocommerce > the page's own markup (`children`)
 *
 * The markup inside is WooCommerce's and Woodmart's, so it is marked like the HTML copied from the
 * live site (data-legacy-html: Tailwind utilities and Tailwind's reset stay out of it).
 * "blog-page" gives it the theme's page frame and form look shared with the blog
 * (src/styles/elementor-page.css, src/styles/blog.css), "woo-page" the WooCommerce rules
 * (src/styles/woocommerce.css).
 *
 * WordPress page ids: the cart is page 10, the checkout 11, my account 12.
 */
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";
import "@/styles/woocommerce.css";

import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/JsonLd";

/**
 * `jsonLdPath`: whose structured data to print (the live site prints the cart's, the account's …).
 * `pageClass`: the class WordPress puts on <body> for this page ("woocommerce-cart",
 * "woocommerce-checkout"), which the owner's CSS uses; here it sits on <main>.
 */
export function WooPage({
  pageId,
  band,
  jsonLdPath,
  pageClass,
  children,
}: {
  pageId: 10 | 11 | 12;
  band: ReactNode;
  jsonLdPath: string;
  pageClass?: string;
  children: ReactNode;
}) {
  return (
    <>
      <JsonLd path={jsonLdPath} />
      {band}
      <main
        id="main-content"
        className={`wd-content-layout content-layout-wrapper container wd-builder-off blog-page woo-page elementor-kit-7${pageClass ? ` ${pageClass}` : ""}`}
        role="main"
      >
        <div className="wd-content-area site-content">
          <article id={`post-${pageId}`} className={`entry-content post-${pageId} page type-page status-publish hentry`} data-legacy-html="">
            <div className="woocommerce">{children}</div>
          </article>
        </div>
      </main>
    </>
  );
}
