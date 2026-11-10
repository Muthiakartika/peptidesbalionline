"use client";

/**
 * "Quick view" popup of a product card (Woodmart quick view in a Magnific Popup on the live site):
 * the product's pictures on the left, and on the right its title (a link to the product page),
 * price, included supplies note, the same option form as the product page, SKU and categories.
 *
 *   * it slides in from the left over a dark background and slides out to the right;
 *   * a click on the background, the × above the box or Esc closes it; the page does not scroll
 *     behind it;
 *   * pictures: one at a time with arrows (on hover, desktop) and a "View details" bar;
 *     a chosen variation shows its picture first, as on the product page.
 *
 * It is drawn inside <main>, like the live popup inside <body>: on product pages the owner's
 * ".single-product" styles reach it, on shop pages they do not (as on the live site).
 * Styles: src/styles/quick-view.css. Data: /api/quick-view/ (src/app/api/quick-view/route.ts).
 */
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { GalleryImage } from "@/lib/catalog/product-page";
import type { Variation } from "@/lib/catalog/types";

import "@/styles/product.css";
import "@/styles/quick-view.css";

import { AddToCartForm, SummaryPrice } from "./AddToCartForm";
import { ProductGalleryProvider, useProductGallery } from "./ProductGalleryContext";
import type { QuickViewResponse } from "./quick-view-types";

const ANIMATION_MS = 450;

/** Loads a product's quick-view data (the same JSON the popup shows). */
export async function loadQuickView(id: number): Promise<QuickViewResponse> {
  const response = await fetch(`/api/quick-view/?id=${id}`);
  if (!response.ok) throw new Error(`Quick view ${id}: ${response.status}`);
  return response.json();
}

