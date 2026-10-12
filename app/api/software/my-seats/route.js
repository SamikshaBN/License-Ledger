import { query } from '@/lib/software/pg';
import { ok, fail, num } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// Open to every role, but ONLY ever returns the caller's own seats:
// the employee_id comes from the signed login token, never from the request.
export async function GET() {
  try {
    const me = await requireRole('admin', 'it_staff', 'employee');
    const employeeId = num(me.employee_id, 'employee_id', { int: true, min: 1 });
    const r = await query(
      `SELECT sa.seat_id, s.name AS product_name, s.plan, v.name AS vendor_name,
              s.cost_per_seat, s.billing_cycle, s.renewal_date, s.status, sa.assigned_at
         FROM seat_assignment sa
         JOIN software_subscription s ON s.subscription_id = sa.subscription_id
         JOIN vendor v ON v.vendor_id = s.vendor_id
        WHERE sa.employee_id = $1 AND sa.revoked_at IS NULL
        ORDER BY s.name`, [employeeId]);
    return ok(r.rows);
  } catch (e) { return fail(e); }
}
