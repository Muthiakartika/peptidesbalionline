/**
 * For the store admin's server actions (products, categories, attributes): who may run them, and what
 * to refresh after a change. Every action checks the role again: a form can be posted from anywhere.
 */
import "server-only";

import { revalidatePath, updateTag } from "next/cache";

import { getAccountUser, isStaff } from "@/lib/account/session";
import { CATALOG_TAG } from "@/lib/catalog/store";

export async function staffUser() {
  const user = await getAccountUser().catch(() => null);
  if (!user || !isStaff(user)) throw new Error("Sorry, you are not allowed to do that.");
  return user;
}

/**
 * After a category or attribute change: the cached catalogue (every shop page, card, breadcrumb and
 * product form reads it), and the shells of the routes whose pages were built before the change (a
 * category made after the build has no page of its own yet).
 */
export function refreshShop() {
  updateTag(CATALOG_TAG);
  revalidatePath("/product-category/[...segments]", "page");
  revalidatePath("/product/[slug]", "page");
}
