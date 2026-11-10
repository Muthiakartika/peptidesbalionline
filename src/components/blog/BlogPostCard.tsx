/**
 * One post in a list of posts (archives, search results, /insights/), as the Woodmart theme prints
 * it ("masonry" design, with a background and a shadow):
 *
 *   picture (with the day and month on it) · category label · title ·
 *   "Posted by …", share button, comment count · excerpt · "Continue reading"
 *
 * `parts` switches parts off like the theme's blog widget options (/insights/ shows no category and
 * no "Posted by" row). Styles: src/styles/blog.css.
 */
import Link from "next/link";
import { Fragment } from "react";

import { BLOG_AUTHOR } from "@/lib/blog/author";
import type { BlogCategory, BlogPost } from "@/lib/blog/data";
import { cardDate, longDate } from "@/lib/blog/dates";
import { cleanLegacyHtml } from "@/lib/legacy-html";

import { ShareIcons } from "./ShareIcons";

export type CardParts = { media: boolean; title: boolean; meta: boolean; text: boolean; btn: boolean; published_date: boolean };

export const ALL_PARTS: CardParts = { media: true, title: true, meta: true, text: true, btn: true, published_date: true };

/** The card's own classes: the theme's, then the post's (from its live <article>). */
function cardClass(post: BlogPost) {
  const own = post.articleClass.split(/\s+/).filter((name) => name && name !== "post-single-page");
  return ["wd-post", "blog-design-masonry", "blog-post-loop", "blog-style-bg", "wd-add-shadow", "wd-col", ...own].join(" ");
}

export function BlogPostCard({
  post,
  categories,
  sharePath,
  parts = ALL_PARTS,
}: {
  post: BlogPost;
  categories: BlogCategory[];
  /** The address the share links point to: like WordPress, the page the list is on. */
  sharePath: string;
  parts?: CardParts;
}) {
  const image = post.card.image;
  const date = cardDate(post.date);
  return (
    <article id={`post-${post.id}`} className={cardClass(post)}>
      <div className="wd-post-inner article-inner">
        {parts.media && image ? (
          <div className="wd-post-thumb entry-header">
            <div className="wd-post-img post-img-wrapp">
              {/* eslint-disable-next-line @next/next/no-img-element -- the theme's markup, and WordPress's own sizes */}
              <img src={image.src} srcSet={image.srcset || undefined} sizes={image.sizes || undefined} width={image.width} height={image.height} alt={image.alt} className={image.className} loading="lazy" decoding="async" />
            </div>
            <Link className="wd-fill" href={post.path} aria-label={`Link on post ${post.title}`} tabIndex={-1} />
            {parts.published_date ? (
              <div className="wd-post-date wd-style-with-bg">
                <span className="post-date-day">{date.day}</span>
                <span className="post-date-month">{date.month}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="wd-post-content article-body-container">
          {parts.meta && categories.length ? (
            <div className="wd-post-cat wd-style-with-bg meta-post-categories">
              {categories.map((category, index) => (
                <Fragment key={category.id}>
                  {index > 0 ? ", " : null}
                  <Link href={category.path} rel="category tag">
                    {category.name}
                  </Link>
                </Fragment>
              ))}
            </div>
          ) : null}
          {parts.title ? (
            <h3 className="wd-post-title wd-entities-title title post-title">
              <Link href={post.path} rel="bookmark">
                {post.title}
              </Link>
            </h3>
          ) : null}
          {parts.meta ? (
            <div className="wd-post-meta">
              <div className="wd-post-author">
                <span>Posted by</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- Gravatar's own picture, as WordPress prints it */}
                <img alt="author-avatar" src={BLOG_AUTHOR.avatar(18)} srcSet={`${BLOG_AUTHOR.avatar(36)} 2x`} className="avatar avatar-18 photo" height={18} width={18} loading="lazy" decoding="async" />
                <span className="author">{BLOG_AUTHOR.name}</span>
              </div>
              <div className="wd-modified-date">
                <time className="updated" dateTime={`${post.modified}+00:00`}>
                  {longDate(post.modified)}
                </time>
              </div>
              <div className="wd-post-share wd-tltp" tabIndex={0}>
                <div className="tooltip top">
                  <div className="tooltip-inner">
                    <ShareIcons path={sharePath} title={post.title} image={post.image?.src} className="wd-style-default wd-size-small social-share wd-shape-circle color-scheme-light text-center" />
                  </div>
                  <div className="tooltip-arrow" />
                </div>
              </div>
              <div className="wd-post-reply wd-style-1">
                <Link href={`${post.path}#respond`}>
                  <span className="wd-replies-count">{post.replies}</span>
                </Link>
              </div>
            </div>
          ) : null}
          {parts.text ? <div className="wd-post-excerpt entry-content" dangerouslySetInnerHTML={{ __html: cleanLegacyHtml(post.card.excerptHtml) }} /> : null}
          {parts.btn ? (
            <div className="wd-post-read-more wd-style-link read-more-section">
              <Link className="" href={post.path}>
                Continue reading
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
