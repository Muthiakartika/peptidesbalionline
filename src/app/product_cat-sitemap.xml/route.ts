// /product_cat-sitemap.xml: the 25 product categories (src/lib/seo/sitemaps.ts).
import { sitemapResponse } from "@/lib/seo/sitemaps";

export function GET() {
  return sitemapResponse("product_cat");
}
