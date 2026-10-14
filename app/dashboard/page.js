'use client';
import { useLoad } from '@/lib/client';
import SoftwareOverview from './software/SoftwareOverview';

export default function Overview() {
  const { data, error } = useLoad('/api/people/summary');
  if (error) return <div className="msg err">{error}</div>;
  if (!data) return <p>Loading...</p>;
  return (
    <>
      <h1>Overview</h1>
      <div className="grid">
        <div className="card stat"><b>{data.employees.active}</b>Active employees</div>
        <div className="card stat"><b>{data.employees.offboarded}</b>Offboarded</div>
        {data.hardware.map((h) => (
          <div className="card stat" key={h.status}><b>{h.n}</b>Hardware: {h.status}</div>
        ))}
      </div>
      <h2>Hardware in use by department</h2>
      <table>
        <thead><tr><th>Department</th><th>Assets in use</th><th>Hardware value</th></tr></thead>
        <tbody>
          {data.departments.map((d) => (
            <tr key={d.department_id}><td>{d.department}</td><td>{d.assets_in_use}</td><td>{Number(d.hardware_value).toLocaleString()}</td></tr>
          ))}
        </tbody>
      </table>
      <SoftwareOverview />
    </>
  );
}
