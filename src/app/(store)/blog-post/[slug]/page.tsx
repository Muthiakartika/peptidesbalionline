/**
 * The 54 blog posts (Phase 3f): /what-is-bpc-157/, /bpc-157-vs-tb-500/, … (src/components/blog/BlogPostPage.tsx).
 *
 * Posts sit at the root of the site, like WordPress's "post name" addresses. Visitors never see this
 * route's own address (/blog-post/<slug>/): src/proxy.ts sends each post's address here, and
 * /blog-post/… itself answers 404. The reason is the same as for the landing pages (see
 * src/app/(store)/landing/[name]/page.tsx): every post is built in advance, while unknown addresses
 * keep a real 404.
 */
// Elementor core → kit, before the theme CSS (on the live site the kit's styles apply to every page).
import "@/styles/legacy/elementor-core.css";
import "@/styles/legacy/elementor-kit.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogPostPage } from "@/components/blog/BlogPostPage";
import { archiveMetadata } from "@/components/shop/archive-metadata";
import { getAllPosts, getPostBySlug, getPostHtml } from "@/lib/blog/data";

// Every page of this route is prerendered (generateStaticParams). Next.js 16 still asks for
// <Suspense> around `params`; the live site reloads the whole page on each click anyway, so this
// route is allowed to wait instead. Docs:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md
export const instant = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog-post/[slug]">): Promise<Metadata> {
  const post = getPostBySlug((await params).slug);
  if (!post) notFound();
  return archiveMetadata(post.seo, post.path);
}

export default async function Page({ params }: PageProps<"/blog-post/[slug]">) {
  const post = getPostBySlug((await params).slug);
  if (!post) notFound();
  return <BlogPostPage post={post} html={await getPostHtml(post.slug)} />;
}
