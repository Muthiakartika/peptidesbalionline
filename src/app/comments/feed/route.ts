// /comments/feed/: WordPress's comments feed (no comments here, Q-41; src/lib/seo/feeds.ts).
import { COMMENTS_FEED_HEADERS, commentsFeedXml } from "@/lib/seo/feeds";

export function GET() {
  return new Response(commentsFeedXml(), { headers: COMMENTS_FEED_HEADERS });
}
