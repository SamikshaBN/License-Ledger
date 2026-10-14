// Run ONCE after seeding if your demo prices are still dollar-sized: npm run convert:inr
// Multiplies prices by RATE and sets invoice currency to INR. It refuses to run twice (it checks the seat prices).
import pg from 'pg';
import { MongoClient } from 'mongodb';

const RATE = 83;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query('SELECT coalesce(max(cost_per_seat), 0)::float AS m FROM software_subscription');
if (rows[0].m > 500) {
  console.log(`Seat prices already look like rupees (highest is ${rows[0].m}). Nothing changed.`);
  await pool.end();
  process.exit(0);
}
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query('UPDATE software_subscription SET cost_per_seat = round(cost_per_seat * $1::numeric)', [RATE]);
  await c.query('UPDATE renewal SET amount = round(amount * $1::numeric)', [RATE]);
  await c.query('UPDATE hardware_asset SET purchase_cost = round(purchase_cost * $1::numeric)', [RATE]);
  await c.query('UPDATE department_budget SET hardware_budget = round(hardware_budget * $1::numeric), software_budget = round(software_budget * $1::numeric)', [RATE]);
  await c.query('COMMIT');
  console.log('PostgreSQL prices converted.');
} catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); await pool.end(); }

if (process.env.MONGODB_URI) {
  const mongo = await new MongoClient(process.env.MONGODB_URI).connect();
  const col = mongo.db(process.env.MONGODB_DB || 'licenseledger').collection('invoices');
  const r = await col.updateMany({ currency: { $ne: 'INR' } },
    [{ $set: { total: { $round: [{ $multiply: ['$total', RATE] }, 2] }, currency: 'INR' } }]);
  console.log(`MongoDB invoices converted: ${r.modifiedCount}`);
  await mongo.close();
}
