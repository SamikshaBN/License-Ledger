// Proves assign_seat() cannot oversell: two simultaneous requests for the LAST seat -> exactly one succeeds.
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const q = (t, p) => pool.query(t, p);

const emps = (await q("SELECT employee_id FROM employee WHERE status='active' ORDER BY employee_id LIMIT 2")).rows;
const vendor = (await q('SELECT vendor_id FROM vendor LIMIT 1')).rows[0];
const dept = (await q('SELECT department_id FROM department LIMIT 1')).rows[0];
if (emps.length < 2 || !vendor || !dept) throw new Error('Need 2 active employees, 1 vendor and 1 department. Run the seeds first.');

const sub = (await q(
  `INSERT INTO software_subscription (vendor_id, department_id, name, plan, cost_per_seat, billing_cycle, seat_limit, renewal_date, status)
   VALUES ($1,$2,'__CONCURRENCY_TEST__','test',1,'monthly',1,current_date+30,'active') RETURNING subscription_id`,
  [vendor.vendor_id, dept.department_id])).rows[0].subscription_id;

try {
  const results = await Promise.allSettled(emps.map(e => q('SELECT assign_seat($1,$2)', [sub, e.employee_id])));
  results.forEach((r, i) => console.log(`request ${i + 1}:`, r.status, r.reason?.message ?? ''));
  const wins = results.filter(r => r.status === 'fulfilled').length;
  const used = (await q('SELECT count(*)::int AS n FROM seat_assignment WHERE subscription_id=$1 AND revoked_at IS NULL', [sub])).rows[0].n;
  console.log(wins === 1 && used === 1 ? 'PASS: exactly one seat assigned' : `FAIL: wins=${wins}, seats in use=${used}`);
  process.exitCode = wins === 1 && used === 1 ? 0 : 1;
} finally {
  await q('DELETE FROM seat_assignment WHERE subscription_id=$1', [sub]);
  await q('DELETE FROM software_subscription WHERE subscription_id=$1', [sub]);
  await pool.end();
}
