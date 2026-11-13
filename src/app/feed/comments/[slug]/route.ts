// A post's comments feed: /<post>/feed/ is rewritten here by src/proxy.ts (src/lib/seo/feeds.ts).
import { COMMENTS_FEED_HEADERS, postCommentsFeedXml } from "@/lib/seo/feeds";

export async function GET(_request: Request, { params }: RouteContext<"/feed/comments/[slug]">) {
  const xml = postCommentsFeedXml((await params).slug);
  if (!xml) return new Response("Not found", { status: 404 });
  return new Response(xml, { headers: COMMENTS_FEED_HEADERS });
}
