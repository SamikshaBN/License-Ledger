'use client';
import { useState } from 'react';
import { api, errText, useLoad, useMe } from '@/lib/client';
import { money } from '@/lib/money';

export default function DepartmentsPage() {
  const me = useMe();
  const isAdmin = me?.role === 'admin';
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, error, reload } = useLoad(`/api/people/budgets?year=${year}`);
  const [deptName, setDeptName] = useState('');
  const [edit, setEdit] = useState(null); // { department_id, hardware_budget, software_budget }
  const [msg, setMsg] = useState(null);

  async function run(fn, okText) {
    try { await fn(); setMsg({ ok: true, text: okText }); reload(); } catch (e) { setMsg({ ok: false, text: errText(e) }); }
  }

  return (
    <>
      <h1>Departments & budgets</h1>
      {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      {error && <div className="msg err">{error}</div>}
      <div className="row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <label>Fiscal year <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 90 }} /></label>
      </div>
      {isAdmin && (
        <div className="card">
          <form className="row" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/api/people/departments', { method: 'POST', body: { name: deptName } }); setDeptName(''); }, 'Department added'); }}>
            <input placeholder="New department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            <button className="btn">Add department</button>
          </form>
        </div>
      )}
      <table>
        <thead><tr><th>Department</th><th>Hardware budget</th><th>Software budget</th><th>Hardware in use (value)</th>{isAdmin && <th></th>}</tr></thead>
        <tbody>
          {data?.budgets.map((b) => {
            const editing = edit?.department_id === b.department_id;
            return (
              <tr key={b.department_id}>
                <td>{b.department}</td>
                <td>{editing ? <input type="number" value={edit.hardware_budget} onChange={(e) => setEdit({ ...edit, hardware_budget: e.target.value })} /> : (b.hardware_budget ?? 'not set')}</td>
                <td>{editing ? <input type="number" value={edit.software_budget} onChange={(e) => setEdit({ ...edit, software_budget: e.target.value })} /> : (b.software_budget ?? 'not set')}</td>
                <td>{Number(b.hardware_value).toLocaleString()}</td>
                {isAdmin && (
                  <td>
                    {editing ? (
                      <>
                        <button className="btn" onClick={() => run(async () => { await api('/api/people/budgets', { method: 'POST', body: { ...edit, fiscal_year: year } }); setEdit(null); }, 'Budget saved')}>Save</button>{' '}
                        <button className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="btn ghost" onClick={() => setEdit({ department_id: b.department_id, hardware_budget: b.hardware_budget ?? 0, software_budget: b.software_budget ?? 0 })}>Edit</button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
