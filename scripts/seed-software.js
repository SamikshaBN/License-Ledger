import pg from 'pg';
import { MongoClient } from 'mongodb';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (t, p) => pool.query(t, p);

const depts = (await q('SELECT department_id FROM department ORDER BY department_id LIMIT 3')).rows;
if (!depts.length) throw new Error("No departments found. Run 'npm run db:seed' (Person A's data) first.");
const employees = (await q("SELECT employee_id FROM employee WHERE status='active' ORDER BY employee_id LIMIT 12")).rows;

const vendors = [
  ['Slack', 'https://slack.com', 'billing@slack.example'],
  ['Figma', 'https://figma.com', 'billing@figma.example'],
  ['Atlassian', 'https://atlassian.com', 'billing@atlassian.example'],
  ['Zoom', 'https://zoom.us', 'billing@zoom.example'],
  ['Notion', 'https://notion.so', 'billing@notion.example'],
];
for (const [n, w, e] of vendors)
  await q(`INSERT INTO vendor (name, website, contact_email)
           SELECT $1::text, $2::text, $3::text WHERE NOT EXISTS (SELECT 1 FROM vendor WHERE lower(name) = lower($1::text))`, [n, w, e]);

// vendor, product, plan, cost/seat, cycle, seats, renewal in N days
const subs = [
  ['Slack', 'Slack Business+', 'Business+', 12.5, 'monthly', 10, 12],
  ['Figma', 'Figma Professional', 'Professional', 15, 'monthly', 6, 25],
  ['Atlassian', 'Jira Software', 'Standard', 8.15, 'monthly', 8, 60],
  ['Zoom', 'Zoom Workplace', 'Business', 18, 'monthly', 5, 5],
  ['Notion', 'Notion Team', 'Team', 10, 'monthly', 4, 90],
];
const created = [];
for (const [i, [vname, product, plan, cost, cycle, seats, days]] of subs.entries()) {
  const v = (await q('SELECT vendor_id FROM vendor WHERE lower(name)=lower($1)', [vname])).rows[0];
  let s = (await q('SELECT subscription_id, seat_limit FROM software_subscription WHERE vendor_id=$1 AND name=$2', [v.vendor_id, product])).rows[0];
  if (!s) {
    s = (await q(
      `INSERT INTO software_subscription (vendor_id, department_id, name, plan, cost_per_seat, billing_cycle, seat_limit, renewal_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7, current_date + $8::int, 'active') RETURNING subscription_id, seat_limit`,
      [v.vendor_id, depts[i % depts.length].department_id, product, plan, cost, cycle, seats, days])).rows[0];
  }
  created.push({ ...s, vendor_id: v.vendor_id, vendor_name: vname, cost, seats });
  // fill roughly 60% of seats through the stored procedure
  const target = Math.min(employees.length, Math.floor(seats * 0.6));
  for (const e of employees.slice(0, target)) {
    try { await q('SELECT assign_seat($1,$2)', [s.subscription_id, e.employee_id]); } catch { /* already assigned */ }
  }
}

// Invoices in MongoDB: 6 months each, last month of the first vendor is an obvious spike.
const mongo = await new MongoClient(process.env.MONGODB_URI).connect();
const col = mongo.db(process.env.MONGODB_DB || 'licenseledger').collection('invoices');
await col.deleteMany({ source: 'seed' });
const docs = [];
for (const [idx, s] of created.entries()) {
  for (let m = 5; m >= 0; m--) {
    const d = new Date(); d.setUTCDate(10); d.setUTCMonth(d.getUTCMonth() - m);
    let total = s.cost * s.seats * (0.97 + Math.random() * 0.06);
    if (idx === 0 && m === 0) total *= 2.4;
    total = Math.round(total * 100) / 100;
    const base = { subscription_id: s.subscription_id, vendor_id: s.vendor_id, vendor_name: s.vendor_name,
      invoice_number: `${s.vendor_name.slice(0, 3).toUpperCase()}-${d.getUTCFullYear()}${d.getUTCMonth() + 1}`,
      invoice_date: d, currency: 'USD', total, source: 'seed', created_at: new Date() };
    // different vendors send differently shaped payloads
    base.line_items = idx % 2 === 0
      ? [{ description: `${s.vendor_name} seats`, qty: s.seats, unit_price: s.cost, amount: total }]
      : [{ sku: 'SEAT', quantity: s.seats, price: s.cost }, { sku: 'TAX', amount: Math.round(total * 0.05 * 100) / 100 }];
    base.raw_payload = idx % 2 === 0
      ? { billing: { account: `ACC-${idx}`, period: d.toISOString().slice(0, 7) }, status: 'paid' }
      : { InvoiceHeader: { Ref: base.invoice_number, PO: null }, Totals: { Gross: total } };
    docs.push(base);
  }
}
await col.insertMany(docs);
console.log(`Seeded ${created.length} subscriptions and ${docs.length} invoices`);
await mongo.close();
await pool.end();
