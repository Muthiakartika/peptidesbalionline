/**
 * The small rotating badge in the header: Apple Pay → Google Pay → Visa → Mastercard, 3 seconds
 * each (pure CSS animation, copied from the live site's custom header HTML).
 */
export function PaymentBadge() {
  return (
    <div className="payment-badge" role="img" aria-label="Payment methods: Apple Pay, Google Pay, Visa and Mastercard">
      <div className="payment-badge__brand payment-badge__brand--apple" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M18.71 12.44c.03 3.15 2.77 4.19 2.8 4.21-.02.07-.44 1.52-1.45 3.02-.87 1.3-1.77 2.6-3.19 2.63-1.4.03-1.85-.85-3.45-.85-1.6 0-2.1.82-3.42.88-1.37.05-2.41-1.39-3.29-2.68-1.8-2.63-3.17-7.44-1.32-10.68a5.1 5.1 0 0 1 4.33-2.64c1.35-.03 2.63.93 3.45.93.82 0 2.37-1.15 4-.98a4.88 4.88 0 0 1 3.83 2.08 4.76 4.76 0 0 0-2.79 4.08ZM16.79 4.55A5.15 5.15 0 0 0 17.97.78a5.27 5.27 0 0 0-3.41 1.8 4.93 4.93 0 0 0-1.21 3.65 4.4 4.4 0 0 0 3.44-1.68Z" />
        </svg>
        <span>Pay</span>
      </div>
      <div className="payment-badge__brand payment-badge__brand--google" aria-hidden="true">
        <span className="payment-badge__g">G</span>
        <span>Pay</span>
      </div>
      <div className="payment-badge__brand payment-badge__brand--visa" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny SVG logo, no optimisation needed */}
        <img src="/brand/payments/visa.svg" alt="" width={46} height={20} />
      </div>
      <div className="payment-badge__brand payment-badge__brand--mastercard" aria-hidden="true">
        <span className="payment-badge__mc">
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}
