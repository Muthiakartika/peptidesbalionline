"use server";

/**
 * My Account's forms (Server Actions), with WooCommerce 11.2.1's and WordPress's texts and rules:
 *   * logIn: "Username or email address" + password (+ "Remember me"); errors as wp_signon gives them;
 *   * register: e-mail only; WooCommerce makes up the user name (src/lib/account/username.ts) and a
 *     password, and logs the new customer in. Live then e-mails a link to set the password: this copy
 *     can't send e-mails yet (Q-08) and says so instead of claiming it did;
 *   * saveAccountDetails: names, display name, e-mail, password change;
 *   * saveAddress: the billing / shipping address;
 *   * sendOrderVerification: "Confirm email address" on Orders (needs e-mail, Q-08: says so).
 * A form that succeeds goes on to the next page like WooCommerce (redirect; after logging in or registering
 * the browser loads it in full, so the static header shows the account menu), its message in the flash
 * cookie (src/lib/account/notices.ts); a form with errors stays and gets the messages back.
 * Accounts live in the database (Neon, or the local one while DATABASE_URL is empty: src/db/index.ts).
 */
import { randomBytes } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/db";
import { addresses, users } from "@/db/schema";
import { getAuth, NEW_ACCOUNT_MARKER, passwordEmailResults } from "@/lib/auth";
import { adoptWordPressPassword } from "@/lib/auth/legacy-password";
import type { EmailResult } from "@/lib/email";
import { ACCOUNT_COOKIE } from "@/lib/account/account-cookie";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/account/login-limit";
import { encodeNotices, FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, notice, type Notice } from "@/lib/account/notices";
import { getAccountUser, logoutTokenFor } from "@/lib/account/session";
import { createCustomerUsername } from "@/lib/account/username";
import { addressFields, isEmail, normaliseAddress, validateAccountDetails, validateAddress, type AddressType } from "@/lib/account/validation";

/** `redirect`: logged in; the browser loads that page (a full load, so the header shows the account menu). */
export type AccountFormResult = { notices: Notice[]; redirect?: string };

const LOST_PASSWORD = "/my-account/lost-password/";
const text = (value: FormDataEntryValue | null, max = 200) => (typeof value === "string" ? value.slice(0, max) : "");
/** Only an address of this site; anything else goes to My Account (wp_validate_redirect). */
const safeRedirect = (value: string) => (/^\/(?!\/)[^\s\\]*$/.test(value) ? value : "/my-account/");

async function flash(list: Notice[]) {
  if (!list.length) return;
  (await cookies()).set(FLASH_COOKIE, encodeNotices(list), { path: "/", maxAge: FLASH_MAX_AGE_SECONDS, sameSite: "lax" });
}

/**
 * WooCommerce's "set your password" (new account) or "reset your password" e-mail, through Better Auth's
 * reset token (src/lib/auth/index.ts writes the e-mail). Says what happened to it.
 */
async function sendPasswordLink(email: string, newAccount: boolean): Promise<EmailResult> {
  const key = email.toLowerCase();
  passwordEmailResults.delete(key);
  await getAuth().api.requestPasswordReset({ body: { email, redirectTo: newAccount ? NEW_ACCOUNT_MARKER : "/my-account/lost-password/" }, headers: await headers() });
  const result = passwordEmailResults.get(key) ?? "not-sent";
  passwordEmailResults.delete(key);
  return result;
}

/** The registration messages, honest about the e-mail (WooCommerce: "…a password has been sent…"). */
function accountCreatedNotices(result: EmailResult): Notice[] {
  if (result === "sent") return [notice.success("Your account was created successfully and a password has been sent to your email address.")];
  if (result === "saved-locally") {
    return [
      notice.success("Your account was created successfully and a password has been sent to your email address."),
      notice.info("This copy of the shop doesn't send e-mails yet: the e-mail with the link to set your password was saved in the folder .data/mail on this computer."),
    ];
  }
  return [notice.success("Your account was created successfully."), notice.info("This copy of the shop can't send e-mails yet, so no e-mail with a link to set your password was sent.")];
}

/** The header's "logged in" cookie with this session's logout token (src/lib/account/account-cookie.ts). */
async function rememberLogin(sessionToken: string, remember: boolean) {
  (await cookies()).set(ACCOUNT_COOKIE, logoutTokenFor(sessionToken), { path: "/", sameSite: "lax", ...(remember ? { maxAge: 14 * 24 * 60 * 60 } : {}) });
}

/** The database isn't reachable or has no tables yet: say what to do instead of a crash. */
function unavailable(error: unknown): AccountFormResult {
  console.error("[account] database error", error);
  return { notices: [notice.error({ strong: "Error:" }, " Accounts aren't available right now: the shop's database can't be reached. Please try again later.")] };
}

