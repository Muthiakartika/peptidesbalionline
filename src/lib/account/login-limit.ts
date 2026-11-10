/**
 * A limit on wrong passwords (an addition: the live site has no login limiter): after 5 failed logins for
 * the same account from the same address within 15 minutes, logging in to it from there waits until the
 * 15 minutes are over. Kept in this server's memory (one server process for now; a shared store, e.g. the
 * database, once the site runs on several).
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type Entry = { failures: number; since: number };
const shared = globalThis as typeof globalThis & { __atlasLoginFailures?: Map<string, Entry> };
const failures = (shared.__atlasLoginFailures ??= new Map());

const keyOf = (ip: string, login: string) => `${ip}|${login.toLowerCase()}`;

/** Minutes left before another try is allowed, or 0. */
export function loginBlockedFor(ip: string, login: string, now = Date.now()): number {
  const entry = failures.get(keyOf(ip, login));
  if (!entry || now - entry.since > WINDOW_MS) return 0;
  return entry.failures >= MAX_FAILURES ? Math.ceil((entry.since + WINDOW_MS - now) / 60_000) : 0;
}

export function recordLoginFailure(ip: string, login: string, now = Date.now()) {
  const key = keyOf(ip, login);
  const entry = failures.get(key);
  if (!entry || now - entry.since > WINDOW_MS) failures.set(key, { failures: 1, since: now });
  else entry.failures += 1;
}

export function clearLoginFailures(ip: string, login: string) {
  failures.delete(keyOf(ip, login));
}
