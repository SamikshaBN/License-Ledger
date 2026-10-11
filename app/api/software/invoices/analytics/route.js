import { invoices } from '@/lib/software/mongo';
import { ok, fail } from '@/lib/software/http';
import { requireRole } from '@/lib/software/guard';

// Monthly spend per vendor + anomaly flag (month total > mean + 1.5 std dev, needs >= 3 months).
export async function GET() {
  try {
    await requireRole('admin', 'it_staff');
    const rows = await (await invoices()).aggregate([
      { $group: {
          _id: { vendor_id: '$vendor_id', vendor_name: '$vendor_name',
                 month: { $dateToString: { format: '%Y-%m', date: '$invoice_date' } } },
          total: { $sum: '$total' }, invoices: { $sum: 1 } } },
      { $group: {
          _id: { vendor_id: '$_id.vendor_id', vendor_name: '$_id.vendor_name' },
          months: { $push: { month: '$_id.month', total: '$total', invoices: '$invoices' } },
          avg: { $avg: '$total' }, std: { $stdDevPop: '$total' }, n: { $sum: 1 } } },
      { $unwind: '$months' },
      { $project: {
          _id: 0, vendor_id: '$_id.vendor_id', vendor_name: '$_id.vendor_name',
          month: '$months.month', total: { $round: ['$months.total', 2] }, invoices: '$months.invoices',
          avg: { $round: ['$avg', 2] },
          anomaly: { $and: [ { $gte: ['$n', 3] }, { $gt: ['$std', 0] },
                    { $gt: ['$months.total', { $add: ['$avg', { $multiply: [1.5, '$std'] }] }] } ] } } },
      { $sort: { vendor_name: 1, month: 1 } },
    ]).toArray();
    return ok(rows);
  } catch (e) { return fail(e); }
}