export async function logIn(form: FormData): Promise<AccountFormResult> {
  const login = text(form.get("username")).trim();
  const password = text(form.get("password"), 500);
  const remember = form.get("rememberme") === "forever";
  const redirectTo = safeRedirect(text(form.get("redirect"), 300));

  if (!login) return { notices: [notice.error({ strong: "Error:" }, " ", "Username is required.")] };
  if (!password) return { notices: [notice.error({ strong: "Error:" }, " The password field is empty.")] };

  // An addition to live: 5 wrong passwords in 15 minutes pause logins to that account from that address.
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const wait = loginBlockedFor(ip, login);
  if (wait) return { notices: [notice.error({ strong: "Error:" }, ` Too many failed login attempts. Please try again in ${wait} ${wait === 1 ? "minute" : "minutes"}.`)] };

  const byEmail = isEmail(login);
  let sessionToken: string;
  try {
    const [account] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(byEmail ? sql`lower(${users.email}) = ${login.toLowerCase()}` : eq(users.username, login.toLowerCase()))
      .limit(1);
    if (!account) {
      return {
        notices: [
          byEmail
            ? notice.error("Unknown email address. Check again or try your username.")
            : notice.error({ strong: "Error:" }, " The username ", { strong: login }, " is not registered on this site. If you are unsure of your username, try your email address instead."),
        ],
      };
    }
    const signIn = async () => {
      const auth = getAuth();
      const result = byEmail
        ? await auth.api.signInEmail({ body: { email: login, password, rememberMe: remember }, headers: await headers() })
        : await auth.api.signInUsername({ body: { username: login, password, rememberMe: remember }, headers: await headers() });
      if (!result?.token) throw new Error("no session");
      return result.token;
    };
    try {
      try {
        sessionToken = await signIn();
      } catch {
        // An account imported from WordPress keeps its old password (Q-07): checked the WordPress way once,
        // then saved as this site's password.
        const adopted = await adoptWordPressPassword(account.id, password).catch((error) => {
          console.error("[account] WordPress password check failed", error instanceof Error ? error.message : "error");
          return false;
        });
        if (!adopted) throw new Error("wrong password");
        sessionToken = await signIn();
      }
    } catch {
      recordLoginFailure(ip, login);
      return {
        notices: [
          notice.error(
            { strong: "Error:" },
            ` The password you entered for the ${byEmail ? "email address" : "username"} `,
            { strong: login },
            " is incorrect. ",
            { text: "Lost your password?", href: LOST_PASSWORD },
          ),
        ],
      };
    }
  } catch (error) {
    return unavailable(error);
  }
  clearLoginFailures(ip, login);
  await rememberLogin(sessionToken, remember);
  return { notices: [], redirect: redirectTo };
}

export async function register(form: FormData): Promise<AccountFormResult> {
  const email = text(form.get("email")).trim();
  const redirectTo = safeRedirect(text(form.get("redirect"), 300));
  if (!email || !isEmail(email)) return { notices: [notice.error({ strong: "Error:" }, " Please provide a valid email address.")] };

  let sessionToken: string;
  let mailResult: EmailResult = "not-sent";
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (existing) {
      return { notices: [notice.error({ strong: "Error:" }, ` An account is already registered with ${email}. Please log in or use a different email address.`)] };
    }
    const username = await createCustomerUsername(email, async (name) => (await db.select({ id: users.id }).from(users).where(eq(users.username, name)).limit(1)).length > 0);
    // WooCommerce generates the password (wp_generate_password) and e-mails a link to set one's own.
    const password = randomBytes(18).toString("base64url");
    const result = await getAuth().api.signUpEmail({ body: { email, password, name: username, username }, headers: await headers() });
    if (!result?.token) throw new Error("sign-up gave no session");
    sessionToken = result.token;
    await db.update(users).set({ temporaryPassword: true }).where(eq(users.id, result.user.id));
    mailResult = await sendPasswordLink(email, true);
  } catch (error) {
    return unavailable(error);
  }
  await rememberLogin(sessionToken, false);
  await flash(accountCreatedNotices(mailResult));
  return { notices: [], redirect: redirectTo };
}

