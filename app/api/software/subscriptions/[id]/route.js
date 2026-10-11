import { query } from '@/lib/software/pg';
import { ok, fail, num, httpError } from '@/lib/software/http';
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
