/**
 * Checking a password against a WordPress password hash, by the rules of WordPress 7.1.4's
 * wp_check_password (wp-includes/pluggable.php), so customers imported from the live site keep their
 * password (Q-07). In WordPress's order:
 *   * 32 characters or fewer: an old MD5 hash (WordPress still accepts these);
 *   * "$wp…": WordPress 6.8+ — bcrypt over base64(HMAC-SHA384 of the password, key "wp-sha384");
 *   * "$P$…" (or "$H$…"): phpass, WordPress before 6.8 — salted MD5 repeated 2^n times;
 *   * anything else: PHP's password_verify, i.e. a plain bcrypt hash ("$2y$…").
 * Passwords longer than 4096 characters never match. The password is checked exactly as typed (WordPress
 * trims it when it makes a hash, not when it checks one). Hashes are never logged.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";

export type WordPressHashFormat = "md5" | "wp-bcrypt" | "phpass" | "bcrypt" | "unsupported";

export function wordpressHashFormat(hash: string): WordPressHashFormat {
  if (hash.length <= 32) return "md5";
  if (hash.startsWith("$wp")) return "wp-bcrypt";
  if (hash.startsWith("$P$") || hash.startsWith("$H$")) return "phpass";
  if (/^\$2[aby]\$\d\d\$/.test(hash)) return "bcrypt";
  return "unsupported";
}

const equal = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** bcryptjs knows "$2a$" / "$2b$"; PHP writes "$2y$", the same algorithm. */
const bcryptCompare = (password: string, hash: string) => bcrypt.compare(password, hash.replace(/^\$2y\$/, "$2b$"));

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** phpass's own base-64 encoding of the final MD5 digest. */
function encode64(input: Buffer, count: number): string {
  let output = "";
  let i = 0;
  while (i < count) {
    let value = input[i++];
    output += ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += ITOA64[(value >> 18) & 0x3f];
  }
  return output;
}

/** phpass "portable" hash: "$P$" + cost character + 8-character salt + 22 characters of digest. */
function phpass(password: string, setting: string): string | null {
  const countLog2 = ITOA64.indexOf(setting[3]);
  if (countLog2 < 7 || countLog2 > 30) return null;
  const salt = setting.slice(4, 12);
  if (salt.length !== 8) return null;
  const secret = Buffer.from(password, "utf8");
  let digest = createHash("md5").update(Buffer.concat([Buffer.from(salt, "binary"), secret])).digest();
  for (let count = 1 << countLog2; count > 0; count--) digest = createHash("md5").update(Buffer.concat([digest, secret])).digest();
  return setting.slice(0, 12) + encode64(digest, 16);
}

export async function checkWordPressPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  if (password.length > 4096) return false;
  switch (wordpressHashFormat(hash)) {
    case "md5":
      return equal(hash.toLowerCase(), createHash("md5").update(password, "utf8").digest("hex"));
    case "wp-bcrypt": {
      const prehashed = createHmac("sha384", "wp-sha384").update(password, "utf8").digest("base64");
      return bcryptCompare(prehashed, hash.slice(3));
    }
    case "phpass": {
      const computed = phpass(password, hash);
      return computed !== null && equal(computed, hash);
    }
    case "bcrypt":
      return bcryptCompare(password, hash);
    default:
      return false;
  }
}
