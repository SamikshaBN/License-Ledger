import { query } from '@/lib/software/pg';
import { ok, fail } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// Read-only dropdown data (employees are owned by Person A; we only SELECT).
export async function GET() {
  try {
    await requireRole('admin', 'it_staff');
    const [employees, vendors, departments] = await Promise.all([
      query("SELECT employee_id, full_name FROM employee WHERE status = 'active' ORDER BY full_name"),
      query('SELECT vendor_id, name, website, contact_email FROM vendor ORDER BY name'),
      query('SELECT department_id, name FROM department ORDER BY name'),
    ]);
    return ok({ employees: employees.rows, vendors: vendors.rows, departments: departments.rows });
  } catch (e) { return fail(e); }
}
