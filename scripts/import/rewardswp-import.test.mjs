/**
 * Reading a MySQL dump (phpMyAdmin and mysqldump layouts, plain and gzipped) and importing RewardsWP's data into
 * the real tables (in-memory PGlite with every migration). Made-up people, codes and IDs only.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseTuples, readMysqlTables } from "./mysqldump.mjs";
import { importRewardsWp, mysqlDate, REWARDSWP_TABLES } from "./rewardswp-import.mjs";

const create = (table, columns) => `CREATE TABLE \`${table}\` (\n${columns.map((c) => `  \`${c}\` varchar(255) DEFAULT NULL`).join(",\n")},\n  PRIMARY KEY (\`${columns[0]}\`)\n) ENGINE=InnoDB;\n`;

/** phpMyAdmin's layout: one row per line below VALUES. */
const phpMyAdmin = (table, columns, rows) => `${create(table, columns)}\nINSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(", ")}) VALUES\n${rows.map((r) => `(${r.join(", ")})`).join(",\n")};\n`;
/** mysqldump's layout: all rows on one line, no column list. */
const mysqldump = (table, columns, rows) => `${create(table, columns)}\nINSERT INTO \`${table}\` VALUES ${rows.map((r) => `(${r.join(",")})`).join(",")};\n`;

const q = (v) => (v === null ? "NULL" : `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`);

const MEMBERS = ["id", "user_id", "email", "first_name", "last_name", "referral_code", "total_referrals", "completed_referrals", "points_balance", "status", "token", "created_at"];
const POINTS = ["id", "member_id", "points", "type", "source_type", "source_id", "status", "created_at", "expires_at", "note_internal", "note_public"];
const REFERRALS = ["id", "advocate_id", "event_id", "referred_user_id", "referred_email", "status", "order_id", "type", "source", "created_at", "converted_at"];
const REWARDS = ["id", "referral_id", "advocate_id", "recipient_type", "reward_type", "amount", "status", "created_at", "applied_at", "expires_at"];
const REWARDMETA = ["meta_id", "reward_id", "meta_key", "meta_value"];

const members = [
  [q(1), q(20), q("one@example.com"), q("One"), q("Test"), q("aaaaaaa"), q(0), q(0), q(0), q("active"), q("t1"), q("2026-09-12 10:53:09")],
  [q(2), q(21), q("two@example.com"), q("Two"), q("Test"), q("bbbbbbb"), q(1), q(0), q(50), q("active"), q("t2"), q("2026-10-28 19:51:19")],
  [q(3), q(22), q("three@example.com"), q("Three"), q("Test"), q("ccccccc"), q(0), q(0), q(288), q("active"), q("t3"), q("2026-10-29 01:45:16")],
  [q(4), q(99), q("ghost@example.com"), q("Ghost"), q("Test"), q("ddddddd"), q(0), q(0), q(0), q("active"), q("t4"), q("2026-10-29 04:08:54")],
];
const point = (id, member, points, source, sourceId, status, created) => [q(id), q(member), q(points), q("earned"), q(source), q(sourceId), q(status), q(created), q("2027-01-28 23:59:59"), "NULL", "NULL"];
const points = [
  point(1, 2, 50, "signup", 21, "approved", "2026-10-28 19:51:19"),
  point(2, 3, 288, "purchase", 5001, "approved", "2026-10-29 01:45:16"),
  point(3, 3, 415, "purchase", 5002, "pending", "2026-10-29 15:03:00"),
  point(4, 1, 60, "purchase", 5003, "pending", "2026-10-29 04:36:43"),
  point(5, 4, 50, "signup", 99, "approved", "2026-10-29 04:08:54"),
];
const referrals = [[q(1), q(2), "NULL", q(0), q("Friend@Example.com"), q("pending"), "NULL", q(""), q("unknown"), q("2026-10-29 12:00:00"), q("0000-00-00 00:00:00")]];
const rewards = [[q(1), q(1), q(0), q("friend"), q("fixed_discount"), q(250000), q("issued"), q("2026-10-29 12:00:00"), q("0000-00-00 00:00:00"), q("2027-01-28 19:53:13")]];
const rewardmeta = [[q(1), q(1), q("coupon_code"), q("rwfriend-abc123")]];

