import { json, readJson, withAuth } from '@/lib/api';
import { query, withTx } from '@/lib/db';
import { validate } from '@/lib/validate';

const TYPES = ['laptop', 'monitor', 'phone', 'tablet', 'peripheral', 'other'];

export const GET = withAuth(['admin', 'it_staff'], async (req) => {
  const sp = new URL(req.url).searchParams;
  const q = sp.get('q')?.trim() || null;
  const status = sp.get('status') || null;
  const type = sp.get('type') || null;
  const { rows } = await query(
    `SELECT * FROM v_hardware_inventory
      WHERE ($1::text IS NULL OR asset_tag ILIKE '%' || $1 || '%' OR make_model ILIKE '%' || $1 || '%'
             OR serial_number ILIKE '%' || $1 || '%' OR assigned_to ILIKE '%' || $1 || '%')
        AND ($2::text IS NULL OR status = $2)
        AND ($3::text IS NULL OR type = $3)
      ORDER BY asset_tag`, [q, status, type]);
  return json({ assets: rows });
});

export const POST = withAuth(['admin', 'it_staff'], async (req, _ctx, user) => {
  const d = validate(await readJson(req), {
    asset_tag: { type: 'string', required: true, max: 40 },
    type: { type: 'enum', required: true, values: TYPES },
    make_model: { type: 'string', required: true, max: 120 },
    serial_number: { type: 'string', required: true, max: 80 },
    purchase_date: { type: 'date' },
    purchase_cost: { type: 'number', min: 0, max: 1e8 },
  });
  const row = await withTx(user.id, async (c) =>
    (await c.query(
      `INSERT INTO hardware_asset(asset_tag, type, make_model, serial_number, purchase_date, purchase_cost)
       VALUES ($1,$2,$3,$4,$5::date,COALESCE($6,0)) RETURNING *`,
      [d.asset_tag, d.type, d.make_model, d.serial_number, d.purchase_date ?? null, d.purchase_cost ?? null])).rows[0]);
  return json({ asset: row }, 201);
});
