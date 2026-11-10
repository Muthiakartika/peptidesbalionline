"use client";

/**
 * The little "⧉" after each code on /lab-results-certificates-of-analysis/ (task numbers, batch
 * codes), from the owner's code snippet "21-lab-copy-icon" on the live site. Clicking it copies the
 * code in front of it and shows "✓" for a second, exactly as that snippet does (it also reads the
 * icon back from the page, so two quick clicks leave the "✓", as live).
 * Its CSS: src/styles/elementor-page.css (".copy-item", ".copy-icon").
 */
import type { HTMLAttributes, MouseEvent, ReactNode } from "react";

export function CopyIcon({ attributes, children }: { attributes: HTMLAttributes<HTMLSpanElement>; children: ReactNode }) {
  const copy = (event: MouseEvent<HTMLSpanElement>) => {
    const icon = event.currentTarget;
    const item = icon.closest(".copy-item");
    const text = item?.childNodes[0]?.textContent?.trim() ?? "";
    void navigator.clipboard?.writeText(text);
    const oldIcon = icon.innerHTML;
    icon.innerHTML = "✓";
    setTimeout(() => {
      icon.innerHTML = oldIcon;
    }, 1000);
  };
  return (
    <span {...attributes} onClick={copy}>
      {children}
    </span>
  );
}
