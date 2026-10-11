import { json, readJson, withAuth } from '@/lib/api';
import { query, withTx } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { buildUpdate } from '@/lib/sql';
import { parseId, validate } from '@/lib/validate';

export const GET = withAuth(['admin', 'it_staff'], async (_req, ctx) => {
  const id = parseId((await ctx.params).id);
  const emp = (await query(
    `SELECT e.*, d.name AS department_name FROM employee e
       LEFT JOIN department d ON d.department_id = e.department_id WHERE e.employee_id = $1`, [id])).rows[0];
  if (!emp) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
  const assets = (await query(`SELECT * FROM v_hardware_inventory WHERE employee_id = $1 ORDER BY asset_tag`, [id])).rows;
  const history = (await query(
    `SELECT a.assignment_id, h.asset_tag, h.make_model, a.assigned_at, a.returned_at
       FROM asset_assignment a JOIN hardware_asset h ON h.asset_id = a.asset_id
      WHERE a.employee_id = $1 ORDER BY a.assigned_at DESC`, [id])).rows;
  return json({ employee: emp, assets, history });
});

// status is NOT editable here: it only changes through the offboarding transaction.
export const PATCH = withAuth(['admin', 'it_staff'], async (req, ctx, user) => {
  const id = parseId((await ctx.params).id);
  const data = validate(await readJson(req), {
    full_name: { type: 'string', max: 120 },
    email: { type: 'email', max: 200 },
    department_id: { type: 'int', min: 1 },
    job_title: { type: 'string', max: 100 },
  });
  const q = buildUpdate(data, 'employee', 'employee_id', id);
  const row = await withTx(user.id, async (c) => (await c.query(q.text, q.values)).rows[0]);
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
  return json({ employee: row });
});
