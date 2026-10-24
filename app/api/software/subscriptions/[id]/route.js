import { query } from '@/lib/software/pg';
import { ok, fail, num, str, date, optInt, httpError } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

export async function GET(_req, { params }) {
  try {
    await requireRole('admin', 'it_staff');
    const id = num((await params).id, 'id', { int: true, min: 1 });
    const sub = await query('SELECT * FROM v_subscription_utilization WHERE subscription_id = $1', [id]);
    if (!sub.rows.length) throw httpError(404, 'Subscription not found');
    const seats = await query(
      `SELECT sa.seat_id AS seat_assignment_id, sa.employee_id, e.full_name, e.status AS employee_status, sa.assigned_at
         FROM seat_assignment sa JOIN employee e ON e.employee_id = sa.employee_id
        WHERE sa.subscription_id = $1 AND sa.revoked_at IS NULL ORDER BY sa.assigned_at`, [id]);
    return ok({ subscription: sub.rows[0], seats: seats.rows });
  } catch (e) { return fail(e); }
}

// PATCH { status: 'paused' | 'active' | 'cancelled' }  -> set_subscription_status()
// PATCH { product_name, plan, seats_total, cost_per_seat, billing_cycle, renewal_date, department_id? } -> update_subscription()
// Admin only.
export async function PATCH(req, { params }) {
  try {
    await requireRole('admin');
    const id = num((await params).id, 'id', { int: true, min: 1 });
    const b = await req.json();
    let released = null;
    if (b.status !== undefined) {
      const status = str(b.status, 'status');
      if (!['active', 'paused', 'cancelled'].includes(status)) throw httpError(400, 'status is invalid');
      released = (await query('SELECT set_subscription_status($1::int, $2::text) AS released', [id, status])).rows[0].released;
    } else {
      const cycle = str(b.billing_cycle, 'billing_cycle');
      if (!['monthly', 'annual'].includes(cycle)) throw httpError(400, 'billing_cycle is invalid');
      await query('SELECT update_subscription($1::int, $2::text, $3::text, $4::int, $5::numeric, $6::text, $7::date, $8::int)', [
        id, str(b.product_name, 'product_name'), str(b.plan, 'plan', { required: false }),
        num(b.seats_total, 'seats_total', { int: true, min: 1 }), num(b.cost_per_seat, 'cost_per_seat', { min: 0 }),
        cycle, date(b.renewal_date, 'renewal_date'), optInt(b.department_id, 'department_id')]);
    }
    const r = await query('SELECT * FROM v_subscription_utilization WHERE subscription_id = $1', [id]);
    return ok({ subscription: r.rows[0], seats_released: released });
  } catch (e) { return fail(e); }
}
