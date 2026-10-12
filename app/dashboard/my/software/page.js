'use client';
import { useEffect, useState } from 'react';

const money = (n) => Number(n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const fmt = (d) => (d ? String(d).slice(0, 10) : '');
const cell = { padding: '6px 8px', borderBottom: '1px solid #8883', textAlign: 'left' };

export default function MySoftwarePage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/software/my-seats')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        setRows(data);
      })
      .catch((e) => setErr(e.message));
  }, []);

  const monthly = (rows ?? []).reduce(
    (sum, r) => sum + (r.billing_cycle === 'annual' ? Number(r.cost_per_seat) / 12 : Number(r.cost_per_seat)), 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>My software</h1>
      {err && <p style={{ color: '#dc2626', fontWeight: 600 }}>{err}</p>}
      {!rows && !err && <p>Loading…</p>}
      {rows && (
        <>
          <p>You hold <b>{rows.length}</b> software seat{rows.length === 1 ? '' : 's'}, costing about <b>{money(monthly)}</b> per month.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>{['Product', 'Vendor', 'Plan', 'Cost per seat', 'Assigned', 'Renews'].map((h) => <th key={h} style={cell}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td style={cell} colSpan={6}>No software seats assigned to you.</td></tr>}
              {rows.map((r) => (
                <tr key={r.seat_id}>
                  <td style={cell}>{r.product_name}</td>
                  <td style={cell}>{r.vendor_name}</td>
                  <td style={cell}>{r.plan}</td>
                  <td style={cell}>{money(r.cost_per_seat)} {r.billing_cycle}</td>
                  <td style={cell}>{fmt(r.assigned_at)}</td>
                  <td style={cell}>{fmt(r.renewal_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
