import { ObjectId } from 'mongodb';
import { invoices } from '@/lib/software/mongo';
import { ok, fail, num, str, date, httpError } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

function oid(id) {
  if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) throw httpError(400, 'Invalid invoice id');
  return new ObjectId(id);
}

// READ one invoice, including raw_payload (admin, it_staff)
export async function GET(_req, { params }) {
  try {
    await requireRole('admin', 'it_staff');
    const doc = await (await invoices()).findOne({ _id: oid((await params).id) });
    if (!doc) throw httpError(404, 'Invoice not found');
    return ok(doc);
  } catch (e) { return fail(e); }
}

// UPDATE: only the fields sent are changed; the $jsonSchema validator re-checks the whole document (admin)
export async function PATCH(req, { params }) {
  try {
    await requireRole('admin');
    const _id = oid((await params).id);
    const b = await req.json();
    const set = {};
    if (b.total !== undefined) set.total = num(b.total, 'total', { min: 0 });
    if (b.invoice_date !== undefined) set.invoice_date = new Date(date(b.invoice_date, 'invoice_date'));
    if (b.invoice_number !== undefined) set.invoice_number = str(b.invoice_number, 'invoice_number', { required: false });
    if (b.currency !== undefined) {
      const c = String(b.currency).trim().toUpperCase();
      if (c.length !== 3) throw httpError(400, 'currency must be a 3-letter code');
      set.currency = c;
    }
    if (Object.keys(set).length === 0) throw httpError(400, 'Nothing to update');
    set.updated_at = new Date();
    const col = await invoices();
    const r = await col.updateOne({ _id }, { $set: set });
    if (!r.matchedCount) throw httpError(404, 'Invoice not found');
    return ok(await col.findOne({ _id }, { projection: { raw_payload: 0 } }));
  } catch (e) { return fail(e); }
}

// DELETE (admin)
export async function DELETE(_req, { params }) {
  try {
    await requireRole('admin');
    const r = await (await invoices()).deleteOne({ _id: oid((await params).id) });
    if (!r.deletedCount) throw httpError(404, 'Invoice not found');
    return ok({ deleted: true });
  } catch (e) { return fail(e); }
}
