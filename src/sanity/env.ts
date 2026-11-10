/**
 * Sanity connection settings, read from environment variables (see .env.example).
 * They are NEXT_PUBLIC_ because the embedded Studio runs in the browser. They are not secrets;
 * write tokens (SANITY_API_WRITE_TOKEN) are never NEXT_PUBLIC_.
 */
export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production";

/** Pin the API version so Sanity behaviour can't change under us. Bump deliberately. */
export const apiVersion = "2026-11-01";

/** False until the owner creates the Sanity project and its ID is added to .env.local. */
export const isSanityConfigured = /^[a-z0-9-]+$/.test(projectId);
