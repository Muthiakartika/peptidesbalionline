/**
 * Better Auth's endpoints (sign up, sign in, sign out, session…) under /api/auth/. The auth server is
 * created on the first request (src/lib/auth/index.ts), so the build doesn't need the database. Until
 * DATABASE_URL and BETTER_AUTH_SECRET are set, every request gets a 503 with the reason in the log.
 */
import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

async function handle(request: Request): Promise<Response> {
  let auth: ReturnType<typeof getAuth>;
  try {
    auth = getAuth();
  } catch (error) {
    console.error(`Accounts are not available: ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ message: "Accounts are not available yet." }, { status: 503 });
  }
  return auth.handler(request);
}

export const { GET, POST } = toNextJsHandler(handle);
