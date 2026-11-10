/**
 * A blog post (/what-is-bpc-157/, …), the live site's Woodmart single-post template:
 *
 *   black title band ("Blog", Home / <category>)
 *   header: category label, title, "Posted by …", date, comment count, picture
 *   the post's text (the HTML WordPress printed)
 *   share buttons · "Newer / Back to list / Older" · comment form
 *
 * CSS order, as on the live site: Elementor core and kit (imported by the route, first), the
 * theme's rules (src/styles/legacy-content.css for the text, src/styles/elementor-page.css for the
 * page frame and form fields, src/styles/blog.css for the rest).
 */
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";

import Link from "next/link";
import { Fragment } from "react";

import { JsonLd } from "@/components/seo/JsonLd";
import { BLOG_AUTHOR } from "@/lib/blog/author";
import { getCategoryById, type BlogPost } from "@/lib/blog/data";
import { longDate } from "@/lib/blog/dates";
import { cleanLegacyHtml } from "@/lib/legacy-html";

import { CommentForm } from "./CommentForm";
import { PageTitle } from "./PageTitle";
import { ShareIcons } from "./ShareIcons";

export function BlogPostPage({ post, html }: { post: BlogPost; html: string }) {
  const categories = post.categories.map((id) => getCategoryById(id)).filter((category) => category !== null);
  const image = post.image;
  return (
    <>
      <JsonLd path={post.path} />
      <PageTitle as="h3" title="Blog" crumbs={[{ label: "Home", href: "/" }, ...(categories[0] ? [{ label: categories[0].name, href: categories[0].path }] : [])]} />
      <main id="main-content" className="wd-content-layout content-layout-wrapper container wd-builder-off blog-page elementor-kit-7" role="main">
        <div className="wd-content-area site-content">
          <article id={`post-${post.id}`} className={post.articleClass}>
            <header className="wd-single-post-header">
              {categories.length ? (
                <div className="wd-post-cat wd-style-with-bg">
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
              <h1 className="wd-entities-title wd-post-title title">{post.title}</h1>
              <div className="wd-post-meta">
                <div className="wd-post-author wd-meta-author">
                  <span>Posted by</span>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Gravatar's own picture, as WordPress prints it */}
                  <img alt="author-avatar" src={BLOG_AUTHOR.avatar(22)} srcSet={`${BLOG_AUTHOR.avatar(44)} 2x`} className="avatar avatar-22 photo" height={22} width={22} loading="lazy" decoding="async" />
                  <span className="author">{BLOG_AUTHOR.name}</span>
                </div>
                <div className="wd-modified-date">
                  <time className="updated" dateTime={`${post.modified}+00:00`}>
                    {longDate(post.modified)}
                  </time>
                </div>
                <div className="wd-post-date wd-style-default">
                  <time className="published" dateTime={`${post.date}+00:00`}>
                    On {longDate(post.date)}
                  </time>
                </div>
                <div className="wd-post-reply wd-style-1">
                  <Link href={`${post.path}#respond`}>
                    <span className="wd-replies-count">{post.replies}</span>
                  </Link>
                </div>
              </div>
              {image ? (
                <div className="wd-post-image">
                  {/* Lazy, as on the live site (LiteSpeed loads it): an <img> that isn't lazy is preloaded by
                      React, also by every page that prefetches a link to this post. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- WordPress's own sizes and srcset */}
                  <img src={image.src} srcSet={image.srcset || undefined} sizes={image.sizes || undefined} width={image.width} height={image.height} alt={image.alt} className={image.className} loading="lazy" decoding="async" />
                </div>
              ) : null}
            </header>
            {/* data-legacy-html: Tailwind utilities do not apply inside (see src/app/globals.css). */}
            <div className="wd-entry-content" data-legacy-html="" dangerouslySetInnerHTML={{ __html: cleanLegacyHtml(html) }} />
          </article>
          <div className="wd-single-footer">
            <ShareIcons path={post.path} title={post.title} image={image?.src} className="wd-style-colored wd-size-default social-share wd-shape-circle" />
          </div>
          <div className="wd-page-nav wd-design-1">
            <div className="wd-page-nav-btn prev-btn">
              {post.newer ? (
                <Link href={post.newer.path}>
                  <div className="wd-label">Newer</div>
                  <span className="wd-entities-title">{post.newer.title}</span>
                  <span className="wd-page-nav-icon" />
                </Link>
              ) : null}
            </div>
            {/* The live site has no blog page set, so "Back to list" leads to the post itself. */}
            <Link className="back-to-archive wd-tooltip" href={post.path}>
              Back to list
            </Link>
            <div className="wd-page-nav-btn next-btn">
              {post.older ? (
                <Link href={post.older.path}>
                  <span className="wd-label">Older</span>
                  <span className="wd-entities-title">{post.older.title}</span>
                  <span className="wd-page-nav-icon" />
                </Link>
              ) : null}
            </div>
          </div>
          {post.commentsOpen ? <CommentForm postId={post.id} /> : null}
        </div>
      </main>
    </>
  );
}
