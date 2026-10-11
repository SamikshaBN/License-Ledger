// Shared seed script. Run:  npm run db:seed   (WIPES all data, then inserts demo data)
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
const one = async (sql, p) => (await c.query(sql, p)).rows[0];

try {
  await c.query('BEGIN');
  await c.query(`TRUNCATE audit_log, seat_assignment, renewal, software_subscription, vendor,
                          asset_assignment, hardware_asset, app_user, employee, department_budget, department
                 RESTART IDENTITY CASCADE`);

  // departments + budgets
  const dept = {};
  for (const n of ['IT', 'Engineering', 'Finance', 'HR', 'Sales']) {
    dept[n] = (await one('INSERT INTO department(name) VALUES ($1) RETURNING department_id', [n])).department_id;
    await c.query(`INSERT INTO department_budget(department_id, fiscal_year, hardware_budget, software_budget)
                   VALUES ($1, 2026, 50000, 20000)`, [dept[n]]);
  }

  // employees
  const people = [
    ['Asha Rao', 'asha@example.com', 'IT', 'IT Manager'],
    ['Ravi Kumar', 'ravi@example.com', 'IT', 'IT Support'],
    ['Meera Iyer', 'meera@example.com', 'Engineering', 'Developer'],
    ['Arjun Nair', 'arjun@example.com', 'Engineering', 'Developer'],
    ['Sana Khan', 'sana@example.com', 'Finance', 'Accountant'],
    ['Vikram Singh', 'vikram@example.com', 'Sales', 'Sales Lead'],
    ['Priya Das', 'priya@example.com', 'HR', 'HR Partner'],
    ['Kabir Shah', 'kabir@example.com', 'Sales', 'Sales Rep'],
  ];
  const emp = {};
  for (const [name, email, d, title] of people) {
    emp[name] = (await one(
      'INSERT INTO employee(full_name, email, department_id, job_title) VALUES ($1,$2,$3,$4) RETURNING employee_id',
      [name, email, dept[d], title])).employee_id;
  }

  // logins
  for (const [who, username, pw, role] of [
    ['Asha Rao', 'admin', 'Admin@123', 'admin'],
    ['Ravi Kumar', 'itstaff', 'ItStaff@123', 'it_staff'],
    ['Arjun Nair', 'arjun', 'Employee@123', 'employee'],
  ]) {
    await c.query('INSERT INTO app_user(employee_id, username, password_hash, role) VALUES ($1,$2,$3,$4)',
      [emp[who], username, await bcrypt.hash(pw, 10), role]);
  }

  // hardware
  const hw = {};
  const add = async (tag, type, model, cost) => {
    hw[tag] = (await one(
      `INSERT INTO hardware_asset(asset_tag, type, make_model, serial_number, purchase_date, purchase_cost)
       VALUES ($1,$2,$3,$4,'2025-06-01',$5) RETURNING asset_id`, [tag, type, model, 'SN-' + tag, cost])).asset_id;
  };
  for (let i = 1; i <= 6; i++) await add(`LAP-00${i}`, 'laptop', i % 2 ? 'Dell Latitude 5440' : 'MacBook Air M2', i % 2 ? 1100 : 1300);
  for (let i = 1; i <= 3; i++) await add(`MON-00${i}`, 'monitor', 'Dell U2723QE', 550);
  for (let i = 1; i <= 3; i++) await add(`PHN-00${i}`, 'phone', 'iPhone 14', 800);

  // assignments (trigger flips asset status to 'assigned')
  for (const [tag, who] of [['LAP-001', 'Meera Iyer'], ['MON-001', 'Meera Iyer'], ['LAP-002', 'Arjun Nair'], ['LAP-003', 'Sana Khan']]) {
    await c.query('INSERT INTO asset_assignment(asset_id, employee_id) VALUES ($1,$2)', [hw[tag], emp[who]]);
  }

  // minimal Person B demo data so the offboarding preview shows seats
  const vend = {};
  for (const n of ['Slack', 'Figma', 'GitHub']) {
    vend[n] = (await one('INSERT INTO vendor(name) VALUES ($1) RETURNING vendor_id', [n])).vendor_id;
  }
  const sub = {};
  for (const [n, seats, cost, date] of [['Slack', 10, 8.75, '2026-11-15'], ['Figma', 5, 15, '2026-12-01'], ['GitHub', 8, 4, '2026-11-30']]) {
    sub[n] = (await one(
      `INSERT INTO software_subscription(vendor_id, name, plan, seat_limit, cost_per_seat, billing_cycle, renewal_date)
       VALUES ($1,$2,'Team',$3,$4,'monthly',$5) RETURNING subscription_id`, [vend[n], n + ' Team', seats, cost, date])).subscription_id;
    await c.query(`INSERT INTO renewal(subscription_id, renewal_date, amount) VALUES ($1,$2,$3)`, [sub[n], date, seats * cost * 12]);
  }
  for (const [who, s] of [['Meera Iyer', 'Slack'], ['Meera Iyer', 'Figma'], ['Meera Iyer', 'GitHub'], ['Arjun Nair', 'Slack'], ['Arjun Nair', 'GitHub'], ['Sana Khan', 'Slack']]) {
    await c.query('INSERT INTO seat_assignment(subscription_id, employee_id) VALUES ($1,$2)', [sub[s], emp[who]]);
  }

  await c.query('COMMIT');
  console.log('Seeded. Logins: admin / Admin@123   itstaff / ItStaff@123');
} catch (e) {
  await c.query('ROLLBACK');
  console.error(e);
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
