/**
 * Money helpers. Every amount in this project is a bigint in MINOR units (cents).
 * IDR has 2 decimals on this store (WooCommerce setting), so:
 *   Rp 850,000.00  →  85_000_000n
 *
 * Why bigint? JavaScript numbers are floating point: 0.1 + 0.2 !== 0.3. Money must never be
 * calculated that way (PRD §9). The database stores the same integers (Postgres bigint).
 */

export type CurrencyCode = "IDR";

const CURRENCY_FORMAT: Record<CurrencyCode, { prefix: string; decimals: number; thousands: string; decimal: string }> = {
  // Same format as the live site: "Rp1,200,000.00".
  IDR: { prefix: "Rp", decimals: 2, thousands: ",", decimal: "." },
};

/** Formats minor units the way WooCommerce shows them on peptidesbali.online, e.g. "Rp1,200,000.00". */
export function formatMoney(minor: bigint, currency: CurrencyCode = "IDR"): string {
  const { prefix, decimals, thousands, decimal } = CURRENCY_FORMAT[currency];
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const divisor = 10n ** BigInt(decimals);
  const whole = (absolute / divisor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
  const fraction = (absolute % divisor).toString().padStart(decimals, "0");
  return `${negative ? "-" : ""}${prefix}${whole}${decimals > 0 ? decimal + fraction : ""}`;
}

/** Adds any number of amounts. */
export function sumMoney(...amounts: bigint[]): bigint {
  return amounts.reduce((total, amount) => total + amount, 0n);
}

/** Unit price × quantity. Quantity must be a whole number ≥ 0. */
export function multiplyMoney(unitMinor: bigint, quantity: number): bigint {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a whole number ≥ 0, got ${quantity}`);
  }
  return unitMinor * BigInt(quantity);
}

/**
 * Reads an integer price string from the WooCommerce Store API (e.g. "85000000") or the
 * database driver (Postgres bigint arrives as a string) and returns a bigint.
 */
export function parseMinor(value: string | number | bigint): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new RangeError(`Not a safe integer amount: ${value}`);
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value.trim())) throw new RangeError(`Not an integer amount: "${value}"`);
  return BigInt(value.trim());
}
