/**
 * The data behind the redesigned blog pages (/insights/ and each post): post cards, topics and
 * "Keep reading" suggestions. The posts themselves come from src/lib/blog/data.ts.
 */
import "server-only";

import type { InsightCardData, InsightTopic } from "@/components/insights/types";

import { plainText, readingMinutes } from "./article-html";
import { getAllPosts, getCategoryById, getPostHtml, type BlogCategory, type BlogPost } from "./data";
import { longDate } from "./dates";

/** WordPress's default category: not a real topic, so it gets no label and no filter button. */
const isRealTopic = (category: BlogCategory | null): category is BlogCategory => category !== null && category.slug !== "uncategorized";

export function postTopics(post: BlogPost): BlogCategory[] {
  return post.categories.map((id) => getCategoryById(id)).filter(isRealTopic);
}

export async function insightCard(post: BlogPost): Promise<InsightCardData> {
  const topics = postTopics(post);
  const image = post.card.image ?? post.image;
  return {
    id: post.id,
    path: post.path,
    title: post.title,
    // WordPress builds some excerpts from the text's first heading ("Tesamorelin vs HGH: … (2026)
    // Introduction When researching …"): start them after that "Introduction".
    excerpt: plainText(post.card.excerptHtml)
      .replace(/^.{0,160}?\bIntroduction\s+/, "")
      .replace(/\s*(\.\.\.|…|\[…\])$/, "…"),
    date: longDate(post.date),
    isoDate: post.date.slice(0, 10),
    readMinutes: readingMinutes(await getPostHtml(post.slug)),
    topic: topics[0] ? { slug: topics[0].slug, name: plainText(topics[0].name), path: topics[0].path } : null,
    topicSlugs: topics.map((topic) => topic.slug),
    image: image ? { src: image.src, srcset: image.srcset || undefined, sizes: image.sizes || undefined, width: image.width, height: image.height, alt: image.alt } : null,
    placeholderImage: Boolean(post.placeholderImage),
  };
}

export function insightCards(posts: BlogPost[]): Promise<InsightCardData[]> {
  return Promise.all(posts.map((post) => insightCard(post)));
}

/** The topics that have posts, biggest first (the filter buttons on /insights/). */
export function insightTopics(): InsightTopic[] {
  const counts = new Map<string, InsightTopic>();
  for (const post of getAllPosts()) {
    for (const topic of postTopics(post)) {
      const entry = counts.get(topic.slug) ?? { slug: topic.slug, name: plainText(topic.name), count: 0 };
      entry.count += 1;
      counts.set(topic.slug, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Up to `count` other posts to suggest under a post: same topic first, then the newest. */
export function relatedPosts(post: BlogPost, count = 3): BlogPost[] {
  const others = getAllPosts().filter((other) => other.id !== post.id);
  const topicIds = new Set(postTopics(post).map((topic) => topic.id));
  const sameTopic = others.filter((other) => other.categories.some((id) => topicIds.has(id)));
  const rest = others.filter((other) => !sameTopic.includes(other));
  return [...sameTopic, ...rest].slice(0, count);
}
