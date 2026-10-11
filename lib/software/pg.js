import pg from 'pg';
// Falls back to PGHOST/PGPORT/... env vars when DATABASE_URL is not set.
const g = globalThis;
export const pool = g.__swPool ?? (g.__swPool = new pg.Pool({ connectionString: process.env.DATABASE_URL }));
export const query = (text, params) => pool.query(text, params);
