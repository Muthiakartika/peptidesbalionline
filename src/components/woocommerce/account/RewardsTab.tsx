/**
 * My Account → Rewards (/my-account/rewards/): the customer's credits, coupons, share link and history, with
 * the rules of /rewards/ and /rewards-terms/ (src/lib/loyalty/rules.ts). A customer who hasn't joined sees the
 * offer instead. Styles: src/styles/rewards.css.
 */
import { cookies } from "next/headers";
import Link from "next/link";

import { claimFriendCouponAction, joinRewardsAction, redeemCreditsAction } from "@/app/(store)/my-account/rewards/actions";
import { longDate } from "@/lib/blog/dates";
import type { AccountUser } from "@/lib/account/session";
import { friendCouponFor, getOverview, type LedgerRow, type Overview, type ReferralRow } from "@/lib/loyalty/store";
import { FRIEND_MIN_ORDER_MINOR, isReferralCode, REDEEM_CREDITS, REDEEM_MIN_ORDER_MINOR, REDEEM_VALUE_RUPIAH, REFERRAL_COOKIE, sharePath, WELCOME_CREDITS, welcomeValueRupiah } from "@/lib/loyalty/rules";
import { siteUrl } from "@/lib/site";

import { CopyButton } from "./CopyButton";

const rupiah = (amount: number) => `Rp ${amount.toLocaleString("en-US")}`;
const rupiahMinor = (minor: bigint) => rupiah(Number(minor / 100n));
const dateOf = (date: Date) => longDate(date.toISOString());

const REFERRAL_STATUS: Record<ReferralRow["status"], string> = {
  pending: "Coupon claimed, waiting for their first order",
  rewarded: "Order completed: your reward is ready",
  reversed: "Reversed (the order was refunded or cancelled)",
  rejected: "Not eligible",
};

function ledgerLabel(row: LedgerRow): string {
  if (row.source === "welcome") return "Welcome reward";
  if (row.source === "redemption") return "Exchanged for a coupon";
  if (row.source === "import") return row.orderNumber ? `Imported credits for order #${row.orderNumber}` : "Imported from the previous rewards programme";
  if (row.source === "admin") return row.reason ?? "Adjustment by Atlas Longevity";
  if (row.type === "reverse") return row.orderNumber ? `Order #${row.orderNumber} was refunded or cancelled` : "Credits taken back";
  return row.orderNumber ? `Completed order #${row.orderNumber}` : "Credits";
}

