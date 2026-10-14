'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  const pathname = usePathname();

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const visible = me ? LINKS.filter((l) => l.roles.includes(me.role)) : [];
  // the longest matching link wins, so /dashboard/my/software does not also light up /dashboard/my
  const current = visible
    .filter((l) => pathname === l.href || (l.href !== '/dashboard' && pathname.startsWith(l.href + '/')))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="nav">
      <div className="brand">LicenseLedger</div>
      {visible.map((l) => (
        <Link key={l.href} href={l.href} className={l.href === current ? 'active' : ''}>{l.label}</Link>
      ))}
      <div className="spacer" />
      <button onClick={logout}>Log out</button>
      {me && <div className="who">{me.username} · {me.role}</div>}
    </nav>
  );
}
