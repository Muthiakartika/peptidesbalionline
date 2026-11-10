// /post-sitemap.xml: the 54 blog posts (src/lib/seo/sitemaps.ts).
import { sitemapResponse } from "@/lib/seo/sitemaps";

export function GET() {
  return sitemapResponse("post");
}
