"use client";

/**
 * Product gallery (Woodmart): one big picture at a time, thumbnails underneath (4 per row on
 * desktop, 3 on phones), arrows, a hover zoom that shows the full-size file under the pointer,
 * and "Click to enlarge", which opens the pictures full screen (PhotoSwipe.tsx).
 * When a variation is picked, the first picture becomes that variation's image.
 *
 * Markup and class names follow the live page so the owner's CSS (snippet 03) applies.
 */
import { useEffect, useRef, useState } from "react";

import type { GalleryImage } from "@/lib/catalog/product-page";
import type { CatalogImage } from "@/lib/catalog/types";

import { PhotoSwipe } from "./PhotoSwipe";
import { useProductGallery } from "./ProductGalleryContext";

function Zoom({ image }: { image: GalleryImage }) {
  // jQuery Zoom behaviour: the full-size file follows the pointer inside the picture (desktop only).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={box}
      className="wd-zoom-area"
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || !box.current) return;
        const rect = box.current.getBoundingClientRect();
        setPos({
          x: (event.clientX - rect.left) / rect.width,
          y: (event.clientY - rect.top) / rect.height,
        });
      }}
      onPointerLeave={() => setPos(null)}
    >
      {pos && image.full.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- the live site's full-size upload
        <img
          className="zoomImg"
          src={image.full.src}
          alt=""
          aria-hidden="true"
          style={{
            width: image.full.width,
            height: image.full.height,
            left: `calc(${pos.x * 100}% - ${pos.x * image.full.width}px)`,
            top: `calc(${pos.y * 100}% - ${pos.y * image.full.height}px)`,
          }}
        />
      ) : null}
    </div>
  );
}

