import pg from 'pg';
import { cookies } from 'next/headers';
import { COOKIE, verifyToken } from './auth.js';
import { DB_ROLE, roleUrl } from './dbroles.js';
import { ApiError } from './errors.js';

// Who is making this request?
//   - inside a web request  -> { dbRole, userId, employeeId } taken from the signed login cookie
//   - not in a web request  -> null (seed script, tests): the owner account is used as before
// Inside a request with no valid login this throws 401, so a request can never fall back to the owner account by accident.
export async function currentCaller() {
  let jar;
  try {
    jar = await cookies();
  } catch (e) {
    if (String(e?.digest ?? '').startsWith('DYNAMIC_SERVER')) throw e; // Next.js build-time signal, not ours to swallow
    return null;
  }
  const token = jar.get(COOKIE)?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) throw new ApiError(401, 'UNAUTHENTICATED', 'Please log in');
  const dbRole = DB_ROLE[payload.role];
  if (!dbRole) throw new ApiError(403, 'FORBIDDEN', 'Your role has no database role');
  return { dbRole, userId: Number(payload.sub), employeeId: payload.employee_id };
}

// One connection pool per database role. A connection in the ll_it_staff pool is LOGGED IN to PostgreSQL
// as ll_it_staff (not a superuser that switched role), so it can never escalate.
const g = globalThis;
export function rolePool(dbRole) {
  g._llRolePools ??= {};
  return (g._llRolePools[dbRole] ??= new pg.Pool({ connectionString: roleUrl(dbRole), max: 5 }));
}

// Must be called right after BEGIN. Transaction-local settings that the audit trigger and the
// employee row-level-security policies read; they vanish at COMMIT, so nothing leaks between users.
export async function applyCaller(client, who) {
  await client.query(
    `SELECT set_config('app.employee_id', $1, true), set_config('app.user_id', $2, true)`,
    [who.employeeId == null ? '' : String(who.employeeId), String(who.userId)]);
}

// One statement, run on a connection that is logged in as the caller's database role
// (used by lib/db.js and lib/software/pg.js). Without a logged-in caller (scripts) the owner pool is used.
export async function runQuery(ownerPool, config) {
  const who = await currentCaller();
  if (!who) return ownerPool.query(config);
  const client = await rolePool(who.dbRole).connect();
  try {
    await client.query('BEGIN');
    await applyCaller(client, who);
    const result = await client.query(config);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
