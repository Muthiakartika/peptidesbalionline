/** What "Place order" saves and where it sends the buyer, as the owner's snippets do. */
import { describe, expect, it } from "vitest";

import { afterOrderAddress, internationalPhone } from "./orders";

describe("orders", () => {
  it("saves the WhatsApp number complete, as snippet 8811 (digits, no leading 0, no repeated code)", () => {
    expect(internationalPhone("ID|+62", "0812 3456 789")).toBe("+628123456789");
    expect(internationalPhone("ID|+62", "+62 812-3456-789")).toBe("+628123456789");
    expect(internationalPhone("AU|+61", "412 345 678")).toBe("+61412345678");
    expect(internationalPhone("ID|+62", "---")).toBe("");
  });

  it("sends IDR Account to WhatsApp with the order number, the others to the thank-you page", () => {
    const order = { id: "x", number: 12345n, key: "wc_order_abc" };
    expect(afterOrderAddress("sleeks_wise", order)).toBe("/checkout/order-received/12345/?key=wc_order_abc");
    const wa = afterOrderAddress("atlas_idr_account", order);
    expect(wa.startsWith("https://wa.me/6282326300167?text=")).toBe(true);
    expect(decodeURIComponent(wa.split("text=")[1])).toBe("Hi, I've placed order #12345 using IDR Account.\n\nPlease send me the account number and confirm the exact amount.");
  });
});
