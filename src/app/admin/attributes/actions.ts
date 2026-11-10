"use server";

/** The attribute screens' actions (staff only). After a change every product using it shows it at once. */
import { createAttribute, deleteAttribute, updateAttribute, type TaxonomyResult } from "@/lib/commerce/taxonomy-admin";

import { refreshShop, staffUser } from "../staff-actions";

function done(result: TaxonomyResult): TaxonomyResult {
  if (result.ok) refreshShop();
  return result;
}

/** Create (slug null) or save an attribute. */
export async function saveAttributeAction(slug: string | null, payload: unknown): Promise<TaxonomyResult> {
  await staffUser();
  return done(slug === null ? await createAttribute(payload) : await updateAttribute(slug, payload));
}

export async function deleteAttributeAction(slug: string): Promise<TaxonomyResult> {
  await staffUser();
  return done(await deleteAttribute(slug));
}
