'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, errText } from '@/lib/client';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
            const { user } = await api('/api/auth/login', { method: 'POST', body: form });
            router.push(user.role === 'employee' ? '/dashboard/my' : '/dashboard');
    } catch (err) {
      setError(errText(err));
    } finally { setBusy(false); }
  }
  return (
    <div className="login card">
      <h1>LicenseLedger</h1>
      <form onSubmit={submit}>
        <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoFocus />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
      {error && <div className="msg err">{error}</div>}
    </div>
  );
}
