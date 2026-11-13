"use client";

/**
 * The checkout's "Delivery location" map, as on live (the owner's snippet 16, read from the live checkout 13 Nov 2026):
 * Google Maps on Bali with a draggable pin, address suggestions biased to Bali (Places Autocomplete), "Find on Map"
 * for a typed address or Plus Code (Geocoding, placed in Bali unless the text says otherwise), and every Google result
 * filling WooCommerce's billing street / city / province / postcode / country (never emptying a field Google has no
 * value for). Moving the pin looks its address up again. Rules and texts: src/lib/commerce/delivery-address.ts.
 *
 * Only shown when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set (docs/setup/google-maps.md). If the key is refused or the
 * script can't load, the map hides itself and the typed address is used, as before.
 */
import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { ADDRESS_STATUS, addressFields, BALI_BOUNDS, isBusiness, matchState, searchText, type GoogleAddress } from "@/lib/commerce/delivery-address";

type LatLng = { lat(): number; lng(): number };
type Listener = { remove(): void };
type GeocodeResult = GoogleAddress & { geometry: { location: LatLng } };
type MapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => { setCenter(point: LatLng | { lat: number; lng: number }): void; setZoom(zoom: number): void };
  Marker: new (options: Record<string, unknown>) => { setPosition(point: LatLng): void; getPosition(): LatLng | null | undefined; addListener(event: string, handler: () => void): Listener };
  Geocoder: new () => { geocode(request: Record<string, unknown>): Promise<{ results: GeocodeResult[] }> };
  LatLngBounds: new (southWest: { lat: number; lng: number }, northEast: { lat: number; lng: number }) => unknown;
  places?: {
    Autocomplete?: new (input: HTMLInputElement, options: Record<string, unknown>) => {
      setBounds(bounds: unknown): void;
      addListener(event: string, handler: () => void): Listener;
      getPlace(): GoogleAddress & { geometry?: { location?: LatLng } };
    };
  };
};

export type DeliveryPoint = { lat: string; lng: string; address: string };
export type StatusTone = "success" | "error" | undefined;

/** The middle of Bali at the zoom live opens with. */
export const BALI_CENTER = { lat: -8.409518, lng: 115.188919 };
const OPEN_ZOOM = 10;
const FOUND_ZOOM = 17;
const CALLBACK = "__atlasMapsReady";

/** The Maps JavaScript API address: Places for the suggestions, results in English, biased to Indonesia. */
export function mapsScriptUrl(key: string): string {
  const query = new URLSearchParams({ key, libraries: "places", v: "weekly", loading: "async", callback: CALLBACK, region: "ID", language: "en" });
  return `https://maps.googleapis.com/maps/api/js?${query.toString()}`;
}

/** A coordinate as the order keeps it (7 decimals, about 1 cm). */
export const coordinate = (value: number) => value.toFixed(7);

type MapsWindow = Window & { google?: { maps?: MapsApi }; [CALLBACK]?: () => void; gm_authFailure?: () => void; __atlasMaps?: Promise<MapsApi> };

/** Loads the Maps JavaScript API once per page. */
function loadMaps(key: string): Promise<MapsApi> {
  const w = window as MapsWindow;
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);
  w.__atlasMaps ??= new Promise<MapsApi>((resolve, reject) => {
    w[CALLBACK] = () => (w.google?.maps ? resolve(w.google.maps) : reject(new Error("no maps")));
    const script = document.createElement("script");
    script.src = mapsScriptUrl(key);
    script.async = true;
    script.onerror = () => reject(new Error("the Maps script didn't load"));
    document.head.append(script);
  });
  return w.__atlasMaps;
}

