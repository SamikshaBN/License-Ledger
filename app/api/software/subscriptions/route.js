import { query } from '@/lib/software/pg';
import { ok, fail, num, str, date, tsQuery, httpError } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// GET /api/software/subscriptions?q=slack   (full-text search over product, plan and vendor name)
export async function GET(req) {
  try {
    await requireRole('admin', 'it_staff');
    const q = tsQuery(new URL(req.url).searchParams.get('q'));
    const r = await query(
      `SELECT u.*
         FROM v_subscription_utilization u
         JOIN software_subscription s ON s.subscription_id = u.subscription_id
         JOIN vendor v ON v.vendor_id = s.vendor_id
        WHERE $1::text IS NULL
           OR s.search_vector @@ to_tsquery('simple', $1)
           OR v.search_vector @@ to_tsquery('simple', $1)
        ORDER BY u.renewal_date`, [q]);
    return ok(r.rows);
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  try {
    await requireRole('admin');
    const b = await req.json();
    const cycle = str(b.billing_cycle, 'billing_cycle');
    if (!['monthly', 'annual'].includes(cycle)) throw httpError(400, 'billing_cycle is invalid');
    const r = await query(
      `INSERT INTO software_subscription
         (vendor_id, department_id, name, plan, cost_per_seat, billing_cycle, seat_limit, renewal_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active') RETURNING *`,
      [num(b.vendor_id, 'vendor_id', { int: true, min: 1 }), num(b.department_id, 'department_id', { int: true, min: 1 }),
       str(b.product_name, 'product_name'), str(b.plan, 'plan', { required: false }),
       num(b.cost_per_seat, 'cost_per_seat', { min: 0 }), cycle, num(b.seats_total, 'seats_total', { int: true, min: 1 }),
       date(b.renewal_date, 'renewal_date')]);
    return ok(r.rows[0], 201);
  } catch (e) { return fail(e); }
}
