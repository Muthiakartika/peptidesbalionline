/**
 * WordPress password hashes (wp_users.user_pass) into legacy_passwords, so imported customers keep their old
 * password (Q-07; checked and converted at their first login by src/lib/auth/legacy-password.ts).
 *
 * Reads the owner's database export of the users table, from phpMyAdmin or a similar tool: CSV (comma or
 * semicolon, with or without a header line) or JSON (phpMyAdmin's JSON export, or a plain list of
 * { ID, user_pass }). Only the ID and user_pass columns are used; any others are ignored.
 * Rows are matched to accounts by WordPress user ID (users.legacy_wp_user_id). An account that already has a
 * password on this site is skipped: that one counts. Nothing is printed but counts.
 */

/** The same rules as src/lib/auth/wordpress-password.ts, for the counts only. */
export function hashFormat(hash) {
  if (hash.length <= 32) return "md5";
  if (hash.startsWith("$wp")) return "wp-bcrypt";
  if (hash.startsWith("$P$") || hash.startsWith("$H$")) return "phpass";
  if (/^\$2[aby]\$\d\d\$/.test(hash)) return "bcrypt";
  return "unsupported";
}

function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const separator = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const lines = rows.filter((r) => r.some((v) => v.trim()));
  if (!lines.length) return [];
  const header = lines[0].map((h) => h.trim().toLowerCase());
  const idColumn = header.indexOf("id");
  const hashColumn = header.indexOf("user_pass");
  if (idColumn >= 0 && hashColumn >= 0) return lines.slice(1).map((r) => ({ id: r[idColumn], hash: r[hashColumn] }));
  // No header: the first column holding a whole number is the ID, the one that looks like a hash is user_pass.
  return lines.map((r) => ({ id: r.find((v) => /^\d+$/.test(v.trim())), hash: r.find((v) => /^\$(wp\$2|P\$|H\$|2[aby]\$)|^[0-9a-f]{32}$/i.test(v.trim())) }));
}

function parseJson(data) {
  const pick = (record) => {
    const id = record.ID ?? record.id ?? record.Id;
    const hash = record.user_pass ?? record.USER_PASS;
    return id !== undefined && hash !== undefined ? { id: String(id), hash: String(hash) } : null;
  };
  if (Array.isArray(data)) {
    // phpMyAdmin's JSON export: [{ type: "header" }, { type: "database" }, { type: "table", data: [...] }].
    const table = data.find((entry) => entry && entry.type === "table" && Array.isArray(entry.data));
    return (table ? table.data : data).map(pick).filter(Boolean);
  }
  return [];
}

/** The export's rows as { id, hash }; rows without a usable ID or hash are left out. */
export function parsePasswordExport(text) {
  const trimmed = text.replace(/^﻿/, "").trim();
  let rows;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) rows = parseJson(JSON.parse(trimmed));
  else rows = parseCsv(trimmed);
  return rows
    .map((r) => ({ id: Number(String(r?.id ?? "").trim()), hash: String(r?.hash ?? "").trim() }))
    .filter((r) => Number.isInteger(r.id) && r.id > 0 && r.hash);
}

/** Writes the hashes in one transaction. Returns counts only. */
export async function importPasswords(rows, db) {
  const summary = { inFile: rows.length, imported: 0, alreadyHasPasswordHere: 0, noAccount: 0, unsupported: 0, formats: {} };
  await db.run(async (q) => {
    for (const { id, hash } of rows) {
      const format = hashFormat(hash);
      if (format === "unsupported") {
        summary.unsupported++;
        continue;
      }
      const [user] = await q("SELECT id FROM users WHERE legacy_wp_user_id = $1", [id]);
      if (!user) {
        summary.noAccount++;
        continue;
      }
      const [credential] = await q("SELECT 1 FROM accounts WHERE user_id = $1 AND provider_id = 'credential' AND password IS NOT NULL LIMIT 1", [user.id]);
      if (credential) {
        summary.alreadyHasPasswordHere++;
        continue;
      }
      await q("INSERT INTO legacy_passwords (user_id, hash, imported_at) VALUES ($1, $2, now()) ON CONFLICT (user_id) DO UPDATE SET hash = excluded.hash, imported_at = now()", [user.id, hash]);
      summary.imported++;
      summary.formats[format] = (summary.formats[format] ?? 0) + 1;
    }
  });
  return summary;
}
