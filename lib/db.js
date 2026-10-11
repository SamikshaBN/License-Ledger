import pg from 'pg';

const g = globalThis; // survive hot reload in dev
export const pool = g._pgPool ?? (g._pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL }));

export const query = (text, params) => pool.query(text, params);

// Runs fn(client) inside BEGIN ... COMMIT. On any error: ROLLBACK and rethrow.
// Also stores the acting user id in a transaction-local setting so the audit
// triggers can fill AUDIT_LOG.changed_by.
export async function withTx(userId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId == null ? '' : String(userId)]);
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
