// Evidence for the report: EXPLAIN ANALYZE of full-text search before and after a GIN index (100k scratch rows).
import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const show = async (label) => {
  const r = await client.query(`EXPLAIN ANALYZE SELECT count(*) FROM search_demo WHERE search_vector @@ to_tsquery('simple','figma:*')`);
  console.log(`\n=== ${label} ===\n` + r.rows.map(x => x['QUERY PLAN']).join('\n'));
};
try {
  await client.query('DROP TABLE IF EXISTS search_demo');
  await client.query(`CREATE TABLE search_demo AS
    SELECT g AS id, (CASE WHEN g % 500 = 0 THEN 'Figma' ELSE 'Tool' || (g % 50) END) || ' plan ' || md5(g::text) AS product_name
    FROM generate_series(1, 100000) g`);
  await client.query(`ALTER TABLE search_demo ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', product_name)) STORED`);
  await client.query('ANALYZE search_demo');
  await show('BEFORE index (expect Seq Scan)');
  await client.query('CREATE INDEX idx_search_demo ON search_demo USING GIN (search_vector)');
  await client.query('ANALYZE search_demo');
  await show('AFTER GIN index (expect Bitmap Index Scan)');
} finally {
  await client.query('DROP TABLE IF EXISTS search_demo');
  await client.end();
}
