"use client";

/**
 * Bottom cookie bar (Woodmart cookie notice). Slides up a moment after the page loads and is
 * remembered with the same cookie name the live site uses, so visitors who already accepted on
 * WordPress don't see it again after the switch.
 */
import { useEffect, useState } from "react";
import { cookieNotice as defaultNotice, type CookieNoticeContent } from "@/content/site-chrome";

const COOKIE_NAME = "woodmart_cookies_1";

export function CookieNotice({ cookieNotice = defaultNotice }: { cookieNotice?: CookieNoticeContent }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (document.cookie.split("; ").some((c) => c === `${COOKIE_NAME}=accepted`)) return;
    const timer = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const accept = () => {
    document.cookie = `${COOKIE_NAME}=accepted; max-age=${60 * 60 * 24 * 60}; path=/; SameSite=Lax`;
    setVisible(false);
  };

  return (
    <div className="cookie-notice" data-visible={visible} role="complementary" aria-label="Cookies" aria-hidden={!visible}>
      <div className="cookie-notice__inner">
        <div className="cookie-notice__text">{cookieNotice.text}</div>
        <button type="button" className="btn-accented" onClick={accept} tabIndex={visible ? 0 : -1}>
          {cookieNotice.button}
        </button>
      </div>
    </div>
  );
}
