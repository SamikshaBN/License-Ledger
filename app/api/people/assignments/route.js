import { json, readJson, withAuth } from '@/lib/api';
import { withTx } from '@/lib/db';
import { validate } from '@/lib/validate';

// The BEFORE INSERT trigger locks the asset row and rejects non-available assets and
// inactive employees; the partial unique index is the backstop for races.
export const POST = withAuth(['admin', 'it_staff'], async (req, _ctx, user) => {
  const d = validate(await readJson(req), {
    asset_id: { type: 'int', required: true, min: 1 },
    employee_id: { type: 'int', required: true, min: 1 },
  });
  const row = await withTx(user.id, async (c) =>
    (await c.query(
      `INSERT INTO asset_assignment(asset_id, employee_id, assigned_by) VALUES ($1,$2,$3) RETURNING *`,
      [d.asset_id, d.employee_id, user.id])).rows[0]);
  return json({ assignment: row }, 201);
});
