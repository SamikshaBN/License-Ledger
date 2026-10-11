import { query } from '@/lib/software/pg';
import { ok, fail } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

export async function GET() {
  try {
    await requireRole('admin', 'it_staff');
    // GROUP BY + HAVING over the utilization view
    const byDepartment = await query(
      `SELECT coalesce(department_name, 'Unassigned') AS department, count(*)::int AS subscriptions,
              sum(seats_unused)::int AS unused_seats, sum(wasted_per_cycle) AS wasted
         FROM v_subscription_utilization WHERE status = 'active'
        GROUP BY department_name HAVING sum(seats_unused) > 0 ORDER BY wasted DESC`);
    // Subquery: utilization below the overall average
    const underused = await query(
      `SELECT subscription_id, product_name, vendor_name, seats_used, seats_total, wasted_per_cycle, billing_cycle
         FROM v_subscription_utilization
        WHERE status = 'active'
          AND seats_used::numeric / seats_total <
              (SELECT avg(seats_used::numeric / seats_total) FROM v_subscription_utilization WHERE status = 'active')
        ORDER BY wasted_per_cycle DESC`);
    const departed = await query('SELECT * FROM v_departed_seats ORDER BY full_name');
    const totals = await query(
      `SELECT coalesce(sum(wasted_per_cycle),0) AS wasted, coalesce(sum(cost_per_cycle),0) AS spend
         FROM v_subscription_utilization WHERE status = 'active'`);
    return ok({ totals: totals.rows[0], byDepartment: byDepartment.rows, underused: underused.rows, departedSeats: departed.rows });
  } catch (e) { return fail(e); }
}
