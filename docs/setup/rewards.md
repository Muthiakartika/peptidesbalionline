# Rewards programme (Atlas Longevity Rewards)

Built 12–13 Nov 2026 (Phase 6b), replacing RewardsWP Pro 1.7.1, which is switched off on live. The rules are the
ones published on `/rewards/` and `/rewards-terms/`; where the old plugin's settings said something else, this
page says which one won.

## 1. The rules (one file: `src/lib/loyalty/rules.ts`)

| | |
|---|---|
| Earning | 1 credit for every Rp 10,000 of **eligible product spend**: after discounts, without shipping, fees or tax, rounded down per completed order. Issued when the order is **completed**. |
| Redeeming | 250 credits → a Rp 250,000 coupon. The coupon needs an order of at least **Rp 2,500,000** (before the discount), is used once and can't be combined with another coupon. Credits never expire. |
| Welcome | Joining is free and gives **50 credits** (worth Rp 50,000 once exchanged). |
| Refer a friend | The friend gets Rp 250,000 off a **first** order of at least Rp 3,000,000. When that order is completed the member gets a Rp 250,000 coupon (order of Rp 2,500,000+). No limit on friends. |
| Not allowed | A member's own link, a second claim by the same person, a friend who already has an order, and an order that earns an affiliate commission (an order can't earn both). |
| Refunds | An order cancelled, failed or refunded gives its credits back; a partial refund recalculates them; an unused referral reward is switched off (a used one stays, and the referral is marked "reversed"). |

## 2. How it works in the shop

- **Members:** My Account → **Rewards** (`/my-account/rewards/`): "Join free" gives the welcome credits and a share
  link (`/share/<code>/`, RewardsWP's slug, so links already sent keep working). Credits only come from orders placed
  after joining, by a logged-in member (a guest order earns nothing).
- **Credits** are a ledger (`loyalty_transactions`): the balance is the sum, rows are never edited. Each time an
  order's status changes, `setOrderStatus` (after its own change is saved) runs `syncOrderRewards`: it works out
  what the order's credits should be and writes only the difference, so running it twice never pays twice. A problem
  in the rewards code is logged and **never stops an order from changing status**.
- **Coupons:** exchanging credits, claiming a friend's coupon and the member's reward all create an ordinary coupon
  (`coupons`, source `rewards_redemption` / `rewards_referral`): fixed amount, used once, only for the owner's
  e-mail address, "individual use". The cart and checkout treat it like any other coupon, and a cancelled order gives
  it back through the existing coupon bookkeeping.
- **Refer a friend:** `/share/<code>/` remembers the code for 30 days and sends the visitor to the Rewards tab. A new
  customer who is logged in claims their coupon there (or by joining). When the order paid with that coupon is
  completed, the referrer's reward coupon is issued.
- Where things are: tables `src/db/schema/loyalty.ts` (migration 0010), logic `src/lib/loyalty/`, the tab
  `src/components/woocommerce/account/RewardsTab.tsx`, its buttons `src/app/(store)/my-account/rewards/actions.ts`,
  the share link `src/app/(store)/share/[code]/route.ts`.

## 3. What the owner should confirm

These were decided by reading the pages, the terms and the old plugin's settings; each is one line to change in
`rules.ts`.

1. **Welcome reward = 50 credits.** The pages say "Rp 50,000 welcome reward"; RewardsWP's data shows it ran as 50
   "signup" points, and credits are worth Rp 1,000 each. If it should be a ready-to-use Rp 50,000 coupon instead,
   say so.
2. **No expiry.** The terms say credits and rewards never expire; RewardsWP's own setting said "+3 months". The
   published terms won. The imported points have no expiry. The one referral coupon RewardsWP had already issued
   keeps the date it was made with (28 Jan 2027).
3. **Minimum orders.** The friend's coupon needs Rp 3,000,000 (the terms) where RewardsWP was set to Rp 2,500,000;
   the member's reward and redeemed credits need Rp 2,500,000. The old friend coupon that was imported keeps its own
   Rp 2,500,000.
4. **Who counts as new:** no earlier order (not cancelled, failed or a draft) under the account or the e-mail address.
5. **Credits for members only,** for orders placed after joining. Customers who never joined don't earn credits
   behind the scenes.
6. **Eligible products:** all products. The terms mention exclusions "for legal or regulatory reasons" without a list;
   there is no list to apply.
7. The terms page ends with "Final terms require legal review before publication".

## 4. Importing RewardsWP's data

The owner's MySQL dump holds RewardsWP's tables (members, points, referrals, rewards). Needs the main import done
first (accounts and orders matched by their WordPress IDs) and `npm run db:migrate`:

```bash
node scripts/import/import-rewardswp.mjs "D:\path\outside\the\project\dump.sql.gz"
```

Run 13 Nov 2026 on the local database and on Neon `dev`: 4 members (codes and join dates kept), 3 approved points
(the two signups as welcome credits, the 288-credit purchase linked to its order), 2 pending purchases waiting for
their orders to be completed, 1 referral with its friend coupon (marked as a reward coupon). Reconciliation prints
`ok` for each member (RewardsWP's balance = its approved points = credits imported). Safe to run again: it skips what
is already there. The script refuses a dump inside the project folder and prints counts only.

## 5. Not built (nobody asked yet)

- Admin screens to adjust a member's credits (for now a ledger row of type `adjust`), and a refund screen: partial
  refunds are recalculated when a row exists in `refunds`.
- E-mails about rewards (needs the mail provider, Q-08).
- The credits calculator on `/rewards/` (the page's calculator section is plain text), and its buttons still go to
  `/my-account/`: pointing them at `/my-account/rewards/` is a content change (this copy and Sanity).
- The affiliate module's own attribution (Phase 6a): until it exists, "an order can't earn both" is checked from an
  affiliate referral row or an affiliate coupon on the order.

## 6. Tests

`npm test` runs `src/lib/loyalty/*.test.ts` (rules; and the database part on a real in-memory Postgres with every
migration: joining, credits, refunds, redemption, referral, the coupon engine, failure isolation) and
`scripts/import/rewardswp-import.test.mjs` (the dump reader and the importer).
