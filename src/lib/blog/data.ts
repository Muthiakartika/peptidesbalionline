/**
 * The blog (Phase 3f): 54 posts and their 8 categories, copied from the live site by
 * `python scripts/audit/export_blog.py` (src/content/blog/). Phase 4 moves them to Sanity.
 *
 * Posts are listed newest first, as WordPress lists them everywhere on this site; the archives show
 * 10 per page (the live "Blog pages show at most" setting).
 */
import "server-only";

import { blogPostSlugs } from "@/content/blog";
import categoriesData from "@/content/blog/categories.json";
import { blogPostFiles } from "@/content/blog/files";
import postsData from "@/content/blog/posts.json";

import type { PageSeo } from "@/lib/catalog/types";
import { withMediaUrls } from "@/lib/media/url";
import { contentFromSanity, getSanityPostHtml } from "@/lib/content/sanity";

export const POSTS_PER_PAGE = 10;

export type BlogImage = { src: string; srcset: string; sizes: string; width: number; height: number; alt: string; className: string };

export type BlogPostLink = { path: string; title: string };

export type BlogPost = {
  id: number;
  slug: string;
  /** e.g. "/what-is-bpc-157/" (posts sit at the root of the site). */
  path: string;
  title: string;
  /** As WordPress stores them (the site's local time). */
  date: string;
  modified: string;
  /** What the live page printed, kept so the tests can check the dates the rebuild writes. */
  printed: { published: string; modified: string };
  categories: number[];
  /** The classes of the live <article> (post id, type, format, categories). */
  articleClass: string;
  /** The picture at the top of the post (null when the post has none). */
  image: BlogImage | null;
  replies: number;
  commentsOpen: boolean;
  /** The "Newer" / "Older" links under the post. */
  newer: BlogPostLink | null;
  older: BlogPostLink | null;
  seo: PageSeo;
  /** What the archive pages print for the post: its picture and excerpt. */
  card: { image: BlogImage | null; excerptHtml: string };
  /** Set while the post borrows another post's picture (a WordPress draft without its own yet):
   *  the slug of the post the picture comes from. */
  placeholderImage?: string;
};

export type BlogCategory = {
  id: number;
  name: string;
  slug: string;
  /** e.g. "/category/peptide-therapy/" */
  path: string;
  count: number;
  /** The SEO tags and heading of each archive page (page 1, 2, …). */
  pages: { seo: PageSeo; title: string }[];
};

const posts = withMediaUrls(postsData as unknown as BlogPost[]).map((post) => ({ ...post, id: Number(post.id) }));
const categories = categoriesData as unknown as (BlogCategory & { postIds: number[] })[];

export function getAllPosts(): BlogPost[] {
  return posts;
}

export function getPostBySlug(slug: string): BlogPost | null {
  return posts.find((post) => post.slug === slug) ?? null;
}

/** The post at an address, e.g. "/what-is-bpc-157/". */
export function blogPostSlugAt(path: string): string | null {
  return Object.hasOwn(blogPostSlugs, path) ? blogPostSlugs[path as keyof typeof blogPostSlugs] : null;
}

/** The post's text: the HTML WordPress printed (clean it with cleanLegacyHtml before use). */
export async function getPostHtml(slug: string): Promise<string> {
  if (!Object.hasOwn(blogPostFiles, slug)) return "";
  // Edited in Sanity (Blog posts → Body) when the site reads Sanity; else the copy of the live post.
  if (contentFromSanity) {
    const html = await getSanityPostHtml(slug);
    if (html !== null) return html;
  }
  return (await blogPostFiles[slug as keyof typeof blogPostFiles]()).default.html;
}

export function getCategories(): BlogCategory[] {
  return categories;
}

export function getCategoryBySlug(slug: string): BlogCategory | null {
  return categories.find((category) => category.slug === slug) ?? null;
}

export function getCategoryById(id: number): BlogCategory | null {
  return categories.find((category) => category.id === id) ?? null;
}

/** The category's posts, newest first. */
export function getPostsInCategory(category: BlogCategory): BlogPost[] {
  return posts.filter((post) => post.categories.includes(category.id));
}

/** One page of a list of posts, and how many pages there are. */
export function paginate<T>(items: T[], page: number, perPage = POSTS_PER_PAGE): { items: T[]; totalPages: number } {
  return { items: items.slice((page - 1) * perPage, page * perPage), totalPages: Math.max(1, Math.ceil(items.length / perPage)) };
}
