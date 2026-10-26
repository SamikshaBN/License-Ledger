import { json, withAuth } from '@/lib/api';
import { query } from '@/lib/db';

export const GET = withAuth(null, async (_req, _ctx, user) => {
  const id = user.employee_id;
  const emp = (await query(
    `SELECT e.employee_id, e.full_name, e.email, e.job_title, e.hire_date, d.name AS department_name
       FROM employee e LEFT JOIN department d ON d.department_id = e.department_id
      WHERE e.employee_id = $1`, [id])).rows[0];
  const assets = (await query(
    `SELECT h.asset_id, h.asset_tag, h.type, h.make_model, h.serial_number, a.assigned_at
       FROM asset_assignment a JOIN hardware_asset h ON h.asset_id = a.asset_id
      WHERE a.employee_id = $1 AND a.returned_at IS NULL ORDER BY h.asset_tag`, [id])).rows;
  const seats = (await query(
    `SELECT s.seat_id, sub.name AS subscription, s.assigned_at
       FROM seat_assignment s JOIN software_subscription sub ON sub.subscription_id = s.subscription_id
      WHERE s.employee_id = $1 AND s.revoked_at IS NULL ORDER BY sub.name`, [id])).rows;
  return json({ employee: emp, assets, seats });
});