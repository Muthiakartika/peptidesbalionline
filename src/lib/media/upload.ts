/**
 * Saving an uploaded picture in the Cloudflare R2 bucket (the Studio's picture fields, /api/media/upload/,
 * and the store admin's category pictures). Files go to wp-content/uploads/<year>/<month>/, like
 * WordPress, so every picture of the site lives under one folder. JPEG, PNG, WebP, GIF and AVIF up to
 * 15 MB (SVG is refused: it can carry scripts).
 */
import "server-only";

import { imageSize } from "image-size";

import { safeFileName } from "./file-name";
import { objectExists, publicUrlFor, putObject, type R2Config } from "./r2";

const MAX_BYTES = 15 * 1024 * 1024;
const TYPES: Record<string, { ext: string; contentType: string }> = {
  jpg: { ext: "jpg", contentType: "image/jpeg" },
  png: { ext: "png", contentType: "image/png" },
  webp: { ext: "webp", contentType: "image/webp" },
  gif: { ext: "gif", contentType: "image/gif" },
  avif: { ext: "avif", contentType: "image/avif" },
};

export type SavedPicture = { url: string; key: string; width?: number; height?: number; size: number; contentType: string };

export async function savePicture(config: R2Config, file: unknown): Promise<SavedPicture | { error: string; status: number }> {
  if (!(file instanceof File)) return { error: "No file received.", status: 400 };
  if (file.size > MAX_BYTES) return { error: "The file is larger than 15 MB.", status: 413 };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let size: { width?: number; height?: number; type?: string };
  try {
    size = imageSize(bytes);
  } catch {
    return { error: "This file isn't a picture the site can show (JPEG, PNG, WebP, GIF or AVIF).", status: 415 };
  }
  const type = TYPES[size.type ?? ""];
  if (!type) return { error: "Only JPEG, PNG, WebP, GIF or AVIF pictures can be uploaded.", status: 415 };

  const now = new Date();
  const folder = `wp-content/uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = safeFileName(file.name);
  let key = `${folder}/${name}.${type.ext}`;
  for (let n = 1; (await objectExists(config, key)) && n < 100; n++) key = `${folder}/${name}-${n}.${type.ext}`;

  await putObject(config, key, bytes, type.contentType);
  return { url: publicUrlFor(config, key), key, width: size.width, height: size.height, size: file.size, contentType: type.contentType };
}
