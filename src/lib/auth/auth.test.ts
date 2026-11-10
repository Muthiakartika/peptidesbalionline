/**
 * The account settings (options.ts) work end to end: sign up, log in with the username (as WordPress
 * allows), wrong passwords, WordPress-style usernames, and addresses ending in "/" (the site's
 * trailing slashes). Uses Better Auth's in-memory database, so no Postgres is needed.
 */
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it } from "vitest";

import { authOptions } from "./options";

const BASE = "http://localhost:3000";

function testAuth() {
  return betterAuth({
    ...authOptions,
    secret: "test-only-secret-with-enough-length-0123456789",
    baseURL: BASE,
    database: memoryAdapter({ users: [], sessions: [], accounts: [], verifications: [] }),
  });
}

function post(auth: ReturnType<typeof testAuth>, path: string, body: unknown) {
  return auth.handler(
    new Request(`${BASE}/api/auth${path}`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify(body) }),
  );
}

describe("accounts", () => {
  it("signs up with e-mail + password + username and logs in with the username", async () => {
    const auth = testAuth();
    const signUp = await post(auth, "/sign-up/email/", { email: "budi@example.com", password: "a-long-password", name: "Budi", username: "budi.santoso" });
    expect(signUp.status).toBe(200);
    const signIn = await post(auth, "/sign-in/username/", { username: "budi.santoso", password: "a-long-password" });
    expect(signIn.status).toBe(200);
    expect(signIn.headers.get("set-cookie")).toContain("session_token");
    const byEmail = await post(auth, "/sign-in/email", { email: "budi@example.com", password: "a-long-password" });
    expect(byEmail.status).toBe(200);
    const wrong = await post(auth, "/sign-in/username/", { username: "budi.santoso", password: "not-the-password" });
    expect(wrong.status).toBe(401);
  });

  it("accepts WordPress usernames (with @, space, dot, dash) and refuses other characters", async () => {
    const auth = testAuth();
    const wordpressStyle = await post(auth, "/sign-up/email", { email: "ana@example.com", password: "a-long-password", name: "Ana", username: "ana@shop" });
    expect(wordpressStyle.status).toBe(200);
    const invalid = await post(auth, "/sign-up/email", { email: "eve@example.com", password: "a-long-password", name: "Eve", username: "eve!<script>" });
    expect(invalid.status).toBe(400);
  });

  it("answers its endpoints with or without the final slash", async () => {
    const auth = testAuth();
    for (const path of ["/ok", "/ok/"]) {
      const response = await auth.handler(new Request(`${BASE}/api/auth${path}`));
      expect(response.status, path).toBe(200);
    }
  });
});
