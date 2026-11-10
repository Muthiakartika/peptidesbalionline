/**
 * Site-wide settings that come from environment variables (see .env.example).
 *
 * SITE_ENV decides whether search engines may index the site:
 *   - "production" → normal indexing, same robots rules as WordPress today
 *   - anything else (local, preview, staging) → noindex everywhere
 * This protects the live site's SEO while the rebuild runs on other URLs (PRD §11).
 */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const isProduction = process.env.SITE_ENV === "production";

/** Business details from the live site's footer and JSON-LD (Store schema). */
export const business = {
  name: "Atlas Longevity",
  email: "hello@peptidesbali.online",
  whatsappNumber: "6282326300167",
} as const;
