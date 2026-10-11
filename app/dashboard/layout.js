import Nav from '@/components/Nav';

export default function DashboardLayout({ children }) {
  return (
    <div className="shell">
      <Nav />
      <main>{children}</main>
    </div>
  );
}
