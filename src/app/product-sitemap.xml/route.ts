// /product-sitemap.xml: /shop/ and the 182 products (src/lib/seo/sitemaps.ts).
import { sitemapResponse } from "@/lib/seo/sitemaps";

export function GET() {
  return sitemapResponse("product");
}
