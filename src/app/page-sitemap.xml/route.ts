// /page-sitemap.xml: the pages (homepage, landing, information pages …; src/lib/seo/sitemaps.ts).
import { sitemapResponse } from "@/lib/seo/sitemaps";

export function GET() {
  return sitemapResponse("page");
}
