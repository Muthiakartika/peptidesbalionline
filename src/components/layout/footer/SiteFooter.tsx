/**
 * The dark footer on every store page. Redesigned on 12 Nov 2026 to go with the new pages (the
 * owner's reference shops: brand block on the left, link columns on the right, research-use notice
 * and a bottom bar), in the Atlas colours. Content: src/content/site-chrome.ts → footer (Sanity can
 * override it). Styles: ".site-footer" in src/styles/site-chrome.css.
 *
 *   ┌ brand: logo, intro, contact, two buttons │ 6 link columns in a 3 × 2 grid ┐
 *   ├ payment methods                                                         ┤
 *   ├ research-use disclaimer                                                 ┤
 *   └ copyright                                                  Back to top  ┘
 */
import Link from "next/link";

import { footer as defaultFooter, type FooterColumn, type FooterContent } from "@/content/site-chrome";

function LinkColumn({ column }: { column: FooterColumn }) {
  const Heading = column.headingTag;
  return (
    <div className="footer-links__col">
      <Heading className="footer-heading">{column.heading}</Heading>
      <ul className="footer-list">
        {column.links.map((link) => {
          // "Home" has no link in the live footer's content; here it goes to the homepage.
          const href = link.href ?? (link.label.trim().toLowerCase() === "home" ? "/" : undefined);
          return <li key={link.label}>{href ? <Link href={href}>{link.label}</Link> : link.label}</li>;
        })}
      </ul>
    </div>
  );
}

function EnvelopeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="footer-contact__icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

function MapMarkerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="footer-contact__icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function SiteFooter({ footer = defaultFooter }: { footer?: FooterContent }) {
  const columns: FooterColumn[] = [...footer.topColumns, ...footer.linkColumns];
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" className="footer-logo" aria-label="Atlas Longevity, home">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo keeps its natural proportions */}
              <img src="/brand/atlas-longevity-logo.png" alt="" width={700} height={356} />
            </Link>
            <p className="footer-intro">{footer.intro}</p>
            <h2 className="footer-heading">{footer.contact.heading}</h2>
            <ul className="footer-contact">
              <li>
                <a href={`mailto:${footer.contact.email}`}>
                  <span className="footer-contact__icon-wrap">
                    <EnvelopeIcon />
                  </span>
                  <span>{footer.contact.email}</span>
                </a>
              </li>
              <li>
                <span className="footer-contact__icon-wrap">
                  <MapMarkerIcon />
                </span>
                <span>{footer.contact.address}</span>
              </li>
            </ul>
            <div className="footer-actions">
              <Link href="/shop/" className="footer-btn footer-btn--gold">
                Shop peptides
              </Link>
              <Link href="/lab-results-certificates-of-analysis/" className="footer-btn">
                Lab results
              </Link>
            </div>
          </div>
          <nav className="footer-links" aria-label="Footer">
            {columns.map((column) => (
              <LinkColumn key={column.heading} column={column} />
            ))}
          </nav>
        </div>

        <div className="footer-payments">
          <p className="footer-payment-label">{footer.paymentLabel}</p>
          <ul className="footer-chips">
            {footer.paymentMethods.map((method) => (
              <li key={method} className="footer-chip">
                {method}
              </li>
            ))}
          </ul>
        </div>

        <p className="footer-disclaimer">
          <span className="footer-disclaimer__label">Research use only</span>
          {footer.disclaimer}
        </p>

        <div className="footer-bottom">
          <p className="footer-copyright">{footer.copyright}</p>
          <a href="#" className="footer-top">
            Back to top
            <span aria-hidden="true">↑</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
