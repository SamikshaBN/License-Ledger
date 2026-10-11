'use client';
import { useState } from 'react';
import { api, errText, useLoad, useMe } from '@/lib/client';

const EMPTY = { asset_tag: '', type: 'laptop', make_model: '', serial_number: '', purchase_date: '', purchase_cost: '' };

export default function HardwarePage() {
  const me = useMe();
  const isAdmin = me?.role === 'admin';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const { data, error, reload } = useLoad(`/api/people/hardware?q=${encodeURIComponent(q)}&status=${status}`);
  const emps = useLoad('/api/people/employees?status=active');
  const [form, setForm] = useState(EMPTY);
  const [assigning, setAssigning] = useState(null); // asset row
  const [empId, setEmpId] = useState('');
  const [msg, setMsg] = useState(null);

  async function run(fn, okText) {
    try { await fn(); setMsg({ ok: true, text: okText }); reload(); } catch (e) { setMsg({ ok: false, text: errText(e) }); }
  }

  return (
    <>
      <h1>Hardware inventory</h1>
      {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      {error && <div className="msg err">{error}</div>}
      <div className="card">
        <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/people/hardware', { method: 'POST', body: form }); setForm(EMPTY); }, 'Asset added'); }}>
          <input placeholder="Asset tag" value={form.asset_tag} onChange={(e) => setForm({ ...form, asset_tag: e.target.value })} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {['laptop', 'monitor', 'phone', 'tablet', 'peripheral', 'other'].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Make / model" value={form.make_model} onChange={(e) => setForm({ ...form, make_model: e.target.value })} />
          <input placeholder="Serial number" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
          <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
          <input type="number" placeholder="Cost" value={form.purchase_cost} onChange={(e) => setForm({ ...form, purchase_cost: e.target.value })} style={{ width: 100 }} />
          <button className="btn">Add asset</button>
        </form>
      </div>
      {assigning && (
        <div className="card">
          <b>Assign {assigning.asset_tag} ({assigning.make_model}) to:</b>{' '}
          <select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Choose employee...</option>
            {emps.data?.employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>)}
          </select>{' '}
          <button className="btn" disabled={!empId} onClick={() => run(async () => { await api('/api/people/assignments', { method: 'POST', body: { asset_id: assigning.asset_id, employee_id: empId } }); setAssigning(null); setEmpId(''); }, 'Asset assigned')}>Confirm</button>{' '}
          <button className="btn ghost" onClick={() => setAssigning(null)}>Cancel</button>
        </div>
      )}
      <div className="row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="Search tag, model, serial, person" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['available', 'assigned', 'repair', 'retired'].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <table>
        <thead><tr><th>Tag</th><th>Type</th><th>Model</th><th>Serial</th><th>Status</th><th>Assigned to</th><th>Actions</th></tr></thead>
        <tbody>
          {data?.assets.map((a) => (
            <tr key={a.asset_id}>
              <td>{a.asset_tag}</td><td>{a.type}</td><td>{a.make_model}</td><td>{a.serial_number}</td>
              <td><span className={`badge ${a.status}`}>{a.status}</span></td><td>{a.assigned_to}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {a.status === 'available' && <button className="btn ghost" onClick={() => setAssigning(a)}>Assign</button>}
                {a.status === 'assigned' && (
                  <>
                    <button className="btn ghost" onClick={() => run(() => api(`/api/people/assignments/${a.assignment_id}/return`, { method: 'POST', body: { condition: 'ok' } }), 'Returned')}>Return</button>{' '}
                    <button className="btn ghost" onClick={() => run(() => api(`/api/people/assignments/${a.assignment_id}/return`, { method: 'POST', body: { condition: 'repair' } }), 'Returned for repair')}>Return (damaged)</button>
                  </>
                )}
                {a.status === 'repair' && <button className="btn ghost" onClick={() => run(() => api(`/api/people/hardware/${a.asset_id}`, { method: 'PATCH', body: { status: 'available' } }), 'Marked available')}>Repaired</button>}
                {isAdmin && (a.status === 'available' || a.status === 'repair') && (
                  <button className="btn danger" onClick={() => confirm(`Retire ${a.asset_tag}? This cannot be undone.`) && run(() => api(`/api/people/hardware/${a.asset_id}`, { method: 'PATCH', body: { status: 'retired' } }), 'Retired')}>Retire</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
