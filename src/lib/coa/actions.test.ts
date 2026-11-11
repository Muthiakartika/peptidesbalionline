/**
 * "Request COA verification links" (src/lib/coa/actions.ts): the address is checked, the e-mail is built
 * from the page's own certificates, requests are limited, and a live server without an e-mail provider
 * answers "not-sent" (the library then offers the visitor's own e-mail app).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

let ip = "203.0.113.1";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": ip }) }));
const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/email", () => ({
  sendEmail: async (email: { to: string; subject: string; text: string }) => {
    sent.push(email);
    return process.env.SITE_ENV === "production" ? "not-sent" : "saved-locally";
  },
}));

const { emailCoaLinks } = await import("./actions");
const { getCoas } = await import("./library");
const coas = await getCoas();
const pt141 = coas.find((c) => c.title === "PT-141 10mg")!;

afterEach(() => {
  delete process.env.SITE_ENV;
  sent.length = 0;
});

describe("emailCoaLinks", () => {
  it("checks the address and the certificates", async () => {
    ip = "203.0.113.10";
    expect(await emailCoaLinks("not-an-email", [pt141.id])).toEqual({ status: "error", message: "Please enter a valid email address." });
    expect(await emailCoaLinks("buyer@example.com", ["no-such-coa"])).toEqual({ status: "error", message: "Please choose at least one certificate." });
    expect(sent).toHaveLength(0);
  });

  it("builds the e-mail from the page's certificates only", async () => {
    ip = "203.0.113.11";
    expect(await emailCoaLinks(" buyer@example.com ", [pt141.id, "https://evil.example/"])).toEqual({ status: "saved-locally" });
    expect(sent[0].to).toBe("buyer@example.com");
    expect(sent[0].subject).toBe("Atlas Longevity: COA verification links (1)");
    expect(sent[0].text).toContain("Verify on Janoshik: https://verify.janoshik.com/tests/150804-PT141_10mg_TVWLBRAXZ2KR");
    expect(sent[0].text).not.toContain("evil.example");
  });

  it("answers not-sent on a live server without an e-mail provider", async () => {
    ip = "203.0.113.12";
    process.env.SITE_ENV = "production";
    expect(await emailCoaLinks("buyer@example.com", [pt141.id])).toEqual({ status: "not-sent" });
  });

  it("limits requests per visitor", async () => {
    ip = "203.0.113.13";
    for (let i = 0; i < 5; i++) expect((await emailCoaLinks("buyer@example.com", [pt141.id])).status).toBe("saved-locally");
    expect(await emailCoaLinks("buyer@example.com", [pt141.id])).toEqual({ status: "error", message: "Too many requests. Please try again in a few minutes." });
  });
});
