/**
 * Who may use the store admin (orders, products): staff only (WooCommerce's "manage_woocommerce"). A visitor is asked to log
 * in; a customer gets WordPress's "Sorry, you are not allowed to access this page."
 */
import Link from "next/link";

import { getAccountUser, isStaff, type AccountUser } from "@/lib/account/session";

export async function staffOnly(): Promise<{ user: AccountUser } | { refusal: React.ReactNode }> {
  const user = await getAccountUser().catch(() => null);
  if (isStaff(user)) return { user: user! };
  return {
    refusal: (
      <div className="rounded border border-[#c3c4c7] bg-white p-6">
        {user ? (
          <p>Sorry, you are not allowed to access this page.</p>
        ) : (
          <p>
            Please{" "}
            <Link href="/my-account/" className="text-[#2271b1] underline">
              log in
            </Link>{" "}
            with a staff account to see this page.
          </p>
        )}
      </div>
    ),
  };
}
