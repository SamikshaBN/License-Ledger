'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useMe } from '@/lib/client';

// Role-based UI hiding: each link lists the roles that may see it.
const LINKS = [
  { href: '/dashboard', label: 'Overview', roles: ['admin', 'it_staff'] },
  { href: '/dashboard/employees', label: 'Employees', roles: ['admin', 'it_staff'] },
  { href: '/dashboard/departments', label: 'Departments & budgets', roles: ['admin', 'it_staff'] },
  { href: '/dashboard/hardware', label: 'Hardware', roles: ['admin', 'it_staff'] },
  { href: '/dashboard/offboarding', label: 'Offboarding', roles: ['admin', 'it_staff'] },
  { href: '/dashboard/software', label: 'Software & spend', roles: ['admin', 'it_staff'] },
  { href: '/dashboard/audit', label: 'Audit log', roles: ['admin'] },
  { href: '/dashboard/users', label: 'Users', roles: ['admin'] },
  { href: '/dashboard/my', label: 'My assets', roles: ['admin', 'it_staff', 'employee'] },
  { href: '/dashboard/my/software', label: 'My software', roles: ['admin', 'it_staff', 'employee'] },
];

export default function Nav() {
  const me = useMe();
  const router = useRouter();
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }
  return (
    <nav className="nav">
      <h2>LicenseLedger</h2>
      {me && LINKS.filter((l) => l.roles.includes(me.role)).map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
      <button onClick={logout}>Log out</button>
      {me && <div className="who">{me.username} ({me.role})</div>}
    </nav>
  );
}
