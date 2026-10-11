import { json, withAuth } from '@/lib/api';
import { query } from '@/lib/db';

export const GET = withAuth(['admin', 'it_staff'], async () => {
  const [emp, hw, byDept] = await Promise.all([
    query(`SELECT count(*) FILTER (WHERE status='active')::int AS active,
                  count(*) FILTER (WHERE status='offboarded')::int AS offboarded FROM employee`),
    query(`SELECT status, count(*)::int AS n FROM hardware_asset GROUP BY status ORDER BY status`),
    query(`SELECT * FROM v_department_hardware_summary ORDER BY department`),
  ]);
  return json({ employees: emp.rows[0], hardware: hw.rows, departments: byDept.rows });
});
