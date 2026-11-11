/**
 * The closing band on /insights/ and under each post: the free consultation and the lab results.
 * Change the texts or links here. Styles: src/styles/insights.css (.ins-cta).
 */
import Link from "next/link";

import { MoleculeMark } from "./InsightCard";

export function InsightsCta() {
  return (
    <section className="ins-cta" aria-labelledby="ins-cta-title">
      <MoleculeMark className="ins-cta__mark" />
      <div className="ins-cta__text">
        <p className="ins-eyebrow ins-eyebrow--light">Still deciding?</p>
        <h2 id="ins-cta-title" className="ins-cta__title">
          Talk it through with <em>our team</em>
        </h2>
        <p>Book a free consultation for answers about your goal, or read the certificates of analysis on our lab results page.</p>
      </div>
      <div className="ins-cta__actions">
        <Link className="ins-button ins-button--gold" href="/peptide-consultation-bali/">
          Book a free consultation
        </Link>
        <Link className="ins-button ins-button--outline-light" href="/lab-results-certificates-of-analysis/">
          See the lab results
        </Link>
      </div>
    </section>
  );
}
