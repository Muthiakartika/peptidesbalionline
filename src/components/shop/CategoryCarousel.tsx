"use client";

/**
 * The round category images in the grey title band (Woodmart "product categories" carousel).
 * Desktop shows 6 at a time, tablets 4, phones 3. The arrows (or a swipe) move one screenful.
 *
 * Styles: ".cat-carousel" in src/styles/shop.css.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { CategoryTile } from "@/lib/catalog";

/** Same breakpoints as the live carousel (--wd-col-lg / md / sm). */
function useTilesPerView(): number {
  const [perView, setPerView] = useState(6);
  useEffect(() => {
    const tablet = window.matchMedia("(max-width: 1024px)");
    const phone = window.matchMedia("(max-width: 768.98px)");
    const update = () => setPerView(phone.matches ? 3 : tablet.matches ? 4 : 6);
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

export function CategoryCarousel({ tiles }: { tiles: CategoryTile[] }) {
  const perView = useTilesPerView();
  const [start, setStart] = useState(0);
  const pointerX = useRef<number | null>(null);
  const last = Math.max(0, tiles.length - perView);
  const first = Math.min(start, last);
  const go = (to: number) => setStart(Math.max(0, Math.min(last, to)));

  return (
    <div className="cat-carousel">
      <div
        className="cat-carousel__viewport"
        onPointerDown={(event) => (pointerX.current = event.clientX)}
        onPointerUp={(event) => {
          if (pointerX.current === null) return;
          const moved = event.clientX - pointerX.current;
          pointerX.current = null;
          if (Math.abs(moved) > 40) go(first + (moved < 0 ? perView : -perView));
        }}
      >
        <div className="cat-carousel__track" style={{ transform: first ? `translateX(-${(first * 100) / perView}%)` : undefined }}>
          {tiles.map((tile) => (
            <div key={tile.path} className="cat-carousel__item">
              <div className="cat-tile">
                <div className="cat-tile__thumb">
                  <Link className="cat-tile__image" href={tile.path} aria-label={tile.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the live site's 100×100 category thumbnails */}
                    <img src={tile.image.src} srcSet={tile.image.srcset} sizes={tile.image.sizes} width={tile.image.width} height={tile.image.height} alt={tile.image.alt} decoding="async" />
                  </Link>
                </div>
                <div className="cat-tile__content">
                  <h3 className="cat-tile__title">{tile.name}</h3>
                </div>
                <Link className="cat-tile__link" href={tile.path} aria-label={`Product category ${tile.name}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="cat-carousel__arrows">
        <button type="button" className="cat-carousel__arrow cat-carousel__arrow--prev" disabled={first === 0} aria-label="Previous" onClick={() => go(first - perView)}>
          <Icon name="chevronLeft" />
        </button>
        <button type="button" className="cat-carousel__arrow cat-carousel__arrow--next" disabled={first >= last} aria-label="Next" onClick={() => go(first + perView)}>
          <Icon name="chevronRight" />
        </button>
      </div>
    </div>
  );
}
