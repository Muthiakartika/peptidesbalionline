"use client";

/**
 * WooCommerce's messages in its notices wrapper, with its markup: errors in one
 * <ul class="woocommerce-error">, successes as <div class="woocommerce-message">, information as
 * <div class="woocommerce-info">. `fromFlash`: the messages came in the flash cookie
 * (src/lib/account/notices.ts); the browser deletes it once they are on screen, so a reload doesn't
 * show them again (WooCommerce prints a session's notices once).
 */
import { Fragment, useEffect } from "react";

import { FLASH_COOKIE, type Notice, type NoticePart } from "@/lib/account/notices";

function Parts({ parts }: { parts: NoticePart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <Fragment key={index}>{part}</Fragment>
        ) : "strong" in part ? (
          <strong key={index}>{part.strong}</strong>
        ) : (
          // Plain links, as WooCommerce prints them: some lead to a route that redirects (logging out).
          <a key={index} href={part.href} className={part.className}>
            {part.text}
          </a>
        ),
      )}
    </>
  );
}

export function NoticeList({ notices }: { notices: Notice[] }) {
  const errors = notices.filter((n) => n.type === "error");
  return (
    <>
      {errors.length ? (
        <ul className="woocommerce-error" role="alert">
          {errors.map((n, index) => (
            <li key={index}>
              <Parts parts={n.parts} />
            </li>
          ))}
        </ul>
      ) : null}
      {notices
        .filter((n) => n.type === "success")
        .map((n, index) => (
          <div key={`s${index}`} className="woocommerce-message" role="alert">
            <Parts parts={n.parts} />
          </div>
        ))}
      {notices
        .filter((n) => n.type === "info")
        .map((n, index) => (
          <div key={`i${index}`} className="woocommerce-info" role="status">
            <Parts parts={n.parts} />
          </div>
        ))}
    </>
  );
}

export function AccountNotices({ notices, fromFlash = false }: { notices: Notice[]; fromFlash?: boolean }) {
  useEffect(() => {
    if (fromFlash && notices.length) document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }, [fromFlash, notices.length]);
  return (
    <div className="woocommerce-notices-wrapper">
      <NoticeList notices={notices} />
    </div>
  );
}
