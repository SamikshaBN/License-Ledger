'use client';
import Link from 'next/link';
import { useLoad } from '@/lib/client';

const money = (n) => Number(n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const fmt = (d) => (d ? String(d).slice(0, 10) : '');

// Shown on the main Overview page (admin and IT staff only; the API enforces the same roles).
export default function SoftwareOverview() {
  const { data, error } = useLoad('/api/software/summary');
  if (error) return <div className="msg err">Software overview: {String(error)}</div>;
  if (!data) return <p>Loading software overview...</p>;
  const t = data.totals;
  return (
    <>
      <h2>Software &amp; spend</h2>
      <div className="grid">
        <div className="card stat"><b>{t.subscriptions}</b>Active subscriptions</div>
        <div className="card stat"><b>{t.seats_used} / {t.seats_total}</b>Seats in use</div>
        <div className="card stat"><b>{t.seats_unused}</b>Unused seats</div>
        <div className="card stat"><b>{money(t.monthly_spend)}</b>Spend per month</div>
        <div className="card stat"><b style={{ color: '#c62828' }}>{money(t.monthly_waste)}</b>Wasted per month</div>
        <div className="card stat"><b>{data.renewingCount}</b>Renewing in 30 days</div>
        <div className="card stat"><b style={data.departedSeats > 0 ? { color: '#c62828' } : undefined}>{data.departedSeats}</b>Seats held by departed staff</div>
      </div>
      <h3>Most wasted spend</h3>
      <table>
        <thead><tr><th>Product</th><th>Vendor</th><th>Seats used</th><th>Wasted per month</th></tr></thead>
        <tbody>
          {data.topWaste.length === 0 && <tr><td colSpan={4}>No unused seats</td></tr>}
          {data.topWaste.map((r) => (
            <tr key={r.subscription_id}><td>{r.product_name}</td><td>{r.vendor_name}</td><td>{r.seats_used}/{r.seats_total}</td><td>{money(r.monthly_waste)}</td></tr>
          ))}
        </tbody>
      </table>
      <h3>Renewing soon</h3>
      <table>
        <thead><tr><th>Product</th><th>Vendor</th><th>Renews</th><th>In</th><th>Cost</th></tr></thead>
        <tbody>
          {data.renewingSoon.length === 0 && <tr><td colSpan={5}>Nothing renews in the next 30 days</td></tr>}
          {data.renewingSoon.map((r, i) => (
            <tr key={i}><td>{r.product_name}</td><td>{r.vendor_name}</td><td>{fmt(r.renewal_date)}</td><td>{r.days_until} days</td><td>{money(r.cost_per_cycle)} {r.billing_cycle}</td></tr>
          ))}
        </tbody>
      </table>
      <p><Link href="/dashboard/software">Open software &amp; spend</Link></p>
    </>
  );
}
