/**
 * One post card of the redesigned blog (/insights/ and "Keep reading" under each post).
 *
 *   variant "default"  picture on top, then topic, title, excerpt, date and reading time
 *   variant "wide"     picture beside the text (takes two grid columns on large screens)
 *   variant "compact"  no picture: a number, the title and the date (the "Latest" list)
 *
 * The whole card is clickable (the title's link stretches over it). Posts that still borrow another
 * post's picture get a typographic cover instead, so the same photo isn't repeated down the grid.
 * Styles: src/styles/insights.css (classes starting with "ins-card").
 */
import Link from "next/link";

import type { InsightCardData } from "./types";

export type CardVariant = "default" | "wide" | "wide-reverse" | "compact";

/** A short label for the kind of article, read from its title. */
export function articleFormat(title: string): string {
  const t = title.toLowerCase();
  if (/\bvs\.?\b|\bversus\b/.test(t)) return "Comparison";
  if (/^how to\b|step[- ]by[- ]step|reconstitut/.test(t)) return "How-to";
  if (/^(what|who|why|when|where|is|are|do|does|can|how)\b/.test(t)) return "Explainer";
  return "Guide";
}

/**
 * Many WordPress titles carry SEO tails after a "|" ("TB-500 vs Wolverine Blend | Complete Comparison
 * Guide (2026) | Peptides Bali"). The first part is shown as the title, the rest smaller and lighter.
 */
export function TitleText({ title }: { title: string }) {
  const [main, ...rest] = title.split(/\s+\|\s+/);
  if (!rest.length || !main) return <>{title}</>;
  return (
    <>
      {main}
      <span className="ins-title-sub">
        <span className="ins-sr-only"> | </span>
        {rest.join(" · ")}
      </span>
    </>
  );
}

const TONES = ["ink", "gold", "sand"] as const;

/** Thin gold hexagon "molecule" drawing used on covers and in the page headers. */
export function MoleculeMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 200" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true" focusable="false">
      <path d="M60 40l26-15 26 15v30l-26 15-26-15z" />
      <path d="M112 70l26-15 26 15v30l-26 15-26-15z" />
      <path d="M112 130l26-15 26 15v30l-26 15-26-15z" />
      <path d="M164 100l26-15 26 15v30l-26 15-26-15z" />
      <path d="M86 85v30M60 70l-30 18M216 130l14 24" />
      <circle cx="30" cy="88" r="5" />
      <circle cx="86" cy="118" r="4" />
      <circle cx="230" cy="156" r="5" />
      <circle cx="138" cy="25" r="3" />
      <path d="M138 55V28" />
    </svg>
  );
}

function Cover({ card, tone }: { card: InsightCardData; tone: (typeof TONES)[number] }) {
  return (
    <div className={`ins-cover ins-cover--${tone}`} role="img" aria-label={`${articleFormat(card.title)}: ${card.title}`}>
      <MoleculeMark className="ins-cover__mark" />
      <span className="ins-cover__kicker">Atlas Longevity</span>
      <span className="ins-cover__word">{articleFormat(card.title)}</span>
      <span className="ins-cover__brand">Insights</span>
    </div>
  );
}

function Media({ card, index, eager }: { card: InsightCardData; index: number; eager?: boolean }) {
  if (card.placeholderImage || !card.image) return <Cover card={card} tone={TONES[index % TONES.length]} />;
  const image = card.image;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- WordPress's own sizes and srcset, served from the media storage
    <img
      src={image.src}
      srcSet={image.srcset}
      sizes={image.sizes ? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" : undefined}
      width={image.width}
      height={image.height}
      alt={image.alt}
      className={image.height > image.width ? "is-portrait" : undefined}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
    />
  );
}

export function Meta({ card }: { card: InsightCardData }) {
  return (
    <p className="ins-meta">
      <time dateTime={card.isoDate}>{card.date}</time>
      <span aria-hidden="true">·</span>
      <span>{card.readMinutes} min read</span>
    </p>
  );
}

export function InsightCard({ card, variant = "default", index = 0, headingLevel = 3, eager = false }: { card: InsightCardData; variant?: CardVariant; index?: number; headingLevel?: 2 | 3; eager?: boolean }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  if (variant === "compact") {
    return (
      <article className="ins-card ins-card--compact">
        <span className="ins-card__number" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="ins-card__body">
          <p className="ins-card__kicker">{card.topic?.name ?? articleFormat(card.title)}</p>
          <Heading className="ins-card__title">
            <Link href={card.path}>
              <TitleText title={card.title} />
            </Link>
          </Heading>
          <Meta card={card} />
        </div>
      </article>
    );
  }
  return (
    <article className={`ins-card ins-card--${variant}`}>
      <div className="ins-card__media">
        <Media card={card} index={index} eager={eager} />
      </div>
      <div className="ins-card__body">
        <p className="ins-card__kicker">
          {card.topic ? <span>{card.topic.name}</span> : null}
          <span className="ins-card__format">{articleFormat(card.title)}</span>
        </p>
        <Heading className="ins-card__title">
          <Link href={card.path}>
              <TitleText title={card.title} />
            </Link>
        </Heading>
        {card.excerpt ? <p className="ins-card__excerpt">{card.excerpt}</p> : null}
        <div className="ins-card__foot">
          <Meta card={card} />
          <span className="ins-card__arrow" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </article>
  );
}
