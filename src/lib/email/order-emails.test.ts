/**
 * WooCommerce's order e-mails (src/lib/email/order-emails.ts) with a made-up order: which status change
 * sends which e-mail (WooCommerce 11.2.1's hooks), and the texts.
 */
import { describe, expect, it } from "vitest";

import type { OrderView } from "@/lib/commerce/orders";

import { customerNoteEmail, emailsForTransition, orderEmail } from "./order-emails";

const rp = (rupiah: number) => BigInt(rupiah) * 100n;
const view = {
  order: {
    orderNumber: 12900n,
    createdAt: new Date("2026-11-13T04:05:06Z"),
    billing: { firstName: "Made Test", lastName: "", address1: "Jl. Pantai Berawa 12", city: "Canggu", state: "BA", postcode: "80361", country: "ID", phone: "+628123456789", email: "made@example.com" },
    shipping: { firstName: "Made Test", lastName: "", address1: "Jl. Pantai Berawa 12", city: "Canggu", state: "BA", postcode: "80361", country: "ID", phone: "" },
    subtotalMinor: rp(1_700_000),
    discountMinor: rp(100_000),
    shippingMinor: 0n,
    shippingMethodTitle: "Free shipping",
    paymentMethodTitle: "Wise",
    totalMinor: rp(1_600_000),
    customerNote: "Ring the bell twice",
    deliveryDay: "2026-11-14",
    deliveryTimeSlot: "10:00-12:00",
    deliveryLocation: { address: "Jl. Pantai Berawa No.12, Canggu, Bali", lat: "-8.6500000", lng: "115.1300000" },
  },
  items: [
    { productName: "BPC-157 10mg", quantity: 2, lineSubtotalMinor: rp(1_700_000), options: [{ label: "Dosage", value: "10mg" }] },
  ],
  fees: [],
} as unknown as NonNullable<OrderView>;

describe("which e-mails a status change sends", () => {
  it("follows WooCommerce's hooks", () => {
    // A placed order: Card / Revolut / Wise go on hold, COD processing, IDR Account stays pending.
    expect(emailsForTransition("pending", "on-hold")).toEqual(["new_order", "customer_on_hold_order"]);
    expect(emailsForTransition("pending", "processing")).toEqual(["new_order", "customer_processing_order"]);
    expect(emailsForTransition("pending", "pending")).toEqual([]);
    // Payment confirmed by the shop, then sent out.
    expect(emailsForTransition("on-hold", "processing")).toEqual(["customer_processing_order"]);
    expect(emailsForTransition("processing", "completed")).toEqual(["customer_completed_order"]);
    expect(emailsForTransition("pending", "completed")).toEqual(["new_order", "customer_completed_order"]);
    // Cancelled, failed, refunded.
    expect(emailsForTransition("pending", "cancelled")).toEqual(["cancelled_order"]);
    expect(emailsForTransition("on-hold", "cancelled")).toEqual(["cancelled_order"]);
    expect(emailsForTransition("completed", "cancelled")).toEqual([]);
    expect(emailsForTransition("pending", "failed")).toEqual(["failed_order"]);
    expect(emailsForTransition("processing", "failed")).toEqual([]);
    expect(emailsForTransition("completed", "refunded")).toEqual(["customer_refunded_order"]);
    // Back from cancelled or failed counts as a new order again.
    expect(emailsForTransition("cancelled", "processing")).toEqual(["new_order", "customer_processing_order"]);
    expect(emailsForTransition("failed", "on-hold")).toEqual(["new_order", "customer_on_hold_order"]);
  });
});

