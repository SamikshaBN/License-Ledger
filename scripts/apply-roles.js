// Creates the database roles and grants (db/roles/roles.sql). Safe to run repeatedly.
// Runs automatically before `npm run dev`; it never blocks startup if the database is not ready.
import fs from 'node:fs';
import pg from 'pg';
import { DB_ROLE, rolePassword } from '../lib/dbroles.js';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(fs.readFileSync('db/roles/roles.sql', 'utf8'));
  // make the three roles real logins (the app opens one connection pool per role)
  for (const role of Object.values(DB_ROLE)) {
    const { rows } = await client.query("SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS stmt", [role, rolePassword()]);
    await client.query(rows[0].stmt);
  }
  const { rows } = await client.query("SELECT rolname FROM pg_roles WHERE rolname LIKE 'll\\_%' ORDER BY rolname");
  console.log('Database roles ready: ' + rows.map((r) => r.rolname).join(', '));
} catch (e) {
  console.warn('Database roles NOT applied: ' + e.message);
  console.warn('Start the databases (docker compose up -d), load the schema and run: npm run db:roles');
} finally {
  await client.end().catch(() => {});
}
