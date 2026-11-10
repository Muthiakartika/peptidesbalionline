/**
 * The site search results (/?s=bpc, /page/2/?s=bpc), the live site's blog-style search template:
 * the black title band "Search Results for: …", then products, posts and pages as cards, 10 per
 * page, with the blog's page links; "Nothing Found" and a posts search box when there is nothing.
 * The search itself: src/lib/search/site-search.ts.
 */
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";

import Link from "next/link";
import { Fragment } from "react";

import { AliasNotice } from "@/components/layout/search/AliasNotice";
import { BLOG_AUTHOR } from "@/lib/blog/author";
import { getCategoryById, getPostBySlug, paginate } from "@/lib/blog/data";
import { cardDate, longDate } from "@/lib/blog/dates";
import { getProductById } from "@/lib/catalog";
import { getProductPage } from "@/lib/catalog/product-page";
import { cleanLegacyHtml } from "@/lib/legacy-html";
import { htmlToText, searchExcerpt, SEARCH_PER_PAGE, withoutCaptions, type SearchDocument } from "@/lib/search/site-search";

import { BlogLoop } from "./BlogLoop";
import { PageTitle } from "./PageTitle";
import { ShareIcons } from "./ShareIcons";

type CardImage = { src: string; srcset?: string; sizes?: string; width: number; height: number; alt: string; className: string };

