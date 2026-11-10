// /category-sitemap.xml: the 8 blog categories (src/lib/seo/sitemaps.ts).
import { sitemapResponse } from "@/lib/seo/sitemaps";

export function GET() {
  return sitemapResponse("category");
}
