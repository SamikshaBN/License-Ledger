import pg from 'pg';
import { applyCaller, currentCaller, rolePool, runQuery } from './dbrole.js';

const g = globalThis; // survive hot reload in dev
export const pool = g._pgPool ?? (g._pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL }));

// Runs on a connection logged in as the user's PostgreSQL role (ll_admin / ll_it_staff / ll_employee), see lib/dbrole.js.
export const query = (text, params) => runQuery(pool, { text, values: params });

// Runs as the owner account. ONLY for code that has no logged-in user yet (the login route).
export const ownerQuery = (text, params) => pool.query(text, params);

// Runs fn(client) inside BEGIN ... COMMIT. On any error: ROLLBACK and rethrow.
// Stores the acting user id in a transaction-local setting so the audit triggers can fill
// AUDIT_LOG.changed_by, and uses the connection pool of the caller's database role.
export async function withTx(userId, fn) {
  const who = await currentCaller();
  const client = await (who ? rolePool(who.dbRole) : pool).connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId == null ? '' : String(userId)]);
    if (who) await applyCaller(client, who);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