/** Writes a value into a form field the way a person would (never empties it: live's atlasSetField). */
function setField(id: string, value: string) {
  const field = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
  if (!value || !field) return;
  field.value = value;
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

/** A Google result into the billing fields and the address box (live's atlasApplyGoogleAddress). Returns the full address. */
function applyResult(result: GoogleAddress, input: HTMLInputElement | null, updateSearchField: boolean, includePlaceName: boolean): string {
  const fields = addressFields(result, includePlaceName);
  setField("billing_address_1", fields.street);
  setField("billing_city", fields.city);
  setField("billing_postcode", fields.postcode);
  const country = document.getElementById("billing_country") as HTMLSelectElement | null;
  if (country && [...country.options].some((option) => option.value === fields.country)) setField("billing_country", fields.country);
  const state = document.getElementById("billing_state") as HTMLSelectElement | null;
  if (state) setField("billing_state", matchState([...state.options].map((option) => [option.value, option.text]), fields.state) ?? "");
  if (updateSearchField && input && fields.full) input.value = fields.full;
  return fields.full;
}

export function DeliveryMap({
  apiKey,
  inputId,
  onLocation,
  onStatus,
  findRef,
}: {
  apiKey: string;
  /** The address field the suggestions attach to and Google's address is written into. */
  inputId: string;
  /** The pin's coordinates and/or Google's address for it (merged into what the form keeps). */
  onLocation: (point: Partial<DeliveryPoint>) => void;
  onStatus: (text: string, tone?: StatusTone) => void;
  /** Set to the "Find on Map" action once the map is ready. */
  findRef: MutableRefObject<((address: string) => void) | null>;
}) {
  const mapElement = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const listeners: Listener[] = [];
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const fail = () => {
      if (cancelled) return;
      setFailed(true);
      findRef.current = null;
      onStatus(ADDRESS_STATUS.unavailable);
    };
    // Google calls this when the key is refused (wrong key, or this address isn't allowed for it).
    (window as MapsWindow).gm_authFailure = fail;

    loadMaps(apiKey)
      .then((maps) => {
        if (cancelled || !mapElement.current) return;
        const map = new maps.Map(mapElement.current, { center: BALI_CENTER, zoom: OPEN_ZOOM, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false });
        const marker = new maps.Marker({ map, position: BALI_CENTER, draggable: true, title: "Delivery location" });
        const geocoder = new maps.Geocoder();

        const moveTo = (point: LatLng) => {
          map.setCenter(point);
          map.setZoom(FOUND_ZOOM);
          marker.setPosition(point);
          onLocation({ lat: coordinate(point.lat()), lng: coordinate(point.lng()) });
        };

        // The pin was dragged: its coordinates count, and the address follows it when Google knows one.
        listeners.push(
          marker.addListener("dragend", () => {
            const point = marker.getPosition();
            if (!point) return;
            onLocation({ lat: coordinate(point.lat()), lng: coordinate(point.lng()) });
            onStatus(ADDRESS_STATUS.updating);
            geocoder
              .geocode({ location: point })
              .then(({ results }) => {
                if (!results[0]) throw new Error("no address");
                onLocation({ address: applyResult(results[0], input, true, false) });
                onStatus(ADDRESS_STATUS.pinMoved, "success");
              })
              .catch(() => onStatus(ADDRESS_STATUS.pinKept, "success"));
          }),
        );

        // "Find on Map" and Enter: the typed address stays the order's address unless Google finds it.
        findRef.current = (typed: string) => {
          if (!typed) return onStatus(ADDRESS_STATUS.empty, "error");
          setField("billing_address_1", typed);
          onLocation({ address: typed });
          onStatus(ADDRESS_STATUS.finding);
          geocoder
            .geocode({ address: searchText(typed), region: "ID" })
            .then(({ results }) => {
              const result = results[0];
              if (!result?.geometry?.location) throw new Error("nothing found");
              moveTo(result.geometry.location);
              onLocation({ address: applyResult(result, input, true, false) });
              onStatus(ADDRESS_STATUS.found, "success");
            })
            .catch(() => {
              if (input) input.value = typed;
              onStatus(ADDRESS_STATUS.notFound, "success");
            });
        };

        // Suggestions while typing, biased to Bali (the classic Places widget, live's).
        if (input && maps.places?.Autocomplete) {
          try {
            const autocomplete = new maps.places.Autocomplete(input, { fields: ["address_components", "formatted_address", "geometry", "name", "types"], componentRestrictions: { country: "id" } });
            autocomplete.setBounds(new maps.LatLngBounds({ lat: BALI_BOUNDS.south, lng: BALI_BOUNDS.west }, { lat: BALI_BOUNDS.north, lng: BALI_BOUNDS.east }));
            listeners.push(
              autocomplete.addListener("place_changed", () => {
                const place = autocomplete.getPlace();
                if (!place?.geometry?.location) {
                  const typed = input.value.trim();
                  if (typed) {
                    setField("billing_address_1", typed);
                    onLocation({ address: typed });
                  }
                  return onStatus(ADDRESS_STATUS.suggestionWithoutPlace, "success");
                }
                moveTo(place.geometry.location);
                onLocation({ address: applyResult(place, input, true, isBusiness(place.types)) });
                onStatus(ADDRESS_STATUS.suggestionFound, "success");
              }),
            );
          } catch {
            // Without suggestions "Find on Map" still works.
          }
        }
      })
      .catch(fail);

    return () => {
      cancelled = true;
      findRef.current = null;
      for (const listener of listeners) listener.remove();
    };
  }, [apiKey, inputId, onLocation, onStatus, findRef]);

  if (failed) return null;
  return (
    <div className="atlas-map-wrap">
      <div ref={mapElement} id="atlas-checkout-map" className="atlas-checkout-map" role="application" aria-label="Map of the delivery location" />
      <div className="atlas-map-note">
        <span className="atlas-map-pin"> ● </span> Drag the pin to your exact delivery location. The address will update automatically.{" "}
      </div>
    </div>
  );
}
