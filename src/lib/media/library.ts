/**
 * The media library: pictures in the R2 bucket under wp-content/uploads/, newest folders first,
 * filtered by file name. WordPress's resized copies (name-300x300.jpg…) are left out unless asked for.
 * Used by the Studio's picture fields (/api/media/list/) and the store admin's category pictures.
 * The bucket's file list is read at most every 5 minutes (one server instance's memory).
 */
import "server-only";

import { listObjects, publicUrlFor, type R2Config, type R2Object } from "./r2";

const IMAGE = /\.(jpe?g|png|webp|gif|avif|svg)$/i;
const RESIZED = /-\d+x\d+\.(jpe?g|png|webp|gif|avif)$/i;
let cache: { at: number; objects: R2Object[] } | null = null;

async function allObjects(config: R2Config) {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.objects;
  const objects: R2Object[] = [];
  let next: string | null = null;
  do {
    const page = await listObjects(config, "wp-content/uploads/", next ?? undefined);
    objects.push(...page.objects);
    next = page.next;
  } while (next);
  objects.sort((a, b) => (a.key < b.key ? 1 : -1));
  cache = { at: Date.now(), objects };
  return objects;
}

export type LibraryItem = { key: string; url: string; size: number };

/** One page of matching pictures; `next` is the position of the following page, or null. */
export async function findPictures(config: R2Config, { query = "", sizes = false, from = 0, limit = 60 }: { query?: string; sizes?: boolean; from?: number; limit?: number }): Promise<{ items: LibraryItem[]; next: string | null }> {
  const needle = query.trim().toLowerCase();
  const matching = (await allObjects(config)).filter((o) => IMAGE.test(o.key) && (sizes || !RESIZED.test(o.key)) && (!needle || o.key.toLowerCase().includes(needle)));
  const items = matching.slice(from, from + limit).map((o) => ({ key: o.key, url: publicUrlFor(config, o.key), size: o.size }));
  return { items, next: from + limit < matching.length ? String(from + limit) : null };
}
