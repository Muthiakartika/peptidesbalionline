/**
 * Creates the local test customer used to try My Account on THIS computer (never on a live site):
 *
 *   node scripts/dev/seed-test-customer.mjs            (the site running on http://localhost:3005)
 *
 * It signs up through the site's own Better Auth endpoint (/api/auth/sign-up/email), so the account is
 * stored like any other, in the local development database (.data/pglite) while DATABASE_URL is empty.
 * The values below are test values for local use only. Running it twice says the account exists.
 */
const TEST_CUSTOMER = {
  email: "local.tester@example.com",
  username: "local.tester",
  name: "local.tester",
  password: "Local-test-only-2026!",
};

const base = process.env.SITE_URL ?? "http://localhost:3005";
const host = new URL(base).hostname;
if (!["localhost", "127.0.0.1", "[::1]"].includes(host) && !host.endsWith(".localhost")) {
  console.error(`Refusing to create a test account on ${base}: local sites only.`);
  process.exit(1);
}

const response = await fetch(`${base}/api/auth/sign-up/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify(TEST_CUSTOMER),
});
const body = await response.text();
console.log(response.status === 200 ? `Created ${TEST_CUSTOMER.email} on ${base}.` : `${response.status}: ${body.slice(0, 200)}`);
