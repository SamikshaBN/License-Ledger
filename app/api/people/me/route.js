import { json, withAuth } from '@/lib/api';
import { query } from '@/lib/db';

export const GET = withAuth(null, async (_req, _ctx, user) => {
  const id = user.employee_id;
  const emp = (await query(
    `SELECT e.employee_id, e.full_name, e.email, e.job_title, e.hire_date, d.name AS department_name
       FROM employee e LEFT JOIN department d ON d.department_id = e.department_id
      WHERE e.employee_id = $1`, [id])).rows[0];
  const assets = (await query(
    `SELECT asset_id, asset_tag, type, make_model, serial_number, assigned_at
       FROM v_hardware_inventory WHERE employee_id = $1 ORDER BY asset_tag`, [id])).rows;
  const seats = (await query(
    `SELECT s.seat_id, sub.name AS subscription, s.assigned_at
       FROM seat_assignment s JOIN software_subscription sub ON sub.subscription_id = s.subscription_id
      WHERE s.employee_id = $1 AND s.revoked_at IS NULL ORDER BY sub.name`, [id])).rows;
  return json({ employee: emp, assets, seats });
});