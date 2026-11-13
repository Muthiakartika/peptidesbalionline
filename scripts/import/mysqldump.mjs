/**
 * Reads some tables out of a MySQL dump (mysqldump or phpMyAdmin, plain .sql or .sql.gz) without loading a
 * database: `readMysqlTables(file, ["wp_users"])` → { wp_users: { columns: [...], rows: [{ ID: "1", user_login: "x", … }] } }.
 * Values are strings (or null for NULL), as the dump writes them. Handles both layouts of INSERT: all rows on
 * one line (mysqldump) and one row per line below VALUES (phpMyAdmin), quoted strings with backslash escapes,
 * and a dump with or without a column list in the INSERT.
 *
 * The dump holds customers' personal data: callers print counts, never values.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";

/** "(1, 'a', NULL),(2, 'b\'c', 3)" → [["1", "a", null], ["2", "b'c", "3"]]. */
export function parseTuples(text) {
  const rows = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    while (i < n && text[i] !== "(") i++;
    if (i >= n) break;
    i++;
    const row = [];
    for (;;) {
      while (text[i] === " ") i++;
      if (text[i] === "'") {
        i++;
        let value = "";
        while (i < n) {
          const c = text[i];
          if (c === "\\") {
            const e = text[i + 1];
            value += e === "n" ? "\n" : e === "r" ? "\r" : e === "t" ? "\t" : e === "0" ? "\0" : e === "Z" ? "\x1a" : e;
            i += 2;
          } else if (c === "'" && text[i + 1] === "'") {
            value += "'";
            i += 2;
          } else if (c === "'") {
            i++;
            break;
          } else {
            value += c;
            i++;
          }
        }
        row.push(value);
      } else {
        const start = i;
        while (i < n && text[i] !== "," && text[i] !== ")") i++;
        const raw = text.slice(start, i).trim();
        row.push(raw === "NULL" ? null : raw);
      }
      if (text[i] === ",") {
        i++;
        continue;
      }
      if (text[i] === ")") {
        i++;
        break;
      }
      throw new Error("Unexpected character while reading a row of the dump.");
    }
    rows.push(row);
  }
  return rows;
}

/**
 * @param {string} file
 * @param {string[]} tables
 * @param {{ filters?: Record<string, (row: Record<string, string | null>) => boolean> }} [options] a filter per
 *   table decides which rows are kept while reading, so a huge table (wp_postmeta) never sits in memory whole.
 * @returns {Promise<Record<string, { columns: string[]; rows: Record<string, string | null>[] }>>}
 */
export async function readMysqlTables(file, tables, { filters = {} } = {}) {
  const wanted = new Set(tables);
  const source = file.endsWith(".gz") ? createReadStream(file).pipe(createGunzip()) : createReadStream(file);
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  const result = Object.fromEntries(tables.map((t) => [t, { columns: [], rows: [] }]));
  let creating = null;
  let inserting = null;
  let insertColumns = [];

  const add = (table, text) => {
    const keep = filters[table];
    for (const values of parseTuples(text)) {
      const row = Object.fromEntries(insertColumns.map((column, index) => [column, values[index] ?? null]));
      if (!keep || keep(row)) result[table].rows.push(row);
    }
  };

  for await (const line of lines) {
    const create = line.match(/^CREATE TABLE `([^`]+)`/);
    if (create && wanted.has(create[1])) {
      creating = create[1];
      continue;
    }
    if (creating) {
      const column = line.match(/^\s*`([^`]+)`\s/);
      if (column) result[creating].columns.push(column[1]);
      if (/^\)/.test(line)) creating = null;
      continue;
    }
    const insert = line.match(/^INSERT INTO `([^`]+)`\s*(?:\(([^)]*)\))?\s*VALUES\s*/);
    if (insert && wanted.has(insert[1])) {
      inserting = insert[1];
      insertColumns = insert[2] ? insert[2].split(",").map((c) => c.trim().replace(/`/g, "")) : result[inserting].columns;
      const rest = line.slice(insert[0].length);
      if (rest.trim()) add(inserting, rest);
      if (/;\s*$/.test(line)) inserting = null;
      continue;
    }
    if (inserting) {
      if (line.trim()) add(inserting, line);
      if (/;\s*$/.test(line)) inserting = null;
    }
  }
  return result;
}
