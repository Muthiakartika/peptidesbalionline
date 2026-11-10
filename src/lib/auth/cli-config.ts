/**
 * Only for Better Auth's table generator, which writes src/db/schema/auth.ts:
 *
 *   npx auth@1.7.12 generate --config src/lib/auth/cli-config.ts --adapter drizzle --dialect postgresql --output src/db/schema/auth.ts
 *
 * The same options as the site (options.ts) without a database: the generator only needs to know
 * which tables and columns the options ask for. The site itself uses src/lib/auth/index.ts.
 */
import { betterAuth } from "better-auth";

import { authOptions } from "./options";

export const auth = betterAuth(authOptions);
