/**
 * The Protocol Builder's API (/protocol-builder/): this site's copy of the live plugin's REST routes
 * /wp-json/atlas-planner/v1/…, at /api/atlas-planner/v1/…, answering in the same shapes and with the
 * same error codes, because the page runs the plugin's own script (planner.js), which was written
 * against them. Its "rest_root" points here (src/lib/planner/config.ts).
 *
 *   GET  session                       who the visitor is (logged in or not), features, limits, nonces
 *   GET  catalog                       the products, searched / filtered / paged
 *   GET  catalog/categories            the categories and the Vials tab's chips
 *   GET  product/{id}                  one product with its options and their verified capacities
 *   GET  combinations                  the store's popular combinations (none on live)
 *   GET  store-protocols[/{id}]        the pre-built protocols
 *   POST calculate                     the whole protocol worked out (the plugin's own engine)
 *   GET  cart, POST cart               this site's cart (POST: dry run, then all or nothing)
 *   POST exports                       CSV, calendar or printable page of the protocol on screen
 * Saved protocols, share links and the store's "publish as pre-built protocol" are not offered here:
 * those routes answer as WordPress does when they are switched off or not allowed.
 *
 * Every answer is "no-store" (as live). The routes that calculate or change something want the
 * session's nonce in "X-ARP-Nonce" (src/lib/planner/session.ts). The address keeps WordPress's
 * route names; with this site's trailing slashes, /api/atlas-planner/v1/session is redirected (308,
 * method and body kept) to …/session/ by Next.js before it reaches this file.
 */
import type { NextRequest } from "next/server";

import { postCartAnswer, getCartAnswer } from "@/lib/planner/cart";
import { calculatePlan } from "@/lib/planner/calculate";
import { CATALOG_ARGS, categoriesResponse, queryCatalog } from "@/lib/planner/catalog";
import { getPlannerState, plannerCombinations, productResponse } from "@/lib/planner/data";
import { exportPlan } from "@/lib/planner/exports";
import { badNonce, forbidden, invalidJson, json, noRoute, readArgs, restError } from "@/lib/planner/rest";
import { createNonce, hasValidNonce, sessionResponse, visitorId } from "@/lib/planner/session";
import { queryStoreProtocols, STORE_PROTOCOL_ARGS, STORE_PROTOCOL_ID, storeProtocolDetail } from "@/lib/planner/store-protocols";

type Context = RouteContext<"/api/atlas-planner/v1/[...route]">;

/** The answer of the saved-protocol routes while that feature is off (the code planner.js knows). */
const plansOff = () => restError("arp_feature_disabled", "Saving protocols to your account is currently not available.", 403);
/** The same for share links. */
const sharingOff = () => restError("arp_feature_disabled", "Share links are currently not available.", 403);

/** The request's JSON body, {} when it is empty, or null when it isn't JSON. */
async function body(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const routeOf = async (context: Context) => (await context.params).route ?? [];
const isPlans = (route: string[]) => route[0] === "plans";

export async function GET(request: NextRequest, context: Context) {
  const route = await routeOf(context);
  const path = route.join("/");
  const query = request.nextUrl.searchParams;

  if (path === "session") return json(await sessionResponse(request));
  if (path === "catalog") {
    const args = readArgs(query, CATALOG_ARGS);
    if (!args.ok) return args.response;
    return json(queryCatalog((await getPlannerState()).catalog, args.args));
  }
  if (path === "catalog/categories") return json(categoriesResponse((await getPlannerState()).catalog));
  if (route[0] === "product" && route.length === 2) {
    // WordPress's route pattern: digits only ("abc" has no route).
    if (!/^\d+$/.test(route[1])) return noRoute();
    const product = (await getPlannerState()).products.get(Number(route[1]));
    if (!product) return restError("arp_not_found", "This product is not available in the protocol builder.", 404);
    return json(productResponse(product));
  }
  if (path === "combinations") return json(plannerCombinations);
  if (path === "store-protocols") {
    const args = readArgs(query, STORE_PROTOCOL_ARGS);
    if (!args.ok) return args.response;
    return json(queryStoreProtocols(args.args));
  }
  if (route[0] === "store-protocols" && route.length >= 2 && route.length <= 3) {
    if (!STORE_PROTOCOL_ID.test(route[1]) || (route.length === 3 && route[2] !== "edit")) return noRoute();
    // ".../edit" is for the store's managers only.
    if (route.length === 3) return forbidden((await visitorId()) !== "0");
    const detail = storeProtocolDetail(route[1]);
    return detail ? json(detail) : restError("arp_not_found", "This pre-built protocol is not available.", 404);
  }
  if (path === "cart") {
    if (!(await hasValidNonce(request))) return badNonce();
    const answer = await getCartAnswer();
    return json(answer.body, answer.status);
  }
  if (isPlans(route)) return route[2] === "shares" ? sharingOff() : plansOff();
  if (path === "shared" || path === "exports/shared") return sharingOff();
  if (route[0] === "exports" && route.length === 2) return plansOff();
  return noRoute();
}

export async function POST(request: NextRequest, context: Context) {
  const route = await routeOf(context);
  const path = route.join("/");

  if (path === "calculate" || path === "cart" || path === "exports") {
    if (!(await hasValidNonce(request))) return badNonce();
    const data = await body(request);
    if (data === null) return invalidJson();
    const { products } = await getPlannerState();
    if (path === "calculate") {
      const answer = calculatePlan(data, products);
      return json(answer.body, answer.status);
    }
    if (path === "cart") {
      const answer = await postCartAnswer(data, products, createNonce("arp_public", await visitorId()));
      return json(answer.body, answer.status);
    }
    const answer = exportPlan(data, products);
    if ("body" in answer) return json(answer.body, answer.status);
    return new Response(answer.file.content, {
      headers: {
        "Content-Type": answer.file.type,
        "Content-Disposition": `attachment; filename="${answer.file.filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (isPlans(route)) return route[2] === "shares" ? sharingOff() : plansOff();
  // Publishing a pre-built protocol: the store's managers only.
  if (route[0] === "store-protocols" && (route.length === 1 || (route.length === 2 && STORE_PROTOCOL_ID.test(route[1])))) {
    return forbidden((await visitorId()) !== "0");
  }
  return noRoute();
}

/** Changing a saved protocol or a pre-built protocol (both not offered here). */
async function change(_request: NextRequest, context: Context) {
  const route = await routeOf(context);
  if (isPlans(route) && route.length === 2) return plansOff();
  if (route[0] === "store-protocols" && route.length === 2 && STORE_PROTOCOL_ID.test(route[1])) return forbidden((await visitorId()) !== "0");
  return noRoute();
}

export const PUT = change;
export const PATCH = change;

export async function DELETE(_request: NextRequest, context: Context) {
  const route = await routeOf(context);
  if (isPlans(route)) return route[2] === "shares" ? sharingOff() : plansOff();
  return noRoute();
}
