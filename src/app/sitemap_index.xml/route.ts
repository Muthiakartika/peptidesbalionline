// /sitemap_index.xml: the list of the five sitemaps, as Yoast SEO prints it, each dated by its newest
// address (the shop's two follow the catalogue as it is now; src/lib/seo/sitemaps.ts).
import { shopSitemaps } from "@/lib/seo/sitemap-data";
import { sitemapIndexXml, sitemapResponse } from "@/lib/seo/sitemaps";

export async function GET() {
  return sitemapResponse("index", sitemapIndexXml(await shopSitemaps()));
}
