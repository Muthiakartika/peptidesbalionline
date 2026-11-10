/**
 * The database the import scripts write to: DATABASE_URL_UNPOOLED / DATABASE_URL (Neon) or, when empty, the
 * local one in .data/pglite (stop the site first: only one program can open that folder).
 * `run(fn)` runs fn(query) in one transaction; `query(text, params)` returns rows.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function openDatabase() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (url) {
    const postgres = require("postgres");
    const sql = postgres(url, { prepare: false, max: 1 });
    return {
      where: "DATABASE_URL",
      run: (fn) => sql.begin((tx) => fn((text, params = []) => tx.unsafe(text, params))),
      query: (text, params = []) => sql.unsafe(text, params),
      close: () => sql.end(),
    };
  }
  if (process.env.SITE_ENV === "production") throw new Error("SITE_ENV=production needs DATABASE_URL: never the local database.");
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(".data/pglite");
  await pg.waitReady;
  return {
    where: ".data/pglite (local)",
    run: (fn) => pg.transaction((tx) => fn(async (text, params = []) => (await tx.query(text, params)).rows)),
    query: async (text, params = []) => (await pg.query(text, params)).rows,
    close: () => pg.close(),
  };
}

/** Personal data stays out of the project folder: refuse files inside it. */
export function outsideProject(file) {
  const path = require("node:path");
  return !path.resolve(file).toLowerCase().startsWith(path.resolve(".").toLowerCase() + path.sep);
}
