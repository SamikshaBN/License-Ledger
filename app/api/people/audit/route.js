import { json, withAuth } from '@/lib/api';
import { query } from '@/lib/db';
import { parsePaging } from '@/lib/validate';

export const GET = withAuth(['admin'], async (req) => {
  const sp = new URL(req.url).searchParams;
  const table = sp.get('table') || null;
  const action = sp.get('action') || null;
  const { limit, offset, page } = parsePaging(sp);
  const where = `($1::text IS NULL OR l.table_name = $1) AND ($2::text IS NULL OR l.action = $2)`;
  const total = (await query(`SELECT count(*)::int AS n FROM audit_log l WHERE ${where}`, [table, action])).rows[0].n;
  const { rows } = await query(
    `SELECT l.log_id, l.table_name, l.record_id, l.action, l.old_data, l.new_data, l.changed_at,
            u.username AS changed_by
       FROM audit_log l LEFT JOIN app_user u ON u.user_id = l.changed_by
      WHERE ${where} ORDER BY l.log_id DESC LIMIT $3 OFFSET $4`, [table, action, limit, offset]);
  return json({ logs: rows, total, page, limit });
});
