"use client";

/**
 * The two round buttons fixed at the bottom right of every page:
 *  - floating cart (snippet 12-floating-cart): opens the cart drawer
 *  - WhatsApp (Joinchat plugin): appears after 3 seconds and opens a chat with the same
 *    pre-filled message as the live site
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { useChrome } from "./ChromeProvider";
import { Icon } from "@/components/ui/Icon";
import { useCartCount } from "@/lib/commerce/useCartCount";
import { whatsappNumber } from "@/content/site-chrome";

function whatsappMessage(): string {
  const title = document.title.replace(/\s*[-|]\s*Atlas Longevity\s*$/i, "");
  return `Hi *Atlas Longevity*! I need more info about ${title} ${window.location.href}\n\n_Sent with Joinchat_`;
}

export function FloatingButtons() {
  const { open } = useChrome();
  const count = useCartCount();
  const [showWhatsapp, setShowWhatsapp] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWhatsapp(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="floating-cart">
        <Link
          href="/cart/"
          title="Shopping cart"
          className="floating-cart__link"
          onClick={(event) => {
            event.preventDefault();
            open("cart");
          }}
        >
          <span className="header-tool__icon">
            <Icon name="cart" />
            <span className="cart-count">
              {count} <span className="sr-only">{count === 1 ? "item" : "items"}</span>
            </span>
          </span>
        </Link>
      </div>
      <button
        type="button"
        className="whatsapp-button"
        data-visible={showWhatsapp}
        aria-label="Open Chat"
        onClick={() => window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage())}`, "_blank", "noopener")}
      />
    </>
  );
}