const dump = [
  "-- a dump\n",
  phpMyAdmin("wp_rewardswp_members", MEMBERS, members),
  phpMyAdmin("wp_rewardswp_points", POINTS, points),
  mysqldump("wp_rewardswp_referrals", REFERRALS, referrals),
  phpMyAdmin("wp_rewardswp_rewards", REWARDS, rewards),
  phpMyAdmin("wp_rewardswp_rewardmeta", REWARDMETA, rewardmeta),
  create("wp_other", ["id", "name"]),
  "INSERT INTO `wp_other` (`id`, `name`) VALUES\n(1, 'not wanted');\n",
].join("\n");

let directory;
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "rewardswp-"));
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("reading a MySQL dump", () => {
  it("reads quotes, escapes and NULL, in both INSERT layouts", () => {
    expect(parseTuples("(1, 'it\\'s', NULL),(2, 'a,b', 'c''d')")).toEqual([
      ["1", "it's", null],
      ["2", "a,b", "c'd"],
    ]);
    expect(parseTuples("(1, 'line\\nbreak', '(paren)')")).toEqual([["1", "line\nbreak", "(paren)"]]);
  });

  it("reads the wanted tables only, plain or gzipped, with the column names", async () => {
    const plain = join(directory, "dump.sql");
    writeFileSync(plain, dump);
    const gz = join(directory, "dump.sql.gz");
    writeFileSync(gz, gzipSync(dump));
    for (const file of [plain, gz]) {
      const tables = await readMysqlTables(file, REWARDSWP_TABLES);
      expect(tables.wp_rewardswp_members.columns).toEqual(MEMBERS);
      expect(tables.wp_rewardswp_members.rows).toHaveLength(4);
      expect(tables.wp_rewardswp_members.rows[0]).toMatchObject({ id: "1", user_id: "20", referral_code: "aaaaaaa", created_at: "2026-09-12 10:53:09" });
      expect(tables.wp_rewardswp_points.rows).toHaveLength(5);
      // The mysqldump layout has no column list: the CREATE TABLE gives the names.
      expect(tables.wp_rewardswp_referrals.rows[0]).toMatchObject({ advocate_id: "2", referred_email: "Friend@Example.com", converted_at: "0000-00-00 00:00:00" });
      expect(Object.keys(tables)).not.toContain("wp_other");
    }
  });

  it("reads MySQL dates as UTC and zero dates as none", () => {
    expect(mysqlDate("2026-10-28 19:51:19")?.toISOString()).toBe("2026-10-28T19:51:19.000Z");
    expect(mysqlDate("0000-00-00 00:00:00")).toBeNull();
    expect(mysqlDate(null)).toBeNull();
  });
});

