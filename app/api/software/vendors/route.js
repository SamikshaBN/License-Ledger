import { query } from '@/lib/software/pg';
import { ok, fail, str } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

export async function GET() {
  try {
    await requireRole('admin', 'it_staff'); return ok((await query('SELECT * FROM vendor ORDER BY name')).rows); }
  catch (e) { return fail(e); }
}

export async function POST(req) {
  try {
    await requireRole('admin');
    const b = await req.json();
    const name = str(b.name, 'name');
    const website = str(b.website, 'website', { required: false });
    const email = str(b.contact_email, 'contact_email', { required: false });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ok({ error: 'contact_email is invalid' }, 400);
    const r = await query(
      'INSERT INTO vendor (name, website, contact_email) VALUES ($1,$2,$3) RETURNING *', [name, website, email]);
    return ok(r.rows[0], 201);
  } catch (e) { return fail(e); }
}
