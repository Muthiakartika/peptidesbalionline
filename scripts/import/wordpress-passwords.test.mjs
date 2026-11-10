/**
 * Reading the owner's users-table export in the shapes phpMyAdmin writes, and importing the hashes into the
 * real tables (in-memory PGlite with every migration). Made-up IDs and hashes only.
 */
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import { hashFormat, importPasswords, parsePasswordExport } from "./wordpress-passwords.mjs";

const WP = "$wp$2y$10$abcdefghijklmnopqrstuuJ8Wn7Yy1Qm9nE3GQ2FzF8w4pXbJcJ1a";
const PHPASS = "$P$BabcdefghijklmnopqrstuvwxyzABCD.";
const MD5 = "5f4dcc3b5aa765d61d8327deb882cf99";
const ARGON = "$argon2id$v=19$m=65536,t=4,p=1$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG";

describe("reading the export", () => {
  it("reads phpMyAdmin CSV with a header, in any column order, comma or semicolon", () => {
    expect(parsePasswordExport(`"ID","user_login","user_pass"\n"20","buyer","${WP}"\n"21","reader","${PHPASS}"\n`)).toEqual([
      { id: 20, hash: WP },
      { id: 21, hash: PHPASS },
    ]);
    expect(parsePasswordExport(`user_pass;ID\n${MD5};5\n`)).toEqual([{ id: 5, hash: MD5 }]);
  });

  it("reads CSV without a header by the values' shapes", () => {
    expect(parsePasswordExport(`20,${WP}\n21,${PHPASS}`)).toEqual([
      { id: 20, hash: WP },
      { id: 21, hash: PHPASS },
    ]);
  });

  it("reads phpMyAdmin's JSON export and a plain list", () => {
    const phpMyAdmin = [{ type: "header", version: "5.2" }, { type: "database", name: "wp" }, { type: "table", name: "wp_users", data: [{ ID: "20", user_pass: WP }] }];
    expect(parsePasswordExport(JSON.stringify(phpMyAdmin))).toEqual([{ id: 20, hash: WP }]);
    expect(parsePasswordExport(JSON.stringify([{ ID: 21, user_pass: PHPASS }]))).toEqual([{ id: 21, hash: PHPASS }]);
  });

  it("knows the formats", () => {
    // 32 characters or fewer is always MD5 to WordPress, so the others are full-length examples.
    expect([WP, PHPASS, MD5, "$2y$10$abcdefghijklmnopqrstuuJ8Wn7Yy1Qm9nE3GQ2FzF8w4pXbJcJ1a", ARGON].map(hashFormat)).toEqual(["wp-bcrypt", "phpass", "md5", "bcrypt", "unsupported"]);
  });
});

describe("importing into the real tables", () => {
  let pg;
  const db = () => ({ run: (fn) => pg.transaction((tx) => fn(async (text, params = []) => (await tx.query(text, params)).rows)) });

  beforeAll(async () => {
    pg = new PGlite();
    const dir = new URL("../../src/db/migrations/", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
    await pg.exec(`INSERT INTO users (id, name, email, legacy_wp_user_id) VALUES ('u20', 'Buyer', 'buyer@example.com', 20), ('u21', 'Reader', 'reader@example.com', 21), ('u22', 'Has password', 'set@example.com', 22);
      INSERT INTO accounts (id, account_id, provider_id, user_id, password, updated_at) VALUES ('a22', 'u22', 'credential', 'u22', 'scrypt-hash', now());`);
  }, 60_000);

  it("imports matching accounts, skips the ones with a password here and the unknown IDs", async () => {
    const rows = [
      { id: 20, hash: WP },
      { id: 21, hash: PHPASS },
      { id: 22, hash: MD5 },
      { id: 99, hash: MD5 },
      { id: 21, hash: ARGON },
    ];
    const summary = await importPasswords(rows, db());
    expect(summary).toEqual({ inFile: 5, imported: 2, alreadyHasPasswordHere: 1, noAccount: 1, unsupported: 1, formats: { "wp-bcrypt": 1, phpass: 1 } });
    const stored = (await pg.query("SELECT user_id FROM legacy_passwords ORDER BY user_id")).rows.map((r) => r.user_id);
    expect(stored).toEqual(["u20", "u21"]);
  });

  it("can run again without doubling", async () => {
    await importPasswords([{ id: 20, hash: WP }], db());
    expect((await pg.query("SELECT count(*)::int AS n FROM legacy_passwords")).rows[0].n).toBe(2);
  });
});
