'use client';
import { useEffect, useState, useCallback } from 'react';

async function api(url, opts) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
const money = (n) => Number(n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const fmt = (d) => (d ? String(d).slice(0, 10) : '');
const S = {
  wrap: { maxWidth: 1100, margin: '0 auto', fontFamily: 'inherit' },
  tabs: { display: 'flex', gap: 4, margin: '0 0 20px', padding: 4, background: '#ebe7dc', borderRadius: 6, width: 'fit-content' },
  tab: (on) => ({ padding: '8px 16px', borderRadius: 4, border: 0, cursor: 'pointer', font: 'inherit', fontWeight: 600, background: on ? '#fff' : 'transparent', color: on ? '#25231f' : '#77726a', boxShadow: on ? '0 1px 2px rgba(34,37,31,.15)' : 'none' }),
  table: { width: '100%' },
  cell: { padding: '10px 14px', textAlign: 'left' },
  card: { background: '#fffefb', border: '1px solid #e3dfd5', borderRadius: 6, padding: 16, margin: '12px 0' },
  row: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' },
  input: { padding: '8px 11px', borderRadius: 4, border: '1px solid #d2cdc0', background: '#fff', color: 'inherit', font: 'inherit' },
  btn: { padding: '8px 14px', borderRadius: 4, border: 0, background: '#2f6b4f', color: '#fff', cursor: 'pointer', font: 'inherit', fontWeight: 600 },
  warn: { color: '#b4432f', fontWeight: 600 },
};


const Table = ({ cols, rows, empty = 'No data' }) => (
  <table style={S.table}>
    <thead><tr>{cols.map((c) => <th key={c.h} style={S.cell}>{c.h}</th>)}</tr></thead>
    <tbody>
      {rows.length === 0 && <tr><td style={S.cell} colSpan={cols.length}>{empty}</td></tr>}
      {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.h} style={S.cell}>{c.r(r)}</td>)}</tr>)}
    </tbody>
  </table>
);

