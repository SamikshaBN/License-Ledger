'use client';
import { useState } from 'react';
import { api, errText, useLoad } from '@/lib/client';

const EMPTY = { employee_id: '', username: '', password: '', role: 'it_staff' };

export default function UsersPage() {
  const { data, error, reload } = useLoad('/api/people/users');
  const emps = useLoad('/api/people/employees?status=active');
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);

  async function add(e) {
    e.preventDefault();
    try {
      await api('/api/people/users', { method: 'POST', body: form });
      setForm(EMPTY); setMsg({ ok: true, text: 'Login created' }); reload();
    } catch (err) { setMsg({ ok: false, text: errText(err) }); }
  }
  return (
    <>
      <h1>Users</h1>
      <div className="card">
        <form className="row" onSubmit={add}>
          <select value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
            <option value="">Employee...</option>
            {emps.data?.employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>)}
          </select>
          <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input type="password" placeholder="Password (min 8)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="admin">admin</option><option value="it_staff">it_staff</option><option value="employee">employee</option>
          </select>
          <button className="btn">Create login</button>
        </form>
        {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      </div>
      {error && <div className="msg err">{error}</div>}
      <table>
        <thead><tr><th>Username</th><th>Employee</th><th>Role</th><th>Active</th><th>Last login</th></tr></thead>
        <tbody>
          {data?.users.map((u) => (
            <tr key={u.user_id}><td>{u.username}</td><td>{u.full_name}</td><td>{u.role}</td><td>{u.is_active ? 'yes' : 'no'}</td><td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : ''}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
