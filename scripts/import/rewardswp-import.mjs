/**
 * RewardsWP Pro's data (members, points, referrals, referral rewards) into the rewards tables (migration 0010).
 * Reads the plugin's tables from a MySQL dump (scripts/import/mysqldump.mjs); matches people by WordPress user
 * ID (users.legacy_wp_user_id) and orders by WordPress order ID (orders.legacy_wc_order_id), so run the main
 * import first. Safe to run again: everything it writes carries RewardsWP's own ID and is skipped the second time.
 *
 *   * a member keeps their referral code (links already shared at /share/<code>/ keep working) and their join date;
 *   * approved points become ledger rows: "signup" points are the welcome credits, "purchase" points are
 *     `migration` rows linked to their order (so the order's credits are never given twice);
 *   * pending purchase points wait for the order to be completed: when the order is already completed here, the
 *     credits are worked out now by the programme's own rule (1 per Rp 10,000 of the order's product lines);
 *   * points expire in RewardsWP ("+3 months") but not under the published terms: they are imported without expiry;
 *   * a referral keeps its friend's e-mail and the friend's coupon code, so when that coupon is used on an order
 *     that is completed, the member gets their reward like any other referral.
 * Prints counts only (importRewardsWp returns them).
 */
const TABLES = ["wp_rewardswp_members", "wp_rewardswp_points", "wp_rewardswp_referrals", "wp_rewardswp_rewards", "wp_rewardswp_rewardmeta"];
export const REWARDSWP_TABLES = TABLES;

