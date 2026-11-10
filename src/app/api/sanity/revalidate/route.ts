/**
 * POST /api/sanity/revalidate/ : called by a Sanity webhook (Sanity → API → Webhooks, on create /
 * update / delete; see docs/setup/sanity.md) whenever content is published. Throws away the cached
 * pages built from Sanity, so the next visitor gets the new content. The request must carry Sanity's
 * signature made with SANITY_REVALIDATE_SECRET.
 */
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { parseBody } from "next-sanity/webhook";

import { SANITY_TAG } from "@/lib/content/sanity";

export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: "SANITY_REVALIDATE_SECRET is not set" }, { status: 503 });
  const { isValidSignature, body } = await parseBody<{ _type?: string; _id?: string }>(request, secret, true);
  if (!isValidSignature) return Response.json({ error: "Invalid signature" }, { status: 401 });
  // Everything from Sanity shares one tag: a shared section or popup changes many pages at once.
  revalidateTag(SANITY_TAG, { expire: 0 });
  return Response.json({ revalidated: true, type: body?._type ?? null });
}
