"use client";

/**
 * A form copied from the live site that sends its answers to WordPress there: the Elementor forms
 * (contact, consultation, affiliate application) and AffiliateWP's login and registration forms.
 * Its markup and texts stay exactly as printed; only sending is held back, because nothing receives
 * the answers yet (open questions Q-12: who gets them, and Q-43: the spam protection, reCAPTCHA with
 * the owner's keys; the affiliate accounts come with Phase 6a). The browser still checks the
 * required fields, as on the live site,
 * and a valid form then simply stays as it is: no success message is shown for a message that was
 * not sent.
 */
import type { FormHTMLAttributes, ReactNode } from "react";

export function PendingForm({ attributes, children }: { attributes: FormHTMLAttributes<HTMLFormElement>; children: ReactNode }) {
  return (
    <form {...attributes} onSubmit={(event) => event.preventDefault()}>
      {children}
    </form>
  );
}
