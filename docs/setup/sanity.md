# Setting up Sanity (the CMS)

What the owner does once, in the browser. About 10 minutes. The project is already built for it: the Studio
runs inside the site at `/studio/`, the schemas are in `src/sanity/schemas/`, and the site reads the project
from `.env.local`.

## 1. Account and project

1. Go to https://www.sanity.io and sign up (Google, GitHub or e-mail). Use an address the business will keep.
2. Open https://www.sanity.io/manage → **Create new project**. Name: `Atlas Longevity`.
   If it asks about a template or the command line, skip it: this project has its own Studio.
3. Plan: start on the free plan. Before moving the images, check https://www.sanity.io/pricing: the site has
   about 3,200 image files (507 MB) to move.

## 2. Datasets

A dataset is one copy of the content.

1. In the project → **Datasets**: `production` exists already.
2. **Add dataset** → `staging` (to try changes without touching the live content).
3. Keep both **public**. The site reads published content without a token, and that content is the public
   website anyway. Drafts are never public.

## 3. The project ID → `.env.local`

On the project's overview page, copy the **Project ID** (a short code like `abc123xy`). It isn't secret: you
can send it in the chat. Then put it in `.env.local` (in the project folder, next to `package.json`):

```
NEXT_PUBLIC_SANITY_PROJECT_ID=abc123xy
NEXT_PUBLIC_SANITY_DATASET=production
```

## 4. CORS origins (who may open the Studio)

Project → **API** → **CORS origins** → **Add CORS origin**, with **Allow credentials** ticked, for each:

- `http://localhost:3005` (this computer, production build)
- `http://localhost:3000` (this computer, `npm run dev`)
- later: the staging address, and `https://peptidesbali.online` once the new site is live there.

## 5. The write token (secret)

The migration scripts need it to fill Sanity with the products, pages, posts and images.

1. Project → **API** → **Tokens** → **Add API token**.
2. Name: `migration`. Permissions: **Editor**. Save.
3. Copy the token. Sanity shows it only once.
4. Paste it into `.env.local` yourself:

   ```
   SANITY_API_WRITE_TOKEN=paste-it-here
   ```

**Never send this token in the chat**, an e-mail or a screenshot, and never put it anywhere else.
`.env.local` is never committed (the `.gitignore` covers it). If it leaks: delete it in the same screen and
make a new one.

## 6. Team members

Project → **Members** → **Invite**: the people who will edit content (role **Editor**), and the owner as
**Administrator**.

## 7. Check

1. Restart the site (stop it, then `npm run build` and `npm run start -- -p 3005`, or `npm run dev`).
2. Open http://localhost:3005/studio/ and log in with your Sanity account.
3. You should see the Studio with empty lists (Products, Categories, Pages, Posts…). Empty is right: nothing
   has been moved yet.

## 8. The webhook (refresh the site when an editor publishes)

The site caches every page it builds from Sanity until Sanity tells it something changed.

1. The secret: a long random code, already made on 13 Nov 2026 in `.data/sanity-webhook-secret.txt` (open the
   file and copy the last line; to make another: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   Put it on **Vercel** yourself (Project → Settings → Environment Variables → `SANITY_REVALIDATE_SECRET`, then
   **Redeploy**). **Not in `.env.local`**: this computer can't receive webhooks, and with the secret set the site
   keeps Sanity pages until a webhook arrives, so local pages would stop refreshing.
2. Project → **API** → **Webhooks** → **Create webhook**:
   - Name: `Refresh site`
   - URL: `https://peptidesbalionline.vercel.app/api/sanity/revalidate/` (the site's address, with the final "/",
     like every address of the site; one webhook per site: test site now, `https://peptidesbali.online/…` at launch)
   - Dataset: the one that site reads (`staging` now, `production` after the production import)
   - Trigger on: **Create, Update, Delete**; drafts and versions off
   - Filter: `_type in ["page", "sharedSection", "popup", "siteSettings", "post", "product"]`
   - Projection: `{_type, _id}`
   - Status: enabled. HTTP method **POST**. API version: the newest offered (any works: the site only reads
     `_type`). HTTP headers: none. **Secret**: the same secret. Save.
3. Publish any small change; the page shows it on the next visit. The webhook's **Attempts log** shows `200`
   for each publish (`401` = the two secrets differ, `503` = Vercel doesn't have the secret yet or wasn't
   redeployed).

Without the webhook (and without `SANITY_REVALIDATE_SECRET`) the site works the same, only a little later: it
keeps a page for one minute (the first visit after that rebuilds it in the background, the next visit shows the
change), and the products' texts for up to an hour.

## Login method

The Studio logs in with a token kept in the browser (`auth.loginMethod: "token"` in `sanity.config.ts`), not
a sanity.io cookie: the picture upload (`/api/media/upload`) sends it so the site can ask Sanity who the
editor is. Nothing changes for the editor: the login screen is the same.

## Where things stand (9 Nov 2026)

- `staging` holds the converted content: 75 pages (sections + widgets), 7 shared sections, 2 popups, Site
  settings (top bar, menu, footer, notices), 54 blog post bodies, 182 products' texts. Editing guide:
  `docs/content/editing-in-sanity.md`.
- Production builds on this computer read `staging` (`.env.production.local`), so
  http://localhost:3005/studio/ edits staging and http://localhost:3005/ shows it.
- `production` is still empty. After the owner's review: `node scripts/sanity/import-content.mjs --dataset
  production --yes`, then `CONTENT_SOURCE=sanity` and `NEXT_PUBLIC_SANITY_DATASET=production` on Vercel.
- Pictures: Cloudflare R2, `docs/setup/r2.md`.
