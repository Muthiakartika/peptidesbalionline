// /product_cat-sitemap.xml: the product categories that have products, as they are now (src/lib/seo/sitemaps.ts).
import { shopSitemaps } from "@/lib/seo/sitemap-data";
import { sitemapResponse, sitemapXml } from "@/lib/seo/sitemaps";

export async function GET() {
  return sitemapResponse("product_cat", sitemapXml("product_cat", (await shopSitemaps()).product_cat));
}