describe("the texts", () => {
  it("the customer's e-mail: heading, greeting, the order, the delivery, the addresses, the footer", () => {
    const email = orderEmail("customer_on_hold_order", view);
    expect(email.audience).toBe("customer");
    expect(email.subject).toBe("Your Atlas Longevity order has been received!");
    expect(email.text).toBe(
      [
        "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=",
        "Thank you for your order",
        "=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=",
        "",
        "Hi Made Test,",
        "",
        "We’ve received your order and it’s currently on hold until we can confirm your payment has been processed.",
        "",
        "Here’s a reminder of what you’ve ordered:",
        "",
        "Order #12900 (November 13, 2026)",
        "",
        "==========",
        "",
        "BPC-157 10mg × 2 Rp1,700,000.00",
        "",
        "- Dosage: 10mg",
        "",
        "==========",
        "",
        "Subtotal: Rp1,700,000.00",
        "Discount: -Rp100,000.00",
        "Shipping: Free shipping",
        "Payment method: Wise",
        "Total: Rp1,600,000.00",
        "",
        "Note:",
        "Ring the bell twice",
        "",
        "----------------------------------------",
        "",
        "Delivery day: Saturday, 14 November 2026",
        "Time slot: 10:00–12:00",
        "Delivery location: Jl. Pantai Berawa No.12, Canggu, Bali",
        "",
        "BILLING ADDRESS",
        "",
        "Made Test",
        "Jl. Pantai Berawa 12",
        "Canggu",
        "Bali",
        "80361",
        "+628123456789",
        "made@example.com",
        "",
        "SHIPPING ADDRESS",
        "",
        "Made Test",
        "Jl. Pantai Berawa 12",
        "Canggu",
        "Bali",
        "80361",
        "",
        "",
        "----------------------------------------",
        "",
        "Thanks again! If you need any help with your order, please contact us at hello@peptidesbali.online.",
        "",
        "----------------------------------------",
        "",
        "Atlas Longevity",
      ].join("\n"),
    );
  });

  it("the shop's new-order e-mail links to the order screen and the map", () => {
    const email = orderEmail("new_order", view);
    expect(email.audience).toBe("admin");
    expect(email.subject).toBe("[Atlas Longevity]: You've got a new order: #12900");
    expect(email.text).toContain("New order: #12900\n");
    expect(email.text).toContain("You’ve received a new order from Made Test:\n\nOrder #12900 (November 13, 2026)");
    expect(email.text).toMatch(/\nView order: https?:\/\/[^/]+\/admin\/orders\/12900\/\n/);
    expect(email.text).toContain("Coordinates: -8.6500000, 115.1300000 (https://www.google.com/maps?q=-8.6500000,115.1300000)");
    expect(email.text).toContain("Congratulations on the sale!");
    // The customer's copy has neither.
    expect(orderEmail("customer_processing_order", view).text).not.toMatch(/View order|Coordinates/);
  });

  it("every e-mail's subject and heading", () => {
    const pick = (kind: Parameters<typeof orderEmail>[0]) => {
      const email = orderEmail(kind, view);
      return [email.audience, email.subject, email.text.split("\n")[1]];
    };
    expect(pick("cancelled_order")).toEqual(["admin", "[Atlas Longevity]: Order #12900 has been cancelled", "Order cancelled: #12900"]);
    expect(pick("failed_order")).toEqual(["admin", "[Atlas Longevity]: Order #12900 has failed", "Order failed: #12900"]);
    expect(pick("customer_processing_order")).toEqual(["customer", "Your Atlas Longevity order has been received!", "Thank you for your order"]);
    expect(pick("customer_completed_order")).toEqual(["customer", "Your order from Atlas Longevity is on its way!", "Good things are heading your way!"]);
    expect(pick("customer_refunded_order")).toEqual(["customer", "Your Atlas Longevity order #12900 has been refunded", "Order refunded: 12900"]);
    expect(orderEmail("customer_processing_order", view).text).toContain("Just to let you know — we’ve received your order, and it is now being processed.");
  });

  it("the designed version: the shop's look, the order, how to pay, the right button", () => {
    const images = new Map([["item-1", "https://media.example.com/bpc.png"]]);
    const withItemId = { ...view, items: view.items.map((item) => ({ ...item, id: "item-1", options: item.options })) } as typeof view;
    const html = orderEmail("customer_on_hold_order", { ...withItemId, order: { ...view.order, paymentMethod: "sleeks_wise", orderKey: "wc_order_abc123" } } as typeof view, { images }).html;
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain(">Thank you for your order</h1>");
    expect(html).toContain("Order #12900 · On hold");
    expect(html).toContain('src="https://media.example.com/bpc.png"');
    expect(html).toContain("BPC-157 10mg");
    expect(html).toContain("Rp1,600,000.00");
    expect(html).toContain("How to pay · Wise");
    // The apostrophe stays escaped inside the attribute (&#39;): an e-mail app reads it back as '.
    expect(html).toMatch(/href="https:\/\/wa\.me\/6282326300167\?text=Hi%2C%20I&#39;ve%20placed%20order%20%2312900%20using%20Wise/);
    expect(html).toMatch(/href="https?:\/\/[^"]+\/checkout\/order-received\/12900\/\?key=wc_order_abc123"/);
    expect(html).toContain("Saturday, 14 November 2026");
    // The customer's copy never shows the staff's links.
    expect(html).not.toMatch(/admin\/orders|Coordinates|WhatsApp the customer/);

    const staff = orderEmail("new_order", view).html;
    expect(staff).toMatch(/href="https?:\/\/[^"]+\/admin\/orders\/12900\/"/);
    expect(staff).toContain("https://www.google.com/maps?q=-8.6500000,115.1300000");
    expect(staff).toContain("WhatsApp the customer");
    expect(staff).not.toContain("View your order");
  });

  it("what a customer typed can't add markup to the e-mail", () => {
    const sneaky = {
      ...view,
      order: { ...view.order, billing: { ...(view.order.billing as object), firstName: '<img src=x onerror="alert(1)">' }, customerNote: "<script>alert(1)</script>" },
    } as typeof view;
    const html = orderEmail("new_order", sneaky).html + customerNoteEmail(sneaky, '<a href="javascript:alert(1)">x</a>').html;
    expect(html).not.toMatch(/<script|<img src=x|onerror="|href="javascript:/);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("the customer note", () => {
    const email = customerNoteEmail(view, "Your parcel left at 9:00.");
    expect(email.subject).toBe("A note has been added to your order from Atlas Longevity");
    expect(email.text).toContain("Hi Made Test,\n\nThe following note has been added to your order:\n\n----------\n\nYour parcel left at 9:00.\n\n----------\n\nAs a reminder, here are your order details:\n\nOrder #12900");
  });
});
