"use client";

/**
 * The homepage's certificates (island "coa-showcase", built by src/lib/coa/showcase.ts): a row of
 * report cards — the report's picture, its lab, title, purity and date — with arrows; a card opens the
 * certificate in a window (picture on the left, the facts and the lab's links on the right, previous /
 * next, Esc or the backdrop closes it). The owner's request of 13 Nov 2026, after biopeptech.id.
 * Styles: src/styles/coa-showcase.css.
 */
import "@/styles/coa-showcase.css";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CoaShowcaseProps, ShowcaseItem } from "@/lib/coa/showcase";

const LIBRARY = "/lab-results-certificates-of-analysis/";
const labShort = (lab: string) => (lab === "Freedom Diagnostics" ? "Freedom" : lab);
const shortMethod = (method: string) => (/HPLC with UV detection coupled with mass spectrometry/i.test(method) ? "HPLC-UV + LC-MS" : method);

export function CoaShowcase({ items }: CoaShowcaseProps) {
  const track = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const updateEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, [updateEdges]);

  const scrollBy = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.8, 260), behavior: "smooth" });
  };

  return (
    <div className="coa-showcase">
      <div className="coa-showcase__bar">
        <p className="coa-showcase__count">
          {items.length} lab reports · <span>tap a report to open it</span>
        </p>
        <div className="coa-showcase__arrows">
          <button type="button" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label="Previous reports">
            ←
          </button>
          <button type="button" onClick={() => scrollBy(1)} disabled={edges.end} aria-label="More reports">
            →
          </button>
        </div>
      </div>
      <div className="coa-showcase__track" ref={track} onScroll={updateEdges}>
        {items.map((item, index) => (
          <button key={item.id} type="button" className="coa-showcase__card" onClick={() => setOpen(index)} aria-label={`Open the ${item.title} report`}>
            <span className="coa-showcase__paper">
              {/* eslint-disable-next-line @next/next/no-img-element -- the report pictures are the page's own uploads on R2 */}
              <img src={item.image} alt="" loading="lazy" decoding="async" />
            </span>
            <span className="coa-showcase__meta">
              {item.coa ? <span className="coa-showcase__lab">{labShort(item.coa.lab)}</span> : null}
              <span className="coa-showcase__title">{item.title}</span>
              {item.coa ? (
                <span className="coa-showcase__facts">
                  <span>{item.coa.purityText} purity</span>
                  <span>{item.coa.testedLabel}</span>
                </span>
              ) : (
                <span className="coa-showcase__facts">
                  <span>Lab report</span>
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {open !== null ? <ReportWindow items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function ReportWindow({ items, index, onIndex, onClose }: { items: ShowcaseItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const item = items[index];
  const close = useRef<HTMLButtonElement>(null);
  const coa = item.coa;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") onIndex((index + 1) % items.length);
      if (event.key === "ArrowLeft") onIndex((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  return (
    <div className="coa-window" role="dialog" aria-modal="true" aria-labelledby="coa-window-title" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="coa-window__box">
        <div className="coa-window__paper">
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src={item.image} alt={`${item.title} certificate of analysis`} />
        </div>
        <div className="coa-window__side">
          <div className="coa-window__head">
            <p className="coa-window__eyebrow">Certificate of Analysis</p>
            <button ref={close} type="button" className="coa-window__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
          <h2 className="coa-window__title" id="coa-window-title">
            {item.title}
          </h2>
          {coa ? (
            <>
              <p className="coa-window__by">
                Independently tested by <strong>{coa.lab}</strong>
              </p>
              <div className="coa-window__purity">
                <span>Purity</span>
                <strong>{coa.purityText}</strong>
              </div>
              <dl className="coa-window__facts">
                <div>
                  <dt>Tested</dt>
                  <dd>{coa.testedLabel}</dd>
                </div>
                <div>
                  <dt>Batch / ref.</dt>
                  <dd className="coa-window__mono">{coa.searchCode ?? coa.batch ?? (coa.task ? `Task #${coa.task}` : "—")}</dd>
                </div>
                {coa.method ? (
                  <div>
                    <dt>Method</dt>
                    <dd>{shortMethod(coa.method)}</dd>
                  </div>
                ) : null}
                {coa.verificationKey ? (
                  <div>
                    <dt>Verification key</dt>
                    <dd className="coa-window__mono">{coa.verificationKey}</dd>
                  </div>
                ) : null}
              </dl>
            </>
          ) : (
            <p className="coa-window__by">Independent lab report, as published by Atlas Longevity.</p>
          )}
          <div className="coa-window__actions">
            {coa?.verifyUrl ? (
              <a href={coa.verifyUrl} target="_blank" rel="noopener noreferrer" className="coa-window__btn coa-window__btn--dark">
                Verify on {labShort(coa.lab)} <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            <a href={item.image} target="_blank" rel="noopener noreferrer" className="coa-window__btn">
              Full-size report <span aria-hidden="true">↗</span>
            </a>
            {coa?.productPath ? (
              <Link href={coa.productPath} className="coa-window__btn">
                View product
              </Link>
            ) : null}
          </div>
          <Link href={coa ? `${LIBRARY}?coa=${encodeURIComponent(coa.id)}#result` : LIBRARY} className="coa-window__all">
            All certificates <span aria-hidden="true">→</span>
          </Link>
          <div className="coa-window__nav">
            <button type="button" onClick={() => onIndex((index - 1 + items.length) % items.length)} aria-label="Previous report">
              ← Previous
            </button>
            <span>
              {index + 1} / {items.length}
            </span>
            <button type="button" onClick={() => onIndex((index + 1) % items.length)} aria-label="Next report">
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
