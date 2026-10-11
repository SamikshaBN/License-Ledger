import { query } from '@/lib/software/pg';
import { invoices } from '@/lib/software/mongo';
import { ok, fail, num, str, date, httpError } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

export async function GET(req) {
  try {
    await requireRole('admin', 'it_staff');
    const sid = new URL(req.url).searchParams.get('subscription_id');
    const filter = sid ? { subscription_id: num(sid, 'subscription_id', { int: true, min: 1 }) } : {};
    const docs = await (await invoices()).find(filter, { projection: { raw_payload: 0 } })
      .sort({ invoice_date: -1 }).limit(50).toArray();
    return ok(docs);
  } catch (e) { return fail(e); }
}

// POST { subscription_id, invoice_date, total, currency?, invoice_number?, line_items?, raw_payload? }
// Vendor-specific payloads are stored as-is in raw_payload; common fields are normalised.
export async function POST(req) {
  try {
    await requireRole('admin');
    const b = await req.json();
    const sid = num(b.subscription_id, 'subscription_id', { int: true, min: 1 });
    const sub = await query(
      `SELECT s.vendor_id, v.name AS vendor_name FROM software_subscription s
         JOIN vendor v ON v.vendor_id = s.vendor_id WHERE s.subscription_id = $1`, [sid]);
    if (!sub.rows.length) throw httpError(404, 'Subscription not found');
    const currency = (str(b.currency ?? 'USD', 'currency', { max: 3 }) ?? 'USD').toUpperCase();
    if (currency.length !== 3) throw httpError(400, 'currency must be a 3-letter code');
    const doc = {
      subscription_id: sid, vendor_id: sub.rows[0].vendor_id, vendor_name: sub.rows[0].vendor_name,
      invoice_number: str(b.invoice_number, 'invoice_number', { required: false }),
      invoice_date: new Date(date(b.invoice_date, 'invoice_date')),
      currency, total: num(b.total, 'total', { min: 0 }),
      line_items: Array.isArray(b.line_items) ? b.line_items : [],
      raw_payload: b.raw_payload && typeof b.raw_payload === 'object' ? b.raw_payload : null,
      source: 'upload', created_at: new Date(),
    };
    const r = await (await invoices()).insertOne(doc);
    return ok({ _id: r.insertedId }, 201);
  } catch (e) { return fail(e); }
}