function Coupons({ overview, friend }: { overview: NonNullable<Overview>; friend: { code: string; used: boolean } | null }) {
  const listed = overview.coupons;
  if (!listed.length) {
    return (
      <p className="atlas-rewards__muted">
        {friend ? null : "You have no coupons yet."} Coupons from redeemed credits and referrals appear here.
      </p>
    );
  }
  return (
    <ul className="atlas-rewards__coupons">
      {listed.map((coupon) => (
        <li key={coupon.code} className={coupon.used ? "is-used" : undefined}>
          <div>
            <strong>{rupiah(coupon.amountRupiah)} OFF</strong>
            <span className="atlas-rewards__muted">
              {" "}
              · order of {rupiahMinor(coupon.minimumMinor)}+ · {coupon.kind === "redemption" ? "from your credits" : "referral"} · one coupon per order
            </span>
          </div>
          <div className="atlas-rewards__code">
            <code>{coupon.code}</code>
            {coupon.used ? <span className="atlas-rewards__badge">Used</span> : <CopyButton text={coupon.code} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

export async function Rewards({ user }: { user: AccountUser }) {
  let overview: Overview = null;
  let friend: { code: string; used: boolean } | null = null;
  let failed = false;
  try {
    [overview, friend] = await Promise.all([getOverview(user.id, user.email), friendCouponFor(user.id)]);
  } catch (error) {
    console.error("[rewards] could not load the Rewards tab", error instanceof Error ? error.message : "error");
    failed = true;
  }
  const linkCode = (await cookies()).get(REFERRAL_COOKIE)?.value ?? "";
  const invited = isReferralCode(linkCode) && !friend;

  if (failed) {
    return (
      <div className="woocommerce-error atlas-rewards" role="alert">
        Rewards aren&apos;t available right now. Please try again in a moment.
      </div>
    );
  }

  return (
    <div className="atlas-rewards">
      <h2 className="atlas-rewards__title">Atlas Longevity Rewards</h2>
      <p className="atlas-rewards__lead">
        Earn 1 credit for every Rp 10,000 you spend. Exchange {REDEEM_CREDITS} credits for {rupiah(REDEEM_VALUE_RUPIAH)} OFF, and give a friend {rupiah(250_000)} while you get {rupiah(250_000)}. Your credits never expire.{" "}
        <Link href="/rewards-terms/">Terms apply.</Link>
      </p>

      {invited ? (
        <section className="atlas-rewards__card atlas-rewards__card--invite">
          <h3>A friend invited you</h3>
          <p>
            Claim {rupiah(250_000)} OFF your first order of {rupiahMinor(FRIEND_MIN_ORDER_MINOR)} or more. It&apos;s for new customers, and the coupon works for your e-mail address only.
          </p>
          <form action={claimFriendCouponAction}>
            <button type="submit" className="atlas-rewards__button">
              Claim {rupiah(250_000)} OFF
            </button>
          </form>
        </section>
      ) : null}

      {friend && !overview ? (
        <section className="atlas-rewards__card">
          <h3>Your friend&apos;s coupon</h3>
          <div className="atlas-rewards__code">
            <code>{friend.code}</code>
            {friend.used ? <span className="atlas-rewards__badge">Used</span> : <CopyButton text={friend.code} />}
          </div>
          <p className="atlas-rewards__muted">
            {rupiah(250_000)} OFF a first order of {rupiahMinor(FRIEND_MIN_ORDER_MINOR)} or more. Enter it in the coupon box at checkout.
          </p>
        </section>
      ) : null}

      {!overview ? (
        <section className="atlas-rewards__card">
          <h3>Join for free</h3>
          <p>
            Create your free rewards account and get {WELCOME_CREDITS} credits as a welcome reward, worth {rupiah(welcomeValueRupiah())} once you exchange them. After that every completed order earns more.
          </p>
          <form action={joinRewardsAction}>
            <button type="submit" className="atlas-rewards__button">
              Join free &amp; get {WELCOME_CREDITS} credits
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="atlas-rewards__card">
            <h3>Your credits</h3>
            <p className="atlas-rewards__balance">
              <strong>{overview.balance.toLocaleString("en-US")}</strong> credits
            </p>
            <p className="atlas-rewards__muted">
              {overview.progress.redeemable > 0
                ? `You can exchange ${REDEEM_CREDITS} credits for a ${rupiah(REDEEM_VALUE_RUPIAH)} coupon${overview.progress.redeemable > 1 ? ` (${overview.progress.redeemable} times)` : ""}.`
                : `${overview.progress.toNext} more credits for your next ${rupiah(REDEEM_VALUE_RUPIAH)} coupon.`}
            </p>
            <div className="atlas-rewards__bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, ((overview.balance % REDEEM_CREDITS) / REDEEM_CREDITS) * 100)}%` }} />
            </div>
            <form action={redeemCreditsAction}>
              <button type="submit" className="atlas-rewards__button" disabled={overview.progress.redeemable < 1}>
                Exchange {REDEEM_CREDITS} credits for {rupiah(REDEEM_VALUE_RUPIAH)} OFF
              </button>
            </form>
            <p className="atlas-rewards__muted">
              The coupon works on an order of {rupiahMinor(REDEEM_MIN_ORDER_MINOR)} or more, once per order, and can&apos;t be combined with another coupon. Credits from an order arrive when it is completed.
            </p>
          </section>

          <section className="atlas-rewards__card">
            <h3>Your coupons</h3>
            <Coupons overview={overview} friend={friend} />
          </section>

          <section className="atlas-rewards__card">
            <h3>Refer a friend: give {rupiah(250_000)}, get {rupiah(250_000)}</h3>
            <p>
              Your friend gets {rupiah(250_000)} OFF a first order of {rupiahMinor(FRIEND_MIN_ORDER_MINOR)} or more. When that order is completed, you get a {rupiah(250_000)} coupon. Share your personal link:
            </p>
            <div className="atlas-rewards__code">
              <code>{`${siteUrl.replace(/\/$/, "")}${sharePath(overview.member.referralCode)}`}</code>
              <CopyButton text={`${siteUrl.replace(/\/$/, "")}${sharePath(overview.member.referralCode)}`} label="Copy link" />
            </div>
            {overview.referrals.length ? (
              <table className="atlas-rewards__table">
                <thead>
                  <tr>
                    <th>Friend</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.referrals.map((row, index) => (
                    <tr key={index}>
                      <td>{row.friend}</td>
                      <td>{dateOf(row.createdAt)}</td>
                      <td>{REFERRAL_STATUS[row.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="atlas-rewards__muted">No referrals yet.</p>
            )}
          </section>

          <section className="atlas-rewards__card">
            <h3>History</h3>
            {overview.ledger.length ? (
              <table className="atlas-rewards__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>What</th>
                    <th>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.ledger.map((row) => (
                    <tr key={row.id}>
                      <td>{dateOf(row.createdAt)}</td>
                      <td>{ledgerLabel(row)}</td>
                      <td className={row.credits < 0 ? "is-negative" : undefined}>{row.credits > 0 ? `+${row.credits}` : row.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="atlas-rewards__muted">Nothing yet.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
