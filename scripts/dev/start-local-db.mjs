#!/usr/bin/env node
// Starts the production build (`next start`) on http://localhost:3006 against the LOCAL development
// database (.data/pglite) instead of Neon, to try the store admin (create / archive / delete test
// products, test orders) without touching the real data. Used by .claude/launch.json ("prod-local-db").
// An empty DATABASE_URL wins over the one in .env.local (Next.js doesn't overwrite variables that exist).
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3006"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: "", DATABASE_URL_UNPOOLED: "" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
