/**
 * Blog category archives (Phase 3f): /category/uncategorized/, its following pages
 * (/category/uncategorized/page/2/ … /page/5/) and the 7 other categories. 10 posts per page,
 * newest first, under the black title band (src/components/blog/).
 */
// Elementor core → kit, before the theme CSS (on the live site the kit's styles apply to every page).
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";
import "@/styles/legacy-content.css";
import "@/styles/elementor-page.css";
import "@/styles/blog.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogLoop } from "@/components/blog/BlogLoop";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { PageTitle } from "@/components/blog/PageTitle";
import { JsonLd } from "@/components/seo/JsonLd";
import { archiveMetadata } from "@/components/shop/archive-metadata";
import { getCategories, getCategoryById, getCategoryBySlug, getPostsInCategory, paginate, POSTS_PER_PAGE } from "@/lib/blog/data";

// Every page of this route is prerendered (generateStaticParams), see src/app/(store)/product-category/.
export const instant = false;

/** ["uncategorized", "page", "2"] -> the category and page 2. */
function resolve(segments: string[]) {
  const [slug, ...rest] = segments;
  let page = 1;
  if (rest.length === 2 && rest[0] === "page" && /^[1-9]\d*$/.test(rest[1])) page = Number(rest[1]);
  else if (rest.length) return null;
  const category = getCategoryBySlug(slug);
  if (!category || page > category.pages.length) return null;
  return { category, page };
}

const pagePath = (base: string, page: number) => (page > 1 ? `${base}page/${page}/` : base);

export function generateStaticParams() {
  return getCategories().flatMap((category) =>
    category.pages.map((_, index) => ({ segments: index === 0 ? [category.slug] : [category.slug, "page", String(index + 1)] })),
  );
}

export async function generateMetadata({ params }: PageProps<"/category/[...segments]">): Promise<Metadata> {
  const resolved = resolve((await params).segments);
  if (!resolved) notFound();
  const { category, page } = resolved;
  return archiveMetadata(category.pages[page - 1].seo, pagePath(category.path, page));
}

export default async function CategoryArchivePage({ params }: PageProps<"/category/[...segments]">) {
  const resolved = resolve((await params).segments);
  if (!resolved) notFound();
  const { category, page } = resolved;
  const { items, totalPages } = paginate(getPostsInCategory(category), page, POSTS_PER_PAGE);
  return (
    <>
      <JsonLd path={pagePath(category.path, page)} />
      <PageTitle title={<span>{category.pages[page - 1].title}</span>} crumbs={[{ label: "Home", href: "/" }, { label: `Archive by Category "${category.name}"` }]} />
      <main id="main-content" className="wd-content-layout content-layout-wrapper container wd-builder-off blog-page elementor-kit-7" role="main">
        <div className="wd-content-area site-content">
          <BlogLoop page={page} totalPages={totalPages} hrefFor={(n) => pagePath(category.path, n)}>
            {items.map((post) => (
              <BlogPostCard
                key={post.id}
                post={post}
                categories={post.categories.map((id) => getCategoryById(id)).filter((c) => c !== null)}
                sharePath={pagePath(category.path, page)}
              />
            ))}
          </BlogLoop>
        </div>
      </main>
    </>
  );
}
