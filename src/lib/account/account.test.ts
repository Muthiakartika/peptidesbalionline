/** My Account rules with WooCommerce 11.2.1's texts: user names, form checks, addresses, messages. */
import { describe, expect, it } from "vitest";

import { decodeNotices, encodeNotices, notice } from "./notices";
import { baseUsername, createCustomerUsername, sanitizeUsername } from "./username";
import { formatAddress, normaliseAddress, validateAccountDetails, validateAddress } from "./validation";

const text = (n: { parts: unknown[] }) => n.parts.map((p) => (typeof p === "string" ? p : (p as { strong?: string; text?: string }).strong ?? (p as { text: string }).text)).join("");

describe("account user names", () => {
  it("uses the part before @, or the domain for common mailboxes, cleaned like WordPress", () => {
    expect(baseUsername("Budi.Santoso@example.com")).toBe("budi.santoso");
    expect(baseUsername("info@atlas-lab.co.id")).toBe("atlas-lab.co.id");
    expect(sanitizeUsername("José <b>Ñ</b>+1")).toBe("Jose N1");
  });

  it("adds -#### when the name is taken, woo_user_#### when nothing is usable", async () => {
    const taken = new Set(["budi"]);
    expect(await createCustomerUsername("budi@example.com", async (n) => taken.has(n), () => 0.042)).toBe("budi-0420");
    expect(await createCustomerUsername("+++@example.com", async () => false, () => 0.5)).toBe("woo_user_5000");
  });
});

describe("account details", () => {
  const current = { displayName: "budi", email: "budi@example.com" };
  const input = { firstName: "Budi", lastName: "Santoso", displayName: "budi", email: "budi@example.com", currentPassword: "", newPassword: "", confirmPassword: "" };

  it("accepts a complete form and lists missing fields in WooCommerce's order", () => {
    expect(validateAccountDetails(input, current, false)).toEqual([]);
    const empty = validateAccountDetails({ ...input, firstName: "", lastName: "", displayName: "", email: "" }, current, false).map(text);
    expect(empty).toEqual(["First name is a required field.", "Last name is a required field.", "Display name is a required field.", "Email address is a required field."]);
  });

  it("checks the e-mail, the display name and the password fields", () => {
    expect(validateAccountDetails({ ...input, email: "nope" }, current, false).map(text)).toEqual(["Please provide a valid email address."]);
    expect(validateAccountDetails({ ...input, email: "other@example.com" }, current, true).map(text)).toEqual(["This email address is already registered."]);
    expect(validateAccountDetails({ ...input, displayName: "x@y.com" }, current, false).map(text)).toEqual(["Display name cannot be changed to email address due to privacy concern."]);
    expect(validateAccountDetails({ ...input, currentPassword: "a" }, current, false).map(text)).toEqual(["Please fill out all password fields."]);
    expect(validateAccountDetails({ ...input, newPassword: "a" }, current, false).map(text)).toEqual(["Please enter your current password."]);
    expect(validateAccountDetails({ ...input, currentPassword: "a", newPassword: "b" }, current, false).map(text)).toEqual(["Please re-enter your password."]);
    expect(validateAccountDetails({ ...input, currentPassword: "a", newPassword: "b", confirmPassword: "c" }, current, false).map(text)).toEqual(["New passwords do not match."]);
  });
});

describe("addresses", () => {
  const billing = { first_name: "Budi Santoso", phone: "812 3456 789", email: "Budi@Example.com", country: "ID", address_1: "Jl. Pantai Berawa 1", city: "Canggu", state: "BA", postcode: "80361" };

  it("checks the fields with save_address's texts", () => {
    expect(validateAddress("billing", normaliseAddress("billing", billing))).toEqual([]);
    expect(validateAddress("billing", normaliseAddress("billing", { ...billing, first_name: "", phone: "call me", postcode: "80*61" })).map(text)).toEqual([
      "Full name is a required field.",
      "WhatsApp Number is not a valid phone number.",
      "Please enter a valid postcode / ZIP.",
    ]);
    expect(validateAddress("shipping", normaliseAddress("shipping", {})).map(text)[0]).toBe("First name is a required field.");
  });

  it("formats an address like WooCommerce (no country for Indonesia, the province by name)", () => {
    expect(formatAddress(normaliseAddress("billing", billing))).toEqual(["Budi Santoso", "Jl. Pantai Berawa 1", "Canggu", "Bali", "80361"]);
    expect(normaliseAddress("billing", billing).email).toBe("budi@example.com");
  });
});

describe("flash messages", () => {
  it("survive the cookie, and a changed cookie or another site's link gives none", () => {
    const list = [notice.error({ strong: "Error:" }, " Username is required."), notice.success("Saved.", { text: "View", href: "/my-account/" })];
    expect(decodeNotices(encodeNotices(list))).toEqual(list);
    expect(decodeNotices("not json")).toEqual([]);
    expect(decodeNotices(encodeNotices([notice.info({ text: "x", href: "https://evil.example/" })]))).toEqual([]);
    expect(decodeNotices(encodeNotices([notice.info({ text: "x", href: "//evil.example/" })]))).toEqual([]);
  });
});

describe("login limit", () => {
  it("pauses an account's logins from one address after 5 wrong passwords, for 15 minutes", async () => {
    const { clearLoginFailures, loginBlockedFor, recordLoginFailure } = await import("./login-limit");
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) recordLoginFailure("1.2.3.4", "Budi", t0);
    expect(loginBlockedFor("1.2.3.4", "budi", t0)).toBe(0);
    recordLoginFailure("1.2.3.4", "budi", t0);
    expect(loginBlockedFor("1.2.3.4", "budi", t0 + 60_000)).toBe(14);
    expect(loginBlockedFor("5.6.7.8", "budi", t0)).toBe(0);
    expect(loginBlockedFor("1.2.3.4", "budi", t0 + 16 * 60_000)).toBe(0);
    clearLoginFailures("1.2.3.4", "budi");
  });
});
