import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, parseId } from '../lib/validate.js';
import { ApiError, toApiError } from '../lib/errors.js';

const schema = {
  full_name: { type: 'string', required: true, max: 10 },
  email: { type: 'email', required: true },
  department_id: { type: 'int', required: true, min: 1 },
  hire_date: { type: 'date' },
  cost: { type: 'number', min: 0 },
  role: { type: 'enum', values: ['admin', 'it_staff'] },
};
const good = { full_name: 'Asha', email: 'ASHA@Example.com', department_id: '2' };
const fails = (body, field) => {
  try { validate(body, schema); } catch (e) {
    assert.ok(e instanceof ApiError); assert.equal(e.status, 400); assert.ok(field in e.details, `expected error on ${field}`); return;
  }
  assert.fail('expected validation to fail');
};

test('V1 valid input is cleaned (trim, lowercase email, numeric coercion)', () => {
  const out = validate({ ...good, full_name: '  Asha  ' }, schema);
  assert.deepEqual(out, { full_name: 'Asha', email: 'asha@example.com', department_id: 2 });
});
test('V2 missing required fields are all reported', () => {
  try { validate({}, schema); assert.fail(); } catch (e) { assert.deepEqual(Object.keys(e.details).sort(), ['department_id', 'email', 'full_name']); }
});
test('V3 bad email rejected', () => fails({ ...good, email: 'not-an-email' }, 'email'));
test('V4 too-long string rejected', () => fails({ ...good, full_name: 'x'.repeat(11) }, 'full_name'));
test('V5 non-integer / below-min id rejected', () => { fails({ ...good, department_id: '1.5' }, 'department_id'); fails({ ...good, department_id: 0 }, 'department_id'); });
test('V6 impossible date rejected', () => { fails({ ...good, hire_date: '2026-02-30' }, 'hire_date'); fails({ ...good, hire_date: '30/01/2026' }, 'hire_date'); });
test('V7 negative cost rejected', () => fails({ ...good, cost: -5 }, 'cost'));
test('V8 enum outside list rejected', () => fails({ ...good, role: 'superuser' }, 'role'));
test('V9 non-object body rejected', () => { assert.throws(() => validate(null, schema), ApiError); assert.throws(() => validate([], schema), ApiError); });
test('V10 SQL-looking text is just text (queries are parameterised)', () => {
  assert.equal(validate({ ...good, full_name: "x'; DROP--" }, schema).full_name, "x'; DROP--");
});
test('V11 parseId', () => { assert.equal(parseId('12'), 12); assert.throws(() => parseId('abc')); assert.throws(() => parseId('-1')); assert.throws(() => parseId('99999999999')); });
test('V12 Postgres errors map to clean API errors', () => {
  assert.equal(toApiError({ code: '23505' }).status, 409);
  assert.equal(toApiError({ code: '23514' }).status, 400);
  assert.equal(toApiError({ code: 'P0001', message: 'Asset 1 is not available' }).code, 'RULE_VIOLATION');
});
