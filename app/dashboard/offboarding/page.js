'use client';
import { useState } from 'react';
import { api, errText, useLoad, useMe } from '@/lib/client';

export default function OffboardingPage() {
  const me = useMe();
  const emps = useLoad('/api/people/employees?status=active');
  const [empId, setEmpId] = useState('');
  const preview = useLoad(empId ? `/api/people/offboard/${empId}` : '/api/auth/me');
  const [confirmed, setConfirmed] = useState(false);
  const [simulate, setSimulate] = useState(false);
  const [msg, setMsg] = useState(null);
  const p = empId ? preview.data : null;

  async function offboard() {
    setMsg(null);
    try {
      const { result } = await api(`/api/people/offboard/${empId}`, { method: 'POST', body: { simulateFailure: simulate } });
      setMsg({ ok: true, text: `${result.full_name} offboarded: ${result.assets_returned} hardware item(s) returned, ${result.seats_released} software seat(s) released.` });
      setEmpId(''); setConfirmed(false); emps.reload();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
      preview.reload(); // proves nothing changed after a rollback
    }
  }

  return (
    <>
      <h1>Offboarding</h1>
      <div className="card">
        <select value={empId} onChange={(e) => { setEmpId(e.target.value); setConfirmed(false); setMsg(null); }}>
          <option value="">Choose employee to offboard...</option>
          {emps.data?.employees.map((e) => <option key={e.employee_id} value={e.employee_id}>{e.full_name} ({e.department_name})</option>)}
        </select>
      </div>
      {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      {p?.employee && (
        <div className="card">
          <h3>{p.employee.full_name}</h3>
          <b>Hardware to be returned ({p.assets.length})</b>
          <ul>{p.assets.map((a) => <li key={a.asset_id}>{a.asset_tag}: {a.make_model}</li>)}</ul>
          <b>Software seats to be freed ({p.seats.length})</b>
          <ul>{p.seats.map((s) => <li key={s.seat_id}>{s.subscription}</li>)}</ul>
          <label><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I confirm this employee has left the company</label>
          <p><button className="btn danger" disabled={!confirmed} onClick={offboard}>Offboard now</button></p>
        </div>
      )}
    </>
  );
}
