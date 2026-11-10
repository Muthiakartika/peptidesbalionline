/**
 * GET /api/media/list/?q=bpc&sizes=0&cursor=60 : the media library (src/lib/media/library.ts), 60
 * pictures at a time, filtered by file name; WordPress's resized copies only with sizes=1. Only for
 * logged-in Studio editors.
 */
import type { NextRequest } from "next/server";

import { findPictures } from "@/lib/media/library";
import { r2Config } from "@/lib/media/r2";
import { studioUser } from "@/lib/media/studio-auth";

export async function GET(request: NextRequest) {
  const user = await studioUser(request);
  if (!user) return Response.json({ items: [], next: null, configured: true, error: "Log in to the Studio with an editor account first." }, { status: 401 });
  const config = r2Config();
  if (!config) return Response.json({ items: [], next: null, configured: false });

  const params = request.nextUrl.searchParams;
  try {
    const page = await findPictures(config, { query: params.get("q") ?? "", sizes: params.get("sizes") === "1", from: Math.max(0, Number(params.get("cursor")) || 0) });
    return Response.json({ ...page, configured: true });
  } catch (error) {
    return Response.json({ items: [], next: null, configured: true, error: error instanceof Error ? error.message : "R2 error" }, { status: 502 });
  }
}
