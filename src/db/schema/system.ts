/**
 * System tables used by every module: legacy ID lookups, migration runs and the admin audit log.
 * See docs/architecture/database-schema.md §6.
 */
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * WordPress password hashes of imported accounts (Q-07), so a customer's old password keeps working: at the
 * first login with it, src/lib/auth/legacy-password.ts checks it the way WordPress does, saves it as this
 * site's own password and deletes the row. "Lost your password?" deletes it too. Imported with
 * scripts/import/import-wordpress-passwords.mjs from the owner's database export; never shown anywhere.
 */
export const legacyPasswords = pgTable("legacy_passwords", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** As WordPress stored it in wp_users.user_pass ("$wp$2y$…", "$P$…", bcrypt or an old MD5). */
  hash: text("hash").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One place to translate any WordPress/WooCommerce/AffiliateWP ID into the new UUID,
 * e.g. ("wc_order", "12345") → order uuid. Keeps old links and reports reconcilable.
 */
export const legacyIdMappings = pgTable(
  "legacy_id_mappings",
  {
    entityType: text("entity_type").notNull(),
    legacyId: text("legacy_id").notNull(),
    newId: text("new_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("legacy_id_mappings_key").on(table.entityType, table.legacyId),
    index("legacy_id_mappings_new_id_idx").on(table.newId),
  ],
);

/** One row per step of each migration script run, with counts for reconciliation. */
export const migrationLogs = pgTable("migration_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: text("run_id").notNull(),
  step: text("step").notNull(),
  sourceCount: integer("source_count"),
  importedCount: integer("imported_count"),
  skippedCount: integer("skipped_count"),
  errors: jsonb("errors"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/** Every admin action (price change, order status change, manual "mark paid"…). Append-only. */
export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_audit_logs_target_idx").on(table.targetType, table.targetId)],
);
