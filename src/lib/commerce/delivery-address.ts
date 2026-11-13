/**
 * The checkout's delivery address rules, as the live site's snippet 16 does them (read from the live checkout page,
 * 13 Nov 2026): what goes into WooCommerce's billing fields from a Google result, when a place's name is added, and
 * how a typed address is searched. Pure functions (shared by the map and the form, and tested).
 */

export type GoogleComponent = { long_name: string; short_name: string; types: string[] };
export type GoogleAddress = { address_components?: GoogleComponent[]; formatted_address?: string; name?: string; types?: string[] };

/** The status texts live shows under the address field. */
export const ADDRESS_STATUS = {
  empty: "Please enter a street address, Plus Code or place.",
  saved: "Your address has been saved.",
  typing: "Select a suggestion or click Find on Map.",
  finding: "Finding address on map...",
  found: "Location found. Drag the pin if you need to adjust the exact delivery point.",
  notFound: "Google could not locate this address exactly. Your address has still been saved and you can adjust the pin manually.",
  suggestionFound: "Address found. Drag the pin if you need to adjust the exact delivery location.",
  suggestionWithoutPlace: "You can keep this address or click Find on Map.",
  updating: "Updating delivery address...",
  pinMoved: "Pin moved. Delivery address updated.",
  pinKept: "Pin updated. Your existing address has been kept.",
  unavailable: "The map isn't available right now. Type your full address; we confirm the exact spot on WhatsApp.",
} as const;

/** Bali, for the suggestions' bias: south-west and north-east corners. */
export const BALI_BOUNDS = { south: -8.95, west: 114.4, north: -8.05, east: 115.75 };

/** Result types that are an address, not a business: their name isn't put in front of the address. */
const NON_BUSINESS_TYPES = new Set([
  "street_address", "route", "intersection", "premise", "subpremise", "postal_code", "plus_code", "locality", "sublocality", "sublocality_level_1",
  "administrative_area_level_1", "administrative_area_level_2", "administrative_area_level_3", "country",
]);

export function component(components: GoogleComponent[] | undefined, type: string, short = false): string {
  const found = (components ?? []).find((item) => item.types.includes(type));
  return found ? (short ? found.short_name : found.long_name) : "";
}

/** A villa, hotel or shop keeps its name in the address; a plain address doesn't. */
export const isBusiness = (types: string[] | undefined) => !(types?.length && types.every((type) => NON_BUSINESS_TYPES.has(type)));

/** "Villa Sari, Jl. Pantai …" when a business name isn't already part of Google's address. */
export function fullAddress(result: GoogleAddress, includePlaceName: boolean): string {
  let address = result.formatted_address ?? "";
  const name = result.name?.trim();
  if (includePlaceName && name) {
    if (address && !address.toLowerCase().includes(name.toLowerCase())) address = `${name}, ${address}`;
    if (!address) address = name;
  }
  return address;
}

export type AddressFields = { street: string; city: string; state: string; postcode: string; country: string; full: string };

/** The WooCommerce fields from a Google result. An empty value means "leave the field as it is". */
export function addressFields(result: GoogleAddress, includePlaceName: boolean): AddressFields {
  const components = result.address_components ?? [];
  const formatted = result.formatted_address ?? "";
  const full = fullAddress(result, includePlaceName);
  // The street part; Indonesian addresses often have no street number or route: then Google's whole address.
  let street = [component(components, "street_number"), component(components, "route")].filter(Boolean).join(" ") || formatted;
  const name = result.name?.trim();
  if (includePlaceName && name && street && !street.toLowerCase().includes(name.toLowerCase())) street = `${name}, ${street}`;
  const city = component(components, "locality") || component(components, "administrative_area_level_3") || component(components, "administrative_area_level_2");
  return {
    street,
    city,
    state: component(components, "administrative_area_level_1", true),
    postcode: component(components, "postal_code"),
    country: component(components, "country", true),
    full: full || formatted || street,
  };
}

/** What "Find on Map" searches: the typed text, placed in Bali unless it already names Bali or Indonesia. */
export const searchText = (typed: string) => (/bali|indonesia/i.test(typed) ? typed : `${typed}, Bali, Indonesia`);

/** The province option for Google's province: its code, or the option whose name contains it ("Bali" → "BA"). */
export function matchState(options: [value: string, text: string][], state: string): string | null {
  if (!state) return null;
  const wanted = state.toLowerCase();
  return options.find(([value, text]) => value === state || (value && text.toLowerCase().includes(wanted)))?.[0] ?? null;
}
