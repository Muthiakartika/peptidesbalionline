// /sitemap_index.xml: the list of the five sitemaps, as Yoast SEO prints it (src/lib/seo/sitemaps.ts).
import { sitemapResponse } from "@/lib/seo/sitemaps";

export function GET() {
  return sitemapResponse("index");
}
