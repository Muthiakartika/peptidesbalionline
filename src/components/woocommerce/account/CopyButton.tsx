"use client";

/** A small "Copy" button for a coupon code or share link; it does nothing if the browser won't allow copying. */
import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="atlas-rewards__copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // The text is selectable next to the button: copying by hand still works.
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
