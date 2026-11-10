/**
 * Old WordPress passwords of imported customers (Q-07; hashes in the legacy_passwords table, imported with
 * scripts/import/import-wordpress-passwords.mjs).
 *   * adoptWordPressPassword: at a login the site's own check refused, the password is checked against the
 *     account's WordPress hash (wordpress-password.ts). If it matches, it becomes this site's password (Better
 *     Auth's "credential" account, hashed Better Auth's way) and the old hash is deleted, so it is used once.
 *   * forgetWordPressPassword: after "Lost your password?" set a new password, the old one stops counting.
 * The hash and the password are never logged.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

import { getDb } from "@/db";
import { accounts, legacyPasswords } from "@/db/schema";

import { checkWordPressPassword } from "./wordpress-password";

export async function adoptWordPressPassword(userId: string, password: string): Promise<boolean> {
  const db = getDb();
  const [legacy] = await db.select({ hash: legacyPasswords.hash }).from(legacyPasswords).where(eq(legacyPasswords.userId, userId)).limit(1);
  if (!legacy) return false;
  const [credential] = await db
    .select({ id: accounts.id, password: accounts.password })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")))
    .limit(1);
  if (credential?.password) {
    // The customer already has a password on this site: the WordPress one doesn't count any more.
    await forgetWordPressPassword(userId);
    return false;
  }
  if (!(await checkWordPressPassword(password, legacy.hash))) return false;
  const hashed = await hashPassword(password);
  const now = new Date();
  await db.transaction(async (tx) => {
    if (credential) await tx.update(accounts).set({ password: hashed, updatedAt: now }).where(eq(accounts.id, credential.id));
    else await tx.insert(accounts).values({ id: randomUUID().replace(/-/g, ""), accountId: userId, providerId: "credential", userId, password: hashed, createdAt: now, updatedAt: now });
    await tx.delete(legacyPasswords).where(eq(legacyPasswords.userId, userId));
  });
  return true;
}

export async function forgetWordPressPassword(userId: string): Promise<void> {
  await getDb().delete(legacyPasswords).where(eq(legacyPasswords.userId, userId));
}
