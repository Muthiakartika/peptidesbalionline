/**
 * Addresses and value names made from text, the same in the browser (the admin forms) and on the
 * server (src/lib/commerce/product-admin.ts, taxonomy-admin.ts), so a form's keys match what is saved.
 */

/** "Peptide Vials" → "peptide-vials" (WordPress's sanitize_title for plain text). */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 190);
}

/** A product-only attribute's form field (WooCommerce's custom attributes): "Vial Size" → attribute_vial-size. */
export const customAttributeName = (label: string) => `attribute_${slugify(label)}`;

/** A shop-wide attribute's form field: "mg" → attribute_pa_mg. */
export const shopAttributeName = (slug: string) => `attribute_pa_${slug}`;
