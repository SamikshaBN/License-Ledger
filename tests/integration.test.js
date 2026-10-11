// Needs: docker compose up -d, npm run db:seed, npm run dev (in another terminal)
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const stamp = Date.now();

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { res, cookie };
}
const call = (cookie, method, path, body) =>
  fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let admin, it;
test.before(async () => {
  admin = (await login('admin', 'Admin@123')).cookie;
  it = (await login('itstaff', 'ItStaff@123')).cookie;
  assert.ok(admin && it, 'seed data + server must be running');
});

const newAsset = async (tag) => (await call(it, 'POST', '/api/people/hardware', { asset_tag: `T-${stamp}-${tag}`, type: 'laptop', make_model: 'Test', serial_number: `S-${stamp}-${tag}`, purchase_cost: 100 })).body.asset;
const newEmp = async (tag) => (await call(it, 'POST', '/api/people/employees', { full_name: `Test ${tag}`, email: `t${stamp}${tag}@example.com`, department_id: 2 })).body.employee;

test('T1 wrong password -> 401', async () => assert.equal((await login('admin', 'wrong')).res.status, 401));
test('T2 no cookie -> 401', async () => assert.equal((await call(null, 'GET', '/api/people/employees')).status, 401));
test('T3 it_staff cannot change budgets -> 403', async () => assert.equal((await call(it, 'POST', '/api/people/budgets', { department_id: 1, fiscal_year: 2026, hardware_budget: 1, software_budget: 1 })).status, 403));
test('T4 it_staff cannot read audit log -> 403', async () => assert.equal((await call(it, 'GET', '/api/people/audit')).status, 403));
test('T5 admin can upsert budget; negative rejected', async () => {
  assert.equal((await call(admin, 'POST', '/api/people/budgets', { department_id: 1, fiscal_year: 2026, hardware_budget: 60000, software_budget: 20000 })).status, 200);
  assert.equal((await call(admin, 'POST', '/api/people/budgets', { department_id: 1, fiscal_year: 2026, hardware_budget: -1, software_budget: 0 })).status, 400);
});
test('T6 invalid employee email -> 400 with details', async () => {
  const r = await call(it, 'POST', '/api/people/employees', { full_name: 'X', email: 'bad', department_id: 2 });
  assert.equal(r.status, 400); assert.ok(r.body.error.details.email);
});
test('T7 duplicate asset tag -> 409', async () => {
  const a = await newAsset('dup');
  const r = await call(it, 'POST', '/api/people/hardware', { asset_tag: a.asset_tag, type: 'laptop', make_model: 'x', serial_number: 'other' + stamp });
  assert.equal(r.status, 409);
});
test('T8 assign twice -> second rejected; return frees it', async () => {
  const a = await newAsset('a8'); const e = await newEmp('e8');
  const first = await call(it, 'POST', '/api/people/assignments', { asset_id: a.asset_id, employee_id: e.employee_id });
  assert.equal(first.status, 201);
  assert.equal((await call(it, 'POST', '/api/people/assignments', { asset_id: a.asset_id, employee_id: e.employee_id })).status, 409);
  assert.equal((await call(it, 'POST', `/api/people/assignments/${first.body.assignment.assignment_id}/return`, {})).status, 200);
  assert.equal((await call(it, 'POST', `/api/people/assignments/${first.body.assignment.assignment_id}/return`, {})).status, 409);
});
test('T9 concurrent assignment of one asset: exactly one wins', async () => {
  const a = await newAsset('a9'); const e1 = await newEmp('e9a'); const e2 = await newEmp('e9b');
  const rs = await Promise.all([e1, e2].map((e) => call(it, 'POST', '/api/people/assignments', { asset_id: a.asset_id, employee_id: e.employee_id })));
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
});
test('T10 retire: it_staff -> 403, admin -> 200', async () => {
  const a = await newAsset('a10');
  assert.equal((await call(it, 'PATCH', `/api/people/hardware/${a.asset_id}`, { status: 'retired' })).status, 403);
  assert.equal((await call(admin, 'PATCH', `/api/people/hardware/${a.asset_id}`, { status: 'retired' })).status, 200);
});
test('T11 simulated failure rolls everything back', async () => {
  const a = await newAsset('a11'); const e = await newEmp('e11');
  await call(it, 'POST', '/api/people/assignments', { asset_id: a.asset_id, employee_id: e.employee_id });
  const r = await call(it, 'POST', `/api/people/offboard/${e.employee_id}`, { simulateFailure: true });
  assert.equal(r.status, 500);
  const after = await call(it, 'GET', `/api/people/employees/${e.employee_id}`);
  assert.equal(after.body.employee.status, 'active');
  assert.equal(after.body.assets.length, 1);
});
test('T12 offboarding returns hardware, marks employee, blocks repeat and new assignments', async () => {
  const a = await newAsset('a12'); const e = await newEmp('e12'); const spare = await newAsset('s12');
  await call(it, 'POST', '/api/people/assignments', { asset_id: a.asset_id, employee_id: e.employee_id });
  const r = await call(it, 'POST', `/api/people/offboard/${e.employee_id}`, {});
  assert.equal(r.status, 200); assert.equal(r.body.result.assets_returned, 1);
  const inv = (await call(it, 'GET', `/api/people/hardware?q=${a.asset_tag}`)).body.assets[0];
  assert.equal(inv.status, 'available'); assert.equal(inv.assigned_to, null);
  assert.equal((await call(it, 'POST', `/api/people/offboard/${e.employee_id}`, {})).status, 409);
  assert.equal((await call(it, 'POST', '/api/people/assignments', { asset_id: spare.asset_id, employee_id: e.employee_id })).status, 409);
});
test('T13 audit log recorded who did what', async () => {
  const e = await newEmp('e13');
  const logs = (await call(admin, 'GET', '/api/people/audit?table=employee&action=INSERT&limit=5')).body.logs;
  const hit = logs.find((l) => l.record_id === String(e.employee_id));
  assert.ok(hit); assert.equal(hit.changed_by, 'itstaff');
});
