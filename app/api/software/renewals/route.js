import { query } from '@/lib/software/pg';
import { ok, fail, num, date } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// GET /api/software/renewals?days=30 -> forecast, plus renewal history
export async function GET(req) {
  try {
    await requireRole('admin', 'it_staff');
    const sp = new URL(req.url).searchParams;
    const days = num(sp.get('days') ?? 30, 'days', { int: true, min: 1 });
    const upcoming = await query(
      'SELECT * FROM v_renewal_forecast WHERE days_until <= $1 ORDER BY renewal_date', [days]);
    const history = await query(
      `SELECT r.renewal_id, r.subscription_id, r.renewal_date, r.amount, r.status, s.name AS product_name
         FROM renewal r JOIN software_subscription s ON s.subscription_id = r.subscription_id
        ORDER BY r.renewal_id DESC LIMIT 20`);
    return ok({ upcoming: upcoming.rows, history: history.rows });
  } catch (e) { return fail(e); }
}

export async function POST(req) {
  try {
    await requireRole('admin');
    const b = await req.json();
    const r = await query('SELECT renew_subscription($1, $2::date, $3) AS renewal_id', [
      num(b.subscription_id, 'subscription_id', { int: true, min: 1 }),
      date(b.new_renewal_date, 'new_renewal_date'), num(b.amount_paid, 'amount_paid', { min: 0 })]);
    return ok(r.rows[0], 201);
  } catch (e) { return fail(e); }
}
