/**
 * "Lab results" on a product page: this product's certificates of analysis, taken from the COA cards
 * on the lab results page (src/lib/coa/library.ts, so editors keep adding them there, in Sanity).
 * Each certificate shows its purity, lab, test date and batch with the lab's own links, and the
 * section links to the full COA library filtered on the product. Nothing is shown when the product
 * has no certificate yet.
 */
import Link from "next/link";

import type { Coa } from "@/components/coa/types";

const LIBRARY = "/lab-results-certificates-of-analysis/";

export function ProductLabResults({ coas, productName }: { coas: Coa[]; productName: string }) {
  if (coas.length === 0) return null;
  const sorted = [...coas].sort((a, b) => b.testedOn.localeCompare(a.testedOn));
  const best = Math.max(...coas.map((c) => c.purity));
  const peptide = coas[0].peptide;
  return (
    <section id="lab-results" className="pp-section pp-lab" aria-labelledby="pp-lab-title">
      <div className="pp-wrap">
        <div className="pp-lab__grid">
          <header className="pp-head pp-lab__head">
            <p className="pp-eyebrow">Independent lab testing</p>
            <h2 className="pp-title" id="pp-lab-title">
              The proof is <span className="pp-title__accent">in the batch</span>
            </h2>
            <p className="pp-lede">
              Every {productName} batch is tested by an independent laboratory before it is sold. Open the lab&rsquo;s own copy of each report to check it yourself.
            </p>
            <dl className="pp-lab__stats">
              <div>
                <dt>Highest purity</dt>
                <dd>{best.toFixed(best % 1 ? 2 : 0)}%</dd>
              </div>
              <div>
                <dt>Certificates</dt>
                <dd>{coas.length}</dd>
              </div>
            </dl>
            <Link href={`${LIBRARY}?q=${encodeURIComponent(peptide)}#result`} className="pp-link">
              See all {peptide} certificates <span aria-hidden="true">→</span>
            </Link>
          </header>
          <ul className="pp-lab__list">
            {sorted.slice(0, 4).map((coa) => (
              <li key={coa.id} className="pp-coa">
                <div className="pp-coa__top">
                  <span className="pp-coa__purity">{coa.purityText}</span>
                  <span className="pp-coa__lab">{coa.lab}</span>
                </div>
                <h3 className="pp-coa__title">{coa.title}</h3>
                <dl className="pp-coa__facts">
                  <div>
                    <dt>Tested</dt>
                    <dd>
                      <time dateTime={coa.testedOn}>{coa.testedLabel}</time>
                    </dd>
                  </div>
                  <div>
                    <dt>Batch</dt>
                    <dd className="pp-mono">{coa.searchCode ?? coa.batch ?? (coa.task ? `Task #${coa.task}` : "—")}</dd>
                  </div>
                </dl>
                <div className="pp-coa__actions">
                  {coa.verifyUrl ? (
                    <a href={coa.verifyUrl} target="_blank" rel="noopener noreferrer" className="pp-coa__verify">
                      Verify on {coa.lab === "Freedom Diagnostics" ? "Freedom" : coa.lab}
                    </a>
                  ) : null}
                  <Link href={`${LIBRARY}?coa=${encodeURIComponent(coa.id)}#result`} className="pp-coa__more">
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
