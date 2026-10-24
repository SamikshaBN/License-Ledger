import pg from 'pg';
// Falls back to PGHOST/PGPORT/... env vars when DATABASE_URL is not set.
const g = globalThis;
export const pool = g.__swPool ?? (g.__swPool = new pg.Pool({ connectionString: process.env.DATABASE_URL }));

// DATE columns come back as plain 'YYYY-MM-DD' strings. The default parser builds a JS Date at local midnight,
// which JSON turns into the previous day on servers east of UTC (for example India).
const types = { getTypeParser: (oid, format) => (oid === 1082 ? (v) => v : pg.types.getTypeParser(oid, format)) };
export const query = (text, params) => pool.query({ text, values: params, types });
