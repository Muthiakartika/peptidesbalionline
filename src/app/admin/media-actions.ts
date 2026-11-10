"use server";

/** The store admin's picture picker (staff only): the same media library as the Studio's picture fields (uploads: /api/admin/media/upload/). */
import { findPictures, type LibraryItem } from "@/lib/media/library";
import { r2Config } from "@/lib/media/r2";

import { staffUser } from "./staff-actions";

const NOT_CONNECTED = "The media library (R2) isn't connected on this server.";

export async function findPicturesAction(query: string): Promise<{ items: LibraryItem[]; error?: string }> {
  await staffUser();
  const config = r2Config();
  if (!config) return { items: [], error: NOT_CONNECTED };
  try {
    return { items: (await findPictures(config, { query: query.slice(0, 100), limit: 24 })).items };
  } catch {
    return { items: [], error: "The media library can't be read right now." };
  }
}
