/**
 * The grey "~$247.27" hint next to every IDR price (the owner's USD snippet). Safe to use in
 * client components.
 *
 * It divides the IDR price by a fixed 16,500 IDR per USD and rounds to cents; this reproduces the
 * live text for all 182 products (see catalog.test.ts). Ranges use an en dash: "~$151.52–$515.15".
 */
export const usdRate = 16_500n;

export function formatUsd(minMinor: bigint, maxMinor: bigint = minMinor): string {
  const usd = (minor: bigint) => {
    // minor / 100 = IDR, IDR / 16,500 = USD, so USD cents = minor / 16,500 (rounded half up).
    const cents = (minor * 2n + usdRate) / (usdRate * 2n);
    return `$${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
  };
  return minMinor === maxMinor ? `~${usd(minMinor)}` : `~${usd(minMinor)}–${usd(maxMinor)}`;
}
