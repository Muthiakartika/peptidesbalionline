/**
 * The account e-mails with WooCommerce 11.2.1's texts (templates/emails/plain/customer-new-account.php and
 * customer-reset-password.php; subjects from their WC_Email classes), {site_title} = "Atlas Longevity".
 * The links lead to /my-account/lost-password/?key=…&id=… as WooCommerce's do; that page then shows
 * "Enter a new password below." (src/components/woocommerce/LostPassword.tsx).
 */
import { siteUrl } from "@/lib/site";

const SITE = "Atlas Longevity";

export const passwordLink = (token: string, userId: string, newAccount = false) =>
  `${siteUrl}/my-account/lost-password/?${newAccount ? "action=newaccount&" : ""}key=${encodeURIComponent(token)}&id=${encodeURIComponent(userId)}`;

export function newAccountEmail({ displayName, username, link }: { displayName: string; username: string; link: string }) {
  return {
    subject: `Your ${SITE} account has been created!`,
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
  };
}

export function resetPasswordEmail({ displayName, username, link }: { displayName: string; username: string; link: string }) {
  return {
    subject: `Password Reset Request for ${SITE}`,
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
  };
}