async function ResultCard({ doc, html }: { doc: SearchDocument; html: string }) {
  const post = doc.type === "post" ? getPostBySlug(doc.path.replace(/^\/|\/$/g, "")) : null;
  const product = doc.type === "product" ? await getProductById(doc.id) : undefined;
  const image: CardImage | null = post?.card.image ?? (product ? { ...product.image, sizes: "(max-width: 1024px) 100vw, 1024px", className: "attachment-large size-large" } : null);
  const categories = post ? post.categories.map((id) => getCategoryById(id)).filter((category) => category !== null) : [];
  const date = cardDate(doc.date);
  const own = post ? post.articleClass.split(/\s+/).filter((name) => name && name !== "post-single-page") : [`post-${doc.id}`, doc.type, `type-${doc.type}`, "status-publish", ...(image ? ["has-post-thumbnail"] : []), ...(doc.type === "page" ? ["hentry"] : [])];
  return (
    <article id={`post-${doc.id}`} className={["wd-post", "blog-design-masonry", "blog-post-loop", "blog-style-bg", "wd-add-shadow", "wd-col", ...own].join(" ")}>
      <div className="wd-post-inner article-inner">
        {image ? (
          <div className="wd-post-thumb entry-header">
            <div className="wd-post-img post-img-wrapp">
              {/* eslint-disable-next-line @next/next/no-img-element -- the theme's markup, and WordPress's own sizes */}
              <img src={image.src} srcSet={image.srcset || undefined} sizes={image.sizes || undefined} width={image.width} height={image.height} alt={image.alt} className={image.className} loading="lazy" decoding="async" />
            </div>
            <Link className="wd-fill" href={doc.path} aria-label={`Link on post ${doc.displayTitle}`} tabIndex={-1} />
            <div className="wd-post-date wd-style-with-bg">
              <span className="post-date-day">{date.day}</span>
              <span className="post-date-month">{date.month}</span>
            </div>
          </div>
        ) : null}
        <div className="wd-post-content article-body-container">
          {categories.length ? (
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
          <h3 className="wd-post-title wd-entities-title title post-title">
            <Link href={doc.path} rel="bookmark">
              {doc.displayTitle}
            </Link>
          </h3>
          <div className="wd-post-meta">
              <div className="wd-post-author">
                <span>Posted by</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- Gravatar's own picture, as WordPress prints it */}
                <img alt="author-avatar" src={BLOG_AUTHOR.avatar(18)} srcSet={`${BLOG_AUTHOR.avatar(36)} 2x`} className="avatar avatar-18 photo" height={18} width={18} loading="lazy" decoding="async" />
                <span className="author">{BLOG_AUTHOR.name}</span>
              </div>
              <div className="wd-modified-date">
                <time className="updated" dateTime={`${doc.modified}+00:00`}>
                  {longDate(doc.modified)}
                </time>
              </div>
              <div className="wd-post-share wd-tltp" tabIndex={0}>
                <div className="tooltip top">
                  <div className="tooltip-inner">
                    {/* In the search results each result shares its own address (in the archives: the archive's). */}
                    <ShareIcons path={doc.path} title={doc.title} image={post?.image?.src ?? product?.image.src} className="wd-style-default wd-size-small social-share wd-shape-circle color-scheme-light text-center" />
                  </div>
                  <div className="tooltip-arrow" />
                </div>
              </div>
              {doc.commentsOpen ? (
                <div className="wd-post-reply wd-style-1">
                  <Link href={`${doc.path}#respond`}>
                    <span className="wd-replies-count">0</span>
                  </Link>
                </div>
              ) : null}
          </div>
          <div className="entry-summary" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </article>
  );
}

/** Drops the bare <p>…</p> WordPress adds around paragraphs (a space stays between them), keeping
 * the <p …> with attributes that are part of the stored text. */
export function withoutBareParagraphs(html: string): string {
  const open: boolean[] = []; // for each <p> still open: is it a bare one?
  return html.replace(/<p\b[^>]*>|<\/p>/gi, (tag) => {
    if (tag.toLowerCase() === "</p>") return open.pop() ? " " : tag;
    const bare = /^<p>$/i.test(tag);
    open.push(bare);
    return bare ? "" : tag;
  });
}

/**
 * What a result shows under its title (WordPress's excerpt):
 *   * a product: its short description as WordPress stores it. The product page adds paragraphs
 *     (bare <p> tags) that the search doesn't print; <p> tags with attributes were pasted into the
 *     text itself and stay. Without a short description: the first 20 words of the description;
 *   * a post: the first 20 words of its text, without the pictures' captions;
 *   * a page: the first 20 words of its text.
 */
async function summary(doc: SearchDocument): Promise<string> {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (doc.type === "product") {
    const short = (await getProductPage(doc.path))?.shortDescription;
    if (!short) return escape(searchExcerpt(htmlToText(doc.text)));
    return withoutBareParagraphs(cleanLegacyHtml(short));
  }
  return escape(searchExcerpt(doc.type === "post" ? htmlToText(withoutCaptions(doc.text)) : doc.text));
}

export async function SiteSearch({ query, results, page, hrefFor }: { query: string; results: SearchDocument[]; page: number; hrefFor: (page: number) => string }) {
  const { items, totalPages } = paginate(results, page, SEARCH_PER_PAGE);
  const summaries = await Promise.all(items.map(summary));
  return (
    <>
      <PageTitle title={`Search Results for: ${query}`} />
      <main id="main-content" className="wd-content-layout content-layout-wrapper container wd-builder-off blog-page elementor-kit-7" role="main">
        <div className="wd-content-area site-content">
          {items.length ? (
            <BlogLoop page={page} totalPages={totalPages} hrefFor={hrefFor}>
              {/* The compound-name note: the owner's script puts it first in the post grid (it then
                  takes a grid cell as tall as the row, as on the live site). */}
              <AliasNotice query={query} />
              {items.map((doc) => (
                <ResultCard key={`${doc.type}-${doc.id}`} doc={doc} html={summaries[items.indexOf(doc)]} />
              ))}
            </BlogLoop>
          ) : null}
          {/* Without results the note goes first in the content area (the owner's script). */}
          {items.length ? null : <AliasNotice query={query} />}
          {items.length ? null : (
            <article id="post-0" className="post no-results not-found entry-content">
              <h3 className="title">Nothing Found</h3>
              <p>Apologies, but no results were found. Perhaps searching will help find a related post.</p>
              <div className="wd-search-form">
                <form role="search" method="get" className="searchform wd-style-default" action="/" autoComplete="off">
                  <input type="text" className="s" placeholder="Search for posts" defaultValue={query} name="s" aria-label="Search" title="Search for posts" required />
                  <input type="hidden" name="post_type" value="post" />
                  <button type="submit" className="searchsubmit">
                    <span>Search</span>
                  </button>
                </form>
              </div>
            </article>
          )}
        </div>
      </main>
    </>
  );
}
