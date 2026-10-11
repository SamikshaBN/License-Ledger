import { json, readJson, withAuth } from '@/lib/api';
import { query, withTx } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { parseId } from '@/lib/validate';

// Preview: what will be returned / freed
export const GET = withAuth(['admin', 'it_staff'], async (_req, ctx) => {
  const id = parseId((await ctx.params).employeeId, 'employeeId');
  const emp = (await query('SELECT employee_id, full_name, email, status FROM employee WHERE employee_id = $1', [id])).rows[0];
  if (!emp) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
  const assets = (await query(
    `SELECT asset_id, asset_tag, type, make_model FROM v_hardware_inventory WHERE employee_id = $1 ORDER BY asset_tag`, [id])).rows;
  const seats = (await query(
    `SELECT s.seat_id, sub.name AS subscription
       FROM seat_assignment s JOIN software_subscription sub ON sub.subscription_id = s.subscription_id
      WHERE s.employee_id = $1 AND s.revoked_at IS NULL ORDER BY sub.name`, [id])).rows;
  return json({ employee: emp, assets, seats });
});

// THE offboarding transaction: all steps commit together or not at all.
export const POST = withAuth(['admin', 'it_staff'], async (req, ctx, user) => {
  const id = parseId((await ctx.params).employeeId, 'employeeId');
  const body = await readJson(req).catch(() => ({}));
  if (id === user.employee_id) throw new ApiError(409, 'SELF_OFFBOARD', 'You cannot offboard your own account');

  const result = await withTx(user.id, async (c) => {
    // 1. lock the employee row so two offboards (or a concurrent assign) cannot interleave
    const emp = (await c.query('SELECT employee_id, full_name, status FROM employee WHERE employee_id = $1 FOR UPDATE', [id])).rows[0];
    if (!emp) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
    if (emp.status !== 'active') throw new ApiError(409, 'ALREADY_OFFBOARDED', 'Employee is already offboarded');

    // 2. return every open hardware assignment (trigger flips asset status back to available)
    const hw = await c.query(
      `UPDATE asset_assignment SET returned_at = now()
        WHERE employee_id = $1 AND returned_at IS NULL RETURNING assignment_id, asset_id`, [id]);

    // 3. free every software seat (SQL function owned by Person B; stub until then)
    const seats = (await c.query('SELECT release_all_seats($1) AS n', [id])).rows[0].n;

    // 4. mark employee offboarded and disable their login
    await c.query(`UPDATE employee SET status = 'offboarded', offboarded_at = now() WHERE employee_id = $1`, [id]);
    await c.query(`UPDATE app_user SET is_active = FALSE WHERE employee_id = $1`, [id]);

    // demo helper for the viva: prove ROLLBACK works (ignored in production)
    if (body?.simulateFailure === true && process.env.NODE_ENV !== 'production') {
      throw new ApiError(500, 'SIMULATED_FAILURE', 'Simulated failure: everything was rolled back');
    }
    return { employee_id: id, full_name: emp.full_name, assets_returned: hw.rowCount, seats_released: seats };
  });
  return json({ result });
});
