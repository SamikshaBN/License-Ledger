import { json, readJson, withAuth } from '@/lib/api';
import { pool, query } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { DB_ROLE } from '@/lib/dbroles';

// Live proof that the DATABASE enforces the roles: switch to the chosen role inside a transaction,
// try the action, then ROLLBACK (nothing is ever changed). Admin only.
export const POST = withAuth(['admin'], async (req) => {
  const { role, table, action } = await readJson(req);
  const dbRole = DB_ROLE[role];
  if (!dbRole) throw new ApiError(400, 'VALIDATION', 'Unknown role');
  if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(action)) throw new ApiError(400, 'VALIDATION', 'Unknown action');
  const known = (await query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'`)).rows.map((r) => r.relname);
  if (!known.includes(table)) throw new ApiError(400, 'VALIDATION', 'Unknown table');

  const client = await pool.connect();
  try {
    // for UPDATE pick a column the role can update (so column-level grants are respected)
    const col = (await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY has_column_privilege($2, format('public.%I', table_name), column_name, 'UPDATE') DESC, ordinal_position
        LIMIT 1`, [table, dbRole])).rows[0]?.column_name;
    const t = `public."${table}"`;
    const sql = {
      SELECT: `SELECT * FROM ${t} LIMIT 1`,
      INSERT: `INSERT INTO ${t} SELECT * FROM ${t} WHERE false`,
      UPDATE: `UPDATE ${t} SET "${col}" = "${col}" WHERE false`,
      DELETE: `DELETE FROM ${t} WHERE false`,
    }[action];
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${dbRole}`);
    try {
      await client.query(sql);
      return json({ allowed: true, role: dbRole, table, action, statement: sql });
    } catch (e) {
      if (e.code === '42501') return json({ allowed: false, role: dbRole, table, action, statement: sql, message: e.message });
      return json({ allowed: true, role: dbRole, table, action, statement: sql, message: 'Permission granted (the statement then stopped on a rule: ' + e.message + ')' });
    }
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
});
