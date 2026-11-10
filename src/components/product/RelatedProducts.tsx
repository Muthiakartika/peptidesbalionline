"use client";

/**
 * "Related products" carousel under the tabs: the same product cards as the shop, 4 at a time on
 * desktop, 3 on tablets, 2 on phones, with arrows and (desktop only) dots.
 * The live site picks and shuffles related products on every visit (WooCommerce default).
 */
import { useEffect, useRef, useState } from "react";

import { ProductCard } from "@/components/shop/ProductCard";
import type { Product } from "@/lib/catalog/types";

function usePerView(): number {
  const [perView, setPerView] = useState(4);
  useEffect(() => {
    const tablet = window.matchMedia("(max-width: 1024px)");
    const phone = window.matchMedia("(max-width: 768.98px)");
    const update = () => setPerView(phone.matches ? 2 : tablet.matches ? 3 : 4);
    update();
    tablet.addEventListener("change", update);
    phone.addEventListener("change", update);
    return () => {
      tablet.removeEventListener("change", update);
      phone.removeEventListener("change", update);
    };
  }, []);
  return perView;
}

export function RelatedProducts({ products }: { products: Product[] }) {
  const perView = usePerView();
  const [start, setStart] = useState(0);
  const pointerX = useRef<number | null>(null);
  if (products.length === 0) return null;
  const last = Math.max(0, products.length - perView);
  const first = Math.min(start, last);
  const pages = Math.ceil(products.length / perView);
  const go = (to: number) => setStart(Math.max(0, Math.min(last, to)));

  return (
    <div className="container related-and-upsells">
      <div className="wd-carousel-container related-products with-title">
        <h2 className="wd-el-title title slider-title element-title">
          <span>Related products</span>
        </h2>
        <div className="wd-carousel-inner">
          <div
            className="wd-carousel wd-grid"
            onPointerDown={(event) => (pointerX.current = event.clientX)}
            onPointerUp={(event) => {
              if (pointerX.current === null) return;
              const moved = event.clientX - pointerX.current;
              pointerX.current = null;
              if (Math.abs(moved) > 40) go(first + (moved < 0 ? perView : -perView));
            }}
          >
            <div className="wd-carousel-wrap" style={first ? { transform: `translateX(-${(first * 100) / perView}%)` } : undefined}>
              {products.map((product) => (
                <div key={product.id} className="wd-carousel-item">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </div>
          <div className="wd-nav-arrows wd-pos-sep wd-hover-1 wd-icon-1">
            <button type="button" className="wd-btn-arrow wd-prev" disabled={first === 0} aria-label="Previous" onClick={() => go(first - perView)}>
              <span className="wd-arrow-inner" />
            </button>
            <button type="button" className="wd-btn-arrow wd-next" disabled={first >= last} aria-label="Next" onClick={() => go(first + perView)}>
              <span className="wd-arrow-inner" />
            </button>
          </div>
        </div>
        {pages > 1 ? (
          <div className="wd-nav-pagin-wrap text-center wd-style-shape wd-hide-md-sm wd-hide-sm">
            <ul className="wd-nav-pagin">
              {Array.from({ length: pages }, (_, page) => (
                <li key={page} className={Math.round(first / perView) === page ? "wd-active" : undefined}>
                  <span role="button" tabIndex={0} aria-label={`Go to slide ${page + 1}`} onClick={() => go(page * perView)} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
