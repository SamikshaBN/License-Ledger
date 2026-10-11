'use client';
import { useState } from 'react';
import { api, errText, useLoad } from '@/lib/client';

const EMPTY = { full_name: '', email: '', department_id: '', job_title: '' };

export default function EmployeesPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const { data, error, reload } = useLoad(`/api/people/employees?q=${encodeURIComponent(q)}&status=${status}`);
  const depts = useLoad('/api/people/departments');
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);

  async function add(e) {
    e.preventDefault();
    try {
      await api('/api/people/employees', { method: 'POST', body: form });
      setForm(EMPTY); setMsg({ ok: true, text: 'Employee added' }); reload();
    } catch (err) { setMsg({ ok: false, text: errText(err) }); }
  }

  return (
    <>
      <h1>Employees</h1>
      <div className="card">
        <form className="row" onSubmit={add}>
          <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">Department...</option>
            {depts.data?.departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
          </select>
          <input placeholder="Job title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
          <button className="btn">Add employee</button>
        </form>
        {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      </div>
      <div className="row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Active</option><option value="offboarded">Offboarded</option><option value="all">All</option>
        </select>
      </div>
      {error && <div className="msg err">{error}</div>}
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Department</th><th>Title</th><th>Status</th><th>Hardware</th><th>Seats</th></tr></thead>
        <tbody>
          {data?.employees.map((e) => (
            <tr key={e.employee_id}>
              <td>{e.full_name}</td><td>{e.email}</td><td>{e.department_name}</td><td>{e.job_title}</td>
              <td><span className={`badge ${e.status}`}>{e.status}</span></td><td>{e.open_assets}</td><td>{e.open_seats}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
