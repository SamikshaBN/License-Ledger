// Needs the databases, seed data, roles (npm run db:roles) and `npm run dev` running.
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  return res.headers.get('set-cookie')?.split(';')[0];
}
const call = (cookie, method, path, body) =>
  fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let admin, staff, emp;
test.before(async () => {
  admin = await login('admin', 'Admin@123'); staff = await login('itstaff', 'ItStaff@123'); emp = await login('arjun', 'Employee@123');
  assert.ok(admin && staff && emp);
});

test('A1 roles are installed and the matrix reflects the grants', async () => {
  const r = await call(admin, 'GET', '/api/people/access');
  assert.equal(r.status, 200);
  assert.equal(r.body.ready, true, 'run npm run db:roles first');
  const budget = r.body.tables.find((t) => t.name === 'department_budget');
  assert.equal(budget.roles.ll_admin.UPDATE, 'full');
  assert.equal(budget.roles.ll_it_staff.UPDATE, 'none');
  assert.equal(budget.roles.ll_it_staff.SELECT, 'full');
  const audit = r.body.tables.find((t) => t.name === 'audit_log');
  assert.equal(audit.roles.ll_it_staff.SELECT, 'none');
});
test('A2 employee sees only their own access, no matrix', async () => {
  const r = await call(emp, 'GET', '/api/people/access');
  assert.equal(r.status, 200);
  assert.equal(r.body.me.db_role, 'll_employee');
  assert.equal(r.body.tables, undefined);
});
test('A3 the database itself denies IT staff an UPDATE on budgets but allows a SELECT', async () => {
  const no = await call(admin, 'POST', '/api/people/access/test', { role: 'it_staff', table: 'department_budget', action: 'UPDATE' });
  assert.equal(no.body.allowed, false);
  const yes = await call(admin, 'POST', '/api/people/access/test', { role: 'it_staff', table: 'department_budget', action: 'SELECT' });
  assert.equal(yes.body.allowed, true);
});
test('A4 IT staff cannot run the check endpoint', async () => {
  assert.equal((await call(staff, 'POST', '/api/people/access/test', { role: 'admin', table: 'employee', action: 'SELECT' })).status, 403);
});

test('A5 logging in switches the database role: PostgreSQL reports the matching current_user', async () => {
  for (const [cookie, role] of [[admin, 'll_admin'], [staff, 'll_it_staff'], [emp, 'll_employee']]) {
    const r = await call(cookie, 'GET', '/api/people/access');
    assert.equal(r.body.me.session_role, role);
  }
});
test('A6 the database (not just the app) blocks a request when the grant is removed', async () => {
  const owner = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await owner.connect();
  try {
    await owner.query('REVOKE UPDATE ON employee FROM ll_it_staff');
    const blocked = await call(staff, 'PATCH', '/api/people/employees/6', { job_title: 'Blocked' });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, 'DB_FORBIDDEN');
    const adminOk = await call(admin, 'PATCH', '/api/people/employees/6', { job_title: 'Sales Lead' });
    assert.equal(adminOk.status, 200);
  } finally {
    await owner.query('GRANT UPDATE ON employee TO ll_it_staff');
    await owner.end();
  }
  assert.equal((await call(staff, 'PATCH', '/api/people/employees/6', { job_title: 'Sales Lead' })).status, 200);
});
test('A7 an employee only ever sees their own row, even through the database role', async () => {
  const r = await call(emp, 'GET', '/api/people/me');
  assert.equal(r.status, 200);
  assert.equal(r.body.employee.email, 'arjun@example.com');
  assert.ok(r.body.assets.every((a) => a.asset_tag));
});
