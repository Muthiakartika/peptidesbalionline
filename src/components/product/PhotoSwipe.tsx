"use client";

/**
 * "Click to enlarge": the full-screen picture viewer of the product gallery. The live site uses
 * PhotoSwipe 4 with its default skin; this rebuilds what a visitor can do with it there:
 *   * the picture fits the screen (between two 44px bars, except on small touch screens); "1 / 4"
 *     at the top left;
 *   * buttons (right to left): close, share (Facebook, X, Pinterest, download), full screen, zoom;
 *   * clicking the picture (or the zoom button) shows it at full size; drag to look around;
 *   * arrows (or ← →, or a swipe on touch screens) go round all pictures;
 *   * Esc, the close button, a click on the dark background or scrolling the page closes it;
 *   * on touch screens: a tap hides or shows the controls; no zoom there (as on the live site).
 * It is drawn on <body> (a portal), above the header, like PhotoSwipe. Styles: src/styles/photoswipe.css.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import type { GalleryImage } from "@/lib/catalog/product-page";

import { placement } from "./photoswipe-layout";

import "@/styles/photoswipe.css";

const BAR = 44; // PhotoSwipe's top and bottom bars
const ANIMATION_MS = 333;
const FIT_CONTROLS_WIDTH = 1200; // PhotoSwipe's fitControlsWidth

export function PhotoSwipe({ images, start, onClose }: { images: GalleryImage[]; start: number; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [visible, setVisible] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [shareOpen, setShareOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [controlsHidden, setControlsHidden] = useState(false);
  const touch = window.matchMedia("(hover: none)").matches;
  // PhotoSwipe keeps the picture clear of the bars except on small touch screens.
  const barSize = () => (!touch || window.screen.width > FIT_CONTROLS_WIDTH ? BAR : 0);
  const [view, setView] = useState(() => ({ width: window.innerWidth, height: window.innerHeight, bar: barSize() }));
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const canFullscreen = document.fullscreenEnabled;

  const count = images.length;
  const image = images[index];
  const size = { width: image.full.width || image.width, height: image.full.height || image.height };
  const box = placement(size, view, zoomed, pan);

  const close = useCallback(() => {
    setVisible(false);
    if (document.fullscreenElement) void document.exitFullscreen();
    window.setTimeout(onClose, ANIMATION_MS);
  }, [onClose]);

  const go = useCallback(
    (step: number) => {
      setIndex((i) => (i + step + count) % count);
      setZoomed(false);
      setShareOpen(false);
    },
    [count],
  );

  // Fade in, keep the size in step with the window, close on Esc / page scroll, arrows navigate.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    const previous = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const onResize = () => setView((v) => ({ ...v, width: window.innerWidth, height: window.innerHeight }));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    const onScroll = () => close();
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("fullscreenchange", onFullscreen);
      previous?.focus();
    };
  }, [close, go]);

  /** Zoom in on the clicked point (or the centre), or back to "fit". */
  const toggleZoom = (point?: { x: number; y: number }) => {
    if (zoomed) {
      setZoomed(false);
      return;
    }
    const fitBox = placement(size, view, false, pan);
    const scale = size.width / fitBox.width;
    const px = point ?? { x: view.width / 2, y: view.height / 2 };
    setPan({ x: px.x - (px.x - fitBox.x) * scale, y: px.y - (px.y - fitBox.y) * scale });
    setZoomed(true);
    setShareOpen(false);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, panX: box.x, panY: box.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLImageElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
    if (zoomed && d.moved) {
      setDragging(true);
      setPan({ x: d.panX + dx, y: d.panY + dy });
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLImageElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const dx = event.clientX - d.x;
    if (d.moved) {
      if (!zoomed && count > 1 && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); // swipe
    } else if (event.pointerType === "mouse") {
      toggleZoom({ x: event.clientX, y: event.clientY });
    } else {
      setControlsHidden((hidden) => !hidden); // a tap on a touch screen
    }
  };

  const pageUrl = encodeURIComponent(window.location.href);
  const imageUrl = image.full.src || image.src;

  const classes = [
    "pswp",
    canFullscreen && "pswp--supports-fs",
    "pswp--open",
    touch ? "pswp--touch" : "pswp--notouch",
    "pswp--svg",
    !touch && "pswp--zoom-allowed",
    visible && "pswp--visible",
    zoomed && "pswp--zoomed-in",
    fullscreen && "pswp--fs",
    dragging && "pswp--dragging",
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      ref={root}
      className={classes}
      role="dialog"
      aria-modal="true"
      aria-label="Product images"
      tabIndex={-1}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest(".pswp__button, .pswp__share-tooltip, .pswp__img")) return;
        if (shareOpen) setShareOpen(false);
        else if (touch) setControlsHidden((hidden) => !hidden);
        else close(); // a click on the dark background closes, as on the live site
      }}
    >
      <div className="pswp__bg" />
      <div className="pswp__scroll-wrap">
        <div className="pswp__container">
          <div className="pswp__item">
            <div className="pswp__zoom-wrap" style={{ transform: `translate3d(${box.x}px, ${box.y}px, 0px) scale(1)` }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- the full-size upload, as PhotoSwipe shows it */}
              <img
                key={imageUrl}
                className="pswp__img"
                src={imageUrl}
                alt={image.alt}
                draggable={false}
                style={{ width: box.width, height: box.height }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
            </div>
          </div>
        </div>
        <div
          className={`pswp__ui${view.width > FIT_CONTROLS_WIDTH ? " pswp__ui--fit" : ""}${count > 1 ? "" : " pswp__ui--one-slide"}${controlsHidden ? " pswp__ui--hidden" : ""}`}
        >
          <div className="pswp__top-bar">
            <div className="pswp__counter">
              {index + 1} / {count}
            </div>
            <button type="button" className="pswp__button pswp__button--close" title="Close (Esc)" onClick={close} />
            <button type="button" className="pswp__button pswp__button--share" title="Share" onClick={() => setShareOpen((open) => !open)} />
            <button
              type="button"
              className="pswp__button pswp__button--fs"
              title="Toggle fullscreen"
              onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void root.current?.requestFullscreen())}
            />
            <button type="button" className="pswp__button pswp__button--zoom" title="Zoom in/out" onClick={() => toggleZoom()} />
          </div>
          <div className={`pswp__share-modal pswp__single-tap${shareOpen ? " pswp__share-modal--fade-in" : " pswp__share-modal--hidden"}`}>
            <div className="pswp__share-tooltip">
              <a href={`https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`} target="_blank" rel="noopener noreferrer" className="pswp__share--facebook">
                Share on Facebook
              </a>
              <a href={`https://x.com/intent/tweet?text=&url=${pageUrl}`} target="_blank" rel="noopener noreferrer" className="pswp__share--twitter">
                Share on X
              </a>
              <a
                href={`https://www.pinterest.com/pin/create/button/?url=${pageUrl}&media=${encodeURIComponent(imageUrl)}&description=`}
                target="_blank"
                rel="noopener noreferrer"
                className="pswp__share--pinterest"
              >
                Pin it
              </a>
              <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="pswp__share--download" download>
                Download image
              </a>
            </div>
          </div>
          <button type="button" className="pswp__button pswp__button--arrow--left" title="Previous (arrow left)" onClick={() => go(-1)} />
          <button type="button" className="pswp__button pswp__button--arrow--right" title="Next (arrow right)" onClick={() => go(1)} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
