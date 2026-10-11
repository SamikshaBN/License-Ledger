import { json, readJson, withAuth } from '@/lib/api';
import { query, withTx } from '@/lib/db';
import { validate } from '@/lib/validate';

export const GET = withAuth(['admin', 'it_staff'], async () => {
  const { rows } = await query(`SELECT d.department_id, d.name, count(e.employee_id)::int AS employees
                                  FROM department d LEFT JOIN employee e
                                    ON e.department_id = d.department_id AND e.status = 'active'
                                 GROUP BY d.department_id ORDER BY d.name`);
  return json({ departments: rows });
});

export const POST = withAuth(['admin'], async (req, _ctx, user) => {
  const data = validate(await readJson(req), { name: { type: 'string', required: true, max: 100 } });
  const row = await withTx(user.id, async (c) =>
    (await c.query('INSERT INTO department(name) VALUES ($1) RETURNING *', [data.name])).rows[0]);
  return json({ department: row }, 201);
});
