import type { NextConfig } from "next";

import { legacyRedirects } from "./src/lib/seo/redirects";

/** The R2 bucket's public address (NEXT_PUBLIC_MEDIA_BASE_URL), "" while pictures stay on WordPress. */
const mediaBase = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "").replace(/\/+$/, "");
const mediaHost = (() => {
  try {
    return mediaBase ? new URL(mediaBase).hostname : "";
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  // The live site's 196 old addresses (WordPress Redirection plugin) → 301, before any page.
  async redirects() {
    return [
      // WordPress answers /favicon.ico with a 302 to its 32px site icon (src/app/icon1.png here).
      { source: "/favicon.ico", destination: "/icon1.png", statusCode: 302 },
      ...legacyRedirects(),
      // Once the pictures live in the Cloudflare R2 bucket (docs/setup/r2.md), old picture addresses on
      // this domain (CSS backgrounds, links from other sites, Google Images) go to the bucket.
      ...(mediaBase ? [{ source: "/wp-content/uploads/:path*", destination: `${mediaBase}/wp-content/uploads/:path*`, permanent: true }] : []),
    ];
  },

  // Every WordPress URL ends with "/" (e.g. /shop/, /product/bpc-157/).
  // With this on, Next.js serves the same URLs and redirects "/shop" → "/shop/",
  // exactly like WordPress does today. Required for SEO parity.
  trailingSlash: true,

  // The local development database (PGlite, src/db/index.ts) loads its WebAssembly Postgres from its own
  // files at run time, so it stays a plain Node.js package instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite"],

  // Next.js 16 defaults: data is dynamic unless a component or function opts in
  // with the "use cache" directive. See node_modules/next/dist/docs/01-app/
  // 01-getting-started/08-caching.md
  cacheComponents: true,
  partialPrefetching: true,

  experimental: {
    // Next.js 16's "optimistic routing" lets a link guess which route an address it hasn't seen yet
    // belongs to, from addresses it has seen, without asking the server. Here that guess is wrong
    // for the landing pages: src/proxy.ts serves /peptides-canggu/ from /landing/[name], but the
    // browser would guess the 404 catch-all ([...slug], learned from any missing page) and show
    // the 404 page without a request. Off, the link asks the server (through the proxy) first.
    // See node_modules/next/dist/client/components/segment-cache/optimistic-routes.d.ts.
    optimisticRouting: false,
    // How many workers build the 425 pages. Default: one per CPU core (11 here), which ran this
    // computer out of memory once the pages read Sanity. NEXT_BUILD_CPUS=4 npm run build uses fewer.
    ...(Number(process.env.NEXT_BUILD_CPUS) > 0 ? { cpus: Number(process.env.NEXT_BUILD_CPUS) } : {}),
  },

  images: {
    remotePatterns: [
      // Sanity's image CDN (where migrated images will live).
      { protocol: "https", hostname: "cdn.sanity.io" },
      // The live WordPress uploads, used only until the media is migrated (Phase 4).
      { protocol: "https", hostname: "peptidesbali.online", pathname: "/wp-content/uploads/**" },
      // The Cloudflare R2 bucket that replaces them (docs/setup/r2.md).
      ...(mediaHost ? [{ protocol: "https" as const, hostname: mediaHost }] : []),
    ],
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
