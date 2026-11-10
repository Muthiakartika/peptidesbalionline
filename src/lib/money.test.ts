import { describe, expect, it } from "vitest";
import { formatMoney, multiplyMoney, parseMinor, sumMoney } from "./money";

describe("formatMoney", () => {
  // Expected strings copied from the live site's product pages and Store API.
  it("formats like the live site", () => {
    expect(formatMoney(120_000_000n)).toBe("Rp1,200,000.00");
    expect(formatMoney(408_000_000n)).toBe("Rp4,080,000.00");
    expect(formatMoney(10_000_000n)).toBe("Rp100,000.00");
    expect(formatMoney(0n)).toBe("Rp0.00");
  });

  it("keeps the cents", () => {
    expect(formatMoney(12_345n)).toBe("Rp123.45");
    expect(formatMoney(5n)).toBe("Rp0.05");
  });

  it("handles negative amounts (refunds, discounts)", () => {
    expect(formatMoney(-25_000_000n)).toBe("-Rp250,000.00");
  });
});

describe("arithmetic", () => {
  it("sums without floating point errors", () => {
    expect(sumMoney(40_000_000n, 10_000_000n)).toBe(50_000_000n); // Rp400,000 + Rp100,000 shipping
  });

  it("multiplies by whole quantities only", () => {
    expect(multiplyMoney(550_000_000n, 4)).toBe(2_200_000_000n);
    expect(() => multiplyMoney(1n, 1.5)).toThrow(RangeError);
    expect(() => multiplyMoney(1n, -1)).toThrow(RangeError);
  });
});

describe("parseMinor", () => {
  it("accepts Store API strings and database bigints", () => {
    expect(parseMinor("85000000")).toBe(85_000_000n);
    expect(parseMinor(85_000_000)).toBe(85_000_000n);
    expect(parseMinor(85_000_000n)).toBe(85_000_000n);
  });

  it("rejects decimals and junk", () => {
    expect(() => parseMinor("850000.00")).toThrow(RangeError);
    expect(() => parseMinor("abc")).toThrow(RangeError);
    expect(() => parseMinor(0.1)).toThrow(RangeError);
  });
});
