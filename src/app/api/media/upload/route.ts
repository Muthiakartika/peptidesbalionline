/**
 * POST /api/media/upload/ (multipart, field "file"): saves a picture in the Cloudflare R2 bucket
 * (src/lib/media/upload.ts) and answers { url, key, width, height, size, contentType }. Only for people
 * logged in to this project's Sanity Studio (src/lib/media/studio-auth.ts).
 */
import { r2Config } from "@/lib/media/r2";
import { studioUser } from "@/lib/media/studio-auth";
import { savePicture } from "@/lib/media/upload";

export async function POST(request: Request) {
  const user = await studioUser(request);
  if (!user) return Response.json({ error: "Log in to the Studio with an editor account first." }, { status: 401 });
  const config = r2Config();
  if (!config) return Response.json({ error: "The R2 bucket isn't connected yet (see docs/setup/r2.md)." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const saved = await savePicture(config, form?.get("file"));
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json(saved);
}