describe("importing into the real tables", () => {
  let pg;
  const db = () => ({ run: (fn) => pg.transaction((tx) => fn(async (text, params = []) => (await tx.query(text, params)).rows)) });
  const query = async (text, params = []) => (await pg.query(text, params)).rows;
  let tables;

  beforeAll(async () => {
    pg = new PGlite();
    const dir = new URL("../../src/db/migrations/", import.meta.url);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(new URL(file, dir), "utf8"));
    await pg.exec(`INSERT INTO users (id, name, email, legacy_wp_user_id) VALUES ('u20', 'One', 'one@example.com', 20), ('u21', 'Two', 'two@example.com', 21), ('u22', 'Three', 'three@example.com', 22);
      INSERT INTO orders (id, order_key, status, subtotal_minor, total_minor, billing_email, billing, payment_method, payment_method_title, legacy_wc_order_id)
        VALUES ('00000000-0000-0000-0000-000000005001', 'wc_order_a', 'completed', 288000000, 288000000, 'three@example.com', '{}', 'x', 'X', 5001),
               ('00000000-0000-0000-0000-000000005002', 'wc_order_b', 'completed', 415000000, 415000000, 'three@example.com', '{}', 'x', 'X', 5002),
               ('00000000-0000-0000-0000-000000005003', 'wc_order_c', 'processing', 60000000, 60000000, 'one@example.com', '{}', 'x', 'X', 5003);
      INSERT INTO order_items (order_id, product_name, quantity, unit_price_minor, line_subtotal_minor, line_total_minor)
        VALUES ('00000000-0000-0000-0000-000000005001', 'P', 1, 288000000, 288000000, 288000000),
               ('00000000-0000-0000-0000-000000005002', 'P', 1, 415000000, 415000000, 415000000),
               ('00000000-0000-0000-0000-000000005003', 'P', 1, 60000000, 60000000, 60000000);
      INSERT INTO coupons (code, type, amount, source) VALUES ('rwfriend-abc123', 'fixed_cart', '250000.00', 'manual');`);
    const file = join(directory, "again.sql");
    writeFileSync(file, dump);
    tables = await readMysqlTables(file, REWARDSWP_TABLES);
  }, 60_000);

  it("imports the members who have an account, their approved points and the referral", async () => {
    const s = await importRewardsWp(tables, db());
    expect(s.members).toMatchObject({ inFile: 4, imported: 3, noAccount: 1 });
    expect(s.points).toMatchObject({ inFile: 5, imported: 2, noMember: 1, pendingCreditedNow: 1, pendingWaiting: 1 });
    expect(s.referrals).toMatchObject({ inFile: 1, imported: 1, couponsLinked: 1 });

    // Referral codes and join dates are kept (links already shared keep working).
    expect(await query("SELECT user_id, referral_code, joined_at FROM loyalty_members ORDER BY user_id")).toMatchObject([
      { user_id: "u20", referral_code: "aaaaaaa" },
      { user_id: "u21", referral_code: "bbbbbbb" },
      { user_id: "u22", referral_code: "ccccccc" },
    ]);
    // The signup points are the welcome credits; the approved purchase points belong to their order.
    expect(await query("SELECT type, credits, source, order_id FROM loyalty_transactions WHERE user_id = 'u21'")).toEqual([{ type: "earn", credits: 50, source: "welcome", order_id: null }]);
    expect(await query("SELECT type, credits, source, order_id FROM loyalty_transactions WHERE user_id = 'u22' ORDER BY credits")).toEqual([
      { type: "migration", credits: 288, source: "import", order_id: "00000000-0000-0000-0000-000000005001" },
      { type: "earn", credits: 415, source: "order", order_id: "00000000-0000-0000-0000-000000005002" },
    ]);
    // A pending purchase whose order isn't completed yet waits (a marker row with 0 credits, nothing else).
    expect(await query("SELECT credits FROM loyalty_transactions WHERE user_id = 'u20'")).toEqual([{ credits: 0 }]);
    // The referral keeps the friend's address and coupon; the coupon is marked as a reward coupon.
    expect(await query("SELECT referrer_user_id, referred_email, status, friend_coupon_code FROM loyalty_referrals")).toEqual([
      { referrer_user_id: "u21", referred_email: "friend@example.com", status: "pending", friend_coupon_code: "rwfriend-abc123" },
    ]);
    expect(await query("SELECT source FROM coupons WHERE code = 'rwfriend-abc123'")).toEqual([{ source: "rewards_referral" }]);
  });

  it("reconciles each member's approved points with RewardsWP's balance", async () => {
    const s = await importRewardsWp(tables, db());
    expect(s.reconciliation).toEqual([
      { memberId: "1", legacyBalance: 0, approvedPoints: 0, importedCredits: 0, ok: true },
      { memberId: "2", legacyBalance: 50, approvedPoints: 50, importedCredits: 50, ok: true },
      { memberId: "3", legacyBalance: 288, approvedPoints: 288, importedCredits: 288, ok: true },
    ]);
  });

  it("changes nothing when it runs again", async () => {
    const before = await query("SELECT (SELECT count(*) FROM loyalty_transactions)::int AS t, (SELECT count(*) FROM loyalty_members)::int AS m, (SELECT count(*) FROM loyalty_referrals)::int AS r");
    const s = await importRewardsWp(tables, db());
    expect(s.members).toMatchObject({ imported: 0, alreadyThere: 3 });
    expect(s.points).toMatchObject({ imported: 0 });
    expect(s.referrals).toMatchObject({ imported: 0, alreadyThere: 1 });
    expect(await query("SELECT (SELECT count(*) FROM loyalty_transactions)::int AS t, (SELECT count(*) FROM loyalty_members)::int AS m, (SELECT count(*) FROM loyalty_referrals)::int AS r")).toEqual(before);
  });
});
