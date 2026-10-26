import { json, withAuth } from '@/lib/api';
import { query } from '@/lib/db';
import { DB_ROLE, PAGES } from '@/lib/dbroles';

const ACTIONS = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

// Everything below is read live from the PostgreSQL catalog, so the page always shows what the database really enforces.
export const GET = withAuth(null, async (_req, _ctx, user) => {
  const roleNames = Object.values(DB_ROLE);
  const roles = (await query(
    `SELECT r.rolname AS name, shobj_description(r.oid, 'pg_authid') AS description
       FROM pg_roles r WHERE r.rolname = ANY($1::text[]) ORDER BY r.rolname`, [roleNames])).rows;
  // current_user is what PostgreSQL itself reports for this very request: proof that the login switched the database role
  const session_role = (await query('SELECT current_user AS name')).rows[0].name;
  const me = { username: user.username, app_role: user.role, db_role: DB_ROLE[user.role], session_role, pages: PAGES[user.role] ?? [] };
  if (roles.length < roleNames.length) {
    return json({ ready: false, missing: roleNames.filter((n) => !roles.some((r) => r.name === n)), me });
  }

  const rows = (await query(
    `SELECT c.relname AS name, c.relkind AS kind, c.relrowsecurity AS rls, r.rolname AS role, a.action,
            has_table_privilege(r.rolname, c.oid, a.action) AS tbl,
            CASE WHEN a.action = 'DELETE' THEN false ELSE has_any_column_privilege(r.rolname, c.oid, a.action) END AS anycol
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       CROSS JOIN pg_roles r
       CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) AS a(action)
      WHERE n.nspname = 'public' AND c.relkind IN ('r','v') AND r.rolname = ANY($1::text[])
      ORDER BY c.relkind, c.relname`, [roleNames])).rows;

  const tables = [];
  const byName = new Map();
  for (const r of rows) {
    if (!byName.has(r.name)) {
      const t = { name: r.name, kind: r.kind === 'r' ? 'table' : 'view', rls: r.rls, roles: {} };
      byName.set(r.name, t); tables.push(t);
    }
    const t = byName.get(r.name);
    t.roles[r.role] ??= {};
    t.roles[r.role][r.action] = r.tbl ? 'full' : r.anycol ? 'partial' : 'none';
  }
  const mine = tables
    .map((t) => ({ name: t.name, kind: t.kind, rls: t.rls, ...t.roles[me.db_role] }))
    .filter((t) => ACTIONS.some((a) => t[a] && t[a] !== 'none'));

  const staff = user.role === 'admin' || user.role === 'it_staff';
  if (!staff) return json({ ready: true, me: { ...me, privileges: mine } });

  const functions = (await query(
    `SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS args, r.rolname AS role,
            has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS allowed
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       CROSS JOIN pg_roles r
      WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prorettype <> 'trigger'::regtype AND r.rolname = ANY($1::text[])
      ORDER BY p.proname, r.rolname`, [roleNames])).rows;
  const fnMap = new Map();
  for (const f of functions) {
    const key = `${f.name}(${f.args})`;
    if (!fnMap.has(key)) fnMap.set(key, { signature: key, roles: {} });
    fnMap.get(key).roles[f.role] = f.allowed;
  }
  const policies = (await query(
    `SELECT tablename AS table, policyname AS name, cmd, roles::text AS roles, qual AS rule
       FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname`)).rows;

  return json({
    ready: true, me: { ...me, privileges: mine }, roles, tables,
    functions: [...fnMap.values()], policies,
    mapping: Object.entries(DB_ROLE).map(([app_role, db_role]) => ({ app_role, db_role })),
  });
});
