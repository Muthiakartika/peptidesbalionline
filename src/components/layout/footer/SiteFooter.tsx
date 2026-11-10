/**
 * The dark footer on every store page (Elementor footer #267 on the live site).
 * Content: src/content/site-chrome.ts → footer. Styles: ".site-footer" in src/styles/site-chrome.css.
 *
 * The markup mirrors Elementor's nesting on purpose, because Elementor's percentage margins are
 * relative to these boxes:
 *   footer (padding 2% 0 1%)
 *   └ container 1212px with 10px padding  ← "outer column"
 *     ├ inner section: 4 columns (logo+text, Navigation, Legal, Contact)
 *     ├ divider
 *     ├ inner section: 3 columns (Bali, Nationwide, Pricing & Guides)
 *     ├ "Payment Methods" label
 *     ├ inner section: 8 payment chips
 *     ├ divider, disclaimer, divider
 *     └ inner section: copyright
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { footer as defaultFooter, type FooterColumn, type FooterContent } from "@/content/site-chrome";

function InnerSection({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`footer-section ${className}`}>
      <div className="footer-row">{children}</div>
    </div>
  );
}

function Column({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`footer-col ${className}`}>
      <div className="footer-col__inner">{children}</div>
    </div>
  );
}

function LinkList({ column, spacing }: { column: FooterColumn; spacing?: "wide" }) {
  const Heading = column.headingTag;
  return (
    <>
      <Heading className={`footer-heading ${column.uppercase ? "uppercase" : ""}`}>{column.heading}</Heading>
      <ul className={`footer-list ${spacing === "wide" ? "footer-list--wide" : ""}`}>
        {column.links.map((link) =>
          link.href ? (
            <li key={link.label}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ) : (
            <li key={link.label}>{link.label}</li>
          ),
        )}
      </ul>
    </>
  );
}

function EnvelopeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 512 512" className="footer-contact__icon">
      <path d="M502.3 190.8c3.9-3.1 9.7-.2 9.7 4.7V400c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V195.6c0-5 5.7-7.8 9.7-4.7 22.4 17.4 52.1 39.5 154.1 113.6 21.1 15.4 56.7 47.8 92.2 47.6 35.7.3 72-32.8 92.3-47.6 102-74.1 131.6-96.3 154-113.7zM256 320c23.2.4 56.6-29.2 73.4-41.4 132.7-96.3 142.8-104.7 173.4-128.7 5.8-4.5 9.2-11.5 9.2-18.9v-19c0-26.5-21.5-48-48-48H48C21.5 64 0 85.5 0 112v19c0 7.4 3.4 14.3 9.2 18.9 30.6 23.9 40.7 32.4 173.4 128.7 16.8 12.2 50.2 41.8 73.4 41.4z" />
    </svg>
  );
}

function MapMarkerIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 384 512" className="footer-contact__icon">
      <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z" />
    </svg>
  );
}

function Divider({ className = "" }: { className?: string }) {
  return <div className={`footer-divider ${className}`} role="separator" />;
}

export function SiteFooter({ footer = defaultFooter }: { footer?: FooterContent }) {
  const [navigation, legal] = footer.topColumns;
  const [bali, nationwide, pricing] = footer.linkColumns;
  return (
    <footer className="site-footer">
      <div className="footer-container">
        <InnerSection className="footer-section--top">
          <Column className="footer-col--quarter footer-col--intro">
            <Link href="/" className="footer-logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo keeps its natural proportions */}
              <img src="/brand/atlas-longevity-logo.png" alt="" width={700} height={356} />
            </Link>
            <p className="footer-intro">{footer.intro}</p>
          </Column>
          <Column className="footer-col--quarter footer-col--nav">
            <LinkList column={navigation} />
          </Column>
          <Column className="footer-col--quarter footer-col--legal">
            <LinkList column={legal} />
          </Column>
          <Column className="footer-col--quarter footer-col--contact">
            <h2 className="footer-heading uppercase">{footer.contact.heading}</h2>
            <ul className="footer-list footer-contact">
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
          </Column>
        </InnerSection>

        <Divider className="footer-divider--first" />

        <InnerSection className="footer-section--links">
          <Column className="footer-col--third footer-col--bali">
            <LinkList column={bali} />
          </Column>
          <Column className="footer-col--third footer-col--nationwide">
            <LinkList column={nationwide} />
          </Column>
          <Column className="footer-col--third footer-col--pricing">
            <LinkList column={pricing} spacing="wide" />
          </Column>
        </InnerSection>

        <p className="footer-payment-label">{footer.paymentLabel}</p>

        <InnerSection className="footer-section--payments">
          {footer.paymentMethods.map((method) => (
            <Column key={method} className="footer-col--payment">
              <span className="footer-chip">{method}</span>
            </Column>
          ))}
        </InnerSection>

        <Divider />
        <p className="footer-disclaimer">{footer.disclaimer}</p>
        <Divider className="footer-divider--thin" />

        <InnerSection className="footer-section--copyright">
          <Column className="footer-col--full">
            <p className="footer-copyright">{footer.copyright}</p>
          </Column>
        </InnerSection>
      </div>
    </footer>
  );
}