export async function saveAccountDetails(form: FormData): Promise<AccountFormResult> {
  const user = await getAccountUser().catch(() => null);
  if (!user) redirect("/my-account/");
  const input = {
    firstName: text(form.get("account_first_name")).trim(),
    lastName: text(form.get("account_last_name")).trim(),
    displayName: text(form.get("account_display_name")).trim(),
    email: text(form.get("account_email")).trim(),
    currentPassword: text(form.get("password_current"), 500),
    newPassword: text(form.get("password_1"), 500),
    confirmPassword: text(form.get("password_2"), 500),
  };
  try {
    const db = getDb();
    const taken = isEmail(input.email)
      ? (await db
          .select({ id: users.id })
          .from(users)
          .where(and(sql`lower(${users.email}) = ${input.email.toLowerCase()}`, ne(users.id, user.id)))
          .limit(1)).length > 0
      : false;
    const messages = validateAccountDetails(input, { displayName: user.displayName, email: user.email }, taken);
    if (messages.length) return { notices: messages };

    if (input.newPassword) {
      if (input.newPassword.length < 8) return { notices: [notice.error("Please enter a stronger password.")] };
      try {
        await getAuth().api.changePassword({ body: { currentPassword: input.currentPassword, newPassword: input.newPassword }, headers: await headers() });
        await db.update(users).set({ temporaryPassword: false }).where(eq(users.id, user.id));
      } catch {
        return { notices: [notice.error("Your current password is incorrect.")] };
      }
    }
    await db
      .update(users)
      .set({ firstName: input.firstName, lastName: input.lastName, name: input.displayName, email: input.email.toLowerCase(), updatedAt: new Date() })
      .where(eq(users.id, user.id));
    // As WooCommerce: a changed e-mail or name is copied into the billing address.
    const changes: Partial<typeof addresses.$inferInsert> = {};
    if (input.email.toLowerCase() !== user.email.toLowerCase()) changes.email = input.email.toLowerCase();
    if (input.firstName !== user.firstName) changes.firstName = input.firstName;
    if (input.lastName !== user.lastName) changes.lastName = input.lastName;
    if (Object.keys(changes).length) {
      await db
        .insert(addresses)
        .values({ userId: user.id, type: "billing", ...changes })
        .onConflictDoUpdate({ target: [addresses.userId, addresses.type], set: { ...changes, updatedAt: new Date() } });
    }
  } catch (error) {
    return unavailable(error);
  }
  await flash([notice.success("Account details changed successfully.")]);
  redirect("/my-account/edit-account/");
}

export async function saveAddress(type: AddressType, form: FormData): Promise<AccountFormResult> {
  if (type !== "billing" && type !== "shipping") redirect("/my-account/edit-address/");
  const user = await getAccountUser().catch(() => null);
  if (!user) redirect("/my-account/");
  const raw: Record<string, string> = {};
  for (const field of addressFields[type]) raw[field.key] = text(form.get(`${type}_${field.key}`), 300);
  const values = normaliseAddress(type, raw);
  const messages = validateAddress(type, values);
  if (messages.length) return { notices: messages };
  const row = {
    firstName: values.first_name || null,
    lastName: values.last_name || null,
    address1: values.address_1 || null,
    city: values.city || null,
    state: values.state || null,
    postcode: values.postcode || null,
    country: values.country || null,
    phone: values.phone || null,
    email: values.email || null,
  };
  try {
    await getDb()
      .insert(addresses)
      .values({ userId: user.id, type, ...row })
      .onConflictDoUpdate({ target: [addresses.userId, addresses.type], set: { ...row, updatedAt: new Date() } });
  } catch (error) {
    return unavailable(error);
  }
  await flash([notice.success("Address changed successfully.")]);
  redirect("/my-account/edit-address/");
}

/** "Confirm email address" on Orders: WooCommerce e-mails a link; this copy can't send e-mails yet. */
export async function sendOrderVerification(): Promise<AccountFormResult> {
  return { notices: [notice.error("This copy of the shop can't send e-mails yet, so the confirmation link wasn't sent.")] };
}

/** "Lost your password?": a user name or e-mail address; WooCommerce's texts (retrieve_password). */
export async function requestPasswordLink(form: FormData): Promise<AccountFormResult> {
  const login = text(form.get("user_login")).trim();
  if (!login) return { notices: [notice.error("Enter a username or email address.")] };
  let result: EmailResult;
  try {
    const db = getDb();
    let [account] = await db.select({ email: users.email }).from(users).where(eq(users.username, login.toLowerCase())).limit(1);
    if (!account && isEmail(login)) [account] = await db.select({ email: users.email }).from(users).where(sql`lower(${users.email}) = ${login.toLowerCase()}`).limit(1);
    if (!account) return { notices: [notice.error("Invalid username or email.")] };
    result = await sendPasswordLink(account.email, false);
  } catch (error) {
    return unavailable(error);
  }
  if (result === "not-sent") return { notices: [notice.error("This copy of the shop can't send e-mails yet, so the password reset e-mail wasn't sent.")] };
  if (result === "saved-locally") await flash([notice.info("This copy of the shop doesn't send e-mails yet: the password reset e-mail was saved in the folder .data/mail on this computer.")]);
  // A full page load (that address is served by another route, src/proxy.ts).
  return { notices: [], redirect: "/my-account/lost-password/?reset-link-sent=true" };
}

/** "Enter a new password below.": the link's key, then WooCommerce's checks (process_reset_password). */
export async function resetPasswordWithKey(form: FormData): Promise<AccountFormResult> {
  const key = text(form.get("reset_key"), 200);
  const password = text(form.get("password_1"), 500);
  const confirm = text(form.get("password_2"), 500);
  if (!password) return { notices: [notice.error("Please enter your password.")] };
  if (password !== confirm) return { notices: [notice.error("Passwords do not match.")] };
  if (password.length < 8) return { notices: [notice.error("Please enter a stronger password.")] };
  try {
    await getAuth().api.resetPassword({ body: { newPassword: password, token: key }, headers: await headers() });
  } catch {
    return { notices: [notice.error("This key is invalid or has already been used. Please reset your password again if needed.")] };
  }
  await flash([notice.success("Your password has been reset successfully.")]);
  redirect("/my-account/?password-reset=true");
}
