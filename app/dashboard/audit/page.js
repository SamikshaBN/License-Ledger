'use client';
import { useState } from 'react';
import { useLoad } from '@/lib/client';

const TABLES = ['employee', 'hardware_asset', 'asset_assignment', 'department_budget', 'app_user', 'seat_assignment'];

export default function AuditPage() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, error } = useLoad(`/api/people/audit?table=${table}&action=${action}&page=${page}&limit=25`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <>
      <h1>Audit log</h1>
      <div className="row" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select value={table} onChange={(e) => { setTable(e.target.value); setPage(1); }}>
          <option value="">All tables</option>{TABLES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>{['INSERT', 'UPDATE', 'DELETE'].map((a) => <option key={a}>{a}</option>)}
        </select>
      </div>
      {error && <div className="msg err">{error}</div>}
      <table>
        <thead><tr><th>#</th><th>When</th><th>Who</th><th>Table</th><th>Record</th><th>Action</th><th>Change</th></tr></thead>
        <tbody>
          {data?.logs.map((l) => (
            <tr key={l.log_id}>
              <td>{l.log_id}</td><td>{new Date(l.changed_at).toLocaleString()}</td><td>{l.changed_by ?? 'system'}</td>
              <td>{l.table_name}</td><td>{l.record_id}</td><td>{l.action}</td>
              <td><details><summary>view</summary><pre>{JSON.stringify({ old: l.old_data, new: l.new_data }, null, 1)}</pre></details></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>{' '}
        Page {page} of {pages} ({data?.total ?? 0} entries){' '}
        <button className="btn ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </p>
    </>
  );
}
