// /feed/: the posts' RSS feed, as WordPress prints it (src/lib/seo/feeds.ts).
import { cacheLife, cacheTag } from "next/cache";

import { SANITY_TAG } from "@/lib/content/sanity";
import { FEED_HEADERS, postsFeedXml } from "@/lib/seo/feeds";

/** Kept with the posts' content: a post published in Sanity refreshes it (SANITY_TAG), else hourly. */
async function feed(): Promise<string> {
  "use cache";
  cacheTag(SANITY_TAG);
  cacheLife("hours");
  return postsFeedXml();
}

export async function GET() {
  return new Response(await feed(), { headers: FEED_HEADERS });
}
