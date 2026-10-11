import bcrypt from 'bcryptjs';
import { json, readJson, withAuth } from '@/lib/api';
import { query, withTx } from '@/lib/db';
import { validate } from '@/lib/validate';

export const GET = withAuth(['admin'], async () => {
  const { rows } = await query(
    `SELECT u.user_id, u.username, u.role, u.is_active, u.last_login_at, e.full_name
       FROM app_user u JOIN employee e ON e.employee_id = u.employee_id ORDER BY u.username`);
  return json({ users: rows });
});

export const POST = withAuth(['admin'], async (req, _ctx, user) => {
  const d = validate(await readJson(req), {
    employee_id: { type: 'int', required: true, min: 1 },
    username: { type: 'string', required: true, min: 3, max: 50 },
    password: { type: 'string', required: true, min: 8, max: 100 },
    role: { type: 'enum', required: true, values: ['admin', 'it_staff', 'employee'] },
  });
  const hash = await bcrypt.hash(d.password, 10);
  const row = await withTx(user.id, async (c) =>
    (await c.query(
      `INSERT INTO app_user(employee_id, username, password_hash, role) VALUES ($1,$2,$3,$4)
       RETURNING user_id, username, role, is_active`, [d.employee_id, d.username, hash, d.role])).rows[0]);
  return json({ user: row }, 201);
});
