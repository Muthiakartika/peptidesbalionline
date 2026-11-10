/**
 * "Shipping to <strong>…</strong>." on the cart: the destination as WooCommerce prints it
 * (WC_Countries::get_formatted_address joined with ", ", the store's own country left out). Without an
 * address it is the store's base province, Bali (live, 6 Nov 2026). With an address entered in "Change
 * address" the parts follow WooCommerce's Indonesian format "{city}, {state} {postcode}" (not yet seen on
 * live: to check on a test order, Q-05).
 */
import type { Destination } from "@/lib/commerce/cart-cookie";
import { indonesiaStates, shipping } from "@/lib/commerce/store-settings";

export function formatDestination(destination?: Destination): string {
  const state = indonesiaStates.find(([code]) => code === (destination?.state ?? shipping.defaultState))?.[1] ?? "";
  if (!destination) return state;
  const statePostcode = [state, destination.postcode].filter(Boolean).join(" ");
  return [destination.city, statePostcode].filter(Boolean).join(", ");
}
