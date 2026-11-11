/**
 * /insights/ (redesign, 11 Nov 2026), from top to bottom:
 *
 *   header   breadcrumbs, "Peptide Insights", the page's SEO description, a few numbers
 *   latest   the newest post as a large story + the next four as a numbered list
 *   library  topic buttons, search and every other post (InsightsLibrary.tsx)
 *   closing  consultation band (InsightsCta.tsx)
 *
 * The page's SEO (title, description) still comes from the Insights page in the content
 * (src/content/pages/insights.json or Sanity); the posts come from the blog data.
 * Styles: src/styles/insights.css.
 */
import "@/styles/insights.css";

import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { getAllPosts } from "@/lib/blog/data";
import { insightCards, insightTopics } from "@/lib/blog/insights";
import type { ElementorPageData } from "@/lib/elementor/pages";

import { Breadcrumbs } from "./Breadcrumbs";
import { InsightCard, Meta, MoleculeMark, TitleText, articleFormat } from "./InsightCard";
import { InsightsCta } from "./InsightsCta";
import { InsightsLibrary } from "./InsightsLibrary";

/** How many of the newest posts the "Latest" block shows (1 large + the rest as a list). */
const LATEST = 5;

export async function InsightsPage({ page }: { page: ElementorPageData }) {
  const cards = await insightCards(getAllPosts());
  const topics = insightTopics();
  const [lead, ...latest] = cards.slice(0, LATEST);
  const description = page.seo.description;

  return (
    <div className="ins ins-index">
      <JsonLd path={page.path} />
      <header className="ins-hero">
        <div className="ins-hero-bg" aria-hidden="true">
          <MoleculeMark className="ins-hero__mark" />
        </div>
        <div className="ins-wrap ins-hero__grid">
          <div>
            <Breadcrumbs crumbs={[{ label: "Home", href: "/" }, { label: "Insights" }]} />
            <p className="ins-eyebrow">Guides &amp; comparisons</p>
            <h1 className="ins-display">
              Peptide <span className="ins-gold-text">Insights</span>
            </h1>
            {description ? <p className="ins-lede">{description}</p> : null}
          </div>
          <dl className="ins-stats">
            <div>
              <dt>Articles</dt>
              <dd>{cards.length}</dd>
            </div>
            <div>
              <dt>Topics</dt>
              <dd>{topics.length}</dd>
            </div>
            {lead ? (
              <div>
                <dt>Last update</dt>
                <dd className="ins-stats__date">
                  <time dateTime={lead.isoDate}>{lead.date}</time>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      <main id="main-content" className="ins-wrap ins-index__main" role="main">
        {lead ? (
          <section className="ins-latest" aria-labelledby="latest-title">
            <h2 id="latest-title" className="ins-sr-only">
              Latest articles
            </h2>
            <article className="ins-lead">
              <Link href={lead.path} className="ins-lead__media" tabIndex={-1} aria-hidden="true">
                {lead.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- WordPress's own sizes and srcset, served from the media storage
                  <img src={lead.image.src} srcSet={lead.image.srcset} sizes="(min-width: 1024px) 60vw, 100vw" width={lead.image.width} height={lead.image.height} alt="" fetchPriority="high" decoding="async" />
                ) : null}
                <span className="ins-lead__badge">Latest</span>
              </Link>
              <div className="ins-lead__body">
                <p className="ins-card__kicker">
                  {lead.topic ? <span>{lead.topic.name}</span> : null}
                  <span className="ins-card__format">{articleFormat(lead.title)}</span>
                </p>
                <h3 className="ins-lead__title">
                  <Link href={lead.path}>
                    <TitleText title={lead.title} />
                  </Link>
                </h3>
                {lead.excerpt ? <p className="ins-lead__excerpt">{lead.excerpt}</p> : null}
                <div className="ins-lead__foot">
                  <Meta card={lead} />
                  <Link href={lead.path} className="ins-button ins-button--dark" aria-label={`Read: ${lead.title}`}>
                    Read the article
                  </Link>
                </div>
              </div>
            </article>
            {latest.length ? (
              <div className="ins-latest__list">
                <p className="ins-eyebrow">Also new</p>
                {latest.map((card, index) => (
                  <InsightCard key={card.id} card={card} variant="compact" index={index + 1} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <InsightsLibrary cards={cards} topics={topics} leadIds={cards.slice(0, LATEST).map((card) => card.id)} />

        <InsightsCta />
      </main>
    </div>
  );
}
