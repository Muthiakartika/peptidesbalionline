/**
 * The Protocol Builder page's configuration: the JSON the live page prints in
 * <script type="application/json" id="arp-config">, which planner.js reads when it starts. Everything
 * is live's (src/content/planner/page.json: texts, colours, formats, limits, version …) except:
 *
 *   rest_root  this site's copy of the plugin's API (src/app/api/atlas-planner/v1/);
 *   urls       this site's own cart, checkout, shop, planner and login pages;
 *   features   saved protocols, share links and the WhatsApp hand-off are off (not offered here yet).
 *
 * Like live's, it holds no nonce and nothing about the visitor, so the page can be built in advance.
 */
import pageFile from "@/content/planner/page.json";
import settingsFile from "@/content/planner/settings.json";

/** This site's API address for planner.js (it adds "session", "catalog", … itself). */
export const PLANNER_REST_ROOT = "/api/atlas-planner/v1/";

/** The planner page and the pages its buttons open (this site's own). */
export const PLANNER_URLS = {
  cart: "/cart/",
  checkout: "/checkout/",
  shop: "/shop/",
  planner: "/protocol-builder/",
  login: "/my-account/",
};

/** Live's features, with what this site doesn't offer yet switched off. */
export const PLANNER_FEATURES = {
  ...settingsFile.features,
  account_plans: false,
  account_plans_enabled: false,
  sharing: false,
  whatsapp: false,
};

export type PlannerPage = {
  path: string;
  postId: number;
  articleClass: string;
  pageTitleHtml: string;
  /** The article's content as live prints it, with <!--arp-config--> where the configuration goes. */
  html: string;
  config: Record<string, unknown>;
  assetVersion: string;
  seo: { title: string; description: string | null; robots: string | null; ogType: string | null; ogTitle: string | null; ogDescription: string | null };
};

export const plannerPage = pageFile as unknown as PlannerPage;

/** The configuration, in live's key order. */
export function plannerConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(plannerPage.config)) {
    if (key === "features") config.features = { ...(value as object), ...PLANNER_FEATURES };
    else config[key] = value;
    if (key === "version") config.rest_root = PLANNER_REST_ROOT;
    if (key === "primary_text") config.urls = PLANNER_URLS;
  }
  return config;
}

/** The configuration as the text of a <script> element (no "</script>" can end it early). */
export function plannerConfigScript(): string {
  return JSON.stringify(plannerConfig()).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

/** The article's HTML with the configuration where live prints it. */
export function plannerArticleHtml(): string {
  return plannerPage.html.replace("<!--arp-config-->", `<script type="application/json" id="arp-config">${plannerConfigScript()}</script>`);
}
