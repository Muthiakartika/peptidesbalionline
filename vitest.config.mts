import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for business logic (money, coupons, commissions…): `npm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" throws outside a React Server Component; tests run plain Node.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
    // The import tests start an in-memory Postgres (PGlite, WebAssembly) next to the others; under that load
    // the tests that read every exported page can pass Vitest's 5 s default.
    testTimeout: 20_000,
    environment: "node",
    // The shop's catalogue comes from the snapshot in tests (src/lib/catalog/store.ts), never a database.
    env: { CATALOG_SOURCE: "snapshot" },
  },
});
