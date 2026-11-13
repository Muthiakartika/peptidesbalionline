/**
 * A single product page (/product/<slug>/). Redesigned on 12 Nov 2026 after the owner's reference
 * shops (every page one continuous page, src/styles/product-page.css), with the certificate card
 * of 13 Nov 2026 (ProductCoaCard) under the gallery:
 *
 *   ┌ top band across the screen: gallery │ breadcrumbs, category, title, price, lab-tested badge,
 *   │                                     │ short description, included supplies, options +
 *   │                                     │ quantity + Add to cart, the buttons block, "Also available as"
 *   ├ "On this page" bar (sticky): Overview · the custom tabs · Lab results · Related products
 *   ├ the description (a designed Elementor page) and the custom tabs, one after another
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
import "@/styles/product-page.css";

import Link from "next/link";
import { Fragment } from "react";

import { JsonLd } from "@/components/seo/JsonLd";
import { OfferBanner } from "@/components/woocommerce/OfferCard";
import { backorderFor, getAllProducts, getCatalogState, getCategories, getProductById } from "@/lib/catalog";
import { withParents } from "@/lib/commerce/cart-lines";
import { CURRENT_OFFER, qualifies } from "@/lib/commerce/offers";
import { getCoas } from "@/lib/coa/library";
import { coasForProduct } from "@/lib/coa/product-coas";
import { getSharedBlockHtml, type ProductPageData } from "@/lib/catalog/product-page";
import type { Product } from "@/lib/catalog/types";
import { cleanLegacyHtml } from "@/lib/legacy-html";
import { offerDate } from "@/lib/seo/offer-date";
import { productJsonLd } from "@/lib/seo/product-jsonld";

import { AddToCartForm, SummaryPrice } from "./AddToCartForm";
import { LegacyHtml } from "./LegacyHtml";
import { ProductGallery } from "./ProductGallery";
import { ProductGalleryProvider } from "./ProductGalleryContext";
import { ProductCoaCard } from "./ProductCoaCard";
import { ProductSectionNav, type SectionLink } from "./ProductSectionNav";
import { ProductSections } from "./ProductSections";
import { RelatedProducts } from "./RelatedProducts";
import { ScrollbarWidth } from "./ScrollbarWidth";
import { TrackRecentlyViewed } from "./TrackRecentlyViewed";

/** Elementor documents whose CSS is not linked: the site footer and the top-bar marquee (rebuilt
 * natively) and the kit (bundled). */
const NOT_LINKED = new Set([267, 4118, 7]);

export async function ProductPage({ product, page }: { product: Product; page: ProductPageData }) {
  const related = (await Promise.all(page.related.map((id) => getProductById(id)))).filter((p): p is Product => Boolean(p));
  const backorder = backorderFor(product, (await getCatalogState()).backorder);
  const jsonLd = productJsonLd(product, page, backorder, new Date(await offerDate()));
  const afterBlocks = (await Promise.all(page.afterAddToCart.map(async (id) => cleanLegacyHtml(await getSharedBlockHtml(id))))).join("");
  const tabs = page.tabs.map((tab) => ({ key: tab.key, title: tab.title, html: cleanLegacyHtml(tab.html) }));
  // This product's certificates (the COA cards on the lab results page link to their product).
  // This product's certificates, or its compound's vial's for a pen or nasal spray (product-coas.ts).
  const { coas, sampled } = coasForProduct(product, await getCoas(), await getAllProducts());
  // The running offer's strip ("20% · mix any 3+ products") on the products that count towards it.
  const inOffer = CURRENT_OFFER.active && qualifies({ name: product.name, categories: withParents(product.categories, await getCategories()) });
  const bestCoa = coas.length ? coas.reduce((a, b) => (b.purity > a.purity ? b : a)) : null;
  // The category the visitor came through: the breadcrumb before the product's own name.
  const category = page.breadcrumbs.length > 2 ? page.breadcrumbs[page.breadcrumbs.length - 2].label : null;
  const sections: SectionLink[] = [
    ...tabs.map((tab) => ({ id: `tab-${tab.key}`, label: tab.key === "description" ? "Overview" : tab.title })),
    ...(coas.length ? [{ id: "lab-results", label: "Lab results" }] : []),
    ...(related.length ? [{ id: "related-products", label: "Related products" }] : []),
  ];

  return (
    <main id="main-content" className="single-product elementor-kit-7">
      <JsonLd path={product.path} product={jsonLd} />
      {/* Plain links (no "precedence"), so React leaves them here in the page instead of moving them
          into <head>: they must load after every other stylesheet, as on the live site. Plain files in
          public/ because each page needs only a few of the 44. */}
      {page.elementorStyles
        .filter((id) => !NOT_LINKED.has(id))
        .map((id) => (
          <link key={id} rel="stylesheet" href={`/legacy/elementor/post-${id}.css`} />
        ))}
      <div className="single-product-page single-product-content wd-sticky-on product-sticky-on">
        <div className="pp-hero">
          <div className="container">
            <ProductGalleryProvider images={page.form.type === "variable" ? page.form.images : undefined}>
              <div className="product-image-summary-wrap">
                <div className="product-image-summary">
                  <div className="product-image-summary-inner wd-grid-g">
                    <div className="product-images wd-grid-col">
                      <ProductGallery images={page.gallery} thumbnails={page.thumbnails} />
                      <ProductCoaCard coas={coas} sampled={sampled} productName={page.title} />
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
                        {category ? <p className="pp-eyebrow pp-hero__category">{category}</p> : null}
                        <h1 className="product_title entry-title wd-entities-title">{page.title}</h1>
                        <SummaryPrice min={product.priceMin} max={product.priceMax} regular={product.regularPrice} />
                        {bestCoa ? (
                          <a href="#lab-results" className="pp-proof">
                            <span className="pp-proof__icon" aria-hidden="true">
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12.5 4.5 4.5L19 7.5" />
                              </svg>
                            </span>
                            <span>
                              {sampled === "vial" ? "Vial lab tested" : "Lab tested"} · <strong>{bestCoa.purityText}</strong> purity · {bestCoa.lab}
                            </span>
                            <span className="pp-proof__more">View certificate{coas.length > 1 ? "s" : ""}</span>
                          </a>
                        ) : null}
                        {page.shortDescription ? (
                          <div className="woocommerce-product-details__short-description" data-legacy-html="" dangerouslySetInnerHTML={{ __html: cleanLegacyHtml(page.shortDescription) }} />
                        ) : null}
                        {page.includedSupplies ? (
                          <div className="sleeks-included-supplies" data-legacy-html="" dangerouslySetInnerHTML={{ __html: cleanLegacyHtml(page.includedSupplies) }} />
                        ) : null}
                        {inOffer ? <OfferBanner /> : null}
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
        </div>
        <ProductSectionNav links={sections} />
        <ProductSections tabs={tabs} productName={page.title} />
        <RelatedProducts products={related} />
      </div>
      <ScrollbarWidth />
      <TrackRecentlyViewed productId={product.id} />
    </main>
  );
}
