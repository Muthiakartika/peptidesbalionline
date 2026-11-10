/**
 * Better Auth settings shared by the site (src/lib/auth/index.ts) and the table generator
 * (src/lib/auth/cli-config.ts). Free of "server-only" and of the database connection, so the CLI can
 * read it. Docs: node_modules/better-auth (1.7.12), https://www.better-auth.com/docs.
 *
 * Accounts copy WooCommerce's (docs/audit/backend-settings.md §1): e-mail + password, and a username,
 * because WordPress logs customers in with "Username or email address". Table names are plural
 * (docs/architecture/database-schema.md §1).
 * Still to come in Phase 5: the "set your password" e-mail after an account is created at checkout,
 * the lost-password e-mail (both need the e-mail step, Q-08) and the WordPress password check for
 * migrated customers (Q-07).
 */
import type { BetterAuthOptions } from "better-auth";
import { username } from "better-auth/plugins";

/** WordPress user names (sanitize_user, strict): letters, digits, space and _ . - @, up to 60 characters. */
const WORDPRESS_USERNAME = /^[a-z0-9 _.@-]+$/i;

export const authOptions = {
  appName: "Atlas Longevity",
  user: {
    modelName: "users",
    additionalFields: {
      /** The customer's WordPress user ID, for migrated accounts (old orders and affiliate links match it). */
      legacyWpUserId: { type: "number", required: false, input: false, unique: true },
      /** My Account → Account details: "First name" and "Last name" (WordPress user meta). `name` is the display name. */
      firstName: { type: "string", required: false, input: false },
      lastName: { type: "string", required: false, input: false },
      /**
       * WooCommerce's "default_password_nag": the account still has the password made up when it was
       * created (registration, checkout); cleared once the customer sets their own.
       */
      temporaryPassword: { type: "boolean", required: false, defaultValue: false, input: false },
      /** When "Resend" last e-mailed a new link (WooCommerce waits 60 seconds between two). */
      setPasswordResentAt: { type: "date", required: false, input: false },
      /**
       * WordPress's role: "customer" (everyone who registers), "shop_manager" or "administrator" (the shop's
       * staff: the order screens under /admin/). Set with scripts/dev/set-role.mjs, never from a form.
       */
      role: { type: "string", required: false, defaultValue: "customer", input: false },
    },
    // Account details can change the e-mail address at once, as WooCommerce does (no confirmation e-mail).
    changeEmail: { enabled: true, updateEmailWithoutVerification: true },
  },
  // WordPress keeps a "Remember me" login for 14 days; without it the cookie ends with the browser.
  session: { modelName: "sessions", expiresIn: 14 * 24 * 60 * 60 },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  emailAndPassword: { enabled: true },
  // The site uses trailing slashes (next.config.ts): Next.js sends /api/auth/get-session on to
  // /api/auth/get-session/, which Better Auth must then treat as the same endpoint.
  advanced: { skipTrailingSlashes: true },
  plugins: [
    username({
      minUsernameLength: 1,
      maxUsernameLength: 60,
      usernameValidator: (name) => WORDPRESS_USERNAME.test(name),
    }),
  ],
} satisfies BetterAuthOptions;
