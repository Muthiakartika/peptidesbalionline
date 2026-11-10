/**
 * The database connection. Import `getDb()` from server code only (Server Components,
 * Server Actions, Route Handlers, scripts): never from a Client Component.
 *
 *   import { getDb } from "@/db";
 *   const variants = await getDb().select().from(productVariants);
 *
 * Which database:
 *   * DATABASE_URL set (Neon, the real one): Postgres over the network (postgres.js).
 *   * DATABASE_URL empty, not production: a local Postgres in the folder .data/pglite (PGlite, the same
 *     Postgres compiled to WebAssembly, running inside the Node.js process). For trying accounts, carts
 *     and orders on this computer before Neon is set up. Create its tables once with
 *     `npm run db:migrate` while the site isn't running (only one program can open the folder).
 *   * DATABASE_URL empty in production (SITE_ENV=production): an error, never a local database.
 */
import "server-only";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Where the local development database lives (also used by drizzle.config.ts). */
export const LOCAL_DB_DIR = ".data/pglite";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * One connection per Node.js process, kept on globalThis: Next.js loads this file once for the pages and
 * once more for the route handlers (/api/auth), and two PGlite instances on the same folder would each
 * see only their own writes (and could damage the folder).
 */
const shared = globalThis as typeof globalThis & { __atlasDatabase?: Database };

export function getDb(): Database {
  if (shared.__atlasDatabase) return shared.__atlasDatabase;

  const url = process.env.DATABASE_URL;
  if (url) {
    // `prepare: false` keeps it compatible with connection poolers (Neon / Supabase pooled URLs).
    shared.__atlasDatabase = drizzle(postgres(url, { prepare: false }), { schema });
    return shared.__atlasDatabase;
  }
  if (process.env.SITE_ENV === "production") {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and add your Postgres URL.");
  }
  // Both drivers offer the same query builder (drizzle's PgDatabase); only the connection differs.
  mkdirSync(".data", { recursive: true });
  shared.__atlasDatabase = drizzlePglite({ client: new PGlite(LOCAL_DB_DIR), schema }) as unknown as Database;
  return shared.__atlasDatabase;
}

/** True when the site uses the local development database (no DATABASE_URL). */
export const usesLocalDatabase = () => !process.env.DATABASE_URL && process.env.SITE_ENV !== "production";

export { schema };