function QuickViewGallery({ images, path }: { images: GalleryImage[]; path: string }) {
  const { variationImage } = useProductGallery();
  const [index, setIndex] = useState(0);
  const [lastVariation, setLastVariation] = useState(variationImage);
  if (variationImage !== lastVariation) {
    setLastVariation(variationImage);
    setIndex(0);
  }
  const shown = images.map((image, i) =>
    i === 0 && variationImage
      ? { ...image, src: variationImage.src, srcset: variationImage.srcset ?? undefined, sizes: variationImage.sizes ?? undefined, alt: variationImage.alt || image.alt, title: variationImage.title }
      : image,
  );
  const count = shown.length;
  return (
    <div className="product-images woocommerce-product-gallery">
      <div className="wd-carousel-container wd-gallery-images">
        <div className="wd-carousel-inner">
          <div className="woocommerce-product-gallery__wrapper images quick-view-gallery wd-carousel wd-grid">
            <div className="wd-carousel-wrap" style={index ? { transform: `translateX(-${index * 100}%)` } : undefined}>
              {shown.map((image, i) => (
                <div key={i} className="wd-carousel-item" role="group" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== index || undefined}>
                  <figure className="woocommerce-product-gallery__image">
                    {/* eslint-disable-next-line @next/next/no-img-element -- same files and srcset as the live popup */}
                    <img
                      src={image.src}
                      srcSet={image.srcset}
                      sizes={image.sizes}
                      width={image.width}
                      height={image.height}
                      alt={image.alt}
                      title={image.title ?? undefined}
                      className="wp-post-image"
                      loading={i === 0 ? undefined : "lazy"}
                      decoding="async"
                    />
                  </figure>
                </div>
              ))}
            </div>
            <Link href={path} className="btn view-details-btn">
              View details
            </Link>
          </div>
          {count > 1 ? (
            <div className="wd-nav-arrows wd-pos-sep wd-hover-1 wd-custom-style wd-icon-1">
              <button type="button" className={`wd-btn-arrow wd-prev${index === 0 ? " wd-disabled" : ""}`} disabled={index === 0} aria-label="Previous slide" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <span className="wd-arrow-inner" />
              </button>
              <button
                type="button"
                className={`wd-btn-arrow wd-next${index === count - 1 ? " wd-disabled" : ""}`}
                disabled={index === count - 1}
                aria-label="Next slide"
                onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
              >
                <span className="wd-arrow-inner" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function QuickView({ data, onClose }: { data: QuickViewResponse; onClose: () => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);

  // The form and price expect the shop's Variation objects (money as bigint).
  const variations = useMemo<Variation[]>(
    () => data.variations.map((v) => ({ id: v.id, attributes: v.attributes, price: BigInt(v.price), inStock: v.inStock, image: null, ...(v.regularPrice ? { regularPrice: BigInt(v.regularPrice) } : {}) })),
    [data.variations],
  );
  const images = data.form.type === "variable" ? data.form.images : undefined;

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, ANIMATION_MS);
  }, [onClose]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(true));
    const previous = document.activeElement as HTMLElement | null;
    wrap.current?.focus();
    // Magnific Popup locks the page behind the popup (and keeps the scrollbar's room).
    const html = document.documentElement;
    const scrollbar = window.innerWidth - html.clientWidth;
    const before = { overflow: html.style.overflow, marginRight: html.style.marginRight };
    html.style.overflow = "hidden";
    if (scrollbar > 0) html.style.marginRight = `${scrollbar}px`;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      html.style.overflow = before.overflow;
      html.style.marginRight = before.marginRight;
      previous?.focus();
    };
  }, [close]);

  const open = shown && !closing;
  const target = document.querySelector("main") ?? document.body;

  return createPortal(
    <>
      <div className={`mfp-bg${open ? " mfp-ready" : ""}${closing ? " mfp-removing" : ""}`} />
      <div
        ref={wrap}
        className="mfp-wrap wd-popup-quick-view-wrap wd-scroll mfp-close-btn-in mfp-auto-cursor mfp-ready"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={data.title}
        onClick={(event) => {
          // A click on the dark area around the box closes it (Magnific "close on background").
          if (!(event.target as HTMLElement).closest(".mfp-content")) close();
        }}
      >
        <div className="mfp-container mfp-ajax-holder">
          <div className="mfp-content">
            <div className={`wd-popup-wrap${open ? " wd-in" : ""}${closing ? " wd-out" : ""}`}>
              <div className="wd-popup-close wd-action-btn wd-cross-icon wd-style-icon">
                <button type="button" title="Close" onClick={close}>
                  <span>Close</span>
                </button>
              </div>
              <div className="wd-popup popup-quick-view wd-scroll-content">
                <div className="product-quick-view single-product-content quick-view-horizontal">
                  <ProductGalleryProvider images={images}>
                    <div className="wd-grid-g product-image-summary">
                      <QuickViewGallery images={data.gallery} path={data.path} />
                      <div className="summary entry-summary wd-scroll text-left">
                        <div className="summary-inner wd-set-mb reset-last-child wd-scroll-content">
                          <h1 className="product_title entry-title wd-entities-title">
                            <Link href={data.path}>{data.title}</Link>
                          </h1>
                          <SummaryPrice min={BigInt(data.priceMin)} max={BigInt(data.priceMax)} regular={data.regularPrice ? BigInt(data.regularPrice) : undefined} />
                          {data.includedSupplies ? (
                            <div className="sleeks-included-supplies" data-legacy-html="" dangerouslySetInnerHTML={{ __html: data.includedSupplies }} />
                          ) : null}
                          <AddToCartForm productId={data.id} productName={data.title} form={data.form} variations={variations} backorder={data.backorder} />
                          <div className="product_meta">
                            <span className="sku_wrapper">
                              <span className="meta-label">SKU:</span> <span className="sku">{data.sku ?? "N/A"}</span>
                            </span>
                            {data.categories.length > 0 ? (
                              <span className="posted_in">
                                <span className="meta-label">{data.categories.length > 1 ? "Categories:" : "Category:"}</span>{" "}
                                {data.categories.map((category, i) => (
                                  <Fragment key={category.path}>
                                    {i > 0 ? <span className="meta-sep">,</span> : null} <Link href={category.path}>{category.name}</Link>
                                  </Fragment>
                                ))}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ProductGalleryProvider>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    target,
  );
}