export default function SoftwarePage() {
  const [tab, setTab] = useState('subs');
  const [msg, setMsg] = useState(null);
  const notify = useCallback((text, error = false) => { setMsg({ text, error }); setTimeout(() => setMsg(null), 5000); }, []);
  return (
    <div style={S.wrap}>
      <h1>Software &amp; Spend</h1>
      {msg && <div style={{ ...S.card, ...(msg.error ? S.warn : {}) }}>{msg.text}</div>}
      <div style={S.tabs}>
        {[['subs', 'Subscriptions'], ['waste', 'Waste report'], ['renew', 'Renewals'], ['inv', 'Invoices']].map(([k, l]) =>
          <button key={k} style={S.tab(tab === k)} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'subs' && <Subscriptions notify={notify} />}
      {tab === 'waste' && <Waste />}
      {tab === 'renew' && <Renewals notify={notify} />}
      {tab === 'inv' && <Invoices notify={notify} />}
    </div>
  );
}

function Subscriptions({ notify }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [lookup, setLookup] = useState({ employees: [], vendors: [], departments: [] });
  const [sel, setSel] = useState(null);
  const [seats, setSeats] = useState([]);
  const [emp, setEmp] = useState('');
  const [vendor, setVendor] = useState({ name: '', website: '', contact_email: '' });
  const blank = { vendor_id: '', department_id: '', product_name: '', plan: '', cost_per_seat: '', billing_cycle: 'monthly', seats_total: '', renewal_date: '' };
  const [sub, setSub] = useState(blank);

  const load = useCallback(() => api(`/api/software/subscriptions?q=${encodeURIComponent(q)}`).then(setRows).catch((e) => notify(e.message, true)), [q, notify]);
  const loadLookup = () => api('/api/software/lookup').then(setLookup).catch((e) => notify(e.message, true));
  const loadSeats = (id) => api(`/api/software/subscriptions/${id}`).then((d) => setSeats(d.seats)).catch((e) => notify(e.message, true));
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadLookup(); }, []);

  const act = async (fn, okText) => { try { await fn(); notify(okText); await load(); if (sel) loadSeats(sel.subscription_id); } catch (e) { notify(e.message, true); } };
  const choose = (r) => { setSel(r); loadSeats(r.subscription_id); };
  const set = (k) => (e) => setSub({ ...sub, [k]: e.target.value });

  return (
    <>
      <div style={S.row}>
        <input style={S.input} placeholder="Search product, plan or vendor" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Table rows={rows} cols={[
        { h: 'Product', r: (r) => <a href="#" onClick={(e) => { e.preventDefault(); choose(r); }}>{r.product_name}</a> },
        { h: 'Vendor', r: (r) => r.vendor_name }, { h: 'Department', r: (r) => r.department_name },
        { h: 'Seats', r: (r) => `${r.seats_used}/${r.seats_total}` },
        { h: 'Cost/seat', r: (r) => `${money(r.cost_per_seat)} ${r.billing_cycle}` },
        { h: 'Renews', r: (r) => fmt(r.renewal_date) }, { h: 'Status', r: (r) => r.status },
      ]} />
      {sel && (
        <div style={S.card}>
          <h3>{sel.product_name}: seats</h3>
          <div style={S.row}>
            <select style={S.input} value={emp} onChange={(e) => setEmp(e.target.value)}>
              <option value="">Select employee</option>
              {lookup.employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>)}
            </select>
            <button style={S.btn} disabled={!emp} onClick={() => act(() => api('/api/software/seats', { method: 'POST', body: JSON.stringify({ subscription_id: sel.subscription_id, employee_id: Number(emp) }) }), 'Seat assigned')}>Assign seat</button>
          </div>
          <Table rows={seats} empty="No active seats" cols={[
            { h: 'Employee', r: (s) => s.full_name }, { h: 'Assigned', r: (s) => fmt(s.assigned_at) },
            { h: '', r: (s) => <button style={S.btn} onClick={() => act(() => api(`/api/software/seats?id=${s.seat_assignment_id}`, { method: 'DELETE' }), 'Seat revoked')}>Revoke</button> },
          ]} />
        </div>
      )}
      <div style={S.card}>
        <h3>Add vendor</h3>
        <div style={S.row}>
          {['name', 'website', 'contact_email'].map((k) => <input key={k} style={S.input} placeholder={k} value={vendor[k]} onChange={(e) => setVendor({ ...vendor, [k]: e.target.value })} />)}
          <button style={S.btn} onClick={() => act(async () => { await api('/api/software/vendors', { method: 'POST', body: JSON.stringify(vendor) }); setVendor({ name: '', website: '', contact_email: '' }); loadLookup(); }, 'Vendor added')}>Add</button>
        </div>
      </div>
      <div style={S.card}>
        <h3>Add subscription</h3>
        <div style={S.row}>
          <select style={S.input} value={sub.vendor_id} onChange={set('vendor_id')}><option value="">Vendor</option>{lookup.vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>)}</select>
          <select style={S.input} value={sub.department_id} onChange={set('department_id')}><option value="">Department</option>{lookup.departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}</select>
          <input style={S.input} placeholder="Product" value={sub.product_name} onChange={set('product_name')} />
          <input style={S.input} placeholder="Plan" value={sub.plan} onChange={set('plan')} />
          <input style={S.input} type="number" min="0" step="0.01" placeholder="Cost/seat" value={sub.cost_per_seat} onChange={set('cost_per_seat')} />
          <select style={S.input} value={sub.billing_cycle} onChange={set('billing_cycle')}><option>monthly</option><option>annual</option></select>
          <input style={S.input} type="number" min="1" placeholder="Seats" value={sub.seats_total} onChange={set('seats_total')} />
          <input style={S.input} type="date" value={sub.renewal_date} onChange={set('renewal_date')} />
          <button style={S.btn} onClick={() => act(async () => { await api('/api/software/subscriptions', { method: 'POST', body: JSON.stringify(sub) }); setSub(blank); }, 'Subscription added')}>Add</button>
        </div>
      </div>
    </>
  );
}

function Waste() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/software/reports/waste').then(setD).catch((e) => setErr(e.message)); }, []);
  if (err) return <p style={S.warn}>{err}</p>;
  if (!d) return <p>Loading…</p>;
  return (
    <>
      <div style={S.card}>
        <b>Spend per billing cycle:</b> {money(d.totals.spend)} &nbsp; <b>Wasted on unused seats:</b> <span style={S.warn}>{money(d.totals.wasted)}</span>
      </div>
      <h3>Waste by department</h3>
      <Table rows={d.byDepartment} cols={[
        { h: 'Department', r: (r) => r.department }, { h: 'Subscriptions', r: (r) => r.subscriptions },
        { h: 'Unused seats', r: (r) => r.unused_seats }, { h: 'Wasted', r: (r) => money(r.wasted) }]} />
      <h3>Below-average utilization</h3>
      <Table rows={d.underused} cols={[
        { h: 'Product', r: (r) => r.product_name }, { h: 'Vendor', r: (r) => r.vendor_name },
        { h: 'Used', r: (r) => `${r.seats_used}/${r.seats_total}` }, { h: 'Wasted', r: (r) => `${money(r.wasted_per_cycle)} / ${r.billing_cycle}` }]} />
      <h3>Seats held by departed employees</h3>
      <Table rows={d.departedSeats} empty="None. Nothing leaking." cols={[
        { h: 'Employee', r: (r) => `${r.full_name} (${r.employee_status})` }, { h: 'Product', r: (r) => r.product_name },
        { h: 'Cost', r: (r) => `${money(r.cost_per_seat)} / ${r.billing_cycle}` }]} />
    </>
  );
}

