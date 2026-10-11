import fs from 'node:fs';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(fs.readFileSync('db/02_software.sql', 'utf8'));
  console.log('db/02_software.sql applied');
} catch (e) {
  console.error('Failed:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
