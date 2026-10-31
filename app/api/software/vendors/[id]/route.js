import { query } from '@/lib/software/pg';
import { ok, fail, num, str, httpError } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// PATCH { name, website?, contact_email? } -> edit a vendor (admin only)
export async function PATCH(req, { params }) {
  try {
    await requireRole('admin');
    const id = num((await params).id, 'id', { int: true, min: 1 });
    const b = await req.json();
    const name = str(b.name, 'name');
    const website = str(b.website, 'website', { required: false });
    const email = str(b.contact_email, 'contact_email', { required: false });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw httpError(400, 'contact_email is invalid');
    const r = await query(
      'UPDATE vendor SET name = $1, website = $2, contact_email = $3 WHERE vendor_id = $4 RETURNING *',
      [name, website, email, id]).catch((e) => { throw e.code === '23505' ? httpError(409, 'A vendor with this name already exists') : e; });
    if (!r.rows.length) throw httpError(404, 'Vendor not found');
    return ok(r.rows[0]);
  } catch (e) { return fail(e); }
}