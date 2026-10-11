import { json, readJson, withAuth } from '@/lib/api';
import { query, withTx } from '@/lib/db';
import { validate } from '@/lib/validate';

export const GET = withAuth(['admin', 'it_staff'], async (req) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get('q')?.trim() || null;
  const status = sp.get('status') || null; // 'active' | 'offboarded' | 'all'
  const dept = sp.get('department_id') ? Number(sp.get('department_id')) : null;
  const { rows } = await query(
    `SELECT e.employee_id, e.full_name, e.email, e.department_id, e.job_title, e.hire_date, e.status, e.offboarded_at,
            d.name AS department_name,
            (SELECT count(*) FROM asset_assignment a WHERE a.employee_id = e.employee_id AND a.returned_at IS NULL)::int AS open_assets,
            (SELECT count(*) FROM seat_assignment s WHERE s.employee_id = e.employee_id AND s.revoked_at IS NULL)::int AS open_seats
       FROM employee e LEFT JOIN department d ON d.department_id = e.department_id
      WHERE ($1::text IS NULL OR e.full_name ILIKE '%' || $1 || '%' OR e.email ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR e.status = $2)
        AND ($3::int  IS NULL OR e.department_id = $3)
      ORDER BY e.full_name`, [q, status === 'all' ? null : status, Number.isInteger(dept) ? dept : null]);
  return json({ employees: rows });
});

export const POST = withAuth(['admin', 'it_staff'], async (req, _ctx, user) => {
  const data = validate(await readJson(req), {
    full_name: { type: 'string', required: true, max: 120 },
    email: { type: 'email', required: true, max: 200 },
    department_id: { type: 'int', required: true, min: 1 },
    job_title: { type: 'string', max: 100 },
    hire_date: { type: 'date' },
  });
  const row = await withTx(user.id, async (c) =>
    (await c.query(
      `INSERT INTO employee(full_name, email, department_id, job_title, hire_date)
       VALUES ($1,$2,$3,$4,COALESCE($5::date, CURRENT_DATE)) RETURNING *`,
      [data.full_name, data.email, data.department_id, data.job_title ?? null, data.hire_date ?? null])).rows[0]);
  return json({ employee: row }, 201);
});