function Renewals({ notify }) {
  const [days, setDays] = useState(30);
  const [d, setD] = useState({ upcoming: [], history: [] });
  const load = useCallback(() => api(`/api/software/renewals?days=${days}`).then(setD).catch((e) => notify(e.message, true)), [days, notify]);
  useEffect(() => { load(); }, [load]);
  const renew = async (r) => {
    const new_renewal_date = window.prompt('New renewal date (YYYY-MM-DD)', '');
    if (!new_renewal_date) return;
    const amount_paid = window.prompt('Amount paid', String(r.cost_per_cycle));
    if (amount_paid === null) return;
    try { await api('/api/software/renewals', { method: 'POST', body: JSON.stringify({ subscription_id: r.subscription_id, new_renewal_date, amount_paid }) }); notify('Renewal recorded'); load(); }
    catch (e) { notify(e.message, true); }
  };
  return (
    <>
      <div style={S.row}>Renewing within
        <select style={S.input} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[7, 30, 60, 90].map((n) => <option key={n} value={n}>{n} days</option>)}</select>
      </div>
      <Table rows={d.upcoming} empty="Nothing renews in this window" cols={[
        { h: 'Product', r: (r) => r.product_name }, { h: 'Vendor', r: (r) => r.vendor_name },
        { h: 'Renews', r: (r) => fmt(r.renewal_date) }, { h: 'In', r: (r) => <span style={r.days_until <= 7 ? S.warn : undefined}>{r.days_until} days</span> },
        { h: 'Cycle cost', r: (r) => money(r.cost_per_cycle) }, { h: 'Unused seats', r: (r) => r.seats_unused },
        { h: '', r: (r) => <button style={S.btn} onClick={() => renew(r)}>Record renewal</button> }]} />
      <h3>Recent renewals</h3>
      <Table rows={d.history} cols={[
        { h: 'Product', r: (r) => r.product_name }, { h: 'Renewed on', r: (r) => fmt(r.renewal_date) },
        { h: 'Amount', r: (r) => money(r.amount) }, { h: 'Status', r: (r) => r.status }]} />
    </>
  );
}

function Invoices({ notify }) {
  const [rows, setRows] = useState([]);
  const [subs, setSubs] = useState([]);
  const [f, setF] = useState({ subscription_id: '', invoice_date: '', total: '', invoice_number: '', raw_payload: null });
  const load = useCallback(() => api('/api/software/invoices/analytics').then(setRows).catch((e) => notify(e.message, true)), [notify]);
  useEffect(() => { load(); api('/api/software/subscriptions').then(setSubs).catch(() => {}); }, [load]);
  const max = Math.max(1, ...rows.map((r) => r.total));
  const readFile = (file) => { if (!file) return; const rd = new FileReader(); rd.onload = () => { try { setF((p) => ({ ...p, raw_payload: JSON.parse(rd.result) })); } catch { notify('File is not valid JSON', true); } }; rd.readAsText(file); };
  const submit = async () => {
    try { await api('/api/software/invoices', { method: 'POST', body: JSON.stringify({ ...f, subscription_id: Number(f.subscription_id) }) }); notify('Invoice stored in MongoDB'); load(); }
    catch (e) { notify(e.message, true); }
  };
  return (
    <>
      <div style={S.card}>
        <h3>Upload invoice</h3>
        <div style={S.row}>
          <select style={S.input} value={f.subscription_id} onChange={(e) => setF({ ...f, subscription_id: e.target.value })}>
            <option value="">Subscription</option>{subs.map((s) => <option key={s.subscription_id} value={s.subscription_id}>{s.vendor_name}: {s.product_name}</option>)}
          </select>
          <input style={S.input} type="date" value={f.invoice_date} onChange={(e) => setF({ ...f, invoice_date: e.target.value })} />
          <input style={S.input} type="number" min="0" step="0.01" placeholder="Total" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} />
          <input style={S.input} placeholder="Invoice #" value={f.invoice_number} onChange={(e) => setF({ ...f, invoice_number: e.target.value })} />
          <input type="file" accept=".json,application/json" onChange={(e) => readFile(e.target.files[0])} />
          <button style={S.btn} onClick={submit}>Upload</button>
        </div>
        <small>The optional JSON file is stored untouched as raw_payload, so each vendor can use its own format.</small>
      </div>
      <h3>Monthly spend per vendor</h3>
      <Table rows={rows} empty="No invoices yet" cols={[
        { h: 'Vendor', r: (r) => r.vendor_name }, { h: 'Month', r: (r) => r.month },
        { h: 'Total', r: (r) => <><div style={{ display: 'inline-block', height: 10, width: `${(r.total / max) * 160}px`, background: r.anomaly ? '#dc2626' : '#2563eb', marginRight: 8 }} />{money(r.total)}</> },
        { h: 'Vendor avg', r: (r) => money(r.avg) }, { h: '', r: (r) => r.anomaly && <span style={S.warn}>Anomaly</span> }]} />
    </>
  );
}
