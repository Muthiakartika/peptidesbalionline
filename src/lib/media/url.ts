/**
 * Where pictures are served from. The pages copied from WordPress point at
 * https://peptidesbali.online/wp-content/uploads/…; once the files are copied to the Cloudflare R2
 * bucket (scripts/media/copy-uploads-to-r2.mjs) and NEXT_PUBLIC_MEDIA_BASE_URL is set, the same
 * paths are served from the bucket's public address instead, so WordPress can be switched off.
 * NEXT_PUBLIC_ values are written into the build: rebuild after changing it. See docs/setup/r2.md.
 */
/** WordPress's address, and the bucket's r2.dev development address (pictures uploaded while the bucket
 * had no domain of its own keep working when NEXT_PUBLIC_MEDIA_BASE_URL moves to e.g. media.…). */
const LIVE_UPLOADS = /https?:\/\/(?:(?:www\.)?peptidesbali\.online|pub-[0-9a-f]+\.r2\.dev)(\/wp-content\/uploads\/)/g;

/** The bucket's public address without the trailing slash, or "" while pictures stay on WordPress. */
export const mediaBaseUrl = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");

/** One picture address (absolute or /wp-content/uploads/…) → where it is served from. */
export function mediaUrl(url: string): string;
export function mediaUrl(url: string | null | undefined): string | null | undefined;
export function mediaUrl(url: string | null | undefined) {
  if (!url || !mediaBaseUrl) return url;
  if (url.startsWith("/wp-content/uploads/")) return `${mediaBaseUrl}${url}`;
  return url.replace(LIVE_UPLOADS, `${mediaBaseUrl}$1`);
}

/** Every WordPress upload address in a piece of HTML or CSS → the bucket (src, srcset, url(…)). */
export function rewriteMediaUrls(text: string): string {
  if (!mediaBaseUrl || !text) return text;
  return text.replace(LIVE_UPLOADS, `${mediaBaseUrl}$1`);
}

/** Data copied from WordPress (catalogue, product pages, blog list) with its picture addresses moved
 * to the bucket. Returns the data itself while NEXT_PUBLIC_MEDIA_BASE_URL is unset. */
export function withMediaUrls<T>(data: T): T {
  if (!mediaBaseUrl) return data;
  return JSON.parse(rewriteMediaUrls(JSON.stringify(data))) as T;
}
