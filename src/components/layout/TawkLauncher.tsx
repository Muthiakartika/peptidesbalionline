"use client";

/**
 * The owner's own chat button (inline snippet on the live site): a black 40px circle at the bottom
 * right that replaces Tawk.to's launcher. As there: once Tawk has loaded its own launcher is hidden;
 * the button opens and enlarges the chat and hides itself while the chat is open; when the chat is
 * made small or closed, Tawk's launcher is hidden again and the button comes back.
 * Rendered only where the Tawk script runs (ThirdPartyScripts.tsx). Styles: "#atlas-tawk-button" in
 * src/styles/site-chrome.css (the owner's CSS).
 */
import { useEffect, useRef } from "react";

type TawkApi = {
  hideWidget?: () => void;
  showWidget?: () => void;
  maximize?: () => void;
  onLoad?: () => void;
  onChatMaximized?: () => void;
  onChatMinimized?: () => void;
  onChatHidden?: () => void;
};

declare global {
  interface Window {
    Tawk_API?: TawkApi;
  }
}

export function TawkLauncher() {
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tawk: TawkApi = (window.Tawk_API = window.Tawk_API || {});
    const show = (visible: boolean) => {
      if (button.current) button.current.style.display = visible ? "flex" : "none";
    };
    // Hide Tawk's own launcher as soon as Tawk can.
    const waitForTawk = window.setInterval(() => {
      if (typeof window.Tawk_API?.hideWidget === "function") {
        window.Tawk_API.hideWidget();
        window.clearInterval(waitForTawk);
      }
    }, 300);
    // Keep any callbacks already set (the owner's snippet does the same).
    const previous = { onLoad: tawk.onLoad, onChatMaximized: tawk.onChatMaximized, onChatMinimized: tawk.onChatMinimized, onChatHidden: tawk.onChatHidden };
    tawk.onLoad = () => {
      previous.onLoad?.();
      window.Tawk_API?.hideWidget?.();
      show(true);
    };
    tawk.onChatMaximized = () => {
      previous.onChatMaximized?.();
      show(false);
    };
    tawk.onChatMinimized = () => {
      previous.onChatMinimized?.();
      window.Tawk_API?.hideWidget?.();
      show(true);
    };
    tawk.onChatHidden = () => {
      previous.onChatHidden?.();
      show(true);
    };
    return () => window.clearInterval(waitForTawk);
  }, []);

  return (
    <button
      ref={button}
      id="atlas-tawk-button"
      type="button"
      aria-label="Open chat"
      onClick={() => {
        const tawk = window.Tawk_API;
        if (!tawk || typeof tawk.showWidget !== "function") return;
        if (button.current) button.current.style.display = "none";
        tawk.showWidget();
        window.setTimeout(() => tawk.maximize?.(), 100);
      }}
    >
      <svg viewBox="0 0 800 800" aria-hidden="true">
        <path d="M400 26.2c-193.3 0-350 156.7-350 350 0 136.2 77.9 254.3 191.5 312.1 15.4 8.1 31.4 15.1 48.1 20.8l-16.5 63.5c-2 7.8 5.4 14.7 13 12.1l229.8-77.6c14.6-5.3 28.8-11.6 42.4-18.7C672 630.6 750 512.5 750 376.2 750 182.9 593.3 26.2 400 26.2zm211.1 510.7c-10.8 26.5-41.9 77.2-121.5 77.2-79.9 0-110.9-51-121.6-77.4-2.8-6.8 5-13.4 13.8-11.8 76.2 13.7 147.7 13 215.3.3 8.9-1.8 16.8 4.8 14 11.7z" />
      </svg>
    </button>
  );
}
