/**
 * The login / account server (Better Auth), for server code only. Created on first use, so building
 * the site needs neither a database nor the secret; a request to /api/auth/… without them fails with
 * a clear message.
 *
 *   import { getAuth } from "@/lib/auth";
 *   const session = await getAuth().api.getSession({ headers: await headers() });
 *
 * Settings shared with the table generator: ./options.ts. Needs DATABASE_URL and BETTER_AUTH_SECRET.
 */
import "server-only";

import { betterAuth } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb, schema } from "@/db";
import { newAccountEmail, passwordLink, resetPasswordEmail } from "@/lib/email/account-emails";
import { sendEmail, type EmailResult } from "@/lib/email";
import { siteUrl } from "@/lib/site";

import { authOptions } from "./options";

/**
 * What happened to the last password e-mail for an address (the action that asked for it reads it right
 * after: "sent", "saved-locally" in development, "not-sent" without a provider).
 */
export const passwordEmailResults = new Map<string, EmailResult>();

/** A reset asked for with this marker in its redirect is the new-account e-mail ("set your password"). */
export const NEW_ACCOUNT_MARKER = "/my-account/?newaccount=1";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set. Add it to .env.local (see .env.example).");
  return betterAuth({
    ...authOptions,
    secret,
    baseURL: siteUrl,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      ...authOptions.emailAndPassword,
      // WordPress's password reset keys last a day.
      resetPasswordTokenExpiresIn: 24 * 60 * 60,
      // WooCommerce's e-mails, with its link format (/my-account/lost-password/?key=…&id=…).
      // The customer chose their own password: no more "temporary password" reminder.
      onPasswordReset: async ({ user }) => {
        await getDb().update(schema.users).set({ temporaryPassword: false }).where(eq(schema.users.id, user.id));
        // A new password from "Lost your password?": an imported account's old WordPress one stops counting (Q-07).
        await getDb().delete(schema.legacyPasswords).where(eq(schema.legacyPasswords.userId, user.id));
      },
      sendResetPassword: async ({ user, url, token }) => {
        const newAccount = decodeURIComponent(url).includes("newaccount=1");
        const username = (user as typeof user & { username?: string | null }).username ?? user.name;
        const link = passwordLink(token, user.id, newAccount);
        const mail = newAccount ? newAccountEmail({ displayName: user.name, username, link }) : resetPasswordEmail({ displayName: user.name, username, link });
        passwordEmailResults.set(user.email.toLowerCase(), await sendEmail({ to: user.email, ...mail }));
      },
    },
    // nextCookies() lets Server Actions set the login cookie; Better Auth wants it last.
    plugins: [...authOptions.plugins, nextCookies()],
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  instance ??= createAuth();
  return instance;
}
