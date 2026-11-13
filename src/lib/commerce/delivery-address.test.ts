/**
 * The delivery address rules taken from the live checkout's map snippet, with made-up Google results.
 */
import { describe, expect, it } from "vitest";

import { addressFields, fullAddress, isBusiness, matchState, searchText, type GoogleAddress } from "./delivery-address";

const c = (long: string, short: string, ...types: string[]) => ({ long_name: long, short_name: short, types });
const street: GoogleAddress = {
  formatted_address: "Jl. Pantai Berawa No.12, Tibubeneng, Kec. Kuta Utara, Kabupaten Badung, Bali 80361, Indonesia",
  types: ["street_address"],
  address_components: [
    c("12", "12", "street_number"),
    c("Jalan Pantai Berawa", "Jl. Pantai Berawa", "route"),
    c("Kuta Utara", "Kuta Utara", "administrative_area_level_3", "political"),
    c("Kabupaten Badung", "Kabupaten Badung", "administrative_area_level_2", "political"),
    c("Bali", "Bali", "administrative_area_level_1", "political"),
    c("Indonesia", "ID", "country", "political"),
    c("80361", "80361", "postal_code"),
  ],
};
const villa: GoogleAddress = {
  name: "Villa Sari Canggu",
  formatted_address: "Jl. Batu Mejan, Canggu, Kuta Utara, Badung Regency, Bali 80351, Indonesia",
  types: ["lodging", "point_of_interest", "establishment"],
  address_components: [c("Canggu", "Canggu", "locality", "political"), c("Bali", "Bali", "administrative_area_level_1"), c("Indonesia", "ID", "country"), c("80351", "80351", "postal_code")],
};

describe("delivery address from a Google result", () => {
  it("fills street, city (district when there is no town), province, postcode and country", () => {
    expect(addressFields(street, false)).toEqual({
      street: "12 Jalan Pantai Berawa",
      city: "Kuta Utara",
      state: "Bali",
      postcode: "80361",
      country: "ID",
      full: street.formatted_address,
    });
  });

  it("puts a business's name in front, and only for businesses", () => {
    expect(isBusiness(villa.types)).toBe(true);
    expect(isBusiness(street.types)).toBe(false);
    expect(isBusiness(["plus_code"])).toBe(false);
    expect(isBusiness(undefined)).toBe(true);
    const fields = addressFields(villa, true);
    expect(fields.full).toBe(`Villa Sari Canggu, ${villa.formatted_address}`);
    // No route: the street falls back to Google's whole address, with the name.
    expect(fields.street).toBe(`Villa Sari Canggu, ${villa.formatted_address}`);
    expect(fields.city).toBe("Canggu");
  });

  it("doesn't repeat a name that is already in the address", () => {
    expect(fullAddress({ name: "Canggu", formatted_address: "Canggu, Bali, Indonesia" }, true)).toBe("Canggu, Bali, Indonesia");
    expect(fullAddress({ name: "Only a name" }, true)).toBe("Only a name");
  });

  it("leaves fields empty (= keep what is there) when Google has no such part", () => {
    const fields = addressFields({ formatted_address: "6P3X+2X Kuta, Bali", address_components: [] }, false);
    expect(fields).toEqual({ street: "6P3X+2X Kuta, Bali", city: "", state: "", postcode: "", country: "", full: "6P3X+2X Kuta, Bali" });
  });
});

describe("searching a typed address", () => {
  it("looks in Bali unless the text already says Bali or Indonesia", () => {
    expect(searchText("Jl. Sunset Road 88")).toBe("Jl. Sunset Road 88, Bali, Indonesia");
    expect(searchText("6P3X+2X")).toBe("6P3X+2X, Bali, Indonesia");
    expect(searchText("Ubud, bali")).toBe("Ubud, bali");
    expect(searchText("Jakarta, Indonesia")).toBe("Jakarta, Indonesia");
  });

  it("finds the province option by code or by name", () => {
    const options: [string, string][] = [["", "Select an option…"], ["BA", "Bali"], ["JK", "DKI Jakarta"], ["JT", "Jawa Tengah"]];
    expect(matchState(options, "Bali")).toBe("BA");
    expect(matchState(options, "JK")).toBe("JK");
    expect(matchState(options, "Jakarta")).toBe("JK");
    expect(matchState(options, "Papua")).toBeNull();
    expect(matchState(options, "")).toBeNull();
  });
});
