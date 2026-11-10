/**
 * What the checkout (and the order-pay page) shows under each payment method: the gateway's description
 * and logo, as set on live (the gateways' settings, read 6–7 Nov 2026).
 */
import type { PaymentMethodId } from "./store-settings";

/** The payment methods' descriptions and logos as set on live (the gateways' settings). */
export const PAYMENT_DETAILS: Record<PaymentMethodId, { description: string; logo?: { src: string; alt: string } }> = {
  atlas_card: { description: "Visa, Mastercard, Amex, Apple Pay, Google Pay. We will send you a payment link after we have received your order." },
  nowpayments_gateway: {
    description: "USDT, USDC, BTC, ETH — instant confirmation. Connect to now payments – Bank Transfer – IDR, USD, Pounds.",
    logo: { src: "/legacy/vendor/payments/nowpayments.png", alt: "Crypto" },
  },
  sleeks_revolut: {
    description: "Your order will be created as Pending Payment. After you tap “Proceed to Payment” you’ll be sent to WhatsApp where we’ll share our Revolut tag and confirm the exact amount. Stock is reserved on submit and released if payment isn’t received within 24 hours.",
  },
  sleeks_wise: {
    description: "Your order will be created as Pending Payment. After you tap “Proceed to Payment” you’ll be sent to WhatsApp where we’ll share our Wise tag and confirm the exact amount. Stock is reserved on submit and released if payment isn’t received within 24 hours.",
  },
  atlas_idr_account: {
    description: "Your order will be created as Pending Payment. After you tap “Proceed to Payment”, you’ll be sent to WhatsApp where we’ll share our account number and confirm the exact amount. Stock is reserved on submit and released if payment isn’t received within 24 hours.",
  },
  payram: { description: "Pay with Bitcoin, Ethereum and more via PayRam." },
  "bitbridge-pay-gateway-hosted": {
    description: "BitBridge Pay routes your credit card payment to a secure processor",
    logo: { src: "/legacy/vendor/payments/bitbridge-card.svg", alt: "Credit Card" },
  },
  cod: {
    description: "Pay our courier in IDR when your order is dropped off. After submit, we’ll confirm availability on WhatsApp (some delivery zones and large orders may need pre-payment). Stock is reserved on submit and released if the order can’t be confirmed.",
  },
};
