/**
 * The homepage's Elementor popups (on the live site they are printed on the homepage only): the
 * "Get 5% off your first order" offer (#5869, at most 5 times) and its sign-up form (#6534, opened
 * by "Claim My 5%"). Their documents come from src/content/popups/ (scripts/audit/export_popups.py);
 * the form doesn't send anything yet (PendingForm, open question Q-12). The age gate (#5870) is the
 * native AgeGate component.
 * The offer waits for the age gate (owner's decision of 6 Nov 2026; on the live site it opens when
 * the visitor scrolls down, even over the age gate): it opens a few seconds after "I'm 21+", and on
 * scrolling down only when the age gate doesn't open on this visit.
 */
import { elementorPopups } from "@/content/popups";
import { ageGate } from "@/content/site-chrome";
import { contentFromSanity, getSanityPopups } from "@/lib/content/sanity";

import { ElementorContent } from "./ElementorContent";
import { ElementorPopup, type PopupSettings } from "./ElementorPopup";

/** The "Get 5% off your first order" popup. */
const OFFER_POPUP_ID = 5869;

export async function HomePopups() {
  // Edited in Sanity ("Popups") when the site reads Sanity; otherwise the copies in src/content/popups/.
  const popups = (contentFromSanity ? await getSanityPopups() : null) ?? elementorPopups;
  return (
    <>
      {/* Each popup's own Elementor CSS, as the live homepage links it. */}
      {popups.map((popup) => (
        <link key={`css-${popup.id}`} rel="stylesheet" href={`/legacy/elementor/post-${popup.id}.css`} />
      ))}
      {popups.map((popup) => (
        <ElementorPopup
          key={popup.id}
          id={popup.id}
          settings={popup.settings as PopupSettings}
          afterAgeGate={popup.id === OFFER_POPUP_ID ? { delayMs: ageGate.offerDelayAfterConfirmMs } : undefined}
        >
          <ElementorContent html={popup.html} path="/" />
        </ElementorPopup>
      ))}
    </>
  );
}
