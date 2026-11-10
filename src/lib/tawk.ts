/**
 * Which Tawk.to chat the site loads (ThirdPartyScripts.tsx).
 *
 * By default it is the owner's live chat (same property and widget as the live site, Q-11). With
 * TAWK_PROPERTY_ID and TAWK_WIDGET_ID in .env.local (or the hosting's environment variables) a local
 * or staging site loads another Tawk property instead, for example a test property, so test chats
 * don't land in the inbox the team answers real customers from. Leave both empty on the live domain.
 * The IDs are read when the site is built (run `npm run build` again after changing them). They are
 * not secrets: they are visible in every page's code.
 */

/** The live site's chat: https://embed.tawk.to/<property>/<widget>. */
export const LIVE_TAWK = { propertyId: "6ab794d5319803344d2cc1ac", widgetId: "1k3ehqojs" } as const;

/** A Tawk property ID is 24 hexadecimal characters; a widget ID is letters and digits ("default" too). */
const PROPERTY_ID = /^[a-f0-9]{24}$/i;
const WIDGET_ID = /^[a-z0-9]{1,40}$/i;

/** process.env, or any object with the same two names (tests). */
type TawkEnv = Record<string, string | undefined>;

/**
 * The address of the Tawk.to script. Stops the build with a clear message when only one ID is set or
 * an ID has the wrong shape, rather than quietly loading the live chat (test chats would then reach
 * real customers' inbox) or putting an unchecked value into the page's script.
 */
export function tawkEmbedUrl(env: TawkEnv = process.env): string {
  const propertyId = env.TAWK_PROPERTY_ID?.trim() ?? "";
  const widgetId = env.TAWK_WIDGET_ID?.trim() ?? "";
  if (!propertyId && !widgetId) return `https://embed.tawk.to/${LIVE_TAWK.propertyId}/${LIVE_TAWK.widgetId}`;
  if (!propertyId || !widgetId) {
    throw new Error("Tawk.to: set both TAWK_PROPERTY_ID and TAWK_WIDGET_ID in .env.local, or leave both empty for the live chat.");
  }
  if (!PROPERTY_ID.test(propertyId)) {
    throw new Error(`Tawk.to: TAWK_PROPERTY_ID "${propertyId}" is not a property ID (24 characters 0-9 and a-f, the first part after embed.tawk.to/).`);
  }
  if (!WIDGET_ID.test(widgetId)) {
    throw new Error(`Tawk.to: TAWK_WIDGET_ID "${widgetId}" is not a widget ID (letters and digits, the last part of the embed.tawk.to address).`);
  }
  return `https://embed.tawk.to/${propertyId}/${widgetId}`;
}
