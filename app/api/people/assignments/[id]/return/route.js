import { json, readJson, withAuth } from '@/lib/api';
import { withTx } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { parseId, validate } from '@/lib/validate';

// condition 'ok' -> asset becomes available (trigger); 'repair' -> available, then set to repair.
export const POST = withAuth(['admin', 'it_staff'], async (req, ctx, user) => {
  const id = parseId((await ctx.params).id);
  const body = await readJson(req).catch(() => ({}));
  const { condition } = validate(body, { condition: { type: 'enum', values: ['ok', 'repair'] } });
  const row = await withTx(user.id, async (c) => {
    const r = (await c.query(
      `UPDATE asset_assignment SET returned_at = now()
        WHERE assignment_id = $1 AND returned_at IS NULL RETURNING *`, [id])).rows[0];
    if (!r) throw new ApiError(409, 'NOT_OPEN', 'Assignment not found or already returned');
    if (condition === 'repair') {
      await c.query(`UPDATE hardware_asset SET status = 'repair' WHERE asset_id = $1`, [r.asset_id]);
    }
    return r;
  });
  return json({ assignment: row });
});
