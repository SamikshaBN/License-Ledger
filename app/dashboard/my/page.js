'use client';
import { useLoad } from '@/lib/client';

export default function MyPage() {
  const { data, error } = useLoad('/api/people/me');
  if (error) return <div className="msg err">{error}</div>;
  if (!data) return <p>Loading...</p>;
  const { employee: e, assets, seats } = data;
  return (
    <>
      <h1>My assets</h1>
      <div className="card">
        <b>{e.full_name}</b> · {e.job_title} · {e.department_name}<br />{e.email}
      </div>
      <h2>Hardware ({assets.length})</h2>
      <table>
        <thead><tr><th>Tag</th><th>Type</th><th>Model</th><th>Serial</th><th>Since</th></tr></thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.asset_id}><td>{a.asset_tag}</td><td>{a.type}</td><td>{a.make_model}</td><td>{a.serial_number}</td><td>{new Date(a.assigned_at).toLocaleDateString()}</td></tr>
          ))}
          {!assets.length && <tr><td colSpan="5">No hardware assigned</td></tr>}
        </tbody>
      </table>
      <h2>Software seats ({seats.length})</h2>
      <table>
        <thead><tr><th>Subscription</th><th>Since</th></tr></thead>
        <tbody>
          {seats.map((s) => <tr key={s.seat_id}><td>{s.subscription}</td><td>{new Date(s.assigned_at).toLocaleDateString()}</td></tr>)}
          {!seats.length && <tr><td colSpan="2">No seats assigned</td></tr>}
        </tbody>
      </table>
    </>
  );
}