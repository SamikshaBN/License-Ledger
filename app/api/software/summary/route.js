import { query } from '@/lib/software/pg';
import { ok, fail } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// Annual plans are converted to a monthly equivalent so the totals are comparable.
const M = (col) => `CASE WHEN billing_cycle = 'annual' THEN ${col} / 12 ELSE ${col} END`;

export async function GET() {
  try {
    await requireRole('admin', 'it_staff');
    const [totals, topWaste, soon, soonCount, departed] = await Promise.all([
      query(`SELECT count(*)::int AS subscriptions,
                    coalesce(sum(seats_total), 0)::int AS seats_total,
                    coalesce(sum(seats_used), 0)::int AS seats_used,
                    coalesce(sum(seats_unused), 0)::int AS seats_unused,
                    coalesce(sum(${M('cost_per_cycle')}), 0) AS monthly_spend,
                    coalesce(sum(${M('wasted_per_cycle')}), 0) AS monthly_waste
               FROM v_subscription_utilization WHERE status = 'active'`),
      query(`SELECT subscription_id, product_name, vendor_name, seats_used, seats_total,
                    ${M('wasted_per_cycle')} AS monthly_waste
               FROM v_subscription_utilization
              WHERE status = 'active' AND seats_unused > 0
              ORDER BY monthly_waste DESC LIMIT 5`),
      query(`SELECT product_name, vendor_name, renewal_date, days_until, cost_per_cycle, billing_cycle
               FROM v_renewal_forecast WHERE days_until <= 30 ORDER BY renewal_date LIMIT 5`),
      query('SELECT count(*)::int AS n FROM v_renewal_forecast WHERE days_until <= 30'),
      query('SELECT count(*)::int AS n FROM v_departed_seats'),
    ]);
    return ok({
      totals: totals.rows[0], topWaste: topWaste.rows, renewingSoon: soon.rows,
      renewingCount: soonCount.rows[0].n, departedSeats: departed.rows[0].n,
    });
  } catch (e) { return fail(e); }
}
