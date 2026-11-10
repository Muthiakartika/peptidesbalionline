/**
 * A single product page (/product/<slug>/), the live site's WooCommerce + Woodmart template:
 *
 *   ┌ gallery card ┬ summary card: breadcrumbs, title, price, short description, included
 *   │              │ supplies, options + quantity + Add to cart, the green/gold buttons block,
 *   │              │ "Also available as"
 *   ├ tabs (Description + the product's custom tabs)
 *   └ related products
 *
 * Class names are the live page's (WooCommerce/Woodmart) on purpose: the site owner's CSS
 * (src/styles/product-owner.css) targets them. Theme rules: src/styles/product.css.
 * Content that WordPress stored as HTML (descriptions, Elementor blocks) is shown as it is, with
 * Elementor's own CSS, in the live site's order (it decides which of two equally strong rules wins):
 *   1. Elementor core and 2. the Elementor "kit" (src/styles/legacy/, imported first below),
 *   3. the theme's and the owner's CSS (the next imports),
 *   4. the CSS Elementor generated for each document on the page (public/legacy/elementor/post-<id>.css),
 *      linked inside the page like Elementor does, so it always comes after everything in <head>.
 */
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
import "@/styles/shop.css";
import "@/styles/product.css";
import "@/styles/legacy-content.css";
import "@/styles/product-owner.css";
import "@/styles/usd-prices-owner.css";

import Link from "next/link";
import { Fragment } from "react";

import { JsonLd } from "@/components/seo/JsonLd";
import { backorderFor, getCatalogState, getProductById } from "@/lib/catalog";
import { getSharedBlockHtml, type ProductPageData } from "@/lib/catalog/product-page";
import type { Product } from "@/lib/catalog/types";
import { cleanLegacyHtml } from "@/lib/legacy-html";

import { AddToCartForm, SummaryPrice } from "./AddToCartForm";
import { LegacyHtml } from "./LegacyHtml";
import { ProductGallery } from "./ProductGallery";
import { ProductGalleryProvider } from "./ProductGalleryContext";
import { ProductTabs } from "./ProductTabs";
import { RelatedProducts } from "./RelatedProducts";
import { ScrollbarWidth } from "./ScrollbarWidth";
import { TrackRecentlyViewed } from "./TrackRecentlyViewed";

/** Elementor documents whose CSS is not linked: the site footer and the top-bar marquee (rebuilt
 * natively) and the kit (bundled). */
const NOT_LINKED = new Set([267, 4118, 7]);

export async function ProductPage({ product, page }: { product: Product; page: ProductPageData }) {
  const related = (await Promise.all(page.related.map((id) => getProductById(id)))).filter((p): p is Product => Boolean(p));
  const backorder = backorderFor(product, (await getCatalogState()).backorder);
  const afterBlocks = (await Promise.all(page.afterAddToCart.map(async (id) => cleanLegacyHtml(await getSharedBlockHtml(id))))).join("");
  const tabs = page.tabs.map((tab) => ({ key: tab.key, title: tab.title, html: cleanLegacyHtml(tab.html) }));

  return (
    <main id="main-content" className="single-product elementor-kit-7">
      <JsonLd path={product.path} />
      {/* Plain links (no "precedence"), so React leaves them here in the page instead of moving them
          into <head>: they must load after every other stylesheet, as on the live site. Plain files in
          public/ because each page needs only a few of the 44. */}
      {page.elementorStyles
        .filter((id) => !NOT_LINKED.has(id))
        .map((id) => (
          <link key={id} rel="stylesheet" href={`/legacy/elementor/post-${id}.css`} />
        ))}
      <div className="single-product-page single-product-content wd-sticky-on product-sticky-on">
        <div className="container">
          <ProductGalleryProvider images={page.form.type === "variable" ? page.form.images : undefined}>
            <div className="product-image-summary-wrap">
              <div className="product-image-summary">
                <div className="product-image-summary-inner wd-grid-g">
                  <div className="product-images wd-grid-col">
                    <ProductGallery images={page.gallery} thumbnails={page.thumbnails} />
                  </div>
                  <div className="summary entry-summary text-left wd-grid-col">
                    <div className="summary-inner wd-set-mb reset-last-child">
                      <div className="single-breadcrumbs-wrapper">
                        <nav className="wd-breadcrumbs woocommerce-breadcrumb" aria-label="Breadcrumb">
                          {page.breadcrumbs.map((crumb, index) => (
                            <Fragment key={`${crumb.label}-${index}`}>
                              {index > 0 ? <span className="wd-delimiter" /> : null}
                              {crumb.path !== null ? (
                                // The live "Home" link is the bare domain, stored as "".
                                <Link href={crumb.path || "/"} className={index === page.breadcrumbs.length - 2 ? "wd-last-link" : undefined}>
                                  {crumb.label}
                                </Link>
                              ) : (
                                <span className="wd-last">{crumb.label}</span>
                              )}
                            </Fragment>
                          ))}
                        </nav>
                      </div>
                      <h1 className="product_title entry-title wd-entities-title">{page.title}</h1>
                      <SummaryPrice min={product.priceMin} max={product.priceMax} regular={product.regularPrice} />
                      {page.shortDescription ? (
                        <div className="woocommerce-product-details__short-description" data-legacy-html="" dangerouslySetInnerHTML={{ __html: cleanLegacyHtml(page.shortDescription) }} />
                      ) : null}
                      {page.includedSupplies ? (
                        <div className="sleeks-included-supplies" data-legacy-html="" dangerouslySetInnerHTML={{ __html: cleanLegacyHtml(page.includedSupplies) }} />
                      ) : null}
                      <AddToCartForm productId={product.id} productName={page.title} form={page.form} variations={product.variations} backorder={backorder} />
                      {afterBlocks ? <LegacyHtml className="wd-after-add-to-cart wd-entry-content" html={afterBlocks} /> : null}
                      {page.connectedFormats ? (
                        <div className="atlas-connected-formats" data-legacy-html="" dangerouslySetInnerHTML={{ __html: cleanLegacyHtml(page.connectedFormats) }} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ProductGalleryProvider>
        </div>
        <ProductTabs tabs={tabs} />
        <RelatedProducts products={related} />
      </div>
      <ScrollbarWidth />
      <TrackRecentlyViewed productId={product.id} />
    </main>
  );
}
