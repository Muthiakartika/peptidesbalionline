/**
 * POST /api/admin/media/upload/ (multipart, field "file"): the store admin's picture upload (category
 * pictures). The same rules and folder as the Studio's (src/lib/media/upload.ts); only for staff
 * accounts (administrator, shop_manager). A route rather than a server action: server actions take at
 * most 1 MB, pictures up to 15 MB.
 */
import { getAccountUser, isStaff } from "@/lib/account/session";
import { r2Config } from "@/lib/media/r2";
import { savePicture } from "@/lib/media/upload";

export async function POST(request: Request) {
  const user = await getAccountUser().catch(() => null);
  if (!user || !isStaff(user)) return Response.json({ error: "Sorry, you are not allowed to do that." }, { status: 403 });
  const config = r2Config();
  if (!config) return Response.json({ error: "The media library (R2) isn't connected on this server." }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const saved = await savePicture(config, form?.get("file"));
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ url: saved.url });
}
