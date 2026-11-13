/**
 * The My Account dashboard (redesigned 13 Nov 2026): a welcome band, four number tiles (orders, in progress, spent,
 * credits), the latest orders, a rewards panel, the saved address and quick links into the shop. Data:
 * src/lib/account/dashboard.ts. Styles: src/styles/account-dashboard.css.
 */
import Link from "next/link";

import type { AccountUser } from "@/lib/account/session";
import { getDashboardData, statusTone, type DashboardData } from "@/lib/account/dashboard";
import { longDate } from "@/lib/blog/dates";
import { ORDER_STATUS_NAMES, needsPayment, paymentAddress } from "@/lib/commerce/orders";
import { REDEEM_CREDITS, REDEEM_VALUE_RUPIAH, WELCOME_CREDITS } from "@/lib/loyalty/rules";
import { business } from "@/lib/site";

import { AccountIcon } from "./AccountIcons";

const rupiah = (minor: bigint) => `Rp ${(Number(minor) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** The first name when the account has one, else the display name as it is ("local.tester", not "local"). */
const firstName = (user: AccountUser) => user.firstName || user.displayName;

const QUICK_LINKS = [
  { icon: "shop", title: "Shop peptides", text: "Browse the full catalogue", href: "/shop/" },
  { icon: "lab", title: "Lab results", text: "Certificates of analysis", href: "/lab-results-certificates-of-analysis/" },
  { icon: "research", title: "Protocol Builder", text: "Plan your research protocol", href: "/protocol-builder/" },
  { icon: "calculator", title: "Calculator", text: "Reconstitution and dosing maths", href: "/calculator/" },
];

function Stat({ icon, label, value, note, href }: { icon: string; label: string; value: string; note?: string; href: string }) {
  return (
    <Link href={href} className="acct-stat">
      <span className="acct-stat__icon">
        <AccountIcon name={icon} size={22} />
      </span>
      <span className="acct-stat__label">{label}</span>
      <strong className="acct-stat__value">{value}</strong>
      {note ? <span className="acct-stat__note">{note}</span> : null}
    </Link>
  );
}

export function RecentOrders({ data }: { data: DashboardData }) {
  return (
    <section className="acct-card acct-orders" aria-labelledby="acct-orders-title">
      <header className="acct-card__head">
        <h3 id="acct-orders-title">Recent orders</h3>
        {data.orderCount ? (
          <Link href="/my-account/orders/" className="acct-link">
            View all <AccountIcon name="arrow" size={15} />
          </Link>
        ) : null}
      </header>
      {data.recent.length ? (
        <ul className="acct-orders__list">
          {data.recent.map((order) => (
            <li key={String(order.number)}>
              <span className="acct-orders__icon">
                <AccountIcon name="orders" size={20} />
              </span>
              <div className="acct-orders__main">
                <Link href={`/my-account/view-order/${order.number}/`} className="acct-orders__number">
                  Order #{String(order.number)}
                </Link>
                <span className="acct-orders__meta">
                  {longDate(order.createdAt.toISOString())} · {order.items} {order.items === 1 ? "item" : "items"}
                </span>
              </div>
              <span className="acct-chip" data-tone={statusTone(order.status)}>
                {ORDER_STATUS_NAMES[order.status] ?? order.status}
              </span>
              <strong className="acct-orders__total">{rupiah(order.totalMinor)}</strong>
              <span className="acct-orders__actions">
                {needsPayment(order.status) ? (
                  <Link href={paymentAddress(order.number, order.key)} className="acct-btn acct-btn--gold">
                    Pay
                  </Link>
                ) : null}
                <Link href={`/my-account/view-order/${order.number}/`} className="acct-btn acct-btn--ghost">
                  View
                </Link>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="acct-empty">
          <span className="acct-empty__icon">
            <AccountIcon name="shop" size={26} />
          </span>
          <strong>No orders yet</strong>
          <p>When you place an order it appears here, with its status and a link to pay or track it.</p>
          <Link href="/shop/" className="acct-btn acct-btn--ink">
            Browse products
          </Link>
        </div>
      )}
    </section>
  );
}

export function RewardsPanel({ rewards }: { rewards: DashboardData["rewards"] }) {
  if (!rewards) {
    return (
      <section className="acct-card acct-rewards" aria-labelledby="acct-rewards-title">
        <span className="acct-eyebrow">Atlas Rewards</span>
        <h3 id="acct-rewards-title">Earn while you research</h3>
        <p>
          Join free and get {WELCOME_CREDITS} credits. Every Rp 10,000 you spend earns 1 credit, and {REDEEM_CREDITS} credits are worth Rp {REDEEM_VALUE_RUPIAH.toLocaleString("en-US")} off.
        </p>
        <Link href="/my-account/rewards/" className="acct-btn acct-btn--gold">
          Join free · get {WELCOME_CREDITS} credits
        </Link>
      </section>
    );
  }
  const filled = ((rewards.balance % REDEEM_CREDITS) / REDEEM_CREDITS) * 100;
  return (
    <section className="acct-card acct-rewards" aria-labelledby="acct-rewards-title">
      <span className="acct-eyebrow">Atlas Rewards</span>
      <h3 id="acct-rewards-title" className="acct-visually-hidden">
        Your rewards
      </h3>
      <p className="acct-rewards__balance">
        <strong>{rewards.balance.toLocaleString("en-US")}</strong> credits
      </p>
      <div className="acct-progress" role="img" aria-label={`${filled.toFixed(0)}% of the way to your next coupon`}>
        <span style={{ width: `${rewards.redeemable > 0 ? 100 : filled}%` }} />
      </div>
      <p className="acct-rewards__note">
        {rewards.redeemable > 0
          ? `You can exchange ${REDEEM_CREDITS} credits for a Rp ${REDEEM_VALUE_RUPIAH.toLocaleString("en-US")} coupon.`
          : `${rewards.toNext} more credits for your next Rp ${REDEEM_VALUE_RUPIAH.toLocaleString("en-US")} coupon.`}
      </p>
      <Link href="/my-account/rewards/" className="acct-btn acct-btn--gold">
        {rewards.redeemable > 0 ? "Exchange credits" : "Open rewards"}
      </Link>
    </section>
  );
}

export async function AccountDashboard({ user }: { user: AccountUser }) {
  let data: DashboardData | null = null;
  try {
    data = await getDashboardData(user.id);
  } catch (error) {
    console.error("[account] dashboard data failed", error instanceof Error ? error.message : "error");
  }
  const logout = `/my-account/customer-logout/?_wpnonce=${user.logoutToken}`;
  const whatsapp = `https://wa.me/${business.whatsappNumber}`;

  return (
    <div className="acct-dash">
      <section className="acct-hero">
        <div className="acct-hero__text">
          <span className="acct-eyebrow">My account</span>
          <h3 className="acct-hero__title">
            Welcome back, <span>{firstName(user)}</span>
          </h3>
          <p>Track your orders, manage your delivery details and see what your rewards have earned.</p>
          <div className="acct-hero__actions">
            <Link href="/shop/" className="acct-btn acct-btn--ink">
              Shop peptides
            </Link>
            <Link href="/my-account/orders/" className="acct-btn acct-btn--outline">
              Track an order
            </Link>
          </div>
        </div>
        <p className="acct-hero__who">
          Not {user.displayName}? <a href={logout}>Log out</a>
        </p>
      </section>

      {data ? (
        <>
          <div className="acct-stats">
            <Stat icon="orders" label="Orders" value={String(data.orderCount)} note={data.orderCount ? "all time" : "none yet"} href="/my-account/orders/" />
            <Stat icon="clock" label="In progress" value={String(data.openCount)} note={data.openCount ? "waiting or on the way" : "nothing waiting"} href="/my-account/orders/" />
            <Stat icon="wallet" label="Total spent" value={rupiah(data.spentMinor)} note="paid orders" href="/my-account/orders/" />
            <Stat icon="rewards" label="Credits" value={data.rewards ? data.rewards.balance.toLocaleString("en-US") : "–"} note={data.rewards ? "reward credits" : "not joined yet"} href="/my-account/rewards/" />
          </div>

          <div className="acct-split">
            <RecentOrders data={data} />
            <div className="acct-side-cards">
              <RewardsPanel rewards={data.rewards} />
              <section className="acct-card acct-address" aria-labelledby="acct-address-title">
                <header className="acct-card__head">
                  <h3 id="acct-address-title">Delivery details</h3>
                  <Link href="/my-account/edit-address/" className="acct-link">
                    Edit <AccountIcon name="arrow" size={15} />
                  </Link>
                </header>
                {data.address ? (
                  <address>
                    {data.address.name ? <strong>{data.address.name}</strong> : null}
                    {data.address.lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                    <span className="acct-address__mail">{user.email}</span>
                  </address>
                ) : (
                  <p className="acct-muted">
                    No address saved yet. Add one and checkout starts with it. <Link href="/my-account/edit-address/billing/">Add billing address</Link>
                  </p>
                )}
              </section>
            </div>
          </div>
        </>
      ) : (
        <p className="acct-muted">Your orders and rewards can&apos;t be shown right now. They&apos;re still available under Orders and Rewards.</p>
      )}

      <section className="acct-quick" aria-label="Quick links">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="acct-quick__item">
            <span className="acct-quick__icon">
              <AccountIcon name={link.icon} size={22} />
            </span>
            <span>
              <strong>{link.title}</strong>
              <small>{link.text}</small>
            </span>
          </Link>
        ))}
        <a href={whatsapp} className="acct-quick__item" target="_blank" rel="noopener noreferrer">
          <span className="acct-quick__icon">
            <AccountIcon name="chat" size={22} />
          </span>
          <span>
            <strong>Need help?</strong>
            <small>Message us on WhatsApp</small>
          </span>
        </a>
      </section>
    </div>
  );
}
