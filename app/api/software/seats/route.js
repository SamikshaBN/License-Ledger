import { query } from '@/lib/software/pg';
import { ok, fail, num } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// POST { subscription_id, employee_id } -> assign_seat() (row-locked, cannot oversell)
export async function POST(req) {
  try {
    await requireRole('admin', 'it_staff');
    const b = await req.json();
    const r = await query('SELECT assign_seat($1, $2) AS seat_assignment_id', [
      num(b.subscription_id, 'subscription_id', { int: true, min: 1 }),
      num(b.employee_id, 'employee_id', { int: true, min: 1 })]);
    return ok(r.rows[0], 201);
  } catch (e) { return fail(e); }
}

// DELETE /api/software/seats?id=123 -> revoke_seat()
export async function DELETE(req) {
  try {
    await requireRole('admin', 'it_staff');
    const id = num(new URL(req.url).searchParams.get('id'), 'id', { int: true, min: 1 });
    await query('SELECT revoke_seat($1)', [id]);
    return ok({ revoked: id });
  } catch (e) { return fail(e); }
}
