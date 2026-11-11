"use client";

/**
 * "All articles" on /insights/: topic buttons, a search field and the grid of post cards, with a
 * "Load more articles" button (12 at a time). Everything happens in the browser: every post is
 * already in the page.
 *
 * Without a topic or a search, the posts shown in the "Latest" block above (`leadIds`) are left out
 * so they don't appear twice.
 */
import { useDeferredValue, useMemo, useState } from "react";

import { InsightCard, type CardVariant } from "./InsightCard";
import type { InsightCardData, InsightTopic } from "./types";

const PER_PAGE = 12;

/** The grid's rhythm (3 columns): a wide card every 10 posts on the left, then one on the right. */
function variantAt(index: number, total: number): CardVariant {
  if (total < 4) return "default";
  if (index % 10 === 0) return "wide";
  if (index % 10 === 6) return "wide-reverse";
  return "default";
}

const matches = (card: InsightCardData, words: string[]) => {
  const text = `${card.title} ${card.excerpt} ${card.topic?.name ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
};

export function InsightsLibrary({ cards, topics, leadIds }: { cards: InsightCardData[]; topics: InsightTopic[]; leadIds: number[] }) {
  const [topic, setTopic] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PER_PAGE);
  const deferredQuery = useDeferredValue(query);

  const results = useMemo(() => {
    const words = deferredQuery.toLowerCase().split(/\s+/).filter(Boolean);
    const browsing = topic === "all" && words.length === 0;
    return cards.filter((card) => (browsing ? !leadIds.includes(card.id) : true) && (topic === "all" || card.topicSlugs.includes(topic)) && matches(card, words));
  }, [cards, leadIds, topic, deferredQuery]);

  const visible = results.slice(0, shown);
  const chooseTopic = (slug: string) => {
    setTopic(slug);
    setShown(PER_PAGE);
  };

  return (
    <section className="ins-library" id="all-articles" aria-labelledby="all-articles-title">
      <div className="ins-library__head">
        <div>
          <p className="ins-eyebrow">The library</p>
          <h2 id="all-articles-title" className="ins-section-title">
            All articles
          </h2>
        </div>
        <label className="ins-search">
          <span className="ins-sr-only">Search articles</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            placeholder="Search articles"
            onChange={(event) => {
              setQuery(event.target.value);
              setShown(PER_PAGE);
            }}
          />
        </label>
      </div>

      <div className="ins-chips" role="group" aria-label="Filter by topic">
        <button type="button" className="ins-chip" aria-pressed={topic === "all"} onClick={() => chooseTopic("all")}>
          All topics
        </button>
        {topics.map((item) => (
          <button key={item.slug} type="button" className="ins-chip" aria-pressed={topic === item.slug} onClick={() => chooseTopic(item.slug)}>
            {item.name}
            <span className="ins-chip__count">{item.count}</span>
          </button>
        ))}
      </div>

      <p className="ins-library__status" aria-live="polite">
        {results.length === 0 ? "No articles found" : `Showing ${visible.length} of ${results.length} ${results.length === 1 ? "article" : "articles"}`}
      </p>

      {results.length ? (
        <div className="ins-grid">
          {visible.map((card, index) => (
            <InsightCard key={card.id} card={card} index={index} variant={variantAt(index, results.length)} />
          ))}
        </div>
      ) : (
        <div className="ins-empty">
          <p className="ins-empty__title">Nothing matches {deferredQuery ? <>“{deferredQuery}”</> : "this topic"} yet.</p>
          <p>Try another word, or look through every topic.</p>
          <button
            type="button"
            className="ins-button ins-button--ghost"
            onClick={() => {
              setQuery("");
              chooseTopic("all");
            }}
          >
            Show all articles
          </button>
        </div>
      )}

      {shown < results.length ? (
        <div className="ins-library__more">
          <button type="button" className="ins-button ins-button--ghost" onClick={() => setShown((count) => count + PER_PAGE)}>
            Load more articles
            <span className="ins-button__hint">{Math.min(PER_PAGE, results.length - shown)} more</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