/** MySQL's "2026-10-28 19:51:19" (no zone, as WordPress writes it) read as UTC; "0000-00-00 00:00:00" is no date. */
export function mysqlDate(value) {
  if (!value || value.startsWith("0000-00-00")) return null;
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Credits for Rp 10,000 of spend, in minor units: the same rule as src/lib/loyalty/rules.ts. */
const CREDIT_SPEND_MINOR = 1_000_000n;

export async function importRewardsWp(tables, db) {
  const summary = {
    members: { inFile: tables.wp_rewardswp_members.rows.length, imported: 0, alreadyThere: 0, noAccount: 0 },
    points: { inFile: tables.wp_rewardswp_points.rows.length, imported: 0, alreadyThere: 0, noMember: 0, pendingCreditedNow: 0, pendingWaiting: 0, orderNotFound: 0 },
    referrals: { inFile: tables.wp_rewardswp_referrals.rows.length, imported: 0, alreadyThere: 0, noMember: 0, couponsLinked: 0 },
    reconciliation: [],
  };
  const metaByReward = new Map();
  for (const meta of tables.wp_rewardswp_rewardmeta.rows) metaByReward.set(`${meta.reward_id}:${meta.meta_key}`, meta.meta_value);

  await db.run(async (q) => {
    /** WordPress member ID → this site's user ID. */
    const userOfMember = new Map();

    for (const member of tables.wp_rewardswp_members.rows) {
      const [user] = member.user_id && member.user_id !== "0" ? await q("SELECT id FROM users WHERE legacy_wp_user_id = $1", [Number(member.user_id)]) : [];
      if (!user) {
        summary.members.noAccount++;
        continue;
      }
      userOfMember.set(member.id, user.id);
      const [there] = await q("SELECT 1 FROM loyalty_members WHERE user_id = $1", [user.id]);
      if (there) {
        summary.members.alreadyThere++;
        continue;
      }
      await q("INSERT INTO loyalty_members (user_id, referral_code, joined_at, legacy_rewardswp_member_id) VALUES ($1, $2, $3, $4)", [
        user.id,
        member.referral_code,
        mysqlDate(member.created_at) ?? new Date(),
        Number(member.id),
      ]);
      summary.members.imported++;
    }

    for (const point of tables.wp_rewardswp_points.rows) {
      const userId = userOfMember.get(point.member_id);
      if (!userId) {
        summary.points.noMember++;
        continue;
      }
      const reason = `RewardsWP points #${point.id}`;
      const [there] = await q("SELECT 1 FROM loyalty_transactions WHERE user_id = $1 AND reason = $2", [userId, reason]);
      if (there) {
        summary.points.alreadyThere++;
        continue;
      }
      const credits = Number(point.points);
      const createdAt = mysqlDate(point.created_at) ?? new Date();
      const [order] = point.source_type === "purchase" && point.source_id ? await q("SELECT id, status FROM orders WHERE legacy_wc_order_id = $1", [Number(point.source_id)]) : [];

      if (point.status === "approved") {
        if (point.source_type === "signup") {
          const [welcome] = await q("SELECT 1 FROM loyalty_transactions WHERE user_id = $1 AND source = 'welcome'", [userId]);
          if (welcome) {
            summary.points.alreadyThere++;
            continue;
          }
          await q("INSERT INTO loyalty_transactions (user_id, type, credits, source, reason, created_at) VALUES ($1, 'earn', $2, 'welcome', $3, $4)", [userId, credits, reason, createdAt]);
        } else {
          if (point.source_type === "purchase" && !order) summary.points.orderNotFound++;
          await q("INSERT INTO loyalty_transactions (user_id, type, credits, source, order_id, reason, created_at) VALUES ($1, 'migration', $2, 'import', $3, $4, $5)", [userId, credits, order?.id ?? null, reason, createdAt]);
        }
        summary.points.imported++;
      } else if (point.status === "pending" && point.source_type === "purchase") {
        // Pending until the order is completed: credited now if it already is, else the programme does it when it completes.
        if (order?.status === "completed") {
          const [spend] = await q("SELECT coalesce(sum(line_total_minor), 0)::text AS total FROM order_items WHERE order_id = $1", [order.id]);
          const earned = Number(BigInt(spend.total) / CREDIT_SPEND_MINOR);
          if (earned > 0) {
            await q("INSERT INTO loyalty_transactions (user_id, type, credits, source, order_id, reason, created_at) VALUES ($1, 'earn', $2, 'order', $3, $4, now())", [userId, earned, order.id, reason]);
          }
          summary.points.pendingCreditedNow++;
        } else {
          // Leave a marker row of 0 credits so running the import again doesn't count it twice.
          await q("INSERT INTO loyalty_transactions (user_id, type, credits, source, order_id, reason, created_at) VALUES ($1, 'migration', 0, 'import', $2, $3, $4)", [userId, order?.id ?? null, reason, createdAt]);
          summary.points.pendingWaiting++;
        }
      }
    }

    for (const referral of tables.wp_rewardswp_referrals.rows) {
      const referrerId = userOfMember.get(referral.advocate_id);
      if (!referrerId) {
        summary.referrals.noMember++;
        continue;
      }
      const [there] = await q("SELECT 1 FROM loyalty_referrals WHERE legacy_rewardswp_referral_id = $1", [Number(referral.id)]);
      if (there) {
        summary.referrals.alreadyThere++;
        continue;
      }
      const rewards = tables.wp_rewardswp_rewards.rows.filter((reward) => reward.referral_id === referral.id);
      const codeOf = (type) => {
        const reward = rewards.find((r) => r.recipient_type === type);
        return reward ? (metaByReward.get(`${reward.id}:coupon_code`) ?? null) : null;
      };
      const friendCode = codeOf("friend");
      const advocateCode = codeOf("advocate");
      const status = referral.status === "pending" ? "pending" : referral.status === "converted" || referral.status === "completed" ? "rewarded" : "rejected";
      await q(
        `INSERT INTO loyalty_referrals (referrer_user_id, referred_email, status, friend_coupon_code, reward_coupon_code, legacy_rewardswp_referral_id, converted_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [referrerId, referral.referred_email ? referral.referred_email.trim().toLowerCase() : null, status, friendCode, advocateCode, Number(referral.id), mysqlDate(referral.converted_at), mysqlDate(referral.created_at) ?? new Date()],
      );
      summary.referrals.imported++;
      // The coupons RewardsWP made are already in `coupons` (the WooCommerce import): mark them as reward coupons.
      for (const code of [friendCode, advocateCode].filter(Boolean)) {
        const done = await q("UPDATE coupons SET source = 'rewards_referral', updated_at = now() WHERE lower(code) = $1 RETURNING id", [code.toLowerCase()]);
        summary.referrals.couponsLinked += done.length;
      }
    }

    // Each member's approved credits against RewardsWP's own balance column.
    for (const member of tables.wp_rewardswp_members.rows) {
      const userId = userOfMember.get(member.id);
      if (!userId) continue;
      const [ledger] = await q("SELECT coalesce(sum(credits), 0)::int AS total FROM loyalty_transactions WHERE user_id = $1 AND reason LIKE 'RewardsWP points #%' AND type IN ('earn', 'migration') AND source IN ('welcome', 'import')", [userId]);
      const approved = tables.wp_rewardswp_points.rows.filter((p) => p.member_id === member.id && p.status === "approved").reduce((sum, p) => sum + Number(p.points), 0);
      summary.reconciliation.push({ memberId: member.id, legacyBalance: Number(member.points_balance), approvedPoints: approved, importedCredits: ledger.total, ok: Number(member.points_balance) === approved && approved === ledger.total });
    }
  });
  return summary;
}
