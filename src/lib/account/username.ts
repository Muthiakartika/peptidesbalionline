/**
 * The user name WooCommerce makes up for a new customer who registered with only an e-mail address
 * (wc_create_new_customer_username, WooCommerce 11.2.1): the part before "@" ("budi.santoso" for
 * budi.santoso@example.com), or the domain when that part is a common mailbox name (sales, hello, mail,
 * contact, info), cleaned the way WordPress cleans user names (sanitize_user, strict), lower case. When the
 * name is taken, "-" and four random digits are added ("budi-0420").
 */

const COMMON_MAILBOXES = ["sales", "hello", "mail", "contact", "info"];

/** WordPress's sanitize_user( $name, true ): no tags or entities, accents removed, only a-z 0-9 space _ . - @. */
export function sanitizeUsername(name: string): string {
  return name
    .replace(/<[^>]*>/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/%[a-fA-F0-9]{2}/g, "")
    .replace(/&.+?;/g, "")
    .replace(/[^a-z0-9 _.\-@]/gi, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function baseUsername(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return sanitizeUsername(COMMON_MAILBOXES.includes(local) ? domain : local).toLowerCase();
}

export async function createCustomerUsername(email: string, isTaken: (name: string) => Promise<boolean>, random = Math.random): Promise<string> {
  const base = baseUsername(email);
  const digits = () => String(Math.floor(random() * 10_000)).padStart(4, "0");
  // Nothing usable before the "@" (e.g. only accents or symbols): WooCommerce uses "woo_user_" + 4 digits.
  let name = base || `woo_user_${digits()}`;
  for (let attempt = 0; attempt < 50 && (await isTaken(name)); attempt++) {
    name = base ? `${base}-${digits()}` : `woo_user_${digits()}`;
  }
  return name;
}
