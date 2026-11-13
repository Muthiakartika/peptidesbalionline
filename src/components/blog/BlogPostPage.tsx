/**
 * A blog post (/what-is-bpc-157/, …). Redesigned on 11 Nov 2026 (it used to copy the live site's
 * Woodmart template with its black "Blog" band):
 *
 *   header   breadcrumbs, topic, title, author, dates, reading time, picture
 *            (a tall picture sits beside the title, a wide one under it)
 *   body     "On this page" + share links in a sticky column, the post's text beside it
 *   footer   share links, Newer / Older, "Keep reading" (3 posts), consultation band
 *
 * Comments are hidden for now (SHOW_COMMENTS below): the live site has none, and saving them isn't
 * built yet. Set it to true to bring WordPress's comment form back under the post.
 *
 * CSS: Elementor core and kit (imported by the route, first), the theme's text styles
 * (legacy-content.css: the post's own HTML still uses WordPress classes such as "wp-caption"), then
 * src/styles/insights.css for the new design.
 */
import "@/styles/legacy-content.css";
import "@/styles/blog.css";
import "@/styles/insights.css";

import Link from "next/link";

import { ArticleToc } from "@/components/insights/ArticleToc";
import { Breadcrumbs } from "@/components/insights/Breadcrumbs";
import { InsightCard, MoleculeMark, TitleText, articleFormat } from "@/components/insights/InsightCard";
import { InsightsCta } from "@/components/insights/InsightsCta";
import { ReadingProgress } from "@/components/insights/ReadingProgress";
import { JsonLd } from "@/components/seo/JsonLd";
import { plainText, readingMinutes, withHeadingIds, withoutPastedCodeViewers, withoutRepeatedPicture, withTableBoxes } from "@/lib/blog/article-html";
import { BLOG_AUTHOR } from "@/lib/blog/author";
import type { BlogPost } from "@/lib/blog/data";
import { longDate } from "@/lib/blog/dates";
import { insightCards, postTopics, relatedPosts } from "@/lib/blog/insights";
import { cleanLegacyHtml } from "@/lib/legacy-html";

import { CommentForm } from "./CommentForm";
import { ShareIcons } from "./ShareIcons";

/** Comments under posts: hidden since 11 Nov 2026. */
const SHOW_COMMENTS = false;

export async function BlogPostPage({ post, html }: { post: BlogPost; html: string }) {
  const topics = postTopics(post);
  const topic = topics[0] ?? null;
  const image = post.image;
  const { html: body, headings } = withHeadingIds(withTableBoxes(withoutPastedCodeViewers(withoutRepeatedPicture(cleanLegacyHtml(html), image?.src))));
  const minutes = readingMinutes(body);
  const tall = image ? image.height > image.width * 1.05 : false;
  const updated = post.modified.slice(0, 10) !== post.date.slice(0, 10);
  const related = await insightCards(relatedPosts(post, 3));

  const picture = image ? (
    <figure className={`ins-post-hero__figure${tall ? " is-tall" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- WordPress's own sizes and srcset, served from the media storage */}
      <img
        src={image.src}
        srcSet={image.srcset || undefined}
        sizes={tall ? "(min-width: 1024px) 420px, 100vw" : "(min-width: 1280px) 1200px, 100vw"}
        width={image.width}
        height={image.height}
        alt={image.alt}
        fetchPriority="high"
        decoding="async"
      />
    </figure>
  ) : null;

  return (
    <div className="ins ins-post">
      <JsonLd path={post.path} />
      <ReadingProgress targetId="article-body" />

      <header className={`ins-post-hero${tall ? " ins-post-hero--split" : picture ? " ins-post-hero--wide" : ""}`}>
        <div className="ins-hero-bg" aria-hidden="true">
          <MoleculeMark className="ins-hero__mark" />
        </div>
        <div className="ins-wrap ins-post-hero__grid">
          <div className="ins-post-hero__text">
            <Breadcrumbs crumbs={[{ label: "Home", href: "/" }, { label: "Insights", href: "/insights/" }, ...(topic ? [{ label: plainText(topic.name), href: topic.path }] : [])]} />
            <p className="ins-post-hero__tags">
              {topics.map((item) => (
                <Link key={item.id} href={item.path} className="ins-tag" rel="category tag">
                  {plainText(item.name)}
                </Link>
              ))}
              <span className="ins-tag ins-tag--plain">{articleFormat(post.title)}</span>
            </p>
            <h1 className="ins-post-title">
              <TitleText title={post.title} />
            </h1>
            <div className="ins-byline">
              <span className="ins-byline__avatar" aria-hidden="true">
                AL
              </span>
              <div>
                <p className="ins-byline__name">{BLOG_AUTHOR.name}</p>
                <p className="ins-meta">
                  <time dateTime={`${post.date}+00:00`}>{longDate(post.date)}</time>
                  {updated ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Updated <time dateTime={`${post.modified}+00:00`}>{longDate(post.modified)}</time>
                      </span>
                    </>
                  ) : null}
                  <span aria-hidden="true">·</span>
                  <span>{minutes} min read</span>
                </p>
              </div>
            </div>
          </div>
          {tall ? picture : null}
        </div>
        {!tall && picture ? <div className="ins-wrap">{picture}</div> : null}
      </header>

      <main id="main-content" className="ins-wrap ins-post__main blog-page" role="main">
        <div className="ins-post-layout">
          <aside className="ins-post-aside">
            <div className="ins-post-aside__sticky">
              <ArticleToc headings={headings} />
              <div className="ins-share">
                <p className="ins-toc__label">Share</p>
                <ShareIcons path={post.path} title={post.title} image={image?.src} className="ins-share__icons" />
              </div>
            </div>
          </aside>

          <article id={`post-${post.id}`} className="ins-article">
            <ArticleToc headings={headings} compact />
            {/* data-legacy-html: Tailwind utilities do not apply inside (see src/app/globals.css). */}
            <div id="article-body" className="wd-entry-content ins-prose" data-legacy-html="" dangerouslySetInnerHTML={{ __html: body }} />

            <footer className="ins-article__foot">
              <div className="ins-share ins-share--inline">
                <p className="ins-toc__label">Share this article</p>
                <ShareIcons path={post.path} title={post.title} image={image?.src} className="ins-share__icons" />
              </div>
              <nav className="ins-pager" aria-label="More articles">
                {post.newer ? (
                  <Link href={post.newer.path} className="ins-pager__link ins-pager__link--prev">
                    <span className="ins-pager__label">← Newer</span>
                    <span className="ins-pager__title">{post.newer.title.split(" | ")[0]}</span>
                  </Link>
                ) : (
                  <span />
                )}
                {post.older ? (
                  <Link href={post.older.path} className="ins-pager__link ins-pager__link--next">
                    <span className="ins-pager__label">Older →</span>
                    <span className="ins-pager__title">{post.older.title.split(" | ")[0]}</span>
                  </Link>
                ) : null}
              </nav>
            </footer>

            {SHOW_COMMENTS && post.commentsOpen ? <CommentForm postId={post.id} /> : null}
          </article>
        </div>

        {related.length ? (
          <section className="ins-related" aria-labelledby="keep-reading">
            <div className="ins-related__head">
              <h2 id="keep-reading" className="ins-section-title">
                Keep reading
              </h2>
              <Link href="/insights/" className="ins-link-arrow">
                All insights
              </Link>
            </div>
            <div className="ins-grid ins-grid--three">
              {related.map((card, index) => (
                <InsightCard key={card.id} card={card} index={index + 1} />
              ))}
            </div>
          </section>
        ) : null}

        <InsightsCta />
      </main>
    </div>
  );
}
