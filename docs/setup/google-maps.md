# Google Maps key for the checkout map (Q-33)

The checkout's "Delivery location" box works like the live site's (the owner's snippet 16): suggestions while typing an
address, "Find on Map" for any address or Plus Code, and a pin the customer drags to the exact door. The order keeps
the pin (lat / lng) and Google's address for it. Code: `src/components/woocommerce/checkout/DeliveryMap.tsx`.

The map appears as soon as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` has a key. Without one, the map box isn't shown and the
address the customer types is kept, as before. If the key is refused, the map hides itself the same way.

## The live site's key (checked 13 Nov 2026)

The live checkout loads `maps.googleapis.com/maps/api/js?key=AIzaSyDx…&libraries=places,marker&v=weekly` from a WPCode
snippet, so a Google Cloud project with Maps (and billing) already exists. Which Google account owns it can't be seen
from the site: whoever made the key (the owner or the developer who added the snippet) finds it in Google Cloud Console →
APIs & Services → Credentials, as the key starting with `AIzaSyDx`. The snippet itself is in wp-admin → Code Snippets.

## What the owner does (once, in the browser)

Either reuse the key the live site already uses, or make a new one. Both are done in Google Cloud Console
(console.cloud.google.com) with the Google account that owns the live site's key. Maps needs a billing account on the
project; a shop's checkout traffic normally stays inside Google's free monthly usage, but check the current prices there.

1. **APIs & Services → Library**: make sure these are enabled on the project:
   - Maps JavaScript API
   - Geocoding API
   - Places API (the suggestions while typing; without it "Find on Map" and the pin still work)
2. **APIs & Services → Credentials**: open the live site's key, or **Create credentials → API key**.
3. **Application restrictions → Websites (HTTP referrers)**, one per line:
   - `http://localhost:3000/*` and `http://localhost:3005/*` (this computer)
   - the Vercel address, e.g. `https://peptidesbalionline.vercel.app/*` (and `https://*.vercel.app/*` only if previews need it)
   - `https://peptidesbali.online/*` and `https://www.peptidesbali.online/*` (already there on the live key)
4. **API restrictions → Restrict key** to the three APIs above. Save (it can take a few minutes to apply).

## Where the key goes

It is a browser key: it ends up in the page, like on the live site, so it is not a secret, but it is only safe because
of the restrictions above.

- This computer: paste it after `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=` in `.env.local` (the line is already there), then
  restart `npm run dev`.
- Vercel: Project → Settings → Environment Variables → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (Production, and Preview if
  used), then **Redeploy**: the key is written into the build.

## Check

Open `/checkout/` with something in the cart: the map shows Bali, typing an address offers suggestions, "Find on Map"
moves the pin, dragging the pin rewrites the address. Place a test order and open it in `/admin/orders/`: "Delivery
Location" shows the address and the coordinates.
