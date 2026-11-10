# Connecting Neon (the database)

What the owner does once, in the browser. The site is ready for it: it reads `DATABASE_URL` (the pooled
connection, for the site) and `DATABASE_URL_UNPOOLED` (the direct one, for creating the tables) from
`.env.local`. While both are empty it uses the local test database in `.data/pglite`.

## 1. Check the project's region

Neon → your project → **Settings**. Best for visitors in Bali: **AWS Asia Pacific (Singapore)**. A project's
region can't be changed later. If it's somewhere else (US, Europe), create a new project in Singapore: it is
still empty, so nothing is lost.

Open question Q-29: check that Neon's terms accept a peptide shop before relying on it.

## 2. Two branches: `main` for the live site, `dev` for this computer

A Neon branch is a separate copy of the database.

- `main` exists already: it becomes the **live** database (the hosting's settings get its connection later).
- Create a second one: **Branches** → **New branch** → name `dev`, parent `main`.
  This computer uses `dev`, so tests (test accounts, test orders) never land in the live database.

## 3. The connection strings → `.env.local`

1. Project → **Connect** (button at the top).
2. Choose **Branch: `dev`**. Keep the default database (`neondb`) and role.
3. With **Connection pooling ON**, copy the connection string (its host contains `-pooler`).
   Paste it into `.env.local` (project folder, next to `package.json`) after `DATABASE_URL=`.
4. Switch **Connection pooling OFF**, copy again, and paste after `DATABASE_URL_UNPOOLED=`.

```
DATABASE_URL=postgresql://…-pooler…/neondb?sslmode=require…
DATABASE_URL_UNPOOLED=postgresql://…/neondb?sslmode=require…
```

These strings contain the database password: **never send them in the chat**, an e-mail or a screenshot.
`.env.local` is never committed. If one leaks: Neon → **Roles** → reset the password and copy the strings
again.

## 4. What the developer does next

1. Stop the site, `npm run db:migrate`: every table is created in `dev` (migrations 0000–0007).
2. A fresh export of the live data (it keeps changing) → `node scripts/import/import-wordpress.mjs <file>
   --report docs/migration/wordpress-import-report.md`: every reconciliation line must say "ok".
3. The site runs on Neon: logging in, the cart, coupons, checkout, My Account and the order screens are
   checked again.
4. The local test database (`.data/pglite`) stays as it is, unused, as a backup.

**At launch:** the same two commands against `main` (with `main`'s strings), just before the switch, and
`main`'s pooled string goes into the hosting's environment variables (with `SITE_ENV=production` and a
production `BETTER_AUTH_SECRET`).
