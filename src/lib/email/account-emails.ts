/**
 * The account e-mails with WooCommerce 11.2.1's texts (templates/emails/plain/customer-new-account.php and
 * customer-reset-password.php; subjects from their WC_Email classes), {site_title} = "Atlas Longevity",
 * as plain text and in the shop's design (src/lib/email/html.ts).
 * The links lead to /my-account/lost-password/?key=…&id=… as WooCommerce's do; that page then shows
 * "Enter a new password below." (src/components/woocommerce/LostPassword.tsx).
 */
import { siteUrl } from "@/lib/site";

import { button, fallbackLink, helpBlock, infoBox, layout, paragraph } from "./html";

const SITE = "Atlas Longevity";

export const passwordLink = (token: string, userId: string, newAccount = false) =>
  `${siteUrl}/my-account/lost-password/?${newAccount ? "action=newaccount&" : ""}key=${encodeURIComponent(token)}&id=${encodeURIComponent(userId)}`;

type AccountMail = { displayName: string; username: string; link: string };

export function newAccountEmail({ displayName, username, link }: AccountMail) {
  const subject = `Your ${SITE} account has been created!`;
  return {
    subject,
    text: [
      `Welcome to ${SITE}`,
      "",
      `Hi ${displayName},`,
      "",
      `Thanks for creating an account on ${SITE}. Here’s a copy of your user details.`,
      "",
      `Username: ${username}.`,
      "",
      "To set your password, visit the following address: ",
      "",
      link,
      "",
      "You can access your account area to view orders, change your password, and more via the link below:",
      "",
      `${siteUrl}/my-account/`,
    ].join("\n"),
    html: layout({
      title: subject,
      preheader: "Set your password to finish your account.",
      eyebrow: "Your account",
      heading: `Welcome to ${SITE}`,
      body: [
        paragraph(`Hi ${displayName},`),
        paragraph(`Thanks for creating an account on ${SITE}. Here’s a copy of your user details.`),
        infoBox("Your details", [{ label: "Username", value: username }]),
        paragraph("To set your password, use the button below:"),
        button("Set your password", link),
        fallbackLink(link),
        paragraph("You can access your account area to view orders, change your password, and more:"),
        button("My account", "/my-account/", "dark"),
        helpBlock(),
      ].join("\n"),
      reason: "You’re receiving this e-mail because an account was created with this address on our shop.",
    }),
  };
}

export function resetPasswordEmail({ displayName, username, link }: AccountMail) {
  const subject = `Password Reset Request for ${SITE}`;
  return {
    subject,
    text: [
      "Password Reset Request",
      "",
      `Hi ${displayName},`,
      "",
      `Someone has requested a new password for the following account on ${SITE}:`,
      "",
      `Username: ${username}`,
      "",
      "If you didn’t make this request, just ignore this email. If you’d like to proceed, reset your password via the link below:",
      "",
      link,
    ].join("\n"),
    html: layout({
      title: subject,
      preheader: "Reset your password with the link inside (valid for 24 hours).",
      eyebrow: "Account security",
      heading: "Password reset request",
      body: [
        paragraph(`Hi ${displayName},`),
        paragraph(`Someone has requested a new password for the following account on ${SITE}:`),
        infoBox("Account", [{ label: "Username", value: username }]),
        paragraph("If you didn’t make this request, just ignore this email. If you’d like to proceed, reset your password via the button below:"),
        button("Reset your password", link),
        fallbackLink(link, "The link works for 24 hours. Button not working? Copy this address into your browser:"),
        helpBlock(),
      ].join("\n"),
      reason: "You’re receiving this e-mail because a password reset was requested for your account.",
    }),
  };
}
