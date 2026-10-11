import { json, readJson, withAuth } from '@/lib/api';
import { query, withTx } from '@/lib/db';
import { validate } from '@/lib/validate';

export const GET = withAuth(['admin', 'it_staff'], async (req) => {
  const year = new URL(req.url).searchParams.get('year') || String(new Date().getFullYear());
  const { fiscal_year } = validate({ fiscal_year: year }, { fiscal_year: { type: 'int', required: true, min: 2000, max: 2100 } });
  const { rows } = await query(
    `SELECT d.department_id, d.name AS department, b.budget_id, b.fiscal_year, b.hardware_budget, b.software_budget,
            COALESCE(s.hardware_value, 0) AS hardware_value
       FROM department d
       LEFT JOIN department_budget b ON b.department_id = d.department_id AND b.fiscal_year = $1
       LEFT JOIN v_department_hardware_summary s ON s.department_id = d.department_id
      ORDER BY d.name`, [fiscal_year]);
  return json({ budgets: rows, fiscal_year });
});

// Admin only. Upsert thanks to UNIQUE(department_id, fiscal_year).
export const POST = withAuth(['admin'], async (req, _ctx, user) => {
  const data = validate(await readJson(req), {
    department_id: { type: 'int', required: true, min: 1 },
    fiscal_year: { type: 'int', required: true, min: 2000, max: 2100 },
    hardware_budget: { type: 'number', required: true, min: 0, max: 1e9 },
    software_budget: { type: 'number', required: true, min: 0, max: 1e9 },
  });
  const row = await withTx(user.id, async (c) =>
    (await c.query(
      `INSERT INTO department_budget(department_id, fiscal_year, hardware_budget, software_budget)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (department_id, fiscal_year)
       DO UPDATE SET hardware_budget = EXCLUDED.hardware_budget, software_budget = EXCLUDED.software_budget
       RETURNING *`,
      [data.department_id, data.fiscal_year, data.hardware_budget, data.software_budget])).rows[0]);
  return json({ budget: row });
});
