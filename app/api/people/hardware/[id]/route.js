import { json, readJson, withAuth } from '@/lib/api';
import { withTx } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { buildUpdate } from '@/lib/sql';
import { parseId, validate } from '@/lib/validate';

// Edit details, or move an UNASSIGNED asset between available / repair / retired.
// 'assigned' is only ever set by the assignment trigger. Retiring is admin-only.
export const PATCH = withAuth(['admin', 'it_staff'], async (req, ctx, user) => {
  const id = parseId((await ctx.params).id);
  const d = validate(await readJson(req), {
    make_model: { type: 'string', max: 120 },
    purchase_cost: { type: 'number', min: 0, max: 1e8 },
    status: { type: 'enum', values: ['available', 'repair', 'retired'] },
  });
  if (d.status === 'retired' && user.role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', 'Only an admin can retire an asset');
  }
  const row = await withTx(user.id, async (c) => {
    const cur = (await c.query('SELECT status FROM hardware_asset WHERE asset_id = $1 FOR UPDATE', [id])).rows[0];
    if (!cur) throw new ApiError(404, 'NOT_FOUND', 'Asset not found');
    if (d.status && cur.status === 'assigned') {
      throw new ApiError(409, 'ASSET_ASSIGNED', 'Return the asset before changing its status');
    }
    if (d.status && cur.status === 'retired') {
      throw new ApiError(409, 'ASSET_RETIRED', 'Retired assets cannot change status');
    }
    const q = buildUpdate(d, 'hardware_asset', 'asset_id', id);
    return (await c.query(q.text, q.values)).rows[0];
  });
  return json({ asset: row });
});
