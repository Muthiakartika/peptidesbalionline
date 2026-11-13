# E-mail through SendGrid (Q-08)

Chosen 13 Nov 2026. The code is ready (`src/lib/email/index.ts`). What is still missing: a SendGrid account,
the domain check and the key, which the owner sets up once, in the browser. About 20 minutes, plus the time the
DNS needs (usually minutes, at most a day).

## What the site sends

| E-mail | To | When |
| --- | --- | --- |
| Your account has been created (set your password) | customer | an account is made at checkout or on My Account |
| Password reset request | customer | "Lost your password?" |
| New order | the shop | an order is placed and goes on hold (Card, Revolut, Wise) or processing (COD), or a pending order is paid |
| Order received / on hold | customer | the same moment |
| Order received / processing | customer | the shop sets "Processing", or COD at checkout |
| Your order is on its way | customer | the shop sets "Completed" |
| Order refunded | customer | the shop sets "Refunded" |
| Order cancelled, order failed | the shop | a pending / on-hold / processing order is cancelled; a payment fails |
| A note has been added to your order | customer | the shop adds a "Note to customer" in /admin/orders/ |
| COA verification links | visitor | the lab results page's "Request COA verification links" |

The order e-mails use WooCommerce's own texts (11.2.1, the switches the live shop has; `src/lib/email/order-emails.ts`).
Every e-mail goes out twice in one: a designed HTML version in the site's look (redesigned on purpose 13 Nov 2026,
`src/lib/email/html.ts`: gold logo on a black band, Anton headings, gold buttons, progress bar, product pictures,
how to pay, delivery box) and WooCommerce's plain text for e-mail apps that don't show HTML. The owner's own
"Atlas Email Automations" flows (welcome series, abandoned cart, product guides, after the purchase) are not rebuilt:
their source is needed (Q-15).

**See every e-mail without sending:** `/api/dev/email-preview/` on this computer or the test site (made-up order;
the address doesn't exist on the live site). "send to the test inbox" next to each one sends it to `EMAIL_TEST_TO`
(only from this computer). The links inside an e-mail point to `NEXT_PUBLIC_SITE_URL`: on the Vercel test site its
address, on the live site peptidesbali.online.

## 1. Account

1. https://sendgrid.com → **Start for free** / **Sign up**, with an address the business keeps.
   Check the current plans at https://sendgrid.com/pricing and SendGrid's acceptable-use policy for this product
   category (as for Q-29).
2. SendGrid asks for a "Sender identity" first: choose **Domain Authentication** (below), not "Single Sender".

## 2. Domain authentication (peptidesbali.online)

Without it SendGrid refuses e-mails from hello@peptidesbali.online, or they land in spam.

1. SendGrid → **Settings → Sender Authentication → Authenticate Your Domain**.
2. DNS host: **Cloudflare**. Domain: `peptidesbali.online`. Leave "Use automated security" **on**. Link branding: no
   (the site switches link tracking off).
3. SendGrid shows about 3 **CNAME** records (`em….peptidesbali.online`, `s1._domainkey…`, `s2._domainkey…`) and
   suggests a **TXT** `_dmarc` record.
4. Cloudflare → the domain → **DNS → Records → Add record**, one per line SendGrid shows, with **Proxy status: DNS only**
   (grey cloud; an orange cloud breaks the check). Add `_dmarc` only if the domain has none yet.
5. Back in SendGrid → **Verify**. "Verified" = done.

This doesn't touch the mailbox: the MX records (where hello@ receives mail) and the WordPress site's own sending stay
as they are.

## 3. The API key (secret)

1. SendGrid → **Settings → API Keys → Create API Key**.
2. Name: `peptidesbali-site`. **Restricted Access** → **Mail Send: Full Access**, everything else off. **Create**.
3. Copy the key (it starts with `SG.`). SendGrid shows it only once.

**Never send it in the chat**, an e-mail or a screenshot. If it leaks: delete it in the same screen and make a new one.

## 4. Where the settings go

On this computer, in `.env.local` (the lines are already there, empty):

```
SENDGRID_API_KEY=SG.paste-it-here
EMAIL_TEST_TO=your-own@inbox.com
```

Then restart `npm run dev`.

**Why `EMAIL_TEST_TO`:** this computer and the Vercel test site use the real customers' data (Neon). Until
`SITE_ENV=production`, every e-mail goes to that one inbox instead (subject starting with "[Test]", the first line
says who it was for), so no customer gets a test e-mail. Without it the e-mails are saved in `.data/mail/` as before.

Vercel (Project → Settings → Environment Variables): the same `SENDGRID_API_KEY` and `EMAIL_TEST_TO`, then
**Redeploy**. At launch `SITE_ENV=production` makes them go to the real addresses (`EMAIL_TEST_TO` is ignored there).

Optional:

- `EMAIL_FROM`: another sender (default `Peptides Bali <hello@peptidesbali.online>`, as live). Its domain must be
  verified in step 2.
- `ORDER_ALERT_TO`: who gets "new order", "cancelled", "failed" (default `hello@peptidesbali.online`, as live; several
  addresses with commas). This is also the answer to Q-26 (new-order alerts without the WooCommerce app).

## 5. Check

1. With `EMAIL_TEST_TO` set: My Account → **Lost your password?** with your own test account's address, or place a
   test order (Wise). The e-mail arrives in the test inbox within a minute.
2. SendGrid → **Activity** shows each e-mail (delivered, bounced, blocked).
3. Nothing arrives: the terminal running the site shows why, e.g.
   `[email] SendGrid refused "…" (HTTP 403): … verified Sender Identity` = step 2 isn't verified yet;
   HTTP 401 = the key is wrong or lacks "Mail Send".
