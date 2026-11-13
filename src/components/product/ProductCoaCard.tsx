"use client";

/**
 * "Certificate of Analysis" card under the product's gallery (the owner, 13 Nov 2026, after
 * biopeptech.id): the product's lab report at a glance — purity, label amount, lab and method, test
 * date and batch — with the lab's own links. A product with several reports (e.g. Retatrutide 10mg and
 * 30mg) gets a chip per report. A pen or nasal spray that borrows its compound's vial report says so
 * ("Sampled vial"); which reports a product shows: src/lib/coa/product-coas.ts.
 *
 * Replaces the "Lab results" section further down the page; it keeps its id (#lab-results), so the
 * "Lab tested" badge and the "On this page" bar still lead here. Styles: src/styles/product-page.css.
 */
import Link from "next/link";
import { useState } from "react";

import type { Coa } from "@/components/coa/types";

const LIBRARY = "/lab-results-certificates-of-analysis/";

/** "HPLC with UV detection coupled with mass spectrometry (LC-MS)" → "HPLC-UV + LC-MS". */
const shortMethod = (method: string) => (/HPLC with UV detection coupled with mass spectrometry/i.test(method) ? "HPLC-UV + LC-MS" : method);
const labShort = (lab: string) => (lab === "Freedom Diagnostics" ? "Freedom" : lab);

export function ProductCoaCard({ coas, sampled, productName }: { coas: Coa[]; sampled: "own" | "vial"; productName: string }) {
  const [index, setIndex] = useState(0);
  if (coas.length === 0) return null;
  const coa = coas[Math.min(index, coas.length - 1)];
  const reference = coa.searchCode ?? coa.batch ?? (coa.task ? `Task #${coa.task}` : null);

  return (
    <section id="lab-results" className="pp-coa-card" aria-labelledby="pp-coa-card-title">
      <div className="pp-coa-card__top">
        <p className="pp-eyebrow">Independent lab testing</p>
        <span className="pp-coa-card__tag">{sampled === "vial" ? "Sampled vial" : "This product"}</span>
      </div>
      <h2 className="pp-coa-card__title" id="pp-coa-card-title">
        Certificate of Analysis
      </h2>
      <p className="pp-coa-card__by">
        Independently tested by <strong>{coa.lab}</strong>
        {coa.method ? <> · {shortMethod(coa.method)}</> : null}
      </p>

      {coas.length > 1 ? (
        <div className="pp-coa-card__picks" role="group" aria-label="Reports">
          {coas.map((c, i) => (
            <button key={c.id} type="button" className="pp-coa-card__pick" aria-pressed={c.id === coa.id} onClick={() => setIndex(i)}>
              {c.title}
            </button>
          ))}
        </div>
      ) : null}

      <div className="pp-coa-card__panel">
        <div className="pp-coa-card__purity">
          <span className="pp-coa-card__label">Purity</span>
          <strong>{coa.purityText}</strong>
        </div>
        <div className="pp-coa-card__sample">
          <span className="pp-coa-card__label">Sample{coa.amount ? " · label" : ""}</span>
          <span className="pp-coa-card__sample-name">{coa.title}</span>
          {coa.amount ? <span className="pp-mono">{coa.amount}</span> : null}
        </div>
      </div>

      <dl className="pp-coa-card__facts">
        <div>
          <dt>Tested</dt>
          <dd>
            <time dateTime={coa.testedOn}>{coa.testedLabel}</time>
          </dd>
        </div>
        <div>
          <dt>Batch / ref.</dt>
          <dd className="pp-mono">{reference ?? "—"}</dd>
        </div>
        <div>
          <dt>Laboratory</dt>
          <dd>{coa.lab}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd title={coa.method || undefined}>{coa.method ? shortMethod(coa.method) : "—"}</dd>
        </div>
      </dl>

      {sampled === "vial" ? (
        <p className="pp-coa-card__note">
          This report is for the vial of the same compound. {productName} has no report of its own yet.
        </p>
      ) : null}

      <div className="pp-coa-card__actions">
        {coa.verifyUrl ? (
          <a href={coa.verifyUrl} target="_blank" rel="noopener noreferrer" className="pp-coa-card__btn pp-coa-card__btn--dark">
            Verify on {labShort(coa.lab)}
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        {coa.reportUrl && coa.reportUrl !== coa.verifyUrl ? (
          <a href={coa.reportUrl} target="_blank" rel="noopener noreferrer" className="pp-coa-card__btn">
            {coa.reportIsPdf ? "Report PDF" : "View report"}
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
        <Link href={`${LIBRARY}?coa=${encodeURIComponent(coa.id)}#result`} className="pp-coa-card__btn">
          Details
        </Link>
      </div>
      <Link href={`${LIBRARY}?q=${encodeURIComponent(coa.peptide)}#result`} className="pp-link pp-coa-card__all">
        All {coa.peptide} certificates <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
