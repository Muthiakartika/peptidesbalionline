"use client";

/**
 * "Research use only · Age 21+" popup (Elementor popup #5870 on the live site).
 *
 * Copies the live settings: opens 1 second after the page loads, cannot be closed with Escape
 * or by clicking outside, locks page scrolling, and is shown at most 3 times per browser (counted
 * where Elementor counts it, localStorage "elementor" → popup_5870_times: src/lib/elementor/popup-times.ts).
 * On the live site it is on the homepage only (Q-45), so it is rendered by the homepage route.
 * (The popup text says "stays on your device for 30 days", which the live settings don't do;
 * that mismatch is open question Q-10.)
 * Owner's decision of 6 Nov 2026: the "5% off" popup waits for this one and opens a few seconds after
 * "I'm 21+" is clicked; the age gate reports where it stands in src/lib/elementor/age-gate-state.ts.
 */
import { useEffect, useState } from "react";
import { ageGate as defaultAgeGate, type AgeGateContent } from "@/content/site-chrome";
import { setAgeGateState } from "@/lib/elementor/age-gate-state";
import { countPopupShown, popupTimesShown } from "@/lib/elementor/popup-times";

/** The Elementor popup it replaces: its count is kept under this id, where Elementor keeps it. */
const AGE_GATE_POPUP_ID = 5870;

function SparklesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function AgeGate({ ageGate = defaultAgeGate }: { ageGate?: AgeGateContent }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Back to "waiting" when the homepage is left, so the next visit waits for the gate again.
    const leave = () => setAgeGateState("waiting");
    if (popupTimesShown(AGE_GATE_POPUP_ID) >= ageGate.maxTimesShown) {
      setAgeGateState("not-shown");
      return leave;
    }
    setAgeGateState("waiting");
    const timer = window.setTimeout(() => {
      setOpen(true);
      countPopupShown(AGE_GATE_POPUP_ID);
    }, ageGate.delayMs);
    return () => {
      window.clearTimeout(timer);
      leave();
    };
  }, [ageGate.maxTimesShown, ageGate.delayMs]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-gate__dialog">
        <div className="age-gate__divider-icon">
          <SparklesIcon />
        </div>
        <p className="age-gate__eyebrow">{ageGate.eyebrow}</p>
        <h2 id="age-gate-title" className="age-gate__title">
          {ageGate.title[0]} <br />
          {ageGate.title[1]}
        </h2>
        <p className="age-gate__text">
          {ageGate.englishBefore}
          <strong>{ageGate.englishBrand}</strong>
          {ageGate.englishAfter}
        </p>
        <div className="age-gate__rule" />
        <p className="age-gate__text">{ageGate.indonesian}</p>
        {/* Focused when the popup opens, as on the live site (keyboard users start here). */}
        <button type="button" className="age-gate__button age-gate__button--enter" onClick={() => {
            setOpen(false);
            setAgeGateState("confirmed");
          }}
          autoFocus
        >
          {ageGate.enterLabel}
          <ArrowIcon />
        </button>
        {/* On the live site this button is a link to "#" with no action; kept the same (Q-10). */}
        <a href="#" className="age-gate__button age-gate__button--back">
          {ageGate.backLabel}
          <ArrowIcon />
        </a>
        <div className="age-gate__rule age-gate__rule--soft" />
        <p className="age-gate__footnote">{ageGate.footnote}</p>
      </div>
    </div>
  );
}
