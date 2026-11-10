import { existsSync, mkdirSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it doesn't read .env.local by itself.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Commands (see docs/architecture/database-schema.md §8):
//   npm run db:generate   create a new SQL migration from src/db/schema/*.ts
//   npm run db:migrate    apply migrations to the database in DATABASE_URL
//   npm run db:studio     browse the database
// With DATABASE_URL empty they use the local development database in .data/pglite (src/db/index.ts);
// stop the site first, because only one program can open that folder at a time.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
if (!url) mkdirSync(".data", { recursive: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  ...(url
    ? {
        // Migrations change tables, so they use Neon's direct connection when there is one; the site
        // itself uses the pooled DATABASE_URL (src/db/index.ts).
        dbCredentials: { url },
      }
    : { driver: "pglite" as const, dbCredentials: { url: "./.data/pglite" } }),
  strict: true,
  verbose: true,
});
