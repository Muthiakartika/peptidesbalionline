/**
 * The first login with an old WordPress password, on the real tables (in-memory PGlite with every migration):
 * the right password becomes this site's password once, a wrong one changes nothing, and an account that
 * already has a password here ignores the old hash. Made-up accounts and test hashes only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { verifyPassword } from "better-auth/crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

import fixture from "./fixtures/wordpress-hashes.json";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", () => ({ getDb: () => state.db }));

const { adoptWordPressPassword, forgetWordPressPassword } = await import("./legacy-password");

const vector = fixture.vectors[0];
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  const pg = new PGlite();
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
  db = drizzle(pg, { schema });
  state.db = db;
  await db.insert(schema.users).values([
    { id: "u-wp", name: "Imported", email: "imported@example.com", legacyWpUserId: 20 },
    { id: "u-set", name: "Has password", email: "set@example.com", legacyWpUserId: 21 },
  ]);
  await db.insert(schema.legacyPasswords).values([
    { userId: "u-wp", hash: vector.wpUntrimmed },
    { userId: "u-set", hash: vector.phpass },
  ]);
  await db.insert(schema.accounts).values({ id: "a-set", accountId: "u-set", providerId: "credential", userId: "u-set", password: "scrypt-of-another-password", updatedAt: new Date() });
}, 60_000);

const legacyRow = async (userId: string) => (await db.select().from(schema.legacyPasswords).where(eq(schema.legacyPasswords.userId, userId)))[0];
const credential = async (userId: string) => (await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)))[0];

describe("old WordPress passwords", () => {
  it("refuses a wrong password and keeps the old hash", async () => {
    expect(await adoptWordPressPassword("u-wp", "wrong password")).toBe(false);
    expect(await legacyRow("u-wp")).toBeDefined();
    expect(await credential("u-wp")).toBeUndefined();
  });

  it("turns the right password into this site's password, once", async () => {
    expect(await adoptWordPressPassword("u-wp", vector.password)).toBe(true);
    const account = await credential("u-wp");
    expect(account).toMatchObject({ providerId: "credential", accountId: "u-wp" });
    expect(await verifyPassword({ hash: account.password!, password: vector.password })).toBe(true);
    expect(await legacyRow("u-wp")).toBeUndefined();
    // Used once: the next login goes through the site's own check only.
    expect(await adoptWordPressPassword("u-wp", vector.password)).toBe(false);
  });

  it("ignores (and drops) the old hash of an account that already has a password here", async () => {
    expect(await adoptWordPressPassword("u-set", vector.password)).toBe(false);
    expect(await legacyRow("u-set")).toBeUndefined();
    expect((await credential("u-set")).password).toBe("scrypt-of-another-password");
  });

  it("forgets an old hash after a password reset", async () => {
    await db.insert(schema.legacyPasswords).values({ userId: "u-wp", hash: vector.md5 });
    await forgetWordPressPassword("u-wp");
    expect(await legacyRow("u-wp")).toBeUndefined();
  });
});