export function ProductGallery({
  images,
  thumbnails,
}: {
  images: GalleryImage[];
  thumbnails: CatalogImage[];
}) {
  const { variationImage } = useProductGallery();
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const count = images.length;
  // Thumbnail row: 4 visible (3 on screens up to 768px), the theme's --wd-col-lg/md/sm: 4/4/3.
  const [perView, setPerView] = useState(4);
  useEffect(() => {
    const small = window.matchMedia("(max-width: 768.98px)");
    const update = () => setPerView(small.matches ? 3 : 4);
    update();
    small.addEventListener("change", update);
    return () => small.removeEventListener("change", update);
  }, []);
  const [thumbStart, setThumbStart] = useState(0);
  const lastThumb = Math.max(0, thumbnails.length - perView);
  // When the main picture changes, its thumbnail is brought into view (as the live carousel does);
  // the thumbnail arrows can still move the row away from it.
  const [followed, setFollowed] = useState(index);
  if (followed !== index) {
    setFollowed(index);
    if (index < thumbStart) setThumbStart(index);
    else if (index >= thumbStart + perView) setThumbStart(index - perView + 1);
  }
  const start = Math.min(lastThumb, thumbStart);
  // A chosen variation replaces the first picture (and its thumbnail) and jumps back to it.
  const [lastVariation, setLastVariation] = useState(variationImage);
  if (variationImage !== lastVariation) {
    setLastVariation(variationImage);
    setIndex(0);
  }
  const shown: GalleryImage[] = images.map((image, i) =>
    i === 0 && variationImage
      ? {
          src: variationImage.src,
          srcset: variationImage.srcset ?? undefined,
          sizes: variationImage.sizes ?? undefined,
          width: variationImage.width || image.width,
          height: variationImage.height || image.height,
          alt: variationImage.alt || image.alt,
          title: variationImage.title,
          full: variationImage.full,
        }
      : image,
  );

  return (
    <div
      className={`woocommerce-product-gallery woocommerce-product-gallery--with-images woocommerce-product-gallery--columns-4 images thumbs-position-bottom image-action-zoom${count > 1 ? " wd-has-thumb" : ""}`}
    >
      <div className="wd-carousel-container wd-gallery-images">
        <div className="wd-carousel-inner">
          <figure className="woocommerce-product-gallery__wrapper wd-carousel wd-grid">
            <div
              className="wd-carousel-wrap"
              style={
                index
                  ? { transform: `translateX(-${index * 100}%)` }
                  : undefined
              }
            >
              {shown.map((image, i) => (
                <div
                  key={i}
                  className="wd-carousel-item"
                  aria-hidden={i !== index || undefined}
                >
                  <figure className="woocommerce-product-gallery__image">
                    <a
                      href={image.full.src}
                      onClick={(event) => event.preventDefault()}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- same files and srcset as the live gallery */}
                      <img
                        src={image.src}
                        srcSet={image.srcset}
                        sizes={image.sizes}
                        width={image.width}
                        height={image.height}
                        alt={image.alt}
                        title={image.title ?? undefined}
                        className="wp-post-image"
                        fetchPriority={i === 0 ? "high" : undefined}
                        loading={i === 0 ? undefined : "lazy"}
                        decoding="async"
                      />
                    </a>
                    {i === index ? <Zoom image={image} /> : null}
                  </figure>
                </div>
              ))}
            </div>
          </figure>
          {count > 1 ? (
            <div className="wd-nav-arrows wd-pos-sep wd-hover-1 wd-custom-style wd-icon-1">
              <button
                type="button"
                className={`wd-btn-arrow wd-prev${index === 0 ? " wd-disabled" : ""}`}
                disabled={index === 0}
                aria-label="Previous image"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <span className="wd-arrow-inner" />
              </button>
              <button
                type="button"
                className={`wd-btn-arrow wd-next${index === count - 1 ? " wd-disabled" : ""}`}
                disabled={index === count - 1}
                aria-label="Next image"
                onClick={() => setIndex((i) => Math.min(count - 1, i + 1))}
              >
                <span className="wd-arrow-inner" />
              </button>
            </div>
          ) : null}
          <div className="product-additional-galleries">
            <div className="wd-show-product-gallery-wrap wd-action-btn wd-style-icon-bg-text wd-gallery-btn">
              <a
                href="#"
                rel="nofollow"
                className="woodmart-show-product-gallery"
                onClick={(event) => {
                  event.preventDefault();
                  setLightbox(index);
                }}
              >
                <span>Click to enlarge</span>
              </a>
            </div>
          </div>
        </div>
      </div>
      {count > 1 ? (
        <div className="wd-carousel-container wd-gallery-thumb">
          <div className="wd-carousel-inner">
            <div className="wd-carousel wd-grid">
              <div className="wd-carousel-wrap" style={start ? { transform: `translateX(-${(start * 100) / perView}%)` } : undefined}>
                {thumbnails.map((thumb, i) => (
                  <div
                    key={i}
                    className={`wd-carousel-item${i === index ? " wd-thumb-active" : ""}`}
                    onClick={() => setIndex(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- live thumbnail file */}
                    <img
                      src={
                        i === 0 && variationImage
                          ? variationImage.src
                          : thumb.src
                      }
                      srcSet={
                        i === 0 && variationImage ? undefined : thumb.srcset
                      }
                      sizes={
                        i === 0 && variationImage ? undefined : thumb.sizes
                      }
                      width={thumb.width}
                      height={thumb.height}
                      alt={thumb.alt}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* One thumbnail per click; hidden ("locked") when every thumbnail fits. */}
            <div className="wd-nav-arrows wd-thumb-nav wd-custom-style wd-pos-sep wd-icon-1">
              <button
                type="button"
                className={`wd-btn-arrow wd-prev${start === 0 ? " wd-disabled" : ""}${lastThumb === 0 ? " wd-lock" : ""}`}
                disabled={start === 0}
                aria-label="Previous thumbnails"
                onClick={() => setThumbStart(Math.max(0, start - 1))}
              >
                <span className="wd-arrow-inner" />
              </button>
              <button
                type="button"
                className={`wd-btn-arrow wd-next${start >= lastThumb ? " wd-disabled" : ""}${lastThumb === 0 ? " wd-lock" : ""}`}
                disabled={start >= lastThumb}
                aria-label="Next thumbnails"
                onClick={() => setThumbStart(Math.min(lastThumb, start + 1))}
              >
                <span className="wd-arrow-inner" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {lightbox !== null ? (
        <PhotoSwipe images={shown} start={lightbox} onClose={() => setLightbox(null)} />
      ) : null}
    </div>
  );
}
