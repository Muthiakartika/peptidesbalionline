/**
 * Sending through SendGrid (src/lib/email/index.ts): who really gets an e-mail with which settings, the
 * request SendGrid gets, and what the shop is told when it fails. Made-up addresses and keys only; fetch is
 * replaced, nothing leaves this computer.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseAddress, planDelivery, sendEmail, sendGridRequest } from "./index";

const email = { to: "buyer@example.com", subject: "Your order", text: "Hello" };
const KEY = "SG.test-key";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseAddress", () => {
  it("reads a bare address or Name <address>", () => {
    expect(parseAddress("hello@peptidesbali.online")).toEqual({ email: "hello@peptidesbali.online" });
    expect(parseAddress("Peptides Bali <hello@peptidesbali.online>")).toEqual({ email: "hello@peptidesbali.online", name: "Peptides Bali" });
    expect(parseAddress(' "Peptides Bali" <hello@peptidesbali.online> ')).toEqual({ email: "hello@peptidesbali.online", name: "Peptides Bali" });
    expect(parseAddress("not an address")).toBeNull();
    expect(parseAddress("a@b.c, d@e.f")).toBeNull();
    expect(parseAddress(undefined)).toBeNull();
  });
});

describe("planDelivery", () => {
  it("without a key: saved on a test site, nothing on the live site", () => {
    expect(planDelivery(email, {})).toEqual({ kind: "local" });
    expect(planDelivery(email, { SITE_ENV: "production" })).toEqual({ kind: "none", reason: "SENDGRID_API_KEY isn't set" });
  });

  it("on the live site: to the real address, from Peptides Bali by default", () => {
    expect(planDelivery(email, { SITE_ENV: "production", SENDGRID_API_KEY: KEY })).toEqual({
      kind: "sendgrid",
      key: KEY,
      from: { email: "hello@peptidesbali.online", name: "Peptides Bali" },
      to: "buyer@example.com",
      subject: "Your order",
      text: "Hello",
    });
    expect(planDelivery(email, { SITE_ENV: "production", SENDGRID_API_KEY: KEY, EMAIL_FROM: "Shop <shop@example.com>" })).toMatchObject({ from: { email: "shop@example.com", name: "Shop" } });
    expect(planDelivery(email, { SITE_ENV: "production", SENDGRID_API_KEY: KEY, EMAIL_FROM: "nonsense" })).toEqual({ kind: "none", reason: "EMAIL_FROM isn't an e-mail address" });
  });

  it("on a test site never to the real address: the test inbox, or saved", () => {
    const env = { SITE_ENV: "staging", SENDGRID_API_KEY: KEY, NEXT_PUBLIC_SITE_URL: "https://test.example" };
    expect(planDelivery(email, env)).toEqual({ kind: "local" });
    expect(planDelivery(email, { ...env, EMAIL_TEST_TO: "nonsense" })).toEqual({ kind: "local" });
    const plan = planDelivery(email, { ...env, EMAIL_TEST_TO: "me@example.com" });
    expect(plan).toMatchObject({ kind: "sendgrid", to: "me@example.com", subject: "[Test] Your order" });
    expect(plan.kind === "sendgrid" && plan.text).toBe("Test e-mail from https://test.example. On the live site it goes to buyer@example.com.\n\nHello");
    // The test inbox is ignored on the live site.
    expect(planDelivery(email, { ...env, SITE_ENV: "production", EMAIL_TEST_TO: "me@example.com" })).toMatchObject({ to: "buyer@example.com" });
  });
});

describe("sendEmail", () => {
  it("posts SendGrid's request with the key, plain text and no link tracking", async () => {
    vi.stubEnv("SITE_ENV", "production");
    vi.stubEnv("SENDGRID_API_KEY", KEY);
    const fetch = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetch);
    expect(await sendEmail(email)).toBe("sent");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(init.body))).toEqual({
      personalizations: [{ to: [{ email: "buyer@example.com" }] }],
      from: { email: "hello@peptidesbali.online", name: "Peptides Bali" },
      subject: "Your order",
      content: [{ type: "text/plain", value: "Hello" }],
      tracking_settings: { click_tracking: { enable: false, enable_text: false }, open_tracking: { enable: false } },
    });
  });

  it("answers not-sent (and logs why) when SendGrid refuses or can't be reached", async () => {
    vi.stubEnv("SITE_ENV", "production");
    vi.stubEnv("SENDGRID_API_KEY", KEY);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", async () => new Response('{"errors":[{"message":"The from address does not match a verified Sender Identity."}]}', { status: 403 }));
    expect(await sendEmail(email)).toBe("not-sent");
    expect(String(log.mock.calls[0][0])).toContain("HTTP 403");
    vi.stubGlobal("fetch", async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    expect(await sendEmail(email)).toBe("not-sent");
    expect(String(log.mock.calls[1][0])).toContain("ENOTFOUND");
  });

  it("sends the designed version with the plain copy first; a test site marks it as a test", () => {
    const designed = { ...email, html: "<!DOCTYPE html><html><body style=\"margin:0\"><p>Hi</p></body></html>" };
    const live = planDelivery(designed, { SITE_ENV: "production", SENDGRID_API_KEY: KEY });
    expect(live.kind === "sendgrid" && sendGridRequest(live).content).toEqual([
      { type: "text/plain", value: "Hello" },
      { type: "text/html", value: designed.html },
    ]);
    const test = planDelivery(designed, { SENDGRID_API_KEY: KEY, EMAIL_TEST_TO: "me@example.com", NEXT_PUBLIC_SITE_URL: "https://test.example" });
    expect(test.kind === "sendgrid" && test.html).toMatch(/<body style="margin:0">\n<div [^>]+>Test e-mail from https:\/\/test\.example\. On the live site it goes to <strong>buyer@example\.com<\/strong>\.<\/div><p>Hi<\/p>/);
  });

  it("never sends the key anywhere but SendGrid's request header", () => {
    const plan = planDelivery(email, { SITE_ENV: "production", SENDGRID_API_KEY: KEY });
    expect(plan.kind).toBe("sendgrid");
    if (plan.kind === "sendgrid") expect(JSON.stringify(sendGridRequest(plan))).not.toContain(KEY);
  });
});
