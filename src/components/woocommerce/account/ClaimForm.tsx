"use client";

/**
 * "Email me a confirmation link" in the Research tools tab (the owner's Atlas Research Planner plugin):
 * the plugin's script shows the form and sends the link. Sending needs e-mail, which this copy of the shop
 * doesn't have yet (Q-08), so the button says so in the plugin's status line instead of pretending.
 */
import { useState } from "react";

export function ClaimForm() {
  const [status, setStatus] = useState("");
  return (
    <>
      <form
        className="arpt-claim__form"
        data-arp-claim=""
        onSubmit={(event) => {
          event.preventDefault();
          setStatus("This copy of the shop can't send e-mails yet, so the confirmation link wasn't sent.");
        }}
      >
        <button type="submit" className="arpt-btn arpt-btn--secondary" data-arp-claim-submit="">
          Email me a confirmation link
        </button>
      </form>
      <div className="arpt-claim__status" role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
